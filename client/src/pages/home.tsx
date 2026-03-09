import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Tablet, Smartphone } from "lucide-react";
import {
  SAMPLE_CONVERSATION,
  HEALTH_DATA,
  DEMO_PRODUCTS,
  type AnalysisResult,
  type Product,
} from "@/lib/constants";
import { IPadView } from "@/components/ipad-view";
import { SmartphoneView } from "@/components/smartphone-view";

export default function Home() {
  const [view, setView] = useState<"ipad" | "smartphone">("ipad");
  const [conversation, setConversation] = useState(SAMPLE_CONVERSATION);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [cart, setCart] = useState<Product[]>([]);
  const [patientNotified, setPatientNotified] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "shop">("timeline");
  const [purchaseMsg, setPurchaseMsg] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: async (data: { conversation: string; healthData: string; products: { id: string; name: string; desc: string }[] }) => {
      const res = await apiRequest("POST", "/api/analyze", data);
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResult(data);
    },
    onError: () => {
      setAnalysisResult({ error: "解析エラー。再度お試しください。" });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate({
      conversation,
      healthData: `歩数${HEALTH_DATA.steps}歩、睡眠${HEALTH_DATA.sleep}時間、水分${HEALTH_DATA.water}L`,
      products: DEMO_PRODUCTS.map(p => ({ id: p.id, name: p.name, desc: p.desc })),
    });
  };

  const handleSendToPatient = () => {
    setPatientNotified(true);
    setView("smartphone");
    setActiveTab("timeline");
  };

  const handleAddToCart = (product: Product) => {
    if (!cart.find(p => p.id === product.id)) {
      setCart([...cart, product]);
      setPurchaseMsg(`${product.name} をカートに追加`);
      setTimeout(() => setPurchaseMsg(""), 2500);
    }
  };

  const recommendedProducts = analysisResult?.recommended_products
    ? DEMO_PRODUCTS.filter(p => analysisResult.recommended_products!.includes(p.id))
    : DEMO_PRODUCTS.slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[920px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold text-primary tracking-[2px]" data-testid="text-app-title">
                CONNECTED HEALTHCARE
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground tracking-[3px]">
                ECOSYSTEM DEMO v1.0
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={view === "ipad" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("ipad")}
              data-testid="button-view-ipad"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">医院 iPad</span>
            </Button>
            <div className="relative">
              <Button
                variant={view === "smartphone" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("smartphone")}
                data-testid="button-view-smartphone"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">患者 スマホ</span>
              </Button>
              {patientNotified && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-bold">
                  1
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {view === "ipad" && (
        <IPadView
          conversation={conversation}
          onConversationChange={setConversation}
          onAnalyze={handleAnalyze}
          isAnalyzing={analyzeMutation.isPending}
          analysisResult={analysisResult}
          onSendToPatient={handleSendToPatient}
        />
      )}

      {view === "smartphone" && (
        <SmartphoneView
          patientNotified={patientNotified}
          analysisResult={analysisResult}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          cart={cart}
          onAddToCart={handleAddToCart}
          purchaseMsg={purchaseMsg}
          recommendedProducts={recommendedProducts}
        />
      )}
    </div>
  );
}
