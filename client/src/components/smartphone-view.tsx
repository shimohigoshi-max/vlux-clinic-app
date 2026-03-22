import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Footprints, Moon, Droplets, ShoppingCart,
  Stethoscope, Check, Bell, Shield, Sparkles, Layers,
  ChevronRight, Clock, Plus, GlassWater, Heart, Zap,
  Calendar, Ticket, Loader2, Activity, Trophy, Users, Link,
  Crown, Award, Leaf, TrendingUp, Target, MapPin, AlertCircle,
} from "lucide-react";
import type { KarteResult, Product, LifeAdvice, SupabaseVisit, SupabaseHealthData, PatientProfile } from "@/lib/constants";
import {
  DEMO_PRODUCTS, TREATMENT_HISTORY,
  RANKS, getRank, getNextRank,
  CLINIC_MASTER,
  statusColor, statusBg,
} from "@/lib/constants";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface SmartphoneViewProps {
  patientSent: boolean;
  karte: KarteResult | null;
  phoneTab: string;
  onPhoneTabChange: (tab: string) => void;
  cart: Product[];
  onAddToCart: (product: Product) => void;
  purchaseMsg: string;
  recommendedProducts: Product[];
  healthSynced: boolean;
  healthSyncing: boolean;
  onSyncHealth: () => void;
}

const PRODUCT_ICONS: Record<string, typeof Shield> = {
  "W001": Shield,
  "S001": Sparkles,
  "S002": GlassWater,
  "W002": Layers,
};

export function SmartphoneView({
  patientSent, karte, phoneTab, onPhoneTabChange,
  cart, onAddToCart, purchaseMsg, recommendedProducts,
  healthSynced, healthSyncing, onSyncHealth,
}: SmartphoneViewProps) {

  const [activeClinic, setActiveClinic] = useState("tanaka");

  const { data: profile } = useQuery<PatientProfile>({
    queryKey: ["/api/patient/profile"],
    staleTime: 30000,
  });

  const { data: visits = [], isLoading: visitsLoading, error: visitsError } = useQuery<SupabaseVisit[]>({
    queryKey: ["/api/patient/visits"],
    staleTime: 10000,
  });

  const { data: healthRows = [], isLoading: healthLoading, error: healthError } = useQuery<SupabaseHealthData[]>({
    queryKey: ["/api/patient/health-data"],
    staleTime: 30000,
  });

  const visitCount = profile?.visit_count ?? TREATMENT_HISTORY.length;
  const memberGrade = profile?.member_grade ?? "bronze";

  // 最新来院の生活アドバイス
  const latestVisit = visits[0];
  const latestAdvice: string[] = latestVisit?.lifestyle_advice ?? [];

  // 今日以外の過去来院
  const pastVisits = patientSent ? visits.slice(1) : visits;

  return (
    <div className="max-w-[400px] mx-auto py-5 px-4 animate-fade-in">
      <div className="rounded-[2.5rem] border-[3px] border-border bg-background shadow-2xl overflow-hidden">
        <div className="bg-card/80 px-6 pt-3 pb-2 flex justify-between text-[10px] font-mono text-muted-foreground">
          <span data-testid="text-phone-time">9:41</span>
          <span className="text-primary text-[9px] tracking-[1px]">VLUX</span>
          <span>100%</span>
        </div>

        <div className="bg-gradient-to-b from-card to-background px-4 pt-3 pb-0">
          {patientSent && (
            <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2.5 mb-3 flex items-center gap-2.5 animate-fade-in" data-testid="notification-report">
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[12px] text-primary font-bold">本日の施術レポートが届きました</p>
                <p className="text-[10px] text-muted-foreground">先生からのアドバイスを確認しましょう</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground" data-testid="text-phone-patient-name">田中 大輔 さん</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> 次回: 3月16日（土）14:00
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {(() => {
              const latest = healthRows[healthRows.length - 1];
              const stepsVal = latest?.steps ? latest.steps.toLocaleString() : "---";
              const sleepVal = latest?.sleep_minutes ? `${(latest.sleep_minutes / 60).toFixed(1)}h` : "---";
              const hrVal = latest?.heart_rate_avg ? String(latest.heart_rate_avg) : "---";
              return [
                { icon: Footprints, v: healthRows.length > 0 ? stepsVal : "---", label: "歩数", color: "text-teal-400" },
                { icon: Moon, v: healthRows.length > 0 ? sleepVal : "---", label: "睡眠", color: "text-amber-400" },
                { icon: Heart, v: healthRows.length > 0 ? hrVal : "---", label: "心拍", color: "text-red-400" },
              ];
            })().map(m => (
              <div key={m.label} className="bg-muted/40 rounded-md p-2 text-center" data-testid={`phone-metric-${m.label}`}>
                <m.icon className={`w-4 h-4 mx-auto mb-0.5 ${m.color}`} />
                <p className={`font-mono text-[12px] font-bold ${m.color}`}>{m.v}</p>
                <p className="text-[9px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {!healthSynced ? (
            <Button
              variant="outline"
              className="w-full mb-3 border-primary/30 text-primary"
              size="sm"
              onClick={onSyncHealth}
              disabled={healthSyncing}
              data-testid="button-phone-sync-health"
            >
              {healthSyncing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 同期中...</>
              ) : (
                <><Activity className="w-3.5 h-3.5" /> Apple HealthKit を接続する</>
              )}
            </Button>
          ) : (
            <p className="text-[10px] text-primary text-center mb-2.5 flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Apple HealthKit 連携済 · 自動同期 ON
            </p>
          )}

          <div className="flex border-b border-border">
            {([["timeline", "タイムライン"], ["health", "健康データ"], ["shop", "VLUXストア"], ["rank", "VLUXスコア"]] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => onPhoneTabChange(tab)}
                className={`flex-1 py-2 text-[11px] tracking-wider border-b-2 transition-colors ${
                  phoneTab === tab
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent"
                }`}
                data-testid={`phone-tab-${tab}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="px-4 py-3">

            {phoneTab === "timeline" && (
              <div className="space-y-2.5">
                <ClinicBanner activeClinic={activeClinic} onSwitch={setActiveClinic} />

                {patientSent && karte && !karte.error ? (
                  <>
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3.5 animate-slide-up" data-testid="card-today-treatment">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Stethoscope className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] text-primary font-medium">今日の施術レポート</span>
                        <span className="ml-auto text-[9px] text-muted-foreground">今日</span>
                      </div>
                      {karte.chief_complaint && (
                        <p className="text-[12px] text-foreground/80 font-medium mb-1.5" data-testid="text-phone-chief-complaint">
                          {karte.chief_complaint}
                        </p>
                      )}
                      {karte.assessment && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">{karte.assessment}</p>
                      )}
                      {karte.treatment_plan && (
                        <p className="text-[11px] text-primary/70 leading-relaxed">施術: {karte.treatment_plan}</p>
                      )}
                    </div>

                    {(karte.lifestyle_advice && karte.lifestyle_advice.length > 0) && (
                      <div className="bg-amber-500/5 border border-amber-500/15 rounded-md p-3.5" data-testid="card-doctor-notes">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Activity className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px] text-amber-400 font-bold">生活アドバイス</span>
                        </div>
                        {karte.lifestyle_advice.map((n, i) => (
                          <div key={i} className="flex gap-1.5 mb-1.5">
                            <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                            <span className="text-[12px] text-amber-300/70 leading-relaxed">{n}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {karte.risk_flags && karte.risk_flags.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3" data-testid="card-risk-flags">
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-[10px] text-red-400 font-medium">注意事項</span>
                        </div>
                        {karte.risk_flags.map((f, i) => (
                          <p key={i} className="text-[11px] text-red-300/70 leading-relaxed mb-1">{f}</p>
                        ))}
                      </div>
                    )}

                    {karte.follow_up && (
                      <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2" data-testid="card-follow-up">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <p className="text-[11px] text-muted-foreground">{karte.follow_up}</p>
                      </div>
                    )}

                    <CouponWallet expanded />

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => alert("デモ：予約システム連携\n実装時はカレンダーUIを表示")}
                      data-testid="button-book-appointment"
                    >
                      <Calendar className="w-4 h-4" /> 次回の予約を取る
                    </Button>
                  </>
                ) : (
                  <>
                    <CouponWallet expanded={false} />

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => alert("デモ：予約システム連携")}
                      data-testid="button-book-appointment-initial"
                    >
                      <Calendar className="w-4 h-4" /> 次回の予約を取る
                    </Button>

                    <div className="text-center py-4">
                      <Stethoscope className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-[12px] text-muted-foreground/40" data-testid="text-phone-empty-timeline">
                        施術後、先生からのノートがここに届きます
                      </p>
                    </div>
                  </>
                )}

                {visitsLoading && (
                  <div className="flex items-center justify-center py-6 gap-2" data-testid="visits-loading">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[12px] text-muted-foreground">履歴を読み込んでいます...</span>
                  </div>
                )}
                {visitsError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-center gap-2" data-testid="visits-error">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-[11px] text-red-300">施術履歴の取得に失敗しました</p>
                  </div>
                )}
                {!visitsLoading && !visitsError && pastVisits.length === 0 && !patientSent && (
                  <div className="text-center py-4" data-testid="visits-empty">
                    <Stethoscope className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-[12px] text-muted-foreground/50">まだ記録がありません</p>
                  </div>
                )}
                {pastVisits.map((visit, i) => {
                  const d = new Date(visit.visited_at);
                  const dateLabel = d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
                  const soap = visit.soap_note;
                  return (
                    <div key={visit.id} className="bg-card border border-border rounded-md p-3" data-testid={`card-past-report-${i}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-primary" />
                          <span className="text-[10px] text-primary">施術レポート</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono">{dateLabel}</span>
                      </div>
                      <p className="text-[12px] text-foreground/70 font-medium mb-1">
                        {visit.chief_complaint ?? soap?.chief_complaint ?? "主訴なし"}
                      </p>
                      {soap?.treatment_plan && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">施術: {soap.treatment_plan}</p>
                      )}
                      {visit.lifestyle_advice && visit.lifestyle_advice.length > 0 && (
                        <div className="mt-1.5">
                          {visit.lifestyle_advice.slice(0, 1).map((a, j) => (
                            <div key={j} className="flex gap-1 items-start">
                              <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-[11px] text-amber-300/60 leading-relaxed">{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {phoneTab === "health" && (
              <div>
                {healthLoading && (
                  <div className="flex items-center justify-center py-10 gap-2" data-testid="health-loading">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[12px] text-muted-foreground">健康データを読み込んでいます...</span>
                  </div>
                )}
                {healthError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-center gap-2 mt-3" data-testid="health-error">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-[11px] text-red-300">健康データの取得に失敗しました</p>
                  </div>
                )}
                {!healthLoading && !healthError && healthRows.length === 0 && (
                  <div className="text-center py-10" data-testid="health-empty">
                    <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-[12px] text-muted-foreground/50">まだ記録がありません</p>
                  </div>
                )}
                {!healthLoading && healthRows.length > 0 && (() => {
                  const latest = healthRows[healthRows.length - 1];
                  const steps = latest.steps ?? 0;
                  const sleepH = latest.sleep_minutes ? (latest.sleep_minutes / 60) : 0;
                  const hr = latest.heart_rate_avg ?? 0;
                  const metrics = [
                    { icon: Footprints, label: "今日の歩数", value: steps.toLocaleString(), unit: "steps", pct: (steps / 8000) * 100, color: statusColor(steps, 5000, 2000), bar: statusBg(steps, 5000, 2000) },
                    { icon: Moon, label: "昨夜の睡眠", value: sleepH.toFixed(1), unit: "時間", pct: (sleepH / 9) * 100, color: statusColor(sleepH, 7, 5.5), bar: statusBg(sleepH, 7, 5.5) },
                    { icon: Heart, label: "安静時心拍", value: hr > 0 ? String(hr) : "---", unit: "bpm", pct: hr > 0 ? Math.min(hr / 120 * 100, 100) : 0, color: "text-red-400", bar: "bg-red-400" },
                  ];
                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-primary text-right flex items-center justify-end gap-1">
                        <Check className="w-3 h-3" /> 最終同期: {latest.recorded_date}
                      </p>
                      {metrics.map(m => (
                        <div key={m.label} className="bg-card border border-border rounded-md p-3" data-testid={`phone-health-${m.label}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground">{m.label}</p>
                              <p className={`font-mono text-base font-bold ${m.color}`}>
                                {m.value} <span className="text-[10px] text-muted-foreground font-normal">{m.unit}</span>
                              </p>
                            </div>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${m.bar} transition-all duration-1000`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground text-center pt-1">直近7日分のデータを表示</p>
                      <div className="grid grid-cols-7 gap-1 pt-1" data-testid="health-week-chart">
                        {healthRows.map((row, i) => {
                          const s = row.steps ?? 0;
                          const pct = Math.min((s / 8000) * 100, 100);
                          const d = new Date(row.recorded_date);
                          const dayLabel = d.toLocaleDateString("ja-JP", { weekday: "short" });
                          return (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div className="w-full h-12 bg-border/40 rounded-sm relative overflow-hidden">
                                <div className={`absolute bottom-0 w-full rounded-sm transition-all ${statusBg(s, 5000, 2000)}`} style={{ height: `${pct}%` }} />
                              </div>
                              <span className="text-[8px] text-muted-foreground">{dayLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {phoneTab === "shop" && (
              <ShopTab
                patientSent={patientSent}
                recommendedProducts={recommendedProducts}
                cart={cart}
                onAddToCart={onAddToCart}
                purchaseMsg={purchaseMsg}
                visitCount={visitCount}
              />
            )}

            {phoneTab === "rank" && <RankTab visitCount={visitCount} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ShopTab({
  patientSent, recommendedProducts, cart, onAddToCart, purchaseMsg, visitCount,
}: {
  patientSent: boolean;
  recommendedProducts: Product[];
  cart: Product[];
  onAddToCart: (p: Product) => void;
  purchaseMsg: string;
  visitCount: number;
}) {
  const rank = getRank(visitCount);
  const recProds = patientSent ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2);

  return (
    <div className="space-y-2.5">
      {purchaseMsg && (
        <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-[12px] text-primary flex items-center gap-1.5 animate-fade-in" data-testid="text-purchase-msg">
          <Check className="w-3.5 h-3.5" /> {purchaseMsg}
        </div>
      )}

      {rank && (
        <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: rank.gradient, border: `1px solid ${rank.border}50` }} data-testid="shop-rank-banner">
          <Crown className="w-4 h-4" style={{ color: rank.glow }} />
          <div>
            <p className="text-[10px] font-bold" style={{ color: rank.color }}>{rank.label}会員特典</p>
            <p className="text-[11px]" style={{ color: rank.glow }}>
              通販 <span className="font-mono font-bold">{rank.ecDiscount}% OFF</span> · ポイント <span className="font-mono font-bold">{rank.pointRate}%</span> 還元
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground tracking-wider" data-testid="text-shop-subtitle">
        {patientSent ? "今日の施術データに基づくおすすめ" : "あなたの健康状態に合わせたおすすめ"}
      </p>

      {recProds.map(p => {
        const IconComp = PRODUCT_ICONS[p.id] || Shield;
        const inCart = cart.some(c => c.id === p.id);
        const discounted = rank ? Math.round(p.price * (1 - rank.ecDiscount / 100)) : p.price;
        const pts = rank ? Math.round(discounted * rank.pointRate / 100) : 0;
        return (
          <div key={p.id} className="bg-primary/5 border border-primary/10 rounded-md p-3 flex gap-2.5" data-testid={`card-shop-product-${p.id}`}>
            <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <IconComp className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-foreground font-medium truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{p.desc}</p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  {rank && rank.ecDiscount > 0 ? (
                    <div>
                      <span className="font-mono text-[11px] text-muted-foreground line-through">¥{p.price.toLocaleString()}</span>
                      <span className="font-mono text-[14px] text-primary font-bold ml-1.5">¥{discounted.toLocaleString()}</span>
                      <p className="text-[9px] mt-0.5" style={{ color: rank.glow }}>+{pts}pt</p>
                    </div>
                  ) : (
                    <span className="text-[13px] text-primary font-mono font-bold">¥{p.price.toLocaleString()}</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={inCart ? "secondary" : "default"}
                  onClick={() => onAddToCart(p)}
                  disabled={inCart}
                  data-testid={`button-add-cart-${p.id}`}
                >
                  {inCart ? <><Check className="w-3 h-3" /> 追加済</> : "カートへ"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="border-t border-border pt-2.5 mt-1">
        <p className="text-[10px] text-muted-foreground mb-2">その他の商品</p>
        {DEMO_PRODUCTS.filter(p => !recProds.some(rp => rp.id === p.id)).map(p => {
          const IconComp = PRODUCT_ICONS[p.id] || Shield;
          const inCart = cart.some(c => c.id === p.id);
          const discounted = rank ? Math.round(p.price * (1 - rank.ecDiscount / 100)) : p.price;
          return (
            <div key={p.id} className="bg-muted/30 border border-border rounded-md p-2.5 mb-2 flex gap-2 items-center" data-testid={`card-other-product-${p.id}`}>
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <IconComp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground/70 truncate">{p.name}</p>
                <div className="flex gap-1.5 items-center mt-0.5">
                  {rank && rank.ecDiscount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono line-through">¥{p.price.toLocaleString()}</span>
                  )}
                  <span className="text-[11px] font-mono" style={{ color: rank ? rank.glow : undefined }}>¥{discounted.toLocaleString()}</span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onAddToCart(p)}
                disabled={inCart}
                data-testid={`button-add-other-${p.id}`}
              >
                {inCart ? <Check className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="sticky bottom-0 bg-background border-t border-border pt-2.5 pb-1">
          <Button className="w-full" size="lg" data-testid="button-checkout">
            <ShoppingCart className="w-4 h-4" />
            カート ({cart.length}点) · ¥{cart.reduce((s, p) => {
              const d = rank ? Math.round(p.price * (1 - rank.ecDiscount / 100)) : p.price;
              return s + d;
            }, 0).toLocaleString()} — 購入する
          </Button>
        </div>
      )}
    </div>
  );
}

function RankTab({ visitCount }: { visitCount: number }) {
  const rank = getRank(visitCount);
  const nextRank = getNextRank(visitCount);

  return (
    <div className="space-y-3" data-testid="rank-tab">
      {rank ? (
        <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: rank.gradient, border: `1px solid ${rank.border}`, boxShadow: `0 4px 24px ${rank.glow}30` }} data-testid="rank-card">
          <div className="flex items-center gap-2.5 mb-3">
            <Crown className="w-8 h-8" style={{ color: rank.glow }} />
            <div>
              <p className="font-mono text-[10px] tracking-[3px]" style={{ color: rank.glow }}>{rank.labelEn}</p>
              <p className="text-lg font-bold" style={{ color: rank.color }}>{rank.label}会員</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            {[
              { label: "通算来院", val: `${visitCount}回` },
              { label: "通販割引", val: `${rank.ecDiscount}%` },
              { label: "ポイント還元", val: `${rank.pointRate}%` },
            ].map(m => (
              <div key={m.label} className="bg-black/30 rounded-lg p-2 text-center">
                <p className="font-mono text-[13px] font-bold" style={{ color: rank.color }}>{m.val}</p>
                <p className="text-[8px]" style={{ color: rank.glow }}>{m.label}</p>
              </div>
            ))}
          </div>
          {nextRank ? (
            <div>
              <div className="flex justify-between text-[9px] mb-1" style={{ color: rank.glow }}>
                <span>次のランク：{nextRank.label}（{nextRank.visits}回）</span>
                <span>{visitCount} / {nextRank.visits}回</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${(visitCount / nextRank.visits) * 100}%`,
                    background: `linear-gradient(90deg,${rank.glow},${nextRank.glow})`,
                  }}
                />
              </div>
              <p className="text-[9px] mt-1 text-right" style={{ color: rank.glow }}>
                あと {nextRank.visits - visitCount} 回で {nextRank.label}へ
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-center py-1" style={{ color: rank.glow }}>
              最高ランク達成！すべての特典が解放されています
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Award className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">5回来院でブロンズランク獲得！</p>
        </div>
      )}

      {rank && (
        <div className="bg-muted/20 border rounded-md p-3.5" style={{ borderColor: `${rank.border}40` }} data-testid="rank-perks">
          <p className="text-[10px] tracking-[2px] mb-2.5" style={{ color: rank.glow }}>現在の特典一覧</p>
          {rank.perks.map((p, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: rank.glow }} />
              <span className="text-[12px] text-foreground/70 leading-relaxed">{p}</span>
            </div>
          ))}
        </div>
      )}

      <div data-testid="rank-roadmap">
        <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2.5">ランクロードマップ</p>
        {[...RANKS].reverse().map((r, i) => {
          const achieved = visitCount >= r.visits;
          const isCurrent = rank?.id === r.id;
          return (
            <div key={r.id} className="flex gap-2.5 mb-2" style={{ opacity: achieved ? 1 : 0.45 }} data-testid={`rank-tier-${r.id}`}>
              <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{
                    background: achieved ? r.glow : "var(--muted-foreground)",
                    boxShadow: isCurrent ? `0 0 6px ${r.glow}` : "none",
                  }}
                />
                {i < RANKS.length - 1 && <div className="w-px flex-1 bg-border mt-0.5" />}
              </div>
              <div
                className="flex-1 rounded-lg p-2.5 mb-0.5"
                style={{
                  background: isCurrent ? r.gradient : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isCurrent ? r.border : "var(--border)"}`,
                  boxShadow: isCurrent ? `0 0 12px ${r.glow}25` : "none",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Crown className="w-4 h-4" style={{ color: isCurrent ? r.color : "var(--muted-foreground)" }} />
                  <span className="font-mono text-[11px] font-bold" style={{ color: isCurrent ? r.color : "var(--muted-foreground)" }}>
                    {r.label}
                  </span>
                  {isCurrent && (
                    <Badge variant="outline" className="ml-auto text-[8px] h-3.5" style={{ color: r.glow, borderColor: `${r.glow}60` }}>
                      現在
                    </Badge>
                  )}
                  <span className={`text-[9px] text-muted-foreground ${isCurrent ? "" : "ml-auto"}`}>{r.visits}回〜</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[`割引 ¥${r.couponDiscount.toLocaleString()}/回`, `通販 ${r.ecDiscount}%OFF`, `PT ${r.pointRate}%`].map(t => (
                    <span key={t} className="text-[9px] bg-black/30 rounded px-1.5 py-0.5" style={{ color: isCurrent ? r.glow : "var(--muted-foreground)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CouponWallet({ expanded }: { expanded: boolean }) {
  return (
    <div className="space-y-2" data-testid="coupon-wallet">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-amber-400 font-bold">クーポンウォレット</span>
        </div>
        <span className="text-[10px] text-muted-foreground">通算 8回来院 · 有効 3枚</span>
      </div>

      <div className="bg-gradient-to-br from-rose-500/12 to-rose-900/8 border border-dashed border-rose-400/20 rounded-md p-3.5 relative overflow-hidden" data-testid="card-coupon-visit">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Ticket className="w-3 h-3 text-rose-400" />
          <span className="text-[11px] text-rose-400 font-bold">
            {expanded ? "今回の施術 来院クーポン" : "来院クーポン（毎回付与）"}
          </span>
          <Badge variant="outline" className="ml-auto text-[9px] h-4 text-rose-400 border-rose-400/30">
            {expanded ? "NEW · 3/31まで" : "3/31まで"}
          </Badge>
        </div>
        <p className="text-xl font-bold font-mono text-rose-300 mb-0.5">¥500 OFF</p>
        <p className="text-[10px] text-muted-foreground/40 mb-2.5">
          {expanded ? "次回施術料金より。毎回の来院でプレゼント。" : "次回施術料金より割引。"}
        </p>
        <div className="bg-background/60 rounded-md px-3 py-1.5 flex items-center justify-between">
          <span className="font-mono text-[13px] text-rose-400 tracking-[4px]">CHE-0309</span>
          <span className="text-[9px] text-muted-foreground/30">来院時に提示</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-amber-900/7 border border-dashed border-amber-500/20 rounded-md p-3.5 relative overflow-hidden" data-testid="card-coupon-loyalty">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] text-amber-400 font-bold">継続通院 8回達成クーポン</span>
          <Badge variant="outline" className="ml-auto text-[9px] h-4 text-amber-400 border-amber-400/30">4/30まで</Badge>
        </div>
        <p className="text-xl font-bold font-mono text-amber-300 mb-0.5">¥1,000 OFF</p>
        <p className="text-[10px] text-muted-foreground/40 mb-2.5">
          {expanded ? "10回達成ごとに自動付与。次は10回目で¥1,500 OFFへ。" : "次：10回で¥1,500 OFF"}
        </p>
        <div className="mb-2.5">
          <div className="flex justify-between text-[9px] text-muted-foreground/40 mb-1">
            <span>{expanded ? "次のマイルストーン：10回" : "次：10回で¥1,500 OFF"}</span>
            <span>8 / 10回</span>
          </div>
          <div className="h-1.5 bg-background/60 rounded-full overflow-hidden">
            <div className="h-full w-4/5 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" />
          </div>
        </div>
        <div className="bg-background/60 rounded-md px-3 py-1.5 flex items-center justify-between">
          <span className="font-mono text-[13px] text-amber-400 tracking-[4px]">VIP-0008</span>
          <span className="text-[9px] text-muted-foreground/30">来院時に提示</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-dashed border-primary/20 rounded-md p-3.5 relative overflow-hidden" data-testid="card-coupon-referral">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Users className="w-3 h-3 text-primary" />
          <span className="text-[11px] text-primary font-bold">お友達紹介クーポン</span>
          <Badge variant="outline" className="ml-auto text-[9px] h-4 text-primary border-primary/30">期限なし</Badge>
        </div>
        <div className="flex gap-2.5 mb-2.5">
          <div className="flex-1 bg-background/60 rounded-md p-2 text-center">
            <p className="text-[9px] text-muted-foreground/40 mb-0.5">紹介した方{expanded ? "に" : ""}</p>
            <p className="text-base font-bold font-mono text-primary">¥500</p>
            {expanded && <p className="text-[9px] text-muted-foreground/40">初回割引</p>}
          </div>
          <div className="flex items-center text-muted-foreground/30">+</div>
          <div className="flex-1 bg-background/60 rounded-md p-2 text-center">
            <p className="text-[9px] text-muted-foreground/40 mb-0.5">あなたにも</p>
            <p className="text-base font-bold font-mono text-primary">¥500</p>
            {expanded && <p className="text-[9px] text-muted-foreground/40">次回割引</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-primary/30 text-primary text-[12px] font-bold"
          onClick={() => alert("デモ：LINEシェア / QRコード表示")}
          data-testid="button-share-referral"
        >
          <Link className="w-3.5 h-3.5" /> 紹介リンクをシェアする
        </Button>
      </div>
    </div>
  );
}


function ClinicBanner({ activeClinic, onSwitch }: { activeClinic: string; onSwitch: (id: string) => void }) {
  const clinics = Object.values(CLINIC_MASTER);
  const switched = activeClinic !== "tanaka";

  return (
    <div className="mb-2.5" data-testid="clinic-banner">
      <div className="bg-muted/30 border border-border rounded-xl p-3">
        <p className="text-[9px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> 本日の来院先
        </p>
        <div className="flex gap-2 mb-2">
          {clinics.map(c => (
            <button
              key={c.id}
              onClick={() => onSwitch(c.id)}
              className={`flex-1 rounded-lg p-2 text-center text-[11px] font-semibold transition-all ${
                activeClinic === c.id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted/40 text-muted-foreground border border-transparent"
              }`}
              data-testid={`clinic-btn-${c.id}`}
            >
              {c.name} {activeClinic === c.id ? (
                <Check className="w-3 h-3 inline ml-0.5" />
              ) : null}
            </button>
          ))}
        </div>
        {switched && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex gap-2 items-start animate-fade-in" data-testid="clinic-inherited-msg">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-400 font-semibold">前回来院（田中整骨院）のデータを引き継ぎました</p>
              <p className="text-[9px] text-blue-400/60 mt-0.5">健康スコア・生活アドバイス・HealthKitデータは継続されます</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LifeAdviceCard({ lifeAdvice }: { lifeAdvice: LifeAdvice }) {
  const priorityStyles: Record<string, { bg: string; text: string; iconBg: string }> = {
    "\u9AD8": { bg: "bg-red-500/20", text: "text-red-400", iconBg: "bg-red-500/15" },
    "\u4E2D": { bg: "bg-amber-500/20", text: "text-amber-400", iconBg: "bg-amber-500/12" },
    "\u4F4E": { bg: "bg-primary/15", text: "text-primary", iconBg: "bg-primary/10" },
  };

  return (
    <div className="space-y-2" data-testid="card-life-advice">
      <div
        className="rounded-xl p-3.5 relative overflow-hidden border"
        style={{
          background: "linear-gradient(135deg,rgba(0,180,120,.12),rgba(0,80,60,.08))",
          borderColor: "rgba(0,184,120,0.25)",
        }}
      >
        <div className="absolute -top-3 -right-3 text-[60px] opacity-[0.05] pointer-events-none">
          <Leaf className="w-16 h-16" />
        </div>

        <div className="flex items-center gap-2 mb-2.5">
          <div className="bg-primary/15 border border-primary/30 rounded-lg px-2.5 py-1">
            <p className="text-[8px] text-primary/70 tracking-[2px] leading-tight">今月のテーマ</p>
            <p className="text-[13px] text-primary font-bold leading-tight" data-testid="text-life-advice-theme">
              {lifeAdvice.this_month_theme}
            </p>
          </div>
          <Badge
            variant="outline"
            className="ml-auto text-[8px] h-4 text-primary/80 border-primary/30 bg-primary/10"
            data-testid="badge-life-advice-updated"
          >
            <Sparkles className="w-2.5 h-2.5 mr-0.5" /> 今日更新
          </Badge>
        </div>

        {lifeAdvice.improved_from_last && (
          <div className="bg-black/20 rounded-lg p-2.5 mb-3 flex gap-2 items-start" data-testid="text-life-advice-improvement">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[8px] text-emerald-600 tracking-wider mb-0.5">前回からの改善</p>
              <p className="text-[11px] text-emerald-400/70 leading-relaxed">{lifeAdvice.improved_from_last}</p>
            </div>
          </div>
        )}

        <p className="text-[8px] text-emerald-700 tracking-[2px] mb-2">生活改善フォーカス</p>
        <div className="space-y-2" data-testid="life-advice-focus-areas">
          {lifeAdvice.focus_areas?.map((area, i) => {
            const style = priorityStyles[area.priority] || priorityStyles["\u4F4E"];
            return (
              <div key={i} className="flex gap-2 items-start" data-testid={`life-advice-area-${i}`}>
                <div
                  className={`min-w-[28px] h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${style.iconBg}`}
                >
                  {area.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] text-emerald-400/80 font-semibold">{area.category}</span>
                    <span className={`text-[8px] px-1.5 py-px rounded ${style.bg} ${style.text}`}>
                      {area.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400/50 leading-relaxed">{area.advice}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lifeAdvice.one_thing_today && (
        <div
          className="rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg,rgba(0,120,220,.1),rgba(0,60,140,.07))",
            borderColor: "rgba(0,102,204,0.25)",
          }}
          data-testid="text-life-advice-today"
        >
          <p className="text-[8px] text-sky-500 tracking-[2px] mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" /> 今日からできること
          </p>
          <p className="text-[13px] text-sky-300/80 font-semibold leading-relaxed">{lifeAdvice.one_thing_today}</p>
        </div>
      )}

      {lifeAdvice.next_visit_goal && (
        <div
          className="rounded-xl p-3 border border-border bg-muted/20"
          data-testid="text-life-advice-goal"
        >
          <p className="text-[8px] text-muted-foreground tracking-[2px] mb-1 flex items-center gap-1">
            <Target className="w-3 h-3" /> 次回来院までの目標
          </p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed italic">
            "{lifeAdvice.next_visit_goal}"
          </p>
        </div>
      )}
    </div>
  );
}

function ClipboardPenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M10.4 12.6a2 2 0 0 1 3 3L8 21l-4 1 1-4Z" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5.5" />
      <path d="M4 13.5V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
