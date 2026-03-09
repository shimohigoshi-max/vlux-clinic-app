import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Footprints, Moon, Droplets, ShoppingCart,
  Stethoscope, Check, Bell, Shield, Sparkles, Layers,
  ChevronRight, Clock, Plus, GlassWater,
} from "lucide-react";
import type { AnalysisResult, Product } from "@/lib/constants";
import { HEALTH_DATA, DEMO_PRODUCTS, PAST_TIMELINE_ITEMS } from "@/lib/constants";

interface SmartphoneViewProps {
  patientNotified: boolean;
  analysisResult: AnalysisResult | null;
  activeTab: "timeline" | "shop";
  onTabChange: (tab: "timeline" | "shop") => void;
  cart: Product[];
  onAddToCart: (product: Product) => void;
  purchaseMsg: string;
  recommendedProducts: Product[];
}

const PRODUCT_ICONS: Record<string, typeof Shield> = {
  "W001": Shield,
  "S001": Sparkles,
  "S002": GlassWater,
  "W002": Layers,
};

export function SmartphoneView({
  patientNotified,
  analysisResult,
  activeTab,
  onTabChange,
  cart,
  onAddToCart,
  purchaseMsg,
  recommendedProducts,
}: SmartphoneViewProps) {
  const stepsPct = Math.min((HEALTH_DATA.steps / HEALTH_DATA.stepsGoal) * 100, 100);
  const sleepPct = Math.min((HEALTH_DATA.sleep / HEALTH_DATA.sleepGoal) * 100, 100);
  const waterPct = Math.min((HEALTH_DATA.water / 2) * 100, 100);

  const healthMetrics = [
    {
      icon: Footprints,
      label: "歩数",
      value: HEALTH_DATA.steps.toLocaleString(),
      unit: "steps",
      pct: stepsPct,
      color: stepsPct < 40 ? "text-destructive" : "text-primary",
      barColor: stepsPct < 40 ? "bg-destructive" : "bg-primary",
    },
    {
      icon: Moon,
      label: "睡眠",
      value: String(HEALTH_DATA.sleep),
      unit: "h",
      pct: sleepPct,
      color: sleepPct < 80 ? "text-chart-5" : "text-primary",
      barColor: sleepPct < 80 ? "bg-chart-5" : "bg-primary",
    },
    {
      icon: Droplets,
      label: "水分",
      value: String(HEALTH_DATA.water),
      unit: "L",
      pct: waterPct,
      color: "text-chart-3",
      barColor: "bg-chart-3",
    },
  ];

  return (
    <div className="max-w-[400px] mx-auto py-6 px-4 animate-fade-in">
      <div className="rounded-[2.5rem] border-[3px] border-border bg-background shadow-2xl overflow-hidden">
        <div className="bg-card/80 px-6 pt-3 pb-2 flex justify-between text-[11px] font-mono text-muted-foreground">
          <span data-testid="text-time">9:41</span>
          <span>Connected Healthcare</span>
          <span>100%</span>
        </div>

        <div className="bg-gradient-to-b from-card to-background px-5 pt-3 pb-0">
          {patientNotified && (
            <div
              className="bg-primary/10 border border-primary/30 rounded-md px-3.5 py-2.5 mb-3.5 flex items-center gap-2.5 animate-fade-in"
              data-testid="notification-treatment-report"
            >
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[12px] text-primary font-bold">本日の施術レポートが届きました</p>
                <p className="text-[11px] text-muted-foreground">先生からのアドバイスを確認しましょう</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground" data-testid="text-patient-name">
                田中 大輔 さん
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                次回予約: 3月16日（土）14:00
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {healthMetrics.map(m => (
              <div
                key={m.label}
                className="bg-muted/50 rounded-md p-2.5 text-center"
                data-testid={`metric-${m.label}`}
              >
                <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
                <p className={`text-base font-bold font-mono ${m.color}`}>{m.value}</p>
                <p className="text-[9px] text-muted-foreground">{m.label} / {m.unit}</p>
                <div className="h-[3px] bg-border rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.barColor} transition-all duration-1000`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex border-b border-border">
            {([["timeline", "タイムライン"], ["shop", "あなたのショップ"]] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`flex-1 py-2.5 text-[12px] tracking-wider border-b-2 transition-colors ${
                  activeTab === tab
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent"
                }`}
                data-testid={`tab-${tab}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[380px]">
          <div className="px-4 py-3">
            {activeTab === "timeline" && (
              <div className="space-y-2.5">
                {patientNotified && analysisResult && !analysisResult.error ? (
                  <div
                    className="bg-primary/5 border border-primary/20 rounded-md p-4 animate-slide-up"
                    data-testid="card-today-report"
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <Stethoscope className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] text-primary font-medium">今日の施術レポート</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">今日</span>
                    </div>
                    <p className="text-[13px] text-foreground/80 leading-relaxed" data-testid="text-patient-message">
                      {analysisResult.patient_message}
                    </p>
                    {analysisResult.advice && analysisResult.advice.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {analysisResult.advice.map((a, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            <span className="text-[12px] text-muted-foreground leading-relaxed">{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <ClipboardIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-[13px] text-muted-foreground/50" data-testid="text-empty-timeline">
                      iPadから施術データを送信すると
                      <br />
                      ここに表示されます
                    </p>
                  </div>
                )}

                {PAST_TIMELINE_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-md p-3.5"
                    data-testid={`card-past-report-${i}`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-3 h-3 text-primary" />
                        <span className="text-[11px] text-primary">施術レポート</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.date}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{item.msg}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "shop" && (
              <div className="space-y-2.5">
                {purchaseMsg && (
                  <div className="bg-primary/10 border border-primary/30 rounded-md px-3.5 py-2 text-[12px] text-primary flex items-center gap-2 animate-fade-in" data-testid="text-purchase-msg">
                    <Check className="w-3.5 h-3.5" />
                    {purchaseMsg}
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground tracking-wider mb-1" data-testid="text-shop-subtitle">
                  {patientNotified ? "今日の施術データに基づくおすすめ" : "あなたの健康状態に合わせたおすすめ"}
                </p>

                {(patientNotified ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).map(p => {
                  const IconComp = PRODUCT_ICONS[p.id] || Shield;
                  const inCart = cart.some(c => c.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="bg-card border border-border rounded-md p-3.5 flex gap-3 items-center"
                      data-testid={`card-shop-product-${p.id}`}
                    >
                      <div className="w-11 h-11 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <IconComp className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{p.desc}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-primary font-mono font-bold">
                            ¥{p.price.toLocaleString()}
                          </span>
                          <Button
                            size="sm"
                            variant={inCart ? "secondary" : "default"}
                            onClick={() => onAddToCart(p)}
                            disabled={inCart}
                            data-testid={`button-add-cart-${p.id}`}
                          >
                            {inCart ? (
                              <>
                                <Check className="w-3 h-3" />
                                追加済み
                              </>
                            ) : "カートへ"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="border-t border-border mt-2 pt-3">
                  <p className="text-[11px] text-muted-foreground mb-2.5">その他の商品</p>
                  {DEMO_PRODUCTS.filter(p => 
                    !(patientNotified ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).some(rp => rp.id === p.id)
                  ).map(p => {
                    const IconComp = PRODUCT_ICONS[p.id] || Shield;
                    const inCart = cart.some(c => c.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className="bg-muted/30 border border-border rounded-md p-3 mb-2 flex gap-2.5 items-center"
                        data-testid={`card-other-product-${p.id}`}
                      >
                        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <IconComp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground/80 truncate">{p.name}</p>
                          <p className="text-[13px] text-muted-foreground font-mono">¥{p.price.toLocaleString()}</p>
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
                  <div className="sticky bottom-0 bg-background border-t border-border pt-3 pb-1 mt-3">
                    <Button
                      className="w-full"
                      size="lg"
                      data-testid="button-checkout"
                    >
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

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  );
}
