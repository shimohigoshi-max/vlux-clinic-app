import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const analyzeRequestSchema = z.object({
  conversation: z.string().min(1).max(10000),
  healthData: z.string().optional().default(""),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    desc: z.string(),
  })).optional().default([]),
});

const analysisResultSchema = z.object({
  chief_complaint: z.string().optional(),
  findings: z.string().optional(),
  treatment: z.string().optional(),
  advice: z.array(z.string()).optional(),
  patient_message: z.string().optional(),
  recommended_products: z.array(z.string()).optional(),
  reason: z.string().optional(),
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "入力データが不正です。" });
      }

      const { conversation, healthData, products } = parsed.data;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `あなたは整骨院AIアシスタントです。施術会話から以下をJSON形式で抽出してください。余分なテキストや\`\`\`jsonは不要。JSONのみ出力。
{
  "chief_complaint": "主訴（1文）",
  "findings": "所見（2〜3項目、箇条書き）",
  "treatment": "処置内容（1〜2文）",
  "advice": ["アドバイス1", "アドバイス2"],
  "patient_message": "患者スマホに送る親しみやすいメッセージ（150字以内）",
  "recommended_products": ["W001", "S001"],
  "reason": "推薦理由（1文）"
}`,
        messages: [{
          role: "user",
          content: `会話:\n${conversation}\n\n生活データ: ${healthData}\n\n商品マスタ: ${JSON.stringify(products)}`
        }],
      });

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      const rawResult = safeJsonParse(text);

      if (!rawResult) {
        return res.status(500).json({ error: "AI応答の解析に失敗しました。再度お試しください。" });
      }

      const validated = analysisResultSchema.safeParse(rawResult);
      if (!validated.success) {
        return res.status(500).json({ error: "AI応答のフォーマットが不正です。再度お試しください。" });
      }

      res.json(validated.data);
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "解析エラー。再度お試しください。" });
    }
  });

  return httpServer;
}
