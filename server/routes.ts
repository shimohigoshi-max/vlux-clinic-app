import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "./supabase";

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
          system: "あなたは整骨院の熟練カルテ作成AIです。施術会話から構造化カルテを生成します。患者の個人名・住所・生年月日などの個人情報はJSONに含めないでください。",
          messages: [{
            role: "user",
            content: `以下の施術会話から構造化カルテを生成してください。
会話テキスト：${transcription}

以下のJSON形式のみで返答してください。説明文・前置き・コードブロックは不要です。

{
  "chief_complaint": "主訴を1文で",
  "assessment": "施術者の見立てを1〜2文で",
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
    "注意すべき点（なければ空配列）"
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

  // ─── Visits ────────────────────────────────────────────────────────
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

  return httpServer;
}
