import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { serviceClient } from "./lib/supabaseService";
import { requireAuth } from "./middleware/requireAuth";
import { requireStaffAuth } from "./middleware/requireStaffAuth";
import twilio from "twilio";

// Augment express-session to include Google Fit token fields
declare module "express-session" {
  interface SessionData {
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: number; // unix ms
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function safeJsonParse(text: string): unknown | null {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

const summarizeInputSchema = z.object({
  conversation: z.string().min(1).max(15000),
});

const analyzeInputSchema = z.object({
  transcription: z.string().min(1).max(15000),
  patient_id: z.string().uuid().optional(),
  clinic_id: z.string().uuid().optional(),
  staff_name: z.string().max(50).optional(),
  // structured transcripts from Whisper stereo split
  structured_transcripts: z.object({
    pre: z.object({ teacher: z.string(), patient: z.string() }).optional(),
    post: z.object({ teacher: z.string(), patient: z.string() }).optional(),
  }).optional(),
  // legacy fields kept for backward compat with existing frontend
  conversation: z.string().optional(),
  healthData: z.string().optional().default(""),
  previousHistory: z.string().optional().default(""),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    desc: z.string(),
  })).optional().default([]),
});

const correlateInputSchema = z.object({
  historyText: z.string().min(1).max(20000),
  todayData: z.string().optional().default(""),
});

const summaryResponseSchema = z.object({
  chief_complaint: z.string().optional().default(""),
  key_symptoms: z.array(z.string()).optional().default([]),
  lifestyle_issues: z.array(z.string()).optional().default([]),
  treatment_done: z.string().optional().default(""),
  home_care: z.array(z.string()).optional().default([]),
  follow_up: z.string().optional().default(""),
});

const karteResponseSchema = z.object({
  chief_complaint: z.string().optional().default(""),
  subjective: z.string().optional().default(""),
  objective: z.string().optional().default(""),
  assessment: z.string().optional().default(""),
  plan: z.string().optional().default(""),
  treatment_summary: z.string().optional().default(""),
  advice_5axis: z.object({
    exercise: z.string().optional().default(""),
    sleep: z.string().optional().default(""),
    nutrition: z.string().optional().default(""),
    lifestyle: z.string().optional().default(""),
    mental: z.string().optional().default(""),
  }).optional().default({}),
  next_visit_note: z.string().optional().default(""),
  lifestyle_advice: z.array(z.string()).optional().default([]),
  recommended_products: z.array(z.string()).optional().default([]),
  follow_up: z.string().optional().default(""),
  risk_flags: z.array(z.string()).optional().default([]),
});

const correlationResponseSchema = z.object({
  summary: z.string().optional().default(""),
  correlations: z.array(z.object({
    title: z.string(),
    finding: z.string(),
    strength: z.string(),
    data_evidence: z.string(),
  })).optional().default([]),
  risk_areas: z.array(z.object({
    area: z.string(),
    risk_level: z.string(),
    reason: z.string(),
  })).optional().default([]),
  lifestyle_triggers: z.array(z.object({
    trigger: z.string(),
    impact: z.string(),
  })).optional().default([]),
  improvement_trend: z.object({
    score: z.number(),
    direction: z.string(),
    comment: z.string(),
  }).optional(),
  next_session_focus: z.array(z.string()).optional().default([]),
  prediction: z.string().optional().default(""),
});

const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < 60000);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

async function getOrCreateDemoClinicAndPatient(): Promise<{ clinic_id: string; patient_id: string }> {
  const supabase = serviceClient;

  const DEMO_CLINIC_NAME = "VLUXデモクリニック";
  const DEMO_PATIENT_KANA = "タナカ ダイスケ";

  let clinic_id: string;
  const { data: existingClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("name", DEMO_CLINIC_NAME)
    .limit(1);

  if (existingClinics && existingClinics.length > 0) {
    clinic_id = existingClinics[0].id;
  } else {
    const { data: newClinic, error } = await supabase
      .from("clinics")
      .insert({ name: DEMO_CLINIC_NAME, address: "", phone: "", plan: "phase1", is_active: true })
      .select("id")
      .single();
    if (error || !newClinic) throw new Error("クリニック作成失敗: " + error?.message);
    clinic_id = newClinic.id;
  }

  let patient_id: string;
  const { data: existingPatients } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic_id)
    .eq("name_kana", DEMO_PATIENT_KANA)
    .limit(1);

  if (existingPatients && existingPatients.length > 0) {
    patient_id = existingPatients[0].id;
  } else {
    const { data: newPatient, error } = await supabase
      .from("patients")
      .insert({
        clinic_id,
        name_kana: DEMO_PATIENT_KANA,
        phone: "",
        member_grade: "bronze",
        gender: "男性",
        birth_date: "1983-05-14",
      })
      .select("id")
      .single();
    if (error || !newPatient) throw new Error("患者作成失敗: " + error?.message);
    patient_id = newPatient.id;
  }

  return { clinic_id, patient_id };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Ensure audio-recordings bucket exists
  (async () => {
    try {
      const admin = serviceClient;
      const { data: buckets } = await admin.storage.listBuckets();
      const exists = buckets?.some(b => b.name === "audio-recordings");
      if (!exists) {
        await admin.storage.createBucket("audio-recordings", { public: false });
        console.log("[storage] audio-recordings bucket created");
      }
    } catch (e) {
      console.warn("[storage] bucket init error:", e);
    }
  })();

  // Audio upload endpoint (receives raw binary, uploads to Supabase Storage)
  app.post(
    "/api/audio/upload",
    (req, res, next) => {
      // collect raw body as Buffer
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        (req as any).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", next);
    },
    async (req, res) => {
      try {
        const phase = (req.headers["x-phase"] as string) || "pre";
        const clinicId = (req.headers["x-clinic-id"] as string) || "unknown";
        const patientId = (req.headers["x-patient-id"] as string) || "unknown";
        const timestamp = (req.headers["x-timestamp"] as string) || Date.now().toString();
        const contentType = req.headers["content-type"] || "audio/webm";
        const ext = contentType.includes("mp4") ? "mp4" : "webm";

        const filePath = `${clinicId}/${patientId}/${phase}_${timestamp}.${ext}`;
        const body = (req as any).rawBody as Buffer;

        if (!body || body.length === 0) {
          return res.status(400).json({ error: "Empty audio body" });
        }

        const admin = serviceClient;
        const { data, error } = await admin.storage
          .from("audio-recordings")
          .upload(filePath, body, { contentType, upsert: true });

        if (error) {
          console.error("[storage] upload error:", error.message);
          return res.status(500).json({ error: error.message });
        }

        const { data: urlData } = admin.storage
          .from("audio-recordings")
          .getPublicUrl(filePath);

        console.log("[storage] audio uploaded:", filePath, urlData?.publicUrl);
        res.json({ path: data.path, url: urlData?.publicUrl });
      } catch (e) {
        console.error("[storage] upload exception:", e);
        res.status(500).json({ error: String(e) });
      }
    }
  );

  // Whisper transcription endpoint
  app.post(
    "/api/transcribe",
    (req, res, next) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => { (req as any).rawBody = Buffer.concat(chunks); next(); });
      req.on("error", next);
    },
    async (req, res) => {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return res.status(500).json({ error: "APIキーを確認してください" });
      }
      const body = (req as any).rawBody as Buffer;
      if (!body || body.length === 0) {
        return res.status(400).json({ error: "録音が正常に取得できませんでした" });
      }
      const speaker = (req.headers["x-speaker"] as string) || "speaker";
      const contentType = req.headers["content-type"] || "audio/wav";
      const ext = contentType.includes("wav") ? "wav" : contentType.includes("mp4") ? "mp4" : "webm";
      try {
        const formData = new FormData();
        const audioBlob = new Blob([body], { type: contentType });
        formData.append("file", audioBlob, `${speaker}.${ext}`);
        formData.append("model", "whisper-1");
        formData.append("language", "ja");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "word");
        formData.append("prompt",
          "これは整骨院・接骨院での施術会話です。" +
          "九州・鹿児島・博多・長崎・久留米・北九州の方言が含まれます。" +

          "【筋肉名】" +
          "僧帽筋、胸鎖乳突筋、斜角筋、板状筋、頭半棘筋、" +
          "菱形筋、広背筋、脊柱起立筋、多裂筋、腸腰筋、大腰筋、腸骨筋、" +
          "大殿筋、中殿筋、小殿筋、梨状筋、大腿四頭筋、大腿二頭筋、" +
          "半腱様筋、半膜様筋、腓腹筋、ヒラメ筋、前脛骨筋、" +
          "大胸筋、小胸筋、前鋸筋、三角筋、回旋筋腱板、" +
          "棘上筋、棘下筋、小円筋、肩甲下筋、" +
          "上腕二頭筋、上腕三頭筋、腕橈骨筋、" +

          "【骨・関節・部位名】" +
          "頸椎、胸椎、腰椎、仙骨、尾骨、椎間板、椎間関節、" +
          "肩甲骨、鎖骨、胸骨、肋骨、骨盤、腸骨、恥骨、坐骨、" +
          "大腿骨、膝蓋骨、脛骨、腓骨、踵骨、距骨、" +
          "上腕骨、橈骨、尺骨、手根骨、" +
          "仙腸関節、股関節、膝関節、足関節、肩関節、肘関節、手関節、" +
          "脊柱管、椎孔、椎弓、棘突起、横突起、" +

          "【症状・疾患名】" +
          "坐骨神経痛、椎間板ヘルニア、脊柱管狭窄症、" +
          "頸椎症、頸椎椎間板ヘルニア、むち打ち、" +
          "五十肩、四十肩、腱板断裂、インピンジメント、" +
          "テニス肘、ゴルフ肘、手根管症候群、" +
          "変形性膝関節症、半月板損傷、靭帯損傷、" +
          "足底筋膜炎、アキレス腱炎、シンスプリント、" +
          "梨状筋症候群、トリガーポイント、筋膜炎、" +
          "自律神経失調、頭痛、眼精疲労、" +

          "【施術・治療用語】" +
          "整復、牽引、温熱療法、電気療法、超音波療法、" +
          "マッサージ、ストレッチ、テーピング、包帯、" +
          "可動域、ROM、筋緊張、圧痛点、" +
          "骨盤矯正、脊椎矯正、姿勢矯正、" +

          "【鍼灸ツボ名】" +
          "百会、風池、天柱、肩井、大椎、" +
          "合谷、内関、外関、曲池、手三里、" +
          "足三里、三陰交、太衝、湧泉、委中、" +
          "環跳、承山、陽陵泉、血海、" +
          "膏肓、天宗、小腸兪、膀胱兪、" +
          "腎兪、大腸兪、次髎、志室" +

          "【生活習慣・職業】" +
          "デスクワーク、テレワーク、リモートワーク、在宅勤務、" +
          "立ち仕事、重労働、肉体労働、夜勤、交代勤務、早番、遅番、" +
          "農作業、介護職、看護師、美容師、理容師、調理師、" +
          "ドライバー、トラック運転手、配達員、" +
          "育児、抱っこ、授乳、おんぶ、子育て、" +
          "スマホ、パソコン、タブレット、長時間作業、" +
          "運動不足、ウォーキング、ランニング、筋トレ、ゴルフ、" +
          "睡眠不足、ストレス、冷え性、むくみ、" +

          "【期間・頻度の表現】" +
          "昨日から、今朝から、先週から、先月から、" +
          "2〜3日前から、1週間ほど、2週間くらい、" +
          "1ヶ月前から、3ヶ月前から、半年くらい、1年以上、" +
          "ずっと前から、最近急に、突然、いつの間にか、" +
          "朝だけ、夜だけ、1日中、動いたとき、安静時、" +
          "週1回、週3回、毎日、たまに、頻繁に、" +

          "【痛みの程度・スケール】" +
          "10段階で、VASスケール、" +
          "少し痛い、中程度、かなり痛い、激痛、" +
          "我慢できる、我慢できない、" +
          "動けないほど、日常生活に支障、仕事に支障、" +

          "【感覚表現・擬音語・擬態語】" +
          "ズキズキ、ズーン、ジンジン、ビリビリ、ピリピリ、" +
          "ジワジワ、じわっと、チクチク、刺すような、" +
          "鈍い痛み、鋭い痛み、重だるい、張った感じ、" +
          "締め付けられる、引っ張られる、押される感じ、" +
          "抜けそうな感じ、力が入らない、脱力感、" +
          "こわばり、むくんだ感じ、熱感、冷感、" +
          "ガキッ、ボキッ、ミシッ、パキッ、" +
          "動くとズキッ、座ると楽、立つと痛い、" +
          "寝返りが痛い、起き上がりが痛い、歩くと痛い"
        );
        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: formData,
        });
        if (!whisperRes.ok) {
          const errText = await whisperRes.text();
          console.error("[whisper] error:", errText);
          if (whisperRes.status === 401) return res.status(500).json({ error: "APIキーを確認してください" });
          return res.status(500).json({ error: "文字起こしに失敗しました。再試行してください" });
        }
        const data = await whisperRes.json() as {
          text: string;
          words?: Array<{ word: string; start: number; end: number; probability: number }>;
        };
        console.log(`[whisper] ${speaker}: ${data.text.substring(0, 80)}...`);

        // Mark low-confidence words with [[?:word]] markers
        let resultText = data.text;
        if (data.words && data.words.length > 0) {
          const UNCLEAR_THRESHOLD = 0.5;
          let markedText = "";
          let unclearBuffer = "";
          for (const w of data.words) {
            if (w.probability < UNCLEAR_THRESHOLD) {
              unclearBuffer += w.word;
            } else {
              if (unclearBuffer) {
                markedText += `[[?:${unclearBuffer.trim()}]]`;
                unclearBuffer = "";
              }
              markedText += w.word;
            }
          }
          if (unclearBuffer) {
            markedText += `[[?:${unclearBuffer.trim()}]]`;
          }
          resultText = markedText;
        }

        res.json({ text: resultText });
      } catch (e) {
        console.error("[whisper] exception:", e);
        res.status(500).json({ error: "通信エラーが発生しました。再試行してください" });
      }
    }
  );

  app.post("/api/summarize", async (req, res) => {
    try {
      if (!checkRateLimit(req.ip || "unknown")) {
        return res.status(429).json({ error: true });
      }

      const parsed = summarizeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: true });
      }

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `整骨院会話の要点をJSONのみで出力（\`\`\`不要）:
{"chief_complaint":"主訴（部位＋動作＋症状で簡潔に）","key_symptoms":["臨床的な症状・部位・動作・身体的所見のみ。例:「腰部屈曲時の鈍痛」「右肩外旋制限」「L4-5圧痛」。生活習慣・職業・時期・感情・環境要因は絶対に含めない"],"lifestyle_issues":["生活習慣や職業・環境の問題点"],"treatment_done":"処置内容","home_care":["ホームケア指導"],"follow_up":"次回来院時の注意点"}
key_symptomsルール: 必ず「症状・部位・動作・身体的所見」に限定。デスクワーク・季節・ストレス・感情・職業名などは lifestyle_issues に入れること。`,
        messages: [{ role: "user", content: parsed.data.conversation }],
      });

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      const raw = safeJsonParse(text);
      if (!raw) return res.status(500).json({ error: true });

      const validated = summaryResponseSchema.safeParse(raw);
      if (!validated.success) return res.status(500).json({ error: true });

      res.json(validated.data);
    } catch (error) {
      console.error("Summarize error:", error);
      res.status(500).json({ error: true });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      if (!checkRateLimit(req.ip || "unknown")) {
        return res.status(429).json({ error: "リクエスト制限に達しました。しばらくお待ちください。" });
      }

      const parsed = analyzeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Analyze input validation error:", parsed.error.flatten());
        return res.status(400).json({ error: "入力データが不正です。", details: parsed.error.flatten() });
      }

      const transcription = parsed.data.transcription;
      const reqPatientId = parsed.data.patient_id;
      const reqClinicId = parsed.data.clinic_id;
      const reqStaffName = parsed.data.staff_name;
      const structuredTranscripts = parsed.data.structured_transcripts;

      // ── Step 1: Haiku — 会話 → 構造化JSON ──────────────────────────
      let haikuText = "";
      try {
        const preTeacher = structuredTranscripts?.pre?.teacher ?? "";
        const prePatient = structuredTranscripts?.pre?.patient ?? "";
        const postTeacher = structuredTranscripts?.post?.teacher ?? "";
        const postPatient = structuredTranscripts?.post?.patient ?? "";

        const dialectDict = `九州方言辞書 v0.3（鹿児島・博多・長崎・久留米・北九州 / 整骨院頻出表現）\n【痛み・しびれ】痛か→痛い（鹿児島）、わっぜ痛か→とても痛い（鹿児島）、いたかばい→痛いよ（久留米）、いたかとー→痛いよ（博多）、いたかっちゃん→痛いんだよ（北九州）、しびるっど→しびれる（鹿児島）、しびれとう→しびれている（博多・久留米）、しびれっぞ→しびれる（長崎）、うっとうしか→不快感がある（博多）\n【疲労・だるさ】だれた→疲れた（鹿児島）、わっぜだれた→すごく疲れた（鹿児島）、だるか→だるい（全域）、だるかばい→だるいよ（久留米・博多）、きつか→しんどい・つらい（全域）、きつかとー→しんどいよ（博多）、よれとう→疲れ果てている（博多・久留米）、へたっとう→力が抜けている（博多）、なおらん→治らない（長崎・北九州）\n【動きにくさ・こわばり】かて→硬い・動かしにくい（鹿児島）、わっぜかて→すごく硬い（鹿児島）、かたかばい→硬いよ（久留米）、かたかとー→硬いよ（博多）、まがらん→曲がらない（全域）、のびらん→伸びない（全域）、まわらん→回らない（全域）、あがらん→上がらない（全域）、ひっぱっとう→引っ張られている感じ（博多）\n【頻度・期間】ここんとこずっと→最近ずっと（鹿児島）、ずっとばい→ずっとだよ（久留米・博多）、まえからばい→前からだよ（久留米）、しばらくなっとう→しばらくなっている（博多）、なんちゃん→何日も・しばらく（久留米）、きのうからたい→昨日からだよ（北九州）\n【程度】わっぜ→とても・すごく（鹿児島）、ちっとばっかい→少し（鹿児島）、ちょっとばかし→少しだけ（全域）、ばりばり→とても・すごく（北九州・博多）、たいぎゃ→とても・大変（北九州・久留米）、がばい→すごく（長崎）、ぼちぼち→まあまあ（長崎・北九州）\n【場所・部位】ここらへん→この辺り（全域）、うしろっかわ→後ろ側（全域）、したっかわ→下側（全域）、くびんとこ→首のところ（博多・久留米）、こしんとこ→腰のところ（博多・久留米）\n【相槌・確認】そうたい→そうだよ（長崎・北九州）、そうばい→そうだよ（久留米・博多）、そうっちゃん→そうなんだよ（北九州）、ほんとばい→本当だよ（久留米）、ほんとたい→本当だよ（長崎）、やっぱそうか→やっぱりそうか（全域）、よかよか→いいよいいよ・大丈夫（全域）`;

        const haikuPrompt = structuredTranscripts
          ? `以下は整骨院での施術前後の会話テキストです。\n方言は標準語の意味に補完してください。\n\n${dialectDict}\n\n【施術前：先生】\n${preTeacher}\n\n【施術前：患者】\n${prePatient}\n\n【施術後：先生】\n${postTeacher}\n\n【施術後：患者】\n${postPatient}`
          : `以下は整骨院での施術会話テキストです。\n方言は標準語の意味に補完してください。\n\n${dialectDict}\n\n${transcription}`;

        const haikuMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `${haikuPrompt}\n\n上記の会話から以下のJSONを抽出してください。\n情報が不明な場合は "不明" と入れてください。\n雑談・脱線は無視してください。\nJSONのみを返してください。前置きや説明は不要です。\n\n{\n  "symptoms": [],\n  "body_parts": [],\n  "severity": "",\n  "onset": "",\n  "possible_causes": [],\n  "treatment_done": "",\n  "teacher_notes": ""\n}`,
          }],
        });
        haikuText = haikuMsg.content[0]?.type === "text" ? haikuMsg.content[0].text : "{}";
        console.log("[haiku] structured extract done, length:", haikuText.length);
      } catch (haikuErr) {
        console.error("[haiku] error:", haikuErr);
        // fallback: use plain transcription for Sonnet
        haikuText = JSON.stringify({ symptoms: [], body_parts: [], severity: "不明", onset: "不明", possible_causes: [], treatment_done: "不明", teacher_notes: transcription.slice(0, 500) });
      }

      const haikuStructured = safeJsonParse(haikuText) ?? { teacher_notes: transcription.slice(0, 500) };

      // ── Step 2: Sonnet — 構造化JSON → SOAPカルテ ─────────────────────
      let message;
      try {
        message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: `あなたは整骨院専門のAIカルテ生成アシスタントです。
整骨院・接骨院のスコープ内（肩こり・腰痛・筋肉疲労等）でカルテを生成します。

九州方言辞書 v0.3（鹿児島・博多・長崎・久留米・北九州 / 整骨院頻出表現）
【痛み・しびれ】痛か→痛い（鹿児島）、わっぜ痛か→とても痛い（鹿児島）、いたかばい→痛いよ（久留米）、いたかとー→痛いよ（博多）、いたかっちゃん→痛いんだよ（北九州）、しびるっど→しびれる（鹿児島）、しびれとう→しびれている（博多・久留米）、しびれっぞ→しびれる（長崎）、うっとうしか→不快感がある（博多）
【疲労・だるさ】だれた→疲れた（鹿児島）、わっぜだれた→すごく疲れた（鹿児島）、だるか→だるい（全域）、だるかばい→だるいよ（久留米・博多）、きつか→しんどい・つらい（全域）、きつかとー→しんどいよ（博多）、よれとう→疲れ果てている（博多・久留米）、へたっとう→力が抜けている（博多）、なおらん→治らない（長崎・北九州）
【動きにくさ・こわばり】かて→硬い・動かしにくい（鹿児島）、わっぜかて→すごく硬い（鹿児島）、かたかばい→硬いよ（久留米）、かたかとー→硬いよ（博多）、まがらん→曲がらない（全域）、のびらん→伸びない（全域）、まわらん→回らない（全域）、あがらん→上がらない（全域）、ひっぱっとう→引っ張られている感じ（博多）
【頻度・期間】ここんとこずっと→最近ずっと（鹿児島）、ずっとばい→ずっとだよ（久留米・博多）、まえからばい→前からだよ（久留米）、しばらくなっとう→しばらくなっている（博多）、なんちゃん→何日も・しばらく（久留米）、きのうからたい→昨日からだよ（北九州）
【程度】わっぜ→とても・すごく（鹿児島）、ちっとばっかい→少し（鹿児島）、ちょっとばかし→少しだけ（全域）、ばりばり→とても・すごく（北九州・博多）、たいぎゃ→とても・大変（北九州・久留米）、がばい→すごく（長崎）、ぼちぼち→まあまあ（長崎・北九州）
【場所・部位】ここらへん→この辺り（全域）、うしろっかわ→後ろ側（全域）、したっかわ→下側（全域）、くびんとこ→首のところ（博多・久留米）、こしんとこ→腰のところ（博多・久留米）
【相槌・確認】そうたい→そうだよ（長崎・北九州）、そうばい→そうだよ（久留米・博多）、そうっちゃん→そうなんだよ（北九州）、ほんとばい→本当だよ（久留米）、ほんとたい→本当だよ（長崎）、やっぱそうか→やっぱりそうか（全域）、よかよか→いいよいいよ・大丈夫（全域）

【重要なルール】
以下の症状は整骨院で十分対応できるため、risk_flagsに他院受診勧奨を含めないこと：
- 首こり・肩こり・眼精疲労、慢性腰痛・姿勢由来の腰痛
- デスクワーク・スマホ由来の疲労、スポーツ後の筋肉疲労
- 骨盤の歪み・姿勢の悪化、頭痛（緊張型）、冷え・むくみ

以下の場合のみrisk_flagsに記載すること：
- 下肢・上肢のしびれが強く広範囲、排尿・排便障害、発熱を伴う関節痛
- 安静時の激しい持続痛、骨折疑い、内臓由来が疑われる症状

患者の個人名・住所・生年月日などの個人情報はJSONに含めないこと。
JSONのみを返すこと。前置きや説明は不要。`,
          messages: [{
            role: "user",
            content: `以下の構造化データからSOAP形式のカルテを生成してください。\n\n【入力データ】\n${JSON.stringify(haikuStructured, null, 2)}\n\nJSONのみを返してください。前置き・説明・コードブロック不要です。\n\n{\n  "chief_complaint": "主訴（部位＋症状を1文で）",\n  "subjective": "患者の訴え・自覚症状",\n  "objective": "施術者の所見・確認事項",\n  "assessment": "施術者の見立て（1〜2文）",\n  "plan": "今後の施術方針（1〜2文）",\n  "treatment_summary": "本日の施術内容",\n  "advice_5axis": {\n    "exercise": "運動アドバイス",\n    "sleep": "睡眠アドバイス",\n    "nutrition": "栄養アドバイス",\n    "lifestyle": "生活習慣アドバイス",\n    "mental": "メンタルアドバイス"\n  },\n  "next_visit_note": "次回来院時の確認事項",\n  "lifestyle_advice": ["生活アドバイス1", "生活アドバイス2", "生活アドバイス3"],\n  "recommended_products": [],\n  "follow_up": "次回来院の推奨時期",\n  "risk_flags": []\n}`,
          }],
        });
      } catch (aiErr) {
        console.error("Claude Sonnet API error:", aiErr);
        return res.status(500).json({ error: "AI（Claude）の呼び出しに失敗しました。" });
      }

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      const raw = safeJsonParse(text);
      if (!raw) {
        console.error("AI response parse failed. Raw text:", text);
        return res.status(500).json({ error: "AI応答の解析に失敗しました。再度お試しください。" });
      }

      const validated = karteResponseSchema.safeParse(raw);
      if (!validated.success) {
        console.error("AI response schema mismatch:", validated.error.flatten(), "Raw:", raw);
        return res.status(500).json({ error: "AI応答のフォーマットが不正です。再度お試しください。" });
      }

      let visit_id: string | null = null;
      try {
        const supabase = serviceClient;

        let clinic_id = reqClinicId;
        let patient_id = reqPatientId;

        if (!clinic_id || !patient_id) {
          const demo = await getOrCreateDemoClinicAndPatient();
          clinic_id = clinic_id ?? demo.clinic_id;
          patient_id = patient_id ?? demo.patient_id;
        }

        const { data: visitData, error: visitError } = await supabase
          .from("visits")
          .insert({
            clinic_id,
            patient_id,
            visited_at: new Date().toISOString(),
            chief_complaint: validated.data.chief_complaint,
            soap_note: { ...validated.data, ...(reqStaffName ? { staff_name: reqStaffName } : {}) },
            lifestyle_advice: validated.data.lifestyle_advice,
            recommended_products: validated.data.recommended_products,
          })
          .select("id")
          .single();

        if (!visitError && visitData) {
          visit_id = visitData.id;
          console.log("Visit saved to Supabase:", visit_id);
        } else {
          console.error("Visit save error:", visitError?.message);
        }
      } catch (saveErr) {
        console.error("Visit save exception:", saveErr);
      }

      res.json({ ...validated.data, visit_id });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "解析エラー。再度お試しください。" });
    }
  });

  app.post("/api/correlate", async (req, res) => {
    try {
      if (!checkRateLimit(req.ip || "unknown")) {
        return res.status(429).json({ error: true });
      }

      const parsed = correlateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: true });
      }

      const { historyText, todayData } = parsed.data;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `あなたは整骨院の臨床データアナリストです。患者の過去の治療履歴と生活習慣データ（HealthKit）を分析し、相関性・パターン・リスク予測をJSONのみで出力してください（\`\`\`不要）:
{
  "summary": "患者の全体的な状態の総括（2〜3文）",
  "correlations": [
    {"title": "相関パターン名", "finding": "発見内容", "strength": "強/中/弱", "data_evidence": "根拠となるデータ"}
  ],
  "risk_areas": [{"area": "リスク部位", "risk_level": "高/中/低", "reason": "理由"}],
  "lifestyle_triggers": [{"trigger": "悪化トリガー", "impact": "影響内容"}],
  "improvement_trend": {"score": 45, "direction": "改善/悪化/横ばい", "comment": "コメント"},
  "next_session_focus": ["次回施術で重点的に見るべき点1", "点2"],
  "prediction": "このまま続いた場合の1ヶ月後の予測（1文）"
}
scoreは0〜100の整数値で出力してください。`,
        messages: [{
          role: "user",
          content: `患者: 田中大輔（42歳男性、デスクワーク）\n\n治療履歴（新しい順）:\n${historyText}\n\n本日の生活データ: ${todayData}`
        }],
      });

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      const raw = safeJsonParse(text);
      if (!raw) return res.status(500).json({ error: true });

      const validated = correlationResponseSchema.safeParse(raw);
      if (!validated.success) return res.status(500).json({ error: true });

      res.json(validated.data);
    } catch (error) {
      console.error("Correlation error:", error);
      res.status(500).json({ error: true });
    }
  });

  // ─── Clinics ───────────────────────────────────────────────────────
  const clinicInsertSchema = z.object({
    name: z.string().min(1),
    address: z.string().default(""),
    phone: z.string().default(""),
    plan: z.string().default("phase1"),
    is_active: z.boolean().default(true),
  });

  app.get("/api/clinics", async (_req, res) => {
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("clinics").select("*").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/clinics", async (req, res) => {
    const parsed = clinicInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("clinics").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/clinics/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { error } = await supabase.from("clinics").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Clinic Settings ────────────────────────────────────────────────
  app.patch("/api/admin/clinic", async (req, res) => {
    try {
      const supabase = serviceClient;
      const clinicId = process.env.TEST_CLINIC_ID ?? "aaaaaaaa-0000-0000-0000-000000000001";
      const allowedFields = ["name"];
      const updateBody: Record<string, unknown> = {};
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updateBody[f] = req.body[f];
      }
      if (Object.keys(updateBody).length === 0) return res.json({ ok: true });
      const { data, error } = await supabase.from("clinics").update(updateBody).eq("id", clinicId).select("id, name").single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Staffs ─────────────────────────────────────────────────────────
  const staffInsertSchema = z.object({
    clinic_id: z.string().uuid(),
    name: z.string().min(1),
    role: z.enum(["owner", "staff", "reception"]).default("staff"),
    email: z.string().optional().default(""),
    calendar_color: z.string().default("#00c896"),
  });

  // Authenticated staff self-lookup. JWT 必須 + staff membership 必須。
  // patient JWT で叩くと 403（staffs に該当行なし）。
  // owner_id NULL のクリニック所属 staff も 403（Default Deny）。
  app.get("/api/staff/me", requireStaffAuth, async (req, res) => {
    const ctx = req.staffContext;
    if (!ctx) {
      return res.status(500).json({ error: "missing staff context" });
    }
    res.json({
      staff: {
        id: ctx.staffId,
        name: ctx.staffName,
        role: ctx.role,
        clinic_id: ctx.clinicId,
      },
      clinic: {
        id: ctx.clinicId,
        name: ctx.clinicName,
      },
    });
  });

  app.get("/api/staffs", async (req, res) => {
    try {
      const supabase = serviceClient;
      let query = supabase.from("staffs").select("*").order("created_at", { ascending: true });
      if (req.query.clinic_id) query = query.eq("clinic_id", req.query.clinic_id as string);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/staffs", async (req, res) => {
    const parsed = staffInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("staffs").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/staffs/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { error } = await supabase.from("staffs").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Patients ──────────────────────────────────────────────────────
  const patientInsertSchema = z.object({
    clinic_id: z.string().uuid(),
    name_kana: z.string().min(1),
    phone: z.string().default(""),
    gender: z.string().optional(),
    birth_date: z.string().optional(),
    address: z.string().optional(),
    member_grade: z.string().default("bronze"),
  });

  app.get("/api/patients", async (req, res) => {
    try {
      const supabase = serviceClient;
      let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (req.query.clinic_id) query = query.eq("clinic_id", req.query.clinic_id as string);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/patients", async (req, res) => {
    const parsed = patientInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("patients").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/patients/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("patients").update(req.body).eq("id", req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { error } = await supabase.from("patients").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── SMS Invite ────────────────────────────────────────────────────
  const inviteSchema = z.object({
    patient_id: z.string().uuid(),
    phone: z.string().min(1),
    clinic_name: z.string().default("堺整骨院"),
  });

  app.post("/api/patients/invite", async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { phone, clinic_name, patient_id } = parsed.data;
    const pwaUrl = process.env.VITE_PWA_URL || process.env.PWA_URL || "https://vlux.health";
    const messageBody = `【${clinic_name}】\n本日はご来院ありがとうございました。\nVLUXアプリでいつでも施術記録・生活アドバイスをご確認いただけます。\n\n▼ アプリを開く\n${pwaUrl}\n\n🎁 初回登録特典\nアプリ登録完了で次回施術料500円OFFクーポンをプレゼント。\nアプリ内のクーポンウォレットをご確認ください。\n\n初回は右下の「ホーム画面に追加」でインストールしてください。\nご不明な点はスタッフまでお声がけください。`;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
      console.log(`[VLUX SMS] Twilio not configured. Would send to ${phone}:\n${messageBody}`);
      return res.json({ success: true, method: "console", patient_id });
    }

    try {
      const client = twilio(sid, token);
      const msg = await client.messages.create({ body: messageBody, from, to: phone });
      console.log(`[VLUX SMS] Sent to ${phone}, SID: ${msg.sid}`);
      res.json({ success: true, method: "twilio", sid: msg.sid, patient_id });
    } catch (e) {
      console.error(`[VLUX SMS] Failed to send to ${phone}:`, e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Admin: Clinic Info ──────────────────────────────────────────
  app.get("/api/admin/clinic", async (_req, res) => {
    try {
      const supabase = serviceClient;
      const clinicId = process.env.TEST_CLINIC_ID;
      if (clinicId) {
        const { data, error } = await supabase.from("clinics").select("id, name").eq("id", clinicId).single();
        if (!error && data) return res.json(data);
      }
      const demo = await getOrCreateDemoClinicAndPatient();
      const { data, error } = await supabase.from("clinics").select("id, name").eq("id", demo.clinic_id).single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Visits ────────────────────────────────────────────────────────
  // visits テーブルの実カラム: chief_complaint, soap_note(jsonb), lifestyle_advice[], recommended_products[]
  // follow_up / risk_flags は soap_note 内に格納するため top-level カラムとしては存在しない
  const visitPatchSchema = z.object({
    chief_complaint: z.string().optional(),
    soap_note: z.record(z.unknown()).optional(),
    lifestyle_advice: z.array(z.string()).optional(),
    recommended_products: z.array(z.string()).optional(),
    // フロントから送られてくる余分フィールドは受け取るが DB には渡さない
    follow_up: z.string().optional(),
    risk_flags: z.array(z.string()).optional(),
  });

  const visitInsertSchema = z.object({
    patient_id: z.string().uuid(),
    clinic_id: z.string().uuid().optional(),
    visited_at: z.string().datetime().optional(),
    chief_complaint: z.string().optional().default(""),
    soap_note: z.record(z.unknown()).optional(),
    audio_url: z.string().optional(),
    lifestyle_advice: z.unknown().optional(),
    recommended_products: z.unknown().optional(),
  });

  app.get("/api/visits", async (req, res) => {
    try {
      const supabase = serviceClient;
      let query = supabase.from("visits").select("*").order("visited_at", { ascending: false });
      if (req.query.patient_id) query = query.eq("patient_id", req.query.patient_id as string);
      if (req.query.clinic_id) query = query.eq("clinic_id", req.query.clinic_id as string);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/visits", async (req, res) => {
    const parsed = visitInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("visits").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/visits/:id", async (req, res) => {
    const parsed = visitPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      // 実在するカラムだけを抽出（follow_up / risk_flags は soap_note 内に含める）
      const { chief_complaint, soap_note, lifestyle_advice, recommended_products,
              follow_up, risk_flags } = parsed.data;

      // soap_note を組み立て（送られてきた soap_note に follow_up/risk_flags をマージ）
      const mergedSoapNote: Record<string, unknown> = { ...(soap_note ?? {}) };
      if (follow_up !== undefined) mergedSoapNote.follow_up = follow_up;
      if (risk_flags !== undefined) mergedSoapNote.risk_flags = risk_flags;

      const updatePayload: Record<string, unknown> = {};
      if (chief_complaint !== undefined) updatePayload.chief_complaint = chief_complaint;
      if (Object.keys(mergedSoapNote).length > 0) updatePayload.soap_note = mergedSoapNote;
      if (lifestyle_advice !== undefined) updatePayload.lifestyle_advice = lifestyle_advice;
      if (recommended_products !== undefined) updatePayload.recommended_products = recommended_products;

      const { data, error } = await supabase
        .from("visits")
        .update(updatePayload)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/visits/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { error } = await supabase.from("visits").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Health Data ───────────────────────────────────────────────────
  const healthDataInsertSchema = z.object({
    patient_id: z.string().uuid(),
    recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    steps: z.number().int().min(0).default(0),
    heart_rate_avg: z.number().min(0).optional(),
    sleep_minutes: z.number().int().min(0).optional(),
    active_calories: z.number().min(0).optional(),
    source: z.string().default("healthkit"),
  });

  app.get("/api/health-data", async (req, res) => {
    try {
      const supabase = serviceClient;
      let query = supabase.from("health_data").select("*").order("recorded_date", { ascending: false });
      if (req.query.patient_id) query = query.eq("patient_id", req.query.patient_id as string);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/health-data", async (req, res) => {
    const parsed = healthDataInsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const supabase = serviceClient;
      const { data, error } = await supabase.from("health_data").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/health-data/:id", async (req, res) => {
    try {
      const supabase = serviceClient;
      const { error } = await supabase.from("health_data").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Patient PWA: Health Sync ──────────────────────────────────────
  const healthSyncRecordSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    steps: z.number().int().min(0).optional(),
    heart_rate_avg: z.number().min(0).optional(),
    sleep_minutes: z.number().int().min(0).optional(),
    active_calories: z.number().min(0).optional(),
  });
  const healthSyncSchema = z.object({
    source: z.enum(["healthkit", "googlefit", "mock"]),
    records: z.array(healthSyncRecordSchema).min(1).max(30),
  });

  app.post("/api/health-data/sync", async (req, res) => {
    try {
      const parsed = healthSyncSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { source, records } = parsed.data;
      const patient_id = await getDemoPatientId();
      const supabase = serviceClient;
      const dates = records.map(r => r.date);
      // 既存の同日データを削除してから挿入（UNIQUE制約がなくても安全に動作）
      await supabase.from("health_data").delete().eq("patient_id", patient_id).in("recorded_date", dates);
      const rows = records.map(r => ({
        patient_id,
        recorded_date: r.date,
        steps: r.steps ?? null,
        heart_rate_avg: r.heart_rate_avg ?? null,
        sleep_minutes: r.sleep_minutes ?? null,
        active_calories: r.active_calories ?? null,
        source,
      }));
      const { error } = await supabase.from("health_data").insert(rows);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ saved: rows.length, source });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Coupons ───────────────────────────────────────────────────────
  function generateCouponCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `VLUX-${rand(4)}-${rand(4)}`;
  }

  const couponIssueSchema = z.object({
    patient_id: z.string().uuid(),
    clinic_id: z.string().uuid(),
  });

  app.post("/api/coupons/issue", async (req, res) => {
    try {
      const parsed = couponIssueSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { patient_id, clinic_id } = parsed.data;
      const supabase = serviceClient;

      // 重複発行チェック — activeなクーポンがすでにある場合は発行しない
      const { data: existing } = await supabase
        .from("coupons")
        .select("id, code, expires_at")
        .eq("patient_id", patient_id)
        .eq("status", "active")
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(409).json({
          error: "active_coupon_exists",
          message: "この患者にはすでに有効なクーポンがあります",
          coupon: existing[0],
        });
      }

      const code = generateCouponCode();
      const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("coupons")
        .insert({ patient_id, clinic_id, code, expires_at, discount_amount: 500, description: "次回施術料500円OFF", status: "active" })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/coupons", async (req, res) => {
    try {
      const supabase = serviceClient;
      let query = supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (req.query.patient_id) query = query.eq("patient_id", req.query.patient_id as string);
      if (req.query.clinic_id) query = query.eq("clinic_id", req.query.clinic_id as string);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Patient-facing PWA APIs ───────────────────────────────────────
  async function getDemoPatientId(): Promise<string> {
    const envId = process.env.TEST_PATIENT_ID;
    if (envId) return envId;
    const { patient_id } = await getOrCreateDemoClinicAndPatient();
    return patient_id;
  }

  // 認証済み user_id から本人 patient.id を解決する。見つからない場合は null。
  async function getAuthenticatedPatientId(userId: string): Promise<string | null> {
    const { data, error } = await serviceClient
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return null;
    return data.id;
  }

  // Authenticated patient self-lookup. JWT 必須。
  // user_id でひもづく patient を 1 件返す（PHI は返さない）。
  app.get("/api/patient/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const supabase = serviceClient;
      const { data, error } = await supabase
        .from("patients")
        .select("id, clinic_id, member_grade, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "patient not found" });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/patient/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const supabase = serviceClient;
      const { data: patient, error } = await supabase
        .from("patients")
        .select("id, clinic_id, name_kana, member_grade, gender, birth_date")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!patient) return res.status(404).json({ error: "patient not found" });

      const { count } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patient.id)
        .is("deleted_at", null);

      res.json({ ...patient, visit_count: count ?? 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/patient/visits", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const patient_id = await getAuthenticatedPatientId(userId);
      if (!patient_id) return res.status(404).json({ error: "patient not found" });
      const supabase = serviceClient;
      const { data, error } = await supabase
        .from("visits")
        .select("id, visited_at, chief_complaint, soap_note, lifestyle_advice, recommended_products")
        .eq("patient_id", patient_id)
        .is("deleted_at", null)
        .order("visited_at", { ascending: false })
        .limit(20);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/patient/health-data", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const patient_id = await getAuthenticatedPatientId(userId);
      if (!patient_id) return res.status(404).json({ error: "patient not found" });
      const supabase = serviceClient;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const fromDate = sevenDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("health_data")
        .select("id, recorded_date, steps, heart_rate_avg, sleep_minutes, active_calories, source")
        .eq("patient_id", patient_id)
        .is("deleted_at", null)
        .gte("recorded_date", fromDate)
        .order("recorded_date", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Dev seed (テストデータ投入) ─────────────────────────────────
  app.post("/api/dev/seed", async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "production環境では実行できません" });
    }
    try {
      const { clinic_id, patient_id } = await getOrCreateDemoClinicAndPatient();
      const supabase = serviceClient;

      // 過去7日分の健康データ
      const today = new Date();
      const healthRows = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return {
          patient_id,
          recorded_date: d.toISOString().split("T")[0],
          steps: Math.floor(Math.random() * 5000 + 1000),
          heart_rate_avg: Math.floor(Math.random() * 20 + 62),
          sleep_minutes: Math.floor(Math.random() * 120 + 300),
          active_calories: Math.floor(Math.random() * 300 + 100),
          source: "healthkit",
        };
      });
      await supabase.from("health_data").upsert(healthRows, { onConflict: "patient_id,recorded_date" });

      // 過去の来院記録3件
      const visitRows = [
        {
          clinic_id, patient_id,
          visited_at: new Date(Date.now() - 14 * 86400000).toISOString(),
          chief_complaint: "腰部の慢性的な張りと右肩の可動域制限",
          soap_note: {
            chief_complaint: "腰部の慢性的な張りと右肩の可動域制限",
            assessment: "デスクワーク長時間継続による筋緊張と姿勢不良が原因と考えられる",
            treatment_plan: "腰部手技＋肩甲骨周囲のリリース、姿勢矯正",
            risk_flags: [],
          },
          lifestyle_advice: ["30分ごとに立ち上がりストレッチを行う", "肩を後ろに引く意識で座る", "就寝前に湯船で肩を温める"],
          recommended_products: ["W001"],
        },
        {
          clinic_id, patient_id,
          visited_at: new Date(Date.now() - 28 * 86400000).toISOString(),
          chief_complaint: "首・肩こりと頭痛",
          soap_note: {
            chief_complaint: "首・肩こりと頭痛",
            assessment: "頸部筋群の過緊張による緊張型頭痛と考えられる",
            treatment_plan: "頸部マッサージ＋トリガーポイント施術",
            risk_flags: ["頭痛が週3回以上続く場合は神経内科受診を推奨"],
          },
          lifestyle_advice: ["PC画面の高さを目線に合わせる", "水分を1日1.5L以上摂取する", "寝る前のスマホ操作を控える"],
          recommended_products: ["S001"],
        },
        {
          clinic_id, patient_id,
          visited_at: new Date(Date.now() - 42 * 86400000).toISOString(),
          chief_complaint: "膝関節の違和感と腰部鈍痛",
          soap_note: {
            chief_complaint: "膝関節の違和感と腰部鈍痛",
            assessment: "大腿四頭筋の筋力低下と骨盤前傾が複合的に影響",
            treatment_plan: "膝周囲テーピング＋骨盤矯正",
            risk_flags: [],
          },
          lifestyle_advice: ["階段を積極的に使う", "スクワット10回×3セットを毎日行う", "歩くときつま先をやや外に向ける"],
          recommended_products: ["W002", "S001"],
        },
      ];
      await supabase.from("visits").insert(visitRows);

      res.json({
        success: true,
        patient_id,
        message: `患者ID: ${patient_id} にテストデータを投入しました（健康データ7日分、来院記録3件）`,
      });
    } catch (e) {
      console.error("Seed error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ── Google OAuth helpers ─────────────────────────────────────────────
  function getGoogleRedirectUri(req: Request): string {
    // Production uses the canonical domain; dev uses the Replit domain
    const prodUri = "https://app.vlux.health/auth/google/callback";
    if (process.env.NODE_ENV === "production") return prodUri;
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
    return `${proto}://${host}/auth/google/callback`;
  }

  async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ access_token: string; expires_in: number }>;
    } catch {
      return null;
    }
  }

  // GET /auth/google — redirect to Google consent screen
  app.get("/auth/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).send("GOOGLE_CLIENT_ID not configured");
    const redirectUri = encodeURIComponent(getGoogleRedirectUri(req));
    const scopes = encodeURIComponent([
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
    ].join(" "));
    const url = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&access_type=offline` +
      `&prompt=consent`;
    res.redirect(url);
  });

  // GET /auth/google/callback — exchange code for tokens
  app.get("/auth/google/callback", async (req, res) => {
    const { code, error } = req.query as { code?: string; error?: string };
    if (error || !code) {
      console.error("[google-oauth] callback error:", error);
      return res.redirect("/?google_fit=error");
    }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: getGoogleRedirectUri(req),
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenRes.ok) {
        console.error("[google-oauth] token exchange failed:", await tokenRes.text());
        return res.redirect("/?google_fit=error");
      }
      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number };
      req.session.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) req.session.googleRefreshToken = tokens.refresh_token;
      req.session.googleTokenExpiry = Date.now() + tokens.expires_in * 1000;
      console.log("[google-oauth] tokens stored in session");
      res.redirect("/?google_fit=success");
    } catch (e) {
      console.error("[google-oauth] exception:", e);
      res.redirect("/?google_fit=error");
    }
  });

  // GET /api/google-fit/status — check if connected
  app.get("/api/google-fit/status", (req, res) => {
    const connected = !!req.session.googleAccessToken;
    res.json({ connected });
  });

  // GET /api/google-fit/data — fetch steps, sleep, heartRate for past 7 days
  app.get("/api/google-fit/data", async (req, res) => {
    let accessToken = req.session.googleAccessToken;
    const refreshToken = req.session.googleRefreshToken;
    const expiry = req.session.googleTokenExpiry ?? 0;

    if (!accessToken) {
      return res.status(401).json({ error: "未連携。/auth/google から認証してください" });
    }

    // Refresh if token is close to expiry (< 2 min)
    if (Date.now() > expiry - 120_000 && refreshToken) {
      const refreshed = await refreshGoogleToken(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        req.session.googleAccessToken = accessToken;
        req.session.googleTokenExpiry = Date.now() + refreshed.expires_in * 1000;
      } else {
        // Refresh failed — clear session and ask re-auth
        delete req.session.googleAccessToken;
        delete req.session.googleRefreshToken;
        return res.status(401).json({ error: "トークンが期限切れです。再度連携してください" });
      }
    }

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const fitBody = {
      aggregateBy: [
        { dataTypeName: "com.google.step_count.delta" },
        { dataTypeName: "com.google.heart_rate.bpm" },
        { dataTypeName: "com.google.sleep.segment" },
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: now - weekMs,
      endTimeMillis: now,
    };

    try {
      const fitRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(fitBody),
      });

      if (!fitRes.ok) {
        const errText = await fitRes.text();
        console.error("[google-fit] data fetch error:", errText);
        if (fitRes.status === 401) {
          delete req.session.googleAccessToken;
          return res.status(401).json({ error: "トークンが期限切れです。再度連携してください" });
        }
        return res.status(500).json({ error: "データの取得に失敗しました" });
      }

      const fitData = await fitRes.json() as { bucket: Record<string, unknown>[] };
      const getVal = (bucket: Record<string, unknown>, idx: number): number => {
        const ds = (bucket.dataset as Record<string, unknown>[])?.[idx];
        const pts = (ds as { point?: { value?: { intVal?: number; fpVal?: number }[] }[] })?.point ?? [];
        return pts.reduce((sum: number, p) => sum + (p.value?.[0]?.intVal ?? p.value?.[0]?.fpVal ?? 0), 0);
      };

      const steps: { date: string; steps: number }[] = [];
      const sleep: { date: string; duration: number }[] = [];
      const heartRate: { date: string; bpm: number }[] = [];

      for (const bucket of fitData.bucket ?? []) {
        const d = new Date(Number(bucket.startTimeMillis));
        const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        const stepVal = Math.round(getVal(bucket, 0));
        const hrVal = Math.round(getVal(bucket, 1));
        const sleepMs = getVal(bucket, 2); // ms in segment format
        const sleepH = Math.round((sleepMs / 60000 / 60) * 10) / 10;
        if (stepVal > 0) steps.push({ date, steps: stepVal });
        if (hrVal > 0) heartRate.push({ date, bpm: hrVal });
        if (sleepH > 0) sleep.push({ date, duration: sleepH });
      }

      console.log(`[google-fit] fetched: ${steps.length} step days, ${sleep.length} sleep days, ${heartRate.length} HR days`);
      res.json({ steps, sleep, heartRate });
    } catch (e) {
      console.error("[google-fit] exception:", e);
      res.status(500).json({ error: "データの取得に失敗しました" });
    }
  });

  // DELETE /api/google-fit/disconnect — clear session tokens
  app.delete("/api/google-fit/disconnect", (req, res) => {
    delete req.session.googleAccessToken;
    delete req.session.googleRefreshToken;
    delete req.session.googleTokenExpiry;
    res.json({ ok: true });
  });

  return httpServer;
}
