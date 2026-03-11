import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Zap, Send, Brain, Stethoscope, Check,
  Shield, Sparkles, Droplets, Layers,
  ClipboardList, Activity, Mic, MicOff, FileText,
  BarChart3, Heart, Footprints, Moon, Search,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  ChevronRight, MapPin, GlassWater, CircleDot,
  Satellite, DollarSign, Building2, Pill, Landmark, Dumbbell,
  ShieldCheck, ArrowUpDown, Users, Database, Crown,
} from "lucide-react";
import type {
  SummaryResult, KarteResult, CorrelationResult,
  Product, TreatmentRecord,
} from "@/lib/constants";
import {
  DEMO_PRODUCTS, TREATMENT_HISTORY, HEALTH_DATA,
  REV_UNIT_PRICE, REV_CONV_RATE, REV_SHARE_RATE, SAAS_MONTHLY_FEE,
  statusColor, statusBg, genWeeklyData,
} from "@/lib/constants";
import { useState, useMemo, useEffect } from "react";

interface IPadViewProps {
  ipadTab: string;
  onIpadTabChange: (tab: string) => void;
  transcript: string;
  onTranscriptChange: (val: string) => void;
  isRecording: boolean;
  onStartRec: () => void;
  onStopRec: () => void;
  onLoadSample: () => void;
  summary: SummaryResult | null;
  isSummarizing: boolean;
  karte: KarteResult | null;
  isAnalyzing: boolean;
  onDoKarte: () => void;
  correlationResult: CorrelationResult | null;
  isCorrelating: boolean;
  onDoCorrelation: () => void;
  healthSynced: boolean;
  healthSyncing: boolean;
  onSyncHealth: () => void;
  onSendToPatient: () => void;
}

const PRODUCT_ICONS: Record<string, typeof Shield> = {
  "W001": Shield,
  "S001": Sparkles,
  "S002": GlassWater,
  "W002": Layers,
};

export function IPadView(props: IPadViewProps) {
  const {
    ipadTab, onIpadTabChange, transcript, onTranscriptChange,
    isRecording, onStartRec, onStopRec, onLoadSample,
    summary, isSummarizing, karte, isAnalyzing, onDoKarte,
    correlationResult, isCorrelating, onDoCorrelation,
    healthSynced, healthSyncing, onSyncHealth, onSendToPatient,
  } = props;

  const recProds = karte?.recommended_products
    ? DEMO_PRODUCTS.filter(p => karte.recommended_products!.includes(p.id))
    : DEMO_PRODUCTS.slice(0, 2);

  const weeklyData = useMemo(() => genWeeklyData(), []);

  const tabs = [
    { id: "voice", label: "音声入力", icon: Mic },
    { id: "karte", label: "カルテ生成", icon: FileText },
    { id: "history", label: "履歴・相関分析", icon: BarChart3 },
    ...(healthSynced ? [{ id: "health", label: "健康データ", icon: Heart }] : []),
    { id: "platform", label: "データ基盤", icon: Satellite },
    { id: "revenue", label: "収益モデル", icon: DollarSign },
  ];

  return (
    <div className="max-w-[980px] mx-auto px-4 py-5 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <span className="text-[15px] font-bold text-foreground" data-testid="text-patient-name-ipad">田中 大輔</span>
        <Badge variant="secondary" data-testid="badge-age">42歳 男性</Badge>
        <Badge variant="outline" data-testid="badge-complaint">腰痛 / デスクワーク</Badge>
        {healthSynced && <Badge data-testid="badge-healthkit">HealthKit 連携済</Badge>}
        {!healthSynced && (
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncHealth}
              disabled={healthSyncing}
              data-testid="button-sync-health"
            >
              {healthSyncing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 同期中...</>
              ) : (
                <><Activity className="w-3.5 h-3.5" /> HealthKit 同期</>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="flex border-b border-border mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onIpadTabChange(t.id)}
            className={`flex items-center gap-1.5 flex-1 py-2.5 text-[11px] tracking-wider border-b-2 transition-colors ${
              ipadTab === t.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent"
            }`}
            data-testid={`tab-ipad-${t.id}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {ipadTab === "voice" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2">施術中の会話（マイク入力 or サンプル読込）</p>
            <div className="relative">
              <Textarea
                value={transcript}
                onChange={e => onTranscriptChange(e.target.value)}
                placeholder="ここに会話テキストが入ります。録音するかサンプルを読み込んでください..."
                className={`h-[260px] resize-none text-[12px] leading-[1.8] bg-card ${isRecording ? "border-primary" : ""}`}
                data-testid="input-transcript"
              />
              {isRecording && (
                <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] font-mono text-destructive">REC</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2.5">
              <Button
                className="flex-1"
                variant={isRecording ? "destructive" : "default"}
                onClick={isRecording ? onStopRec : onStartRec}
                data-testid="button-record"
              >
                {isRecording ? (
                  <><MicOff className="w-4 h-4" /> 録音停止</>
                ) : (
                  <><Mic className="w-4 h-4" /> 録音開始</>
                )}
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={onLoadSample}
                data-testid="button-load-sample"
              >
                <FileText className="w-4 h-4" /> サンプル読込
              </Button>
            </div>
            <Button
              className="w-full mt-2.5"
              size="lg"
              onClick={onDoKarte}
              disabled={isAnalyzing || !transcript.trim()}
              data-testid="button-generate-karte"
            >
              {isAnalyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> カルテ生成中...</>
              ) : (
                <><Zap className="w-4 h-4" /> 正式カルテ + 商品推薦を生成</>
              )}
            </Button>
          </div>

          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2">AI 要点整理（自動）</p>
            {!summary && !isSummarizing && (
              <div className="h-[260px] bg-card border border-dashed border-border rounded-md flex flex-col items-center justify-center gap-2">
                <ClipboardList className="w-7 h-7 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground/50" data-testid="text-empty-summary">音声入力後、自動で要約</p>
              </div>
            )}
            {isSummarizing && (
              <div className="h-[260px] bg-primary/5 border border-primary/20 rounded-md flex flex-col items-center justify-center">
                <Brain className="w-7 h-7 text-primary animate-pulse" />
                <p className="text-[12px] text-primary mt-2" data-testid="text-summarizing">要点を整理中...</p>
              </div>
            )}
            {summary && !summary.error && (
              <ScrollArea className="h-[260px] bg-card border border-primary/20 rounded-md">
                <div className="p-3.5 space-y-3" data-testid="panel-summary">
                  {([
                    ["主訴", summary.chief_complaint],
                    ["主要症状", summary.key_symptoms?.join(" / ")],
                    ["生活習慣の問題", summary.lifestyle_issues?.join(" / ")],
                    ["処置内容", summary.treatment_done],
                    ["ホームケア", summary.home_care?.join(" / ")],
                    ["次回注意点", summary.follow_up],
                  ] as [string, string | undefined][]).map(([k, v]) => v ? (
                    <div key={k}>
                      <p className="text-[9px] font-mono text-primary tracking-[2px]">{k}</p>
                      <p className="text-[12px] text-foreground/70 leading-relaxed mt-1">{v}</p>
                    </div>
                  ) : null)}
                </div>
              </ScrollArea>
            )}
            {summary?.error && (
              <div className="h-[260px] border border-destructive/30 rounded-md flex items-center justify-center">
                <p className="text-[12px] text-destructive" data-testid="text-summary-error">エラー。再度お試しください。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {ipadTab === "karte" && (
        <div>
          {!karte && (
            <div className="text-center py-16">
              <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[12px] text-muted-foreground/50" data-testid="text-empty-karte">音声入力タブで会話を入力しカルテを生成してください</p>
            </div>
          )}
          {karte?.error && (
            <div className="text-center py-10">
              <p className="text-destructive text-[12px]" data-testid="text-karte-error">エラーが発生しました。</p>
            </div>
          )}
          {karte && !karte.error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up">
              <Card className="p-4 space-y-3.5" data-testid="panel-karte-result">
                {([
                  ["主訴", karte.chief_complaint],
                  ["所見", karte.findings],
                  ["処置内容", karte.treatment],
                ] as [string, string | undefined][]).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9px] font-mono text-primary tracking-[2px] mb-1">{k}</p>
                    <p className="text-[13px] text-foreground/70 leading-relaxed whitespace-pre-line">{v}</p>
                  </div>
                ))}
                {karte.advice && karte.advice.length > 0 && (
                  <div>
                    <p className="text-[9px] font-mono text-primary tracking-[2px] mb-1">アドバイス</p>
                    {karte.advice.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1">
                        <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground/70 leading-relaxed">{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <div className="space-y-3">
                <Card className="p-4 border-primary/20" data-testid="panel-recommendations">
                  <p className="text-[9px] font-mono text-primary tracking-[2px] mb-2">AI レコメンド商品</p>
                  {karte.reason && <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{karte.reason}</p>}
                  {recProds.map(p => {
                    const Icon = PRODUCT_ICONS[p.id] || Shield;
                    return (
                      <div key={p.id} className="flex gap-2.5 mb-3 bg-primary/5 rounded-md p-2.5" data-testid={`card-rec-product-${p.id}`}>
                        <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[13px] text-foreground/90">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                          <p className="text-[13px] text-primary font-mono font-bold mt-1">¥{p.price.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  {karte.patient_message && (
                    <div className="mt-3 p-2.5 bg-chart-3/10 border border-chart-3/20 rounded-md">
                      <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-1">患者へのメッセージ</p>
                      <p className="text-[12px] text-foreground/60 leading-relaxed">{karte.patient_message}</p>
                    </div>
                  )}
                </Card>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={onSendToPatient}
                  data-testid="button-send-to-patient"
                >
                  <Send className="w-4 h-4" /> 患者スマホへ送信
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {ipadTab === "history" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2.5">治療履歴（通院 {TREATMENT_HISTORY.length} 回）</p>
            <ScrollArea className="h-[500px] pr-1">
              <div className="space-y-0">
                {TREATMENT_HISTORY.map((h, i) => (
                  <div key={i} className="flex gap-2.5" data-testid={`card-history-${i}`}>
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-primary" : "bg-muted"}`} />
                      {i < TREATMENT_HISTORY.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className={`flex-1 rounded-md p-2.5 mb-2.5 border ${i === 0 ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-mono ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{h.date}</span>
                        {i === 0 && <Badge variant="default" className="text-[9px] h-4">今日</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[12px] text-foreground/90 font-semibold">{h.area}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">{h.treatment}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "疼痛", val: `${h.pain}/10`, color: statusColor(10 - h.pain, 4, 6) },
                          { label: "歩数", val: h.steps.toLocaleString(), color: statusColor(h.steps, 5000, 2000) },
                          { label: "睡眠", val: `${h.sleep}h`, color: statusColor(h.sleep, 7, 5.5) },
                          { label: "HRV", val: String(h.hrv), color: statusColor(h.hrv, 50, 35) },
                        ].map(m => (
                          <span key={m.label} className="bg-background/60 rounded px-1.5 py-0.5 text-[10px]">
                            <span className="text-muted-foreground">{m.label} </span>
                            <span className={`font-mono ${m.color}`}>{m.val}</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-relaxed">{h.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2.5">AI 相関分析</p>
            <Button
              className="w-full mb-3.5"
              size="lg"
              onClick={onDoCorrelation}
              disabled={isCorrelating}
              data-testid="button-correlate"
            >
              {isCorrelating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 相関分析中...</>
              ) : (
                <><Search className="w-4 h-4" /> 治療履歴 x 生活データ 相関分析</>
              )}
            </Button>

            {!correlationResult && !isCorrelating && (
              <div className="bg-card border border-dashed border-border rounded-md p-8 text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-[12px] text-muted-foreground/50 leading-relaxed" data-testid="text-empty-correlation">
                  ボタンを押すとAIが<br />過去{TREATMENT_HISTORY.length}回の治療データと<br />生活習慣の相関を分析します
                </p>
              </div>
            )}

            {isCorrelating && (
              <div className="bg-primary/5 border border-primary/20 rounded-md p-10 text-center">
                <Brain className="w-8 h-8 text-primary animate-pulse mx-auto mb-3" />
                <p className="text-[12px] text-primary mb-1" data-testid="text-correlating">{TREATMENT_HISTORY.length}回分のデータを解析中...</p>
                <p className="text-[11px] text-muted-foreground">治療部位 x 歩数 x 睡眠 x HRV の相関を計算しています</p>
              </div>
            )}

            {correlationResult && !correlationResult.error && (
              <ScrollArea className="h-[440px] pr-1" data-testid="panel-correlation">
                <div className="space-y-2.5 animate-slide-up">
                  <Card className="p-3.5 border-primary/20">
                    <p className="text-[9px] font-mono text-primary tracking-[2px] mb-1.5">総括</p>
                    <p className="text-[12px] text-foreground/70 leading-relaxed">{correlationResult.summary}</p>
                  </Card>

                  {correlationResult.improvement_trend && (
                    <Card className="p-3.5">
                      <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-2">回復トレンド</p>
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14">
                          <svg viewBox="0 0 36 36" className="w-14 h-14" style={{ transform: "rotate(-90deg)" }}>
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none"
                              stroke={
                                correlationResult.improvement_trend!.score >= 60 ? "hsl(160, 80%, 45%)"
                                : correlationResult.improvement_trend!.score >= 40 ? "hsl(40, 90%, 55%)"
                                : "hsl(0, 70%, 55%)"
                              }
                              strokeWidth="3"
                              strokeDasharray={`${correlationResult.improvement_trend!.score} 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold font-mono text-foreground">
                            {correlationResult.improvement_trend!.score}
                          </div>
                        </div>
                        <div>
                          <div className={`text-[13px] font-bold flex items-center gap-1 ${
                            correlationResult.improvement_trend!.direction === "改善" ? "text-emerald-400"
                            : correlationResult.improvement_trend!.direction === "悪化" ? "text-red-400"
                            : "text-amber-400"
                          }`}>
                            {correlationResult.improvement_trend!.direction === "改善" ? <TrendingUp className="w-4 h-4" />
                              : correlationResult.improvement_trend!.direction === "悪化" ? <TrendingDown className="w-4 h-4" />
                              : <Minus className="w-4 h-4" />}
                            {correlationResult.improvement_trend!.direction}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{correlationResult.improvement_trend!.comment}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {correlationResult.correlations && correlationResult.correlations.length > 0 && (
                    <Card className="p-3.5">
                      <p className="text-[9px] font-mono text-amber-400 tracking-[2px] mb-2">発見された相関パターン</p>
                      {correlationResult.correlations.map((c, i) => (
                        <div key={i} className={`mb-2.5 pb-2.5 ${i < correlationResult.correlations!.length - 1 ? "border-b border-border" : ""}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] text-amber-300 font-semibold">{c.title}</span>
                            <Badge
                              variant="outline"
                              className={`ml-auto text-[9px] h-4 ${
                                c.strength === "強" ? "text-red-400 border-red-400/30"
                                : c.strength === "中" ? "text-amber-400 border-amber-400/30"
                                : "text-emerald-400 border-emerald-400/30"
                              }`}
                            >
                              相関 {c.strength}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-foreground/60 leading-relaxed">{c.finding}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1">根拠: {c.data_evidence}</p>
                        </div>
                      ))}
                    </Card>
                  )}

                  {correlationResult.risk_areas && correlationResult.risk_areas.length > 0 && (
                    <Card className="p-3.5">
                      <p className="text-[9px] font-mono text-red-400 tracking-[2px] mb-2">リスク部位</p>
                      {correlationResult.risk_areas.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 shrink-0 mt-0.5 ${
                              r.risk_level === "高" ? "text-red-400 border-red-400/30"
                              : r.risk_level === "中" ? "text-amber-400 border-amber-400/30"
                              : "text-emerald-400 border-emerald-400/30"
                            }`}
                          >{r.risk_level}</Badge>
                          <div>
                            <p className="text-[12px] text-foreground/80">{r.area}</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{r.reason}</p>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {correlationResult.lifestyle_triggers && correlationResult.lifestyle_triggers.length > 0 && (
                    <Card className="p-3.5">
                      <p className="text-[9px] font-mono text-purple-400 tracking-[2px] mb-2">悪化トリガー</p>
                      {correlationResult.lifestyle_triggers.map((t, i) => (
                        <div key={i} className="flex gap-1.5 mb-1.5">
                          <Zap className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[12px] text-purple-300">{t.trigger}</span>
                            <span className="text-[11px] text-muted-foreground ml-1.5">→ {t.impact}</span>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}

                  <Card className="p-3.5 border-chart-3/20">
                    {correlationResult.next_session_focus && correlationResult.next_session_focus.length > 0 && (
                      <div className="mb-2.5">
                        <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-1.5">次回施術の重点ポイント</p>
                        {correlationResult.next_session_focus.map((f, i) => (
                          <div key={i} className="flex gap-1.5 mb-1">
                            <ChevronRight className="w-3 h-3 text-chart-3 mt-0.5 shrink-0" />
                            <span className="text-[12px] text-foreground/60 leading-relaxed">{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {correlationResult.prediction && (
                      <div>
                        <p className="text-[9px] font-mono text-muted-foreground tracking-[2px] mb-1">1ヶ月後の予測</p>
                        <p className="text-[12px] text-muted-foreground/70 leading-relaxed italic">"{correlationResult.prediction}"</p>
                      </div>
                    )}
                  </Card>
                </div>
              </ScrollArea>
            )}

            {correlationResult?.error && (
              <div className="border border-destructive/30 rounded-md p-5 text-center">
                <p className="text-[12px] text-destructive" data-testid="text-correlation-error">エラーが発生しました。再度お試しください。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {ipadTab === "health" && healthSynced && (
        <div className="animate-fade-in">
          <div className="flex gap-2 mb-4 flex-wrap">
            <Badge>Apple HealthKit</Badge>
            <Badge variant="secondary">Google Fit 対応</Badge>
            <Badge variant="outline">最終同期: 今日 9:38</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { icon: Footprints, label: "歩数", value: HEALTH_DATA.steps.toLocaleString(), unit: "steps", color: statusColor(HEALTH_DATA.steps, 5000, 2000) },
              { icon: Moon, label: "睡眠", value: String(HEALTH_DATA.sleep), unit: "h", color: statusColor(HEALTH_DATA.sleep, 7, 5.5) },
              { icon: Heart, label: "心拍", value: String(HEALTH_DATA.heartRate), unit: "bpm", color: "text-red-400" },
              { icon: Zap, label: "HRV", value: String(HEALTH_DATA.hrv), unit: "ms", color: statusColor(HEALTH_DATA.hrv, 50, 35) },
            ].map(m => (
              <Card key={m.label} className="p-4 text-center" data-testid={`card-health-${m.label}`}>
                <m.icon className={`w-6 h-6 mx-auto mb-1.5 ${m.color}`} />
                <p className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{m.label} / {m.unit}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4" data-testid="card-weekly-chart">
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-3">過去7日間 歩数トレンド</p>
            <div className="flex gap-1.5 items-end h-24">
              {weeklyData.map((d, i) => {
                const h = Math.max((d.steps / 8000) * 90, 6);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-sm ${i === 6 ? "bg-primary" : "bg-muted"}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className={`text-[9px] ${i === 6 ? "text-primary" : "text-muted-foreground"}`}>{d.date}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {ipadTab === "platform" && <DataPlatformTab />}

      {ipadTab === "revenue" && <RevenueModelTab />}
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <span className="font-mono">{count.toLocaleString()}{suffix}</span>;
}

function DataPlatformTab() {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);

  const quadrants = [
    { id: "insurance", icon: Building2, label: "保険会社", color: "#0073e6", sub: "腰痛リスク予測モデル", detail: "過去の治療データと生活習慣から、腰痛リスクを事前に予測。保険料のパーソナライズに活用。" },
    { id: "pharma", icon: Pill, label: "製薬・サプリ", color: "#00c896", sub: "実証データで新商品開発", detail: "750万人の実データに基づくサプリメント効果検証。臨床エビデンスの構築を支援。" },
    { id: "finance", icon: Landmark, label: "金融機関", color: "#d4a030", sub: "健康スコア連動型金利", detail: "VLUXスコアと連動した金利優遇プログラム。健康維持のインセンティブ設計。" },
    { id: "fitness", icon: Dumbbell, label: "フィットネス", color: "#c090ff", sub: "未病顧客へのターゲット広告", detail: "整骨院データから「運動不足だが健康意識が高い層」を特定。高精度な広告配信。" },
  ];

  const complianceItems = [
    { label: "個人情報保護法準拠設計", done: true },
    { label: "医療情報二次利用同意フロー", done: true },
    { label: "ISMS取得予定（Phase 4）", done: false },
    { label: "SOC2準拠予定（Phase 4）", done: false },
  ];

  return (
    <div className="space-y-5" data-testid="platform-tab">
      <div className="text-center mb-1">
        <p className="font-mono text-[10px] tracking-[3px] text-purple-400/60 mb-0.5">PHASE 4 VISION</p>
        <p className="text-lg font-bold text-foreground">データプラットフォーム構想</p>
      </div>

      <div className="grid grid-cols-3 gap-3" data-testid="platform-scale-meters">
        {[
          { label: "参加院数", target: 7500, suffix: "院", color: "#0073e6" },
          { label: "登録患者数", target: 7500000, suffix: "人", color: "#00c896" },
          { label: "蓄積データ件数", target: 2800000000, suffix: "件", color: "#c090ff" },
        ].map(m => (
          <Card key={m.label} className="p-4 text-center border-border" style={{ background: "rgba(255,255,255,.02)" }}>
            <p className="text-[9px] text-muted-foreground tracking-wider mb-1">{m.label}</p>
            <p className="text-xl font-bold" style={{ color: m.color }}>
              <AnimatedCounter target={m.target} />
            </p>
            <p className="text-[10px]" style={{ color: m.color }}>{m.suffix}（目標）</p>
          </Card>
        ))}
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground tracking-[2px] mb-3">データ価値マップ</p>
        <div className="grid grid-cols-2 gap-3" data-testid="platform-value-map">
          {quadrants.map(q => {
            const isHovered = hoveredQuadrant === q.id;
            return (
              <button
                key={q.id}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background: isHovered ? `rgba(${q.color === "#0073e6" ? "0,115,230" : q.color === "#00c896" ? "0,200,150" : q.color === "#d4a030" ? "212,160,48" : "192,144,255"},.12)` : "rgba(255,255,255,.03)",
                  border: `1px solid ${isHovered ? q.color + "50" : "var(--border)"}`,
                  boxShadow: isHovered ? `0 0 16px ${q.color}25` : "none",
                }}
                onMouseEnter={() => setHoveredQuadrant(q.id)}
                onMouseLeave={() => setHoveredQuadrant(null)}
                onClick={() => setHoveredQuadrant(isHovered ? null : q.id)}
                data-testid={`platform-quadrant-${q.id}`}
              >
                <q.icon className="w-5 h-5 mb-2" style={{ color: q.color }} />
                <p className="text-[12px] font-bold" style={{ color: q.color }}>{q.label}</p>
                <p className="text-[11px] text-foreground/60 mt-0.5">{q.sub}</p>
                {isHovered && (
                  <p className="text-[10px] text-foreground/40 mt-2 leading-relaxed animate-fade-in">
                    {q.detail}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-4 border-border" style={{ background: "rgba(136,102,255,.06)", borderColor: "rgba(136,102,255,.2)" }} data-testid="platform-inheritance">
        <p className="text-[10px] text-purple-400 tracking-[2px] mb-2 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> 院跨ぎデータ継承
        </p>
        <p className="text-[12px] text-foreground/70 leading-relaxed mb-3">
          「田中さんが別の整骨院を訪れても、すべての治療履歴が引き継がれます。」
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "患者LTV", val: "∞", sub: "プラットフォームから離れられない" },
            { label: "院のメリット", val: "深い施術", sub: "初診でも過去データが活用可能" },
            { label: "VLUXのモート", val: "圧倒的", sub: "後発は永遠に追いつけない" },
          ].map(m => (
            <div key={m.label} className="bg-black/20 rounded-lg p-2.5 text-center">
              <p className="text-[9px] text-purple-400/60 mb-0.5">{m.label}</p>
              <p className="font-mono text-[14px] font-bold text-purple-300">{m.val}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight">{m.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-border" style={{ background: "rgba(255,255,255,.02)" }} data-testid="platform-compliance">
        <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> 法務・コンプライアンス
        </p>
        <div className="grid grid-cols-2 gap-2">
          {complianceItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              {item.done ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded border border-muted-foreground/30 shrink-0" />
              )}
              <span className={`text-[11px] ${item.done ? "text-foreground/70" : "text-muted-foreground/50"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RevenueModelTab() {
  const [revenueTab, setRevenueTab] = useState("clinic");
  const [patients, setPatients] = useState(100);
  const [saasCount, setSaasCount] = useState(20);

  const ecMonthly = Math.round(patients * REV_UNIT_PRICE * REV_CONV_RATE);
  const vluxEcShare = Math.round(ecMonthly * REV_SHARE_RATE);
  const saasMonthly = saasCount * SAAS_MONTHLY_FEE;
  const totalEcAllClinics = vluxEcShare * saasCount;
  const totalMonthly = saasMonthly + totalEcAllClinics;

  return (
    <div className="space-y-5" data-testid="revenue-tab">
      <div className="text-center mb-1">
        <p className="font-mono text-[10px] tracking-[3px] text-amber-400/60 mb-0.5">REVENUE MODEL</p>
        <p className="text-lg font-bold text-foreground">収益モデルシミュレーター</p>
      </div>

      <div className="flex border-b border-border">
        {([["clinic", "院内収益"], ["ec", "EC収益"], ["saas", "SaaS収益"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRevenueTab(id)}
            className={`flex-1 py-2 text-[11px] tracking-wider border-b-2 transition-colors ${
              revenueTab === id ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            }`}
            data-testid={`revenue-subtab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      {revenueTab === "clinic" && (
        <div className="space-y-3" data-testid="revenue-clinic">
          {[
            { icon: Brain, label: "AI自動カルテ", metric: "先生の工数", before: "100%", after: "-60%", impact: "診察件数 +20%", color: "#0073e6" },
            { icon: Crown, label: "会員ランク制度", metric: "再来院率", before: "基準値", after: "+35%", impact: "患者定着率の大幅向上", color: "#d4a030" },
            { icon: Heart, label: "HealthKit連携", metric: "施術精度", before: "問診のみ", after: "データ併用", impact: "口コミ拡大・紹介増", color: "#00c896" },
          ].map(item => (
            <Card key={item.label} className="p-4 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
                <span className="text-[12px] font-bold" style={{ color: item.color }}>{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">{item.metric}</p>
                  <p className="font-mono text-[14px] text-muted-foreground">{item.before}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
                  <p className="text-[9px]" style={{ color: item.color }}>改善後</p>
                  <p className="font-mono text-[14px] font-bold" style={{ color: item.color }}>{item.after}</p>
                </div>
              </div>
              <p className="text-[10px] text-foreground/50 mt-2 text-center">{item.impact}</p>
            </Card>
          ))}
        </div>
      )}

      {revenueTab === "ec" && (
        <div className="space-y-4" data-testid="revenue-ec">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">患者数</span>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPatients(p => Math.max(10, p - 10))} data-testid="btn-patients-minus">
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="font-mono text-[14px] text-foreground font-bold w-16 text-center" data-testid="text-patients-count">
                  {patients}人
                </span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPatients(p => Math.min(1000, p + 10))} data-testid="btn-patients-plus">
                  <ArrowUpDown className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-300" style={{ width: `${(patients / 1000) * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3 border-border text-center" style={{ background: "rgba(255,255,255,.03)" }}>
              <p className="text-[9px] text-muted-foreground">平均購入単価</p>
              <p className="font-mono text-[14px] text-foreground font-bold">¥{REV_UNIT_PRICE.toLocaleString()}</p>
            </Card>
            <Card className="p-3 border-border text-center" style={{ background: "rgba(255,255,255,.03)" }}>
              <p className="text-[9px] text-muted-foreground">購入転換率</p>
              <p className="font-mono text-[14px] text-foreground font-bold">{(REV_CONV_RATE * 100)}%</p>
              <p className="text-[8px] text-primary/60">先生推薦+AI連携の効果</p>
            </Card>
          </div>

          <Card className="p-4 border-primary/20" style={{ background: "rgba(0,200,150,.06)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-muted-foreground">月間EC売上（1院あたり）</span>
              <span className="font-mono text-lg text-primary font-bold" data-testid="text-ec-monthly">
                ¥{ecMonthly.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">VLUX運営収入（{(REV_SHARE_RATE * 100)}%）</span>
              <span className="font-mono text-[14px] text-amber-400 font-bold" data-testid="text-ec-vlux-share">
                ¥{vluxEcShare.toLocaleString()}/月
              </span>
            </div>
          </Card>
        </div>
      )}

      {revenueTab === "saas" && (
        <div className="space-y-4" data-testid="revenue-saas">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">契約院数</span>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setSaasCount(c => Math.max(1, c - 5))} data-testid="btn-saas-minus">
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="font-mono text-[14px] text-foreground font-bold w-16 text-center" data-testid="text-saas-count">
                  {saasCount}院
                </span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setSaasCount(c => Math.min(200, c + 5))} data-testid="btn-saas-plus">
                  <ArrowUpDown className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300" style={{ width: `${(saasCount / 200) * 100}%` }} />
            </div>
          </div>

          <Card className="p-3 border-border text-center" style={{ background: "rgba(255,255,255,.03)" }}>
            <p className="text-[9px] text-muted-foreground">月額プラン</p>
            <p className="font-mono text-[14px] text-foreground font-bold">¥{SAAS_MONTHLY_FEE.toLocaleString()} / 院</p>
          </Card>

          <Card className="p-4 border-purple-500/20" style={{ background: "rgba(136,102,255,.06)" }}>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">SaaS月額収入</span>
                <span className="font-mono text-[14px] text-purple-400 font-bold" data-testid="text-saas-monthly">
                  ¥{saasMonthly.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">EC レベニューシェア（{(REV_SHARE_RATE * 100)}%）</span>
                <span className="font-mono text-[14px] text-amber-400 font-bold">
                  ¥{totalEcAllClinics.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="text-[12px] text-foreground font-semibold">合計月次収益</span>
                <span className="font-mono text-xl text-primary font-bold" data-testid="text-total-monthly">
                  ¥{totalMonthly.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/40 text-center pt-2">
        ※ このシミュレーターはデモ用の概算値です。実際の収益は市場環境により変動します。
      </p>
    </div>
  );
}
