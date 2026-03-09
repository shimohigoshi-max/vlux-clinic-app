import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

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

      const { conversation, healthData, products } = parsed.data;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `整骨院AIカルテ。JSONのみ出力（\`\`\`不要）: {"chief_complaint":"","findings":"","treatment":"","advice":[],"patient_message":"患者への親しみやすいメッセージ150字以内","lifestyle_notes":["生活習慣の注意点1","注意点2"],"diet_advice":["食事アドバイス1","アドバイス2"],"supplement_advice":[{"name":"サプリ名","timing":"摂取タイミング","reason":"理由"}],"self_care":["セルフケア指導1","指導2"],"recommended_products":["W001","S001"],"reason":"推薦理由"}`,
        messages: [{
          role: "user",
          content: `会話:\n${conversation}\n生活データ: ${healthData}\n商品: ${JSON.stringify(products)}`
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

  return httpServer;
}
