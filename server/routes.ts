import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseClient } from "./supabase";

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
  conversation: z.string().min(1).max(15000),
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
  findings: z.string().optional().default(""),
  treatment: z.string().optional().default(""),
  advice: z.array(z.string()).optional().default([]),
  patient_message: z.string().optional().default(""),
  lifestyle_notes: z.array(z.string()).optional().default([]),
  diet_advice: z.array(z.string()).optional().default([]),
  supplement_advice: z.array(z.object({
    name: z.string(),
    timing: z.string(),
    reason: z.string(),
  })).optional().default([]),
  self_care: z.array(z.string()).optional().default([]),
  recommended_products: z.array(z.string()).optional().default([]),
  reason: z.string().optional().default(""),
  life_advice: z.object({
    this_month_theme: z.string(),
    improved_from_last: z.string().optional(),
    focus_areas: z.array(z.object({
      icon: z.string(),
      category: z.string(),
      priority: z.enum(["高", "中", "低"]),
      advice: z.string(),
    })).min(1).max(7).optional().default([]),
    one_thing_today: z.string().optional(),
    next_visit_goal: z.string().optional(),
  }).optional(),
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
        system: `整骨院会話の要点をJSONのみで出力（\`\`\`不要）: {"chief_complaint":"主訴","key_symptoms":["症状"],"lifestyle_issues":["生活習慣問題"],"treatment_done":"処置","home_care":["ホームケア"],"follow_up":"次回注意"}`,
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
        return res.status(400).json({ error: "入力データが不正です。" });
      }

      const { conversation, healthData, previousHistory, products } = parsed.data;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `整骨院AIカルテ。JSONのみ出力（\`\`\`不要）:
{
  "chief_complaint": "",
  "findings": "",
  "treatment": "",
  "advice": [],
  "patient_message": "患者への親しみやすいメッセージ150字以内",
  "lifestyle_notes": ["生活習慣の注意点"],
  "diet_advice": ["食事アドバイス"],
  "supplement_advice": [{"name": "サプリ名", "timing": "摂取タイミング", "reason": "理由"}],
  "self_care": ["セルフケア指導"],
  "recommended_products": ["W001"],
  "reason": "推薦理由",
  "life_advice": {
    "this_month_theme": "今月のテーマ（10文字以内）",
    "improved_from_last": "前回から改善された点（1文）",
    "focus_areas": [
      {"category": "睡眠", "icon": "😴", "advice": "具体的なアドバイス1文", "priority": "高"},
      {"category": "運動", "icon": "🏃", "advice": "具体的なアドバイス1文", "priority": "高"},
      {"category": "食事・水分", "icon": "🥗", "advice": "具体的なアドバイス1文", "priority": "中"},
      {"category": "仕事環境", "icon": "💼", "advice": "具体的なアドバイス1文", "priority": "中"},
      {"category": "メンタル", "icon": "🧘", "advice": "具体的なアドバイス1文", "priority": "低"}
    ],
    "one_thing_today": "今日からできる一つのこと（具体的・短く）",
    "next_visit_goal": "次回来院までの目標（1文）"
  }
}
priorityは高/中/低のいずれか。focus_areasは必ず5つ出力。improved_from_lastは過去データがあれば記載。`,
        messages: [{
          role: "user",
          content: `会話:\n${conversation}\n生活データ: ${healthData}\n過去3回の施術: ${previousHistory}\n商品: ${JSON.stringify(products)}`
        }],
      });

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      const raw = safeJsonParse(text);
      if (!raw) {
        return res.status(500).json({ error: "AI応答の解析に失敗しました。再度お試しください。" });
      }

      const validated = karteResponseSchema.safeParse(raw);
      if (!validated.success) {
        return res.status(500).json({ error: "AI応答のフォーマットが不正です。再度お試しください。" });
      }

      res.json(validated.data);
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
  });

  app.get("/api/clinics", async (_req, res) => {
    try {
      const supabase = getSupabaseClient();
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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("clinics").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/clinics/:id", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
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
    name: z.string().min(1),
    phone: z.string().default(""),
    grade: z.string().default("Bronze"),
  });

  app.get("/api/patients", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("patients").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/patients/:id", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("patients").update(req.body).eq("id", req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
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
    clinic_id: z.string().uuid(),
    note: z.string().default(""),
    advice: z.string().default(""),
  });

  app.get("/api/visits", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from("visits").select("*").order("created_at", { ascending: false });
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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("visits").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/visits/:id", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
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
    steps: z.number().int().min(0).default(0),
    sleep_hours: z.number().min(0).default(0),
    heart_rate: z.number().int().min(0).default(0),
    recorded_at: z.string().datetime().optional(),
  });

  app.get("/api/health-data", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from("health_data").select("*").order("recorded_at", { ascending: false });
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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("health_data").insert(parsed.data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/health-data/:id", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("health_data").delete().eq("id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return httpServer;
}
