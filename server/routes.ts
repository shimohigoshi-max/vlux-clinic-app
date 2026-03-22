import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "./supabase";
import twilio from "twilio";

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
  assessment: z.string().optional().default(""),
  treatment_plan: z.string().optional().default(""),
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
  const supabase = getSupabaseAdmin();

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

      let message;
      try {
        message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `あなたは整骨院専門のカルテ作成AIです。
整骨院・接骨院で施術できる症状の範囲内でカルテを生成します。

【重要なルール】
以下の症状は整骨院で十分対応できるため、
他の医療機関（整形外科・眼科・内科等）への
受診勧奨をrisk_flagsに含めないこと：
- 首こり・肩こり・眼精疲労
- 慢性腰痛・姿勢由来の腰痛
- デスクワーク・スマホ由来の疲労
- スポーツ後の筋肉疲労・筋肉痛
- 骨盤の歪み・姿勢の悪化
- 頭痛（緊張型）
- 冷え・むくみ

以下の場合のみrisk_flagsに他院受診を記載すること：
- 下肢・上肢のしびれが強く広範囲に及ぶ場合
- 排尿・排便障害を伴う場合
- 発熱を伴う関節痛・腫脹がある場合
- 安静時でも激しい痛みが持続する場合
- 明らかな外傷による強い痛み（骨折疑い）
- 胸痛・腹痛など内臓由来が疑われる場合

患者の個人名・住所・生年月日などの個人情報は
JSONに含めないこと。

【病院診断結果の活用について】
患者が他の医療機関での診断結果を話してくれた場合：
- その診断内容をカルテのassessmentに記載してよい
  例：「整形外科にて腰椎椎間板ヘルニアと診断済み」
- 診断結果を整骨院の施術計画に積極的に活かすこと
  例：「ヘルニアの診断を踏まえ、腰部への強い刺激は避けてアプローチする」
- 病院での治療と整骨院の施術を並行することは患者にとってメリットがあるため、
  treatment_planにその旨を自然に記載してよい
  例：「整形外科での治療と並行して、筋緊張の緩和・姿勢改善を目的とした施術を行う」
- ただし病院の治療内容を変更・中断するよう示唆する表現は含めないこと
- すでに受診済みの医療機関への再受診勧奨はrisk_flagsに含めないこと`,
          messages: [{
            role: "user",
            content: `以下の施術会話から構造化カルテを生成してください。
会話テキスト：${transcription}

以下のJSON形式のみで返答してください。
説明文・前置き・コードブロックは不要です。

{
  "chief_complaint": "主訴を1文で",
  "assessment": "整骨院の施術者としての見立てを1〜2文で",
  "treatment_plan": "本日の施術方針を1〜2文で",
  "lifestyle_advice": [
    "生活アドバイス1",
    "生活アドバイス2",
    "生活アドバイス3"
  ],
  "recommended_products": [
    "推薦商品（なければ空配列）"
  ],
  "follow_up": "次回来院の推奨時期",
  "risk_flags": [
    "本当に危険なサインがある場合のみ記載。なければ空配列"
  ]
}`
          }],
        });
      } catch (aiErr) {
        console.error("Claude API error:", aiErr);
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
        const supabase = getSupabaseAdmin();

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
            soap_note: validated.data,
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("clinics").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/clinics/:id", async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("clinics").delete().eq("id", req.params.id);
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
    member_grade: z.string().default("bronze"),
  });

  app.get("/api/patients", async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("patients").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/patients/:id", async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("patients").update(req.body).eq("id", req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("health_data").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/health-data/:id", async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();

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
      const supabase = getSupabaseAdmin();
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

  app.get("/api/patient/profile", async (_req, res) => {
    try {
      const patient_id = await getDemoPatientId();
      const supabase = getSupabaseAdmin();
      const { data: patient, error } = await supabase
        .from("patients")
        .select("id, clinic_id, name_kana, member_grade, gender, birth_date")
        .eq("id", patient_id)
        .single();
      if (error) return res.status(500).json({ error: error.message });

      const { count } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patient_id);

      res.json({ ...patient, visit_count: count ?? 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/patient/visits", async (_req, res) => {
    try {
      const patient_id = await getDemoPatientId();
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("visits")
        .select("id, visited_at, chief_complaint, soap_note, lifestyle_advice, recommended_products")
        .eq("patient_id", patient_id)
        .order("visited_at", { ascending: false })
        .limit(20);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/patient/health-data", async (_req, res) => {
    try {
      const patient_id = await getDemoPatientId();
      const supabase = getSupabaseAdmin();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const fromDate = sevenDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("health_data")
        .select("id, recorded_date, steps, heart_rate_avg, sleep_minutes, active_calories, source")
        .eq("patient_id", patient_id)
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
      const supabase = getSupabaseAdmin();

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

  return httpServer;
}
