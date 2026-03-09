import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Footprints, Moon, Droplets, ShoppingCart,
  Stethoscope, Check, Bell, Shield, Sparkles, Layers,
  ChevronRight, Clock, Plus, GlassWater, Heart, Zap,
  Calendar, Ticket, Loader2, Activity,
} from "lucide-react";
import type { KarteResult, Product } from "@/lib/constants";
import {
  HEALTH_DATA, DEMO_PRODUCTS, PAST_TIMELINE_ITEMS,
  statusColor, statusBg,
} from "@/lib/constants";

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

  return (
    <div className="max-w-[400px] mx-auto py-5 px-4 animate-fade-in">
      <div className="rounded-[2.5rem] border-[3px] border-border bg-background shadow-2xl overflow-hidden">
        <div className="bg-card/80 px-6 pt-3 pb-2 flex justify-between text-[10px] font-mono text-muted-foreground">
          <span data-testid="text-phone-time">9:41</span>
          <span className="text-primary text-[9px]">Connected Health</span>
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
            {[
              { icon: Footprints, v: healthSynced ? HEALTH_DATA.steps.toLocaleString() : "---", label: "歩数", color: "text-red-400" },
              { icon: Moon, v: healthSynced ? `${HEALTH_DATA.sleep}h` : "---", label: "睡眠", color: "text-amber-400" },
              { icon: Heart, v: healthSynced ? String(HEALTH_DATA.heartRate) : "---", label: "心拍", color: "text-red-300" },
            ].map(m => (
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
            {([["timeline", "タイムライン"], ["health", "健康データ"], ["shop", "ショップ"]] as const).map(([tab, label]) => (
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
                {patientSent && karte && !karte.error ? (
                  <>
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3.5 animate-slide-up" data-testid="card-today-treatment">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Stethoscope className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] text-primary font-medium">今日の施術レポート</span>
                        <span className="ml-auto text-[9px] text-muted-foreground">今日</span>
                      </div>
                      <p className="text-[12px] text-foreground/70 leading-relaxed" data-testid="text-phone-patient-message">
                        {karte.patient_message}
                      </p>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-md p-3.5" data-testid="card-doctor-notes">
                      <div className="flex items-center gap-1.5 mb-3">
                        <ClipboardPenIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] text-amber-400 font-bold">先生からのノート</span>
                      </div>

                      {karte.lifestyle_notes && karte.lifestyle_notes.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] text-amber-400 tracking-[2px] mb-1.5 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> 生活習慣の改善ポイント
                          </p>
                          {karte.lifestyle_notes.map((n, i) => (
                            <div key={i} className="flex gap-1.5 mb-1">
                              <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-amber-300/70 leading-relaxed">{n}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {karte.diet_advice && karte.diet_advice.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] text-emerald-400 tracking-[2px] mb-1.5 flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> 食事・水分アドバイス
                          </p>
                          {karte.diet_advice.map((n, i) => (
                            <div key={i} className="flex gap-1.5 mb-1">
                              <ChevronRight className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-emerald-300/70 leading-relaxed">{n}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {karte.supplement_advice && karte.supplement_advice.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] text-indigo-400 tracking-[2px] mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> サプリメントの推奨
                          </p>
                          {karte.supplement_advice.map((s, i) => (
                            <div key={i} className="bg-indigo-500/10 rounded-md p-2.5 mb-1.5">
                              <p className="text-[12px] text-indigo-300 font-semibold">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {s.timing}
                              </p>
                              <p className="text-[11px] text-indigo-300/60 mt-0.5 leading-relaxed">→ {s.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {karte.self_care && karte.self_care.length > 0 && (
                        <div>
                          <p className="text-[9px] text-sky-400 tracking-[2px] mb-1.5 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> 自分でできるケア
                          </p>
                          {karte.self_care.map((n, i) => (
                            <div key={i} className="flex gap-1.5 mb-1">
                              <ChevronRight className="w-3 h-3 text-sky-400 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-sky-300/70 leading-relaxed">{n}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-rose-500/10 to-rose-900/5 border border-dashed border-rose-400/20 rounded-md p-3.5 relative overflow-hidden" data-testid="card-coupon">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Ticket className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-[11px] text-rose-400 font-bold">今月のご来院クーポン</span>
                        <Badge variant="outline" className="ml-auto text-[9px] h-4 text-rose-400 border-rose-400/30">3/31まで</Badge>
                      </div>
                      <p className="text-xl font-bold font-mono text-rose-300 mb-1">¥500 OFF</p>
                      <p className="text-[11px] text-muted-foreground/50 mb-2.5">次回施術料金より割引。1回限り有効。</p>
                      <div className="bg-background rounded-md px-3 py-2 flex items-center justify-between">
                        <span className="font-mono text-sm text-rose-400 tracking-[4px]">CHE-0309</span>
                        <span className="text-[10px] text-muted-foreground/40">提示してご利用ください</span>
                      </div>
                    </div>

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
                    <div className="bg-gradient-to-br from-rose-500/10 to-rose-900/5 border border-dashed border-rose-400/20 rounded-md p-3.5" data-testid="card-coupon-initial">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Ticket className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-[11px] text-rose-400 font-bold">今月のご来院クーポン</span>
                        <Badge variant="outline" className="ml-auto text-[9px] h-4 text-rose-400 border-rose-400/30">3/31まで</Badge>
                      </div>
                      <p className="text-xl font-bold font-mono text-rose-300 mb-1">¥500 OFF</p>
                      <p className="text-[11px] text-muted-foreground/50 mb-2.5">次回施術料金より割引。1回限り有効。</p>
                      <div className="bg-background rounded-md px-3 py-2 font-mono text-sm text-rose-400 tracking-[4px]">CHE-0309</div>
                    </div>

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

                {PAST_TIMELINE_ITEMS.map((item, i) => (
                  <div key={i} className="bg-card border border-border rounded-md p-3" data-testid={`card-past-report-${i}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1">
                        <Stethoscope className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-primary">施術レポート</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{item.date}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.msg}</p>
                  </div>
                ))}
              </div>
            )}

            {phoneTab === "health" && (
              <div>
                {!healthSynced ? (
                  <div className="text-center py-10">
                    <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-[12px] text-muted-foreground/50">Apple HealthKit を接続してください</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-primary text-right flex items-center justify-end gap-1">
                      <Check className="w-3 h-3" /> 最終同期: 今日 9:38
                    </p>
                    {[
                      { icon: Footprints, label: "今日の歩数", value: HEALTH_DATA.steps.toLocaleString(), unit: "steps", pct: (HEALTH_DATA.steps / 8000) * 100, color: statusColor(HEALTH_DATA.steps, 5000, 2000), bar: statusBg(HEALTH_DATA.steps, 5000, 2000) },
                      { icon: Moon, label: "昨夜の睡眠", value: String(HEALTH_DATA.sleep), unit: "時間", pct: (HEALTH_DATA.sleep / 9) * 100, color: statusColor(HEALTH_DATA.sleep, 7, 5.5), bar: statusBg(HEALTH_DATA.sleep, 7, 5.5) },
                      { icon: Heart, label: "安静時心拍", value: String(HEALTH_DATA.heartRate), unit: "bpm", pct: 60, color: "text-red-400", bar: "bg-red-400" },
                      { icon: Zap, label: "HRV", value: String(HEALTH_DATA.hrv), unit: "ms", pct: (HEALTH_DATA.hrv / 80) * 100, color: statusColor(HEALTH_DATA.hrv, 50, 35), bar: statusBg(HEALTH_DATA.hrv, 50, 35) },
                    ].map(m => (
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
                          <div
                            className={`h-full rounded-full ${m.bar} transition-all duration-1000`}
                            style={{ width: `${Math.min(m.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {phoneTab === "shop" && (
              <div className="space-y-2.5">
                {purchaseMsg && (
                  <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-[12px] text-primary flex items-center gap-1.5 animate-fade-in" data-testid="text-purchase-msg">
                    <Check className="w-3.5 h-3.5" /> {purchaseMsg}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground tracking-wider" data-testid="text-shop-subtitle">
                  {patientSent ? "今日の施術データに基づくおすすめ" : "あなたの健康状態に合わせたおすすめ"}
                </p>

                {(patientSent ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).map(p => {
                  const IconComp = PRODUCT_ICONS[p.id] || Shield;
                  const inCart = cart.some(c => c.id === p.id);
                  return (
                    <div key={p.id} className="bg-primary/5 border border-primary/10 rounded-md p-3 flex gap-2.5" data-testid={`card-shop-product-${p.id}`}>
                      <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                        <IconComp className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{p.desc}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[13px] text-primary font-mono font-bold">¥{p.price.toLocaleString()}</span>
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
                  {DEMO_PRODUCTS.filter(p =>
                    !(patientSent ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).some(rp => rp.id === p.id)
                  ).map(p => {
                    const IconComp = PRODUCT_ICONS[p.id] || Shield;
                    const inCart = cart.some(c => c.id === p.id);
                    return (
                      <div key={p.id} className="bg-muted/30 border border-border rounded-md p-2.5 mb-2 flex gap-2 items-center" data-testid={`card-other-product-${p.id}`}>
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <IconComp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground/70 truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">¥{p.price.toLocaleString()}</p>
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
                      カート ({cart.length}点) · ¥{cart.reduce((s, p) => s + p.price, 0).toLocaleString()} — 購入する
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
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
