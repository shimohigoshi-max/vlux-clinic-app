import { useState, useCallback } from "react";
import { SmartphoneView } from "@/components/smartphone-view";
import type { Product } from "@/lib/constants";
import { DEMO_PRODUCTS } from "@/lib/constants";

type PatientTickerItem = {
  id: string;
  type: "booking" | "reply" | "reminder" | "coupon" | "health";
  label: string;
};

const PATIENT_TICKER_ITEMS: PatientTickerItem[] = [
  { id: "1", type: "reply",    label: "💬 返信あり：田中整骨院から予約リクエストへの返信が届いています" },
  { id: "2", type: "booking",  label: "✅ 予約確定：5月15日（金）10:00 田中整骨院 — 定期施術" },
  { id: "3", type: "reminder", label: "🔔 来院リマインダー：明日 10:00 田中整骨院のご予約があります" },
  { id: "4", type: "coupon",   label: "🎟 クーポン付与：今回の来院で ¥500 OFFクーポンが追加されました" },
  { id: "5", type: "health",   label: "💙 ヘルスデータ更新：今週の歩数平均 8,240歩 — 先週比 +12%" },
];

function PatientNotificationTicker() {
  const colorMap: Record<PatientTickerItem["type"], string> = {
    reply:    "text-blue-400",
    booking:  "text-primary",
    reminder: "text-amber-400",
    coupon:   "text-rose-400",
    health:   "text-emerald-400",
  };

  const separator = <span className="mx-6 text-muted-foreground/30 select-none">◆</span>;
  const content = PATIENT_TICKER_ITEMS.map((item, i) => (
    <span key={item.id} className={`whitespace-nowrap ${colorMap[item.type]}`}>
      {item.label}
      {i < PATIENT_TICKER_ITEMS.length - 1 && separator}
    </span>
  ));

  return (
    <div className="relative overflow-hidden bg-card/60 border-b border-border h-7 flex items-center">
      <style>{`
        @keyframes patient-ticker {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .patient-ticker-track {
          display: inline-flex;
          animation: patient-ticker 50s linear infinite;
          will-change: transform;
        }
        .patient-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <span className="flex-shrink-0 z-10 px-2 font-mono text-[9px] tracking-[2px] text-primary/70 bg-card/60 border-r border-border h-full flex items-center select-none">
        INFO
      </span>
      <div className="overflow-hidden flex-1 h-full flex items-center">
        <span className="patient-ticker-track text-[11px] font-mono gap-0">
          {content}
          {separator}
          {content}
        </span>
      </div>
    </div>
  );
}

export default function PatientApp() {
  const [phoneTab, setPhoneTab] = useState("timeline");
  const [cart, setCart] = useState<Product[]>([]);
  const [cartMsg, setCartMsg] = useState("");
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);

  const addCart = useCallback((p: Product) => {
    if (!cart.find(c => c.id === p.id)) {
      setCart(prev => [...prev, p]);
      setCartMsg(p.name);
      setTimeout(() => setCartMsg(""), 2500);
    }
  }, [cart]);

  const syncHealthPhone = useCallback(() => {
    setHealthSyncing(true);
    setTimeout(() => {
      setHealthSyncing(false);
      setHealthSynced(true);
    }, 2000);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="bg-gradient-to-r from-card to-background border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/vlux-logo-white.png" alt="VLUX" className="h-8 w-auto object-contain" />
          <div>
            <h1 className="font-mono text-[15px] font-bold tracking-[4px]" data-testid="text-patient-title">
              <span className="bg-gradient-to-r from-primary via-chart-3 to-purple-400 bg-clip-text text-transparent">VLUX</span>
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[3px]">PATIENT · 患者アプリ</p>
          </div>
        </div>
      </header>

      <PatientNotificationTicker />

      <SmartphoneView
        patientSent={false}
        karte={null}
        phoneTab={phoneTab}
        onPhoneTabChange={setPhoneTab}
        cart={cart}
        onAddToCart={addCart}
        purchaseMsg={cartMsg}
        recommendedProducts={DEMO_PRODUCTS.slice(0, 2)}
        healthSynced={healthSynced}
        healthSyncing={healthSyncing}
        onSyncHealth={syncHealthPhone}
      />
    </div>
  );
}
