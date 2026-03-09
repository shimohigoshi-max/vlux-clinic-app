import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Zap, Send, Brain, Stethoscope, Check,
  Shield, Sparkles, Droplets, Layers,
  ClipboardList, Activity, Calendar, Hash, FileText,
} from "lucide-react";
import type { AnalysisResult, Product } from "@/lib/constants";
import { DEMO_PRODUCTS } from "@/lib/constants";

interface IPadViewProps {
  conversation: string;
  onConversationChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  onSendToPatient: () => void;
}

const PRODUCT_ICONS: Record<string, typeof Shield> = {
  "W001": Shield,
  "S001": Sparkles,
  "S002": Droplets,
  "W002": Layers,
};

const PRODUCT_COLORS: Record<string, string> = {
  "W001": "bg-primary/20 text-primary",
  "S001": "bg-chart-4/20 text-chart-4",
  "S002": "bg-chart-3/20 text-chart-3",
  "W002": "bg-chart-2/20 text-chart-2",
};

export function IPadView({
  conversation,
  onConversationChange,
  onAnalyze,
  isAnalyzing,
  analysisResult,
  onSendToPatient,
}: IPadViewProps) {
  const recommendedProducts = analysisResult?.recommended_products
    ? DEMO_PRODUCTS.filter(p => analysisResult.recommended_products!.includes(p.id))
    : [];

  return (
    <div className="max-w-[920px] mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-5">
        <p className="text-[11px] font-mono text-muted-foreground tracking-[2px] mb-3" data-testid="text-patient-header">
          CLINICIAN TERMINAL — PATIENT: 田中 大輔 (42歳 男性)
        </p>
        <div className="flex gap-3 flex-wrap">
          {[
            { icon: Calendar, label: "初診日", value: "2024.03.09" },
            { icon: Activity, label: "前回来院", value: "2週間前" },
            { icon: Hash, label: "通院回数", value: "8回" },
            { icon: FileText, label: "主訴", value: "腰痛 / デスクワーク" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-md px-3 py-2 min-w-[120px]"
              data-testid={`card-patient-${label}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
              <span className="text-[13px] text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] font-mono text-muted-foreground tracking-[2px] mb-2.5 flex items-center gap-2">
            <Stethoscope className="w-3 h-3" />
            施術会話（ピンマイク入力）
          </p>
          <div className="relative">
            <Textarea
              value={conversation}
              onChange={e => onConversationChange(e.target.value)}
              className="h-[280px] resize-none text-[13px] leading-relaxed bg-card"
              data-testid="input-conversation"
            />
            <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-primary">REC</span>
            </div>
          </div>
          <Button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="w-full mt-3"
            size="lg"
            data-testid="button-analyze"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI解析中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                AI解析 — カルテ自動生成
              </>
            )}
          </Button>
        </div>

        <div>
          <p className="text-[11px] font-mono text-muted-foreground tracking-[2px] mb-2.5 flex items-center gap-2">
            <ClipboardList className="w-3 h-3" />
            AI生成カルテ
          </p>

          {!analysisResult && !isAnalyzing && (
            <div className="h-[280px] bg-card border border-dashed border-border rounded-md flex items-center justify-center">
              <div className="text-center">
                <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground/50" data-testid="text-empty-analysis">
                  会話を入力して「AI解析」を押してください
                </p>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="h-[280px] bg-primary/5 border border-primary/20 rounded-md flex items-center justify-center">
              <div className="text-center">
                <Brain className="w-10 h-10 text-primary mx-auto mb-3 animate-pulse" />
                <p className="text-[13px] text-primary tracking-wider" data-testid="text-analyzing">
                  AI 解析中...
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  会話 x 生活データ 統合分析
                </p>
              </div>
            </div>
          )}

          {analysisResult && !analysisResult.error && (
            <ScrollArea className="h-[280px] bg-card border border-primary/20 rounded-md">
              <div className="p-4 space-y-3" data-testid="panel-analysis-result">
                {[
                  { label: "主訴", value: analysisResult.chief_complaint },
                  { label: "所見", value: analysisResult.findings },
                  { label: "処置", value: analysisResult.treatment },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-mono text-primary tracking-[2px] mb-1">{label}</p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-line">{value}</p>
                  </div>
                ))}
                {analysisResult.advice && analysisResult.advice.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-primary tracking-[2px] mb-1">アドバイス</p>
                    {analysisResult.advice.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1">
                        <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground/80 leading-relaxed">{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {analysisResult?.error && (
            <div className="h-[280px] bg-destructive/5 border border-destructive/30 rounded-md flex items-center justify-center">
              <p className="text-[13px] text-destructive" data-testid="text-analysis-error">
                {analysisResult.error}
              </p>
            </div>
          )}
        </div>
      </div>

      {analysisResult && !analysisResult.error && (
        <div className="mt-6 animate-slide-up">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <p className="text-[11px] font-mono text-muted-foreground tracking-[2px]">
                AIレコメンド商品
              </p>
            </div>
            {analysisResult.reason && (
              <p className="text-[12px] text-muted-foreground mb-4" data-testid="text-recommendation-reason">
                {analysisResult.reason}
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(recommendedProducts.length > 0 ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).map(p => {
                const IconComp = PRODUCT_ICONS[p.id] || Shield;
                const colorClass = PRODUCT_COLORS[p.id] || "bg-primary/20 text-primary";
                return (
                  <div
                    key={p.id}
                    className="bg-card border border-border rounded-md p-3.5 hover-elevate"
                    data-testid={`card-product-${p.id}`}
                  >
                    <div className={`w-10 h-10 rounded-md ${colorClass} flex items-center justify-center mb-2.5`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <p className="text-[13px] text-foreground font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                    <p className="text-sm text-primary font-mono font-bold mt-2">
                      ¥{p.price.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={onSendToPatient}
              variant="outline"
              className="w-full mt-4"
              size="lg"
              data-testid="button-send-to-patient"
            >
              <Send className="w-4 h-4" />
              患者スマホへ送信
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
