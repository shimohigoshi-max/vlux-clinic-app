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
  Users, ShoppingCart, Package, Calendar, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import type {
  SummaryResult, KarteResult, CorrelationResult,
  Product, TreatmentRecord, KarteHistoryEntry,
} from "@/lib/constants";
import {
  DEMO_PRODUCTS, TREATMENT_HISTORY, HEALTH_DATA,
  REV_CONV_RATE,
  statusColor, statusBg, genWeeklyData,
} from "@/lib/constants";
import { useState, useMemo } from "react";

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
  karteSaved?: boolean;
  correlationResult: CorrelationResult | null;
  isCorrelating: boolean;
  onDoCorrelation: () => void;
  healthSynced: boolean;
  healthSyncing: boolean;
  onSyncHealth: () => void;
  onSendToPatient: () => void;
  karteHistory: KarteHistoryEntry[];
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
    summary, isSummarizing, karte, isAnalyzing, onDoKarte, karteSaved,
    correlationResult, isCorrelating, onDoCorrelation,
    healthSynced, healthSyncing, onSyncHealth, onSendToPatient,
    karteHistory,
  } = props;

  const recProds = karte?.recommended_products
    ? DEMO_PRODUCTS.filter(p => karte.recommended_products!.includes(p.id))
    : DEMO_PRODUCTS.slice(0, 2);

  const weeklyData = useMemo(() => genWeeklyData(), []);

  const tabs = [
    { id: "voice", label: "音声入力", icon: Mic },
    { id: "karte", label: "カルテ履歴", icon: FileText },
    { id: "history", label: "履歴・相関分析", icon: BarChart3 },
    ...(healthSynced ? [{ id: "health", label: "健康データ", icon: Heart }] : []),
    { id: "ec-sales", label: "通販売上", icon: ShoppingCart },
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
            {karteSaved && (
              <div className="flex items-center gap-1.5 mt-2 justify-center" data-testid="text-karte-saved">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-mono">カルテ保存済み</span>
              </div>
            )}
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
        <KarteHistoryTab
          karteHistory={karteHistory}
          onSendToPatient={onSendToPatient}
          karteSaved={karteSaved}
        />
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

      {ipadTab === "ec-sales" && <ECSalesTab />}
    </div>
  );
}


function KarteHistoryTab({ karteHistory, onSendToPatient, karteSaved }: { karteHistory: KarteHistoryEntry[]; onSendToPatient: () => void; karteSaved?: boolean }) {
  const latestId = karteHistory.length > 0 ? karteHistory[0].id : null;
  const [expandedId, setExpandedId] = useState<string | null>(latestId);
  const [prevLatestId, setPrevLatestId] = useState<string | null>(latestId);
  if (latestId !== prevLatestId) {
    setPrevLatestId(latestId);
    setExpandedId(latestId);
  }

  if (karteHistory.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-[12px] text-muted-foreground/50" data-testid="text-empty-karte">音声入力タブで会話を入力しカルテを生成してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="karte-history-tab">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-mono text-muted-foreground tracking-[2px]">
            カルテ履歴（{karteHistory.length}件）
          </p>
          {karteSaved && (
            <div className="flex items-center gap-1" data-testid="text-karte-saved">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-mono">カルテ保存済み</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSendToPatient}
          data-testid="button-send-to-patient"
        >
          <Send className="w-3.5 h-3.5" /> 患者スマホへ送信
        </Button>
      </div>

      <ScrollArea className="h-[560px]">
        <div className="space-y-3 pr-2">
          {karteHistory.map((entry, idx) => {
            const isExpanded = expandedId === entry.id;
            const k = entry.karte;
            const s = entry.summary;
            const entryProds = k.recommended_products
              ? DEMO_PRODUCTS.filter(p => k.recommended_products!.includes(p.id))
              : DEMO_PRODUCTS.slice(0, 2);

            return (
              <Card
                key={entry.id}
                className={`border transition-all ${idx === 0 ? "border-primary/30" : "border-border"}`}
                style={{ background: idx === 0 ? "rgba(0,200,150,.03)" : "rgba(255,255,255,.02)" }}
                data-testid={`karte-history-entry-${entry.id}`}
              >
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  data-testid={`karte-history-toggle-${entry.id}`}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono text-[12px] text-foreground/70">{entry.createdAt}</span>
                  </div>
                  {idx === 0 && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px]">最新</Badge>
                  )}
                  <span className="text-[12px] text-foreground/60 flex-1 truncate">
                    {k.chief_complaint || "カルテ"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 animate-slide-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-[9px] font-mono text-primary tracking-[3px] border-b border-primary/20 pb-1">正式カルテ</p>
                        {([
                          ["主訴", k.chief_complaint],
                          ["所見", k.findings],
                          ["処置内容", k.treatment],
                        ] as [string, string | undefined][]).map(([label, val]) => val ? (
                          <div key={label}>
                            <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-0.5">{label}</p>
                            <p className="text-[12px] text-foreground/70 leading-relaxed whitespace-pre-line">{val}</p>
                          </div>
                        ) : null)}
                        {k.advice && k.advice.length > 0 && (
                          <div>
                            <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-0.5">アドバイス</p>
                            {k.advice.map((a, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                <span className="text-[11px] text-foreground/60 leading-relaxed">{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {k.patient_message && (
                          <div className="p-2.5 bg-chart-3/10 border border-chart-3/20 rounded-md">
                            <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-1">患者へのメッセージ</p>
                            <p className="text-[11px] text-foreground/60 leading-relaxed">{k.patient_message}</p>
                          </div>
                        )}
                        {entryProds.length > 0 && (
                          <div>
                            <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">AI レコメンド商品</p>
                            {k.reason && <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{k.reason}</p>}
                            {entryProds.map(p => {
                              const Icon = PRODUCT_ICONS[p.id] || Shield;
                              return (
                                <div key={p.id} className="flex gap-2 mb-2 bg-primary/5 rounded-md p-2">
                                  <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-foreground/80">{p.name}</p>
                                    <p className="text-[11px] text-primary font-mono font-bold">¥{p.price.toLocaleString()}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] font-mono text-chart-3 tracking-[3px] border-b border-chart-3/20 pb-1">AI 要点整理</p>
                        {s && !s.error ? (
                          <div className="space-y-2.5">
                            {([
                              ["主訴", s.chief_complaint],
                              ["主要症状", s.key_symptoms?.join(" / ")],
                              ["生活習慣の問題", s.lifestyle_issues?.join(" / ")],
                              ["処置内容", s.treatment_done],
                              ["ホームケア", s.home_care?.join(" / ")],
                              ["次回注意点", s.follow_up],
                            ] as [string, string | undefined][]).map(([label, val]) => val ? (
                              <div key={label}>
                                <p className="text-[9px] font-mono text-chart-3/70 tracking-[2px] mb-0.5">{label}</p>
                                <p className="text-[12px] text-foreground/60 leading-relaxed">{val}</p>
                              </div>
                            ) : null)}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/50 py-4 text-center">要点整理データなし</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function ECSalesTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const salesData = {
    today: {
      orders: 3, revenue: 12740, avgPrice: 4247, topProduct: "3D骨盤サポートベルト",
      items: [
        { time: "09:15", patient: "田中太郎", product: "リカバリーMag", qty: 1, price: 3280, via: "AI推薦" },
        { time: "11:42", patient: "鈴木花子", product: "3D骨盤サポートベルト", qty: 1, price: 4980, via: "先生推薦" },
        { time: "14:30", patient: "佐藤健一", product: "電解質ウォーター", qty: 2, price: 4480, via: "リピート" },
      ],
    },
    week: {
      orders: 18, revenue: 68400, avgPrice: 3800, topProduct: "リカバリーMag",
      items: [
        { time: "3/10", patient: "田中太郎 他2名", product: "リカバリーMag", qty: 4, price: 13120, via: "AI推薦" },
        { time: "3/9", patient: "山田美咲 他1名", product: "3D骨盤サポートベルト", qty: 3, price: 14940, via: "先生推薦" },
        { time: "3/8", patient: "佐藤健一 他3名", product: "電解質ウォーター", qty: 6, price: 14880, via: "リピート" },
        { time: "3/7", patient: "高橋雄大 他1名", product: "腰椎クッション", qty: 2, price: 11960, via: "AI推薦" },
        { time: "3/6", patient: "渡辺麻衣 他2名", product: "リカバリーMag", qty: 3, price: 9840, via: "先生推薦" },
      ],
    },
    month: {
      orders: 67, revenue: 254600, avgPrice: 3800, topProduct: "リカバリーMag",
      items: [
        { time: "第2週", patient: "18件", product: "リカバリーMag", qty: 22, price: 72160, via: "AI推薦" },
        { time: "第2週", patient: "12件", product: "3D骨盤サポートベルト", qty: 15, price: 74700, via: "先生推薦" },
        { time: "第1週", patient: "15件", product: "電解質ウォーター", qty: 18, price: 44640, via: "リピート" },
        { time: "第1週", patient: "8件", product: "腰椎クッション", qty: 12, price: 71760, via: "AI推薦" },
      ],
    },
  };

  const current = salesData[period];

  const channelBreakdown = [
    { label: "AI推薦", pct: 45, color: "#0073e6", amount: Math.round(current.revenue * 0.45) },
    { label: "先生推薦", pct: 35, color: "#00c896", amount: Math.round(current.revenue * 0.35) },
    { label: "リピート", pct: 20, color: "#d4a030", amount: Math.round(current.revenue * 0.20) },
  ];

  const productRanking = [
    { name: "リカバリーMag", qty: period === "today" ? 1 : period === "week" ? 7 : 28, revenue: period === "today" ? 3280 : period === "week" ? 22960 : 91840, trend: "up" as const },
    { name: "3D骨盤サポートベルト", qty: period === "today" ? 1 : period === "week" ? 5 : 18, revenue: period === "today" ? 4980 : period === "week" ? 24900 : 89640, trend: "up" as const },
    { name: "電解質ウォーター", qty: period === "today" ? 2 : period === "week" ? 8 : 24, revenue: period === "today" ? 4480 : period === "week" ? 19840 : 59520, trend: "flat" as const },
    { name: "腰椎クッション", qty: period === "today" ? 0 : period === "week" ? 3 : 12, revenue: period === "today" ? 0 : period === "week" ? 17940 : 71760, trend: "down" as const },
  ];

  return (
    <div className="space-y-4" data-testid="ec-sales-tab">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[3px] text-primary/60 mb-0.5">EC SALES DASHBOARD</p>
          <p className="text-lg font-bold text-foreground">通販売上管理</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {([["today", "今日"], ["week", "週間"], ["month", "月間"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`px-3 py-1.5 text-[11px] transition-colors ${
                period === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`ec-period-${id}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3" data-testid="ec-kpi-cards">
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">売上</p>
          <p className="font-mono text-lg text-primary font-bold" data-testid="text-ec-revenue">
            ¥{current.revenue.toLocaleString()}
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">注文数</p>
          <p className="font-mono text-lg text-foreground font-bold" data-testid="text-ec-orders">
            {current.orders}件
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">平均単価</p>
          <p className="font-mono text-lg text-foreground font-bold">
            ¥{current.avgPrice.toLocaleString()}
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(0,200,150,.06)", borderColor: "rgba(0,200,150,.2)" }}>
          <p className="text-[9px] text-emerald-400 mb-1">購入転換率</p>
          <p className="font-mono text-lg text-emerald-400 font-bold">
            {(REV_CONV_RATE * 100)}%
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> 商品別ランキング
          </p>
          <Card className="border-border" style={{ background: "rgba(255,255,255,.02)" }}>
            {productRanking.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < productRanking.length - 1 ? "border-b border-border" : ""}`}
                data-testid={`ec-product-rank-${i}`}
              >
                <span className={`font-mono text-[13px] font-bold w-5 ${i === 0 ? "text-amber-400" : i === 1 ? "text-foreground/60" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.qty}個販売</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12px] text-foreground font-bold">¥{p.revenue.toLocaleString()}</p>
                  {p.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400 ml-auto" />}
                  {p.trend === "down" && <TrendingDown className="w-3 h-3 text-red-400 ml-auto" />}
                  {p.trend === "flat" && <Minus className="w-3 h-3 text-muted-foreground ml-auto" />}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> 経路別内訳
          </p>
          <Card className="p-3 border-border space-y-3" style={{ background: "rgba(255,255,255,.02)" }}>
            {channelBreakdown.map(ch => (
              <div key={ch.label} data-testid={`ec-channel-${ch.label}`}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px]" style={{ color: ch.color }}>{ch.label}</span>
                  <span className="font-mono text-[11px] text-foreground/70">{ch.pct}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${ch.pct}%`, background: ch.color }}
                  />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  ¥{ch.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {period === "today" ? "本日の注文" : period === "week" ? "今週の注文" : "今月の注文"}
        </p>
        <Card className="border-border" style={{ background: "rgba(255,255,255,.02)" }}>
          <div className="divide-y divide-border">
            {current.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5" data-testid={`ec-order-${i}`}>
                <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">{item.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate">{item.product} x{item.qty}</p>
                  <p className="text-[10px] text-muted-foreground">{item.patient}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] shrink-0 ${
                    item.via === "AI推薦" ? "border-blue-500/30 text-blue-400" :
                    item.via === "先生推薦" ? "border-emerald-500/30 text-emerald-400" :
                    "border-amber-500/30 text-amber-400"
                  }`}
                >
                  {item.via}
                </Badge>
                <span className="font-mono text-[12px] text-foreground font-bold w-20 text-right shrink-0">
                  ¥{item.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center pt-1">
        ※ デモ用のサンプルデータです
      </p>
    </div>
  );
}
