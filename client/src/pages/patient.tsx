import { useState, useCallback } from "react";
import { SmartphoneView } from "@/components/smartphone-view";
import type { Product } from "@/lib/constants";
import { DEMO_PRODUCTS } from "@/lib/constants";

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
