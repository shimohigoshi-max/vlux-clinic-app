import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Stethoscope, Smartphone } from "lucide-react";
import { IPadView } from "@/components/ipad-view";
import { SmartphoneView } from "@/components/smartphone-view";
import { apiRequest } from "@/lib/queryClient";
import type {
  SummaryResult, KarteResult, CorrelationResult, Product,
} from "@/lib/constants";
import {
  SAMPLE_CONVERSATION, DEMO_PRODUCTS, TREATMENT_HISTORY, HEALTH_DATA,
} from "@/lib/constants";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function Home() {
  const [screen, setScreen] = useState<"ipad" | "smartphone">("ipad");
  const [ipadTab, setIpadTab] = useState("voice");
  const [phoneTab, setPhoneTab] = useState("timeline");
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [karte, setKarte] = useState<KarteResult | null>(null);
  const [patientSent, setPatientSent] = useState(false);
  const [cart, setCart] = useState<Product[]>([]);
  const [cartMsg, setCartMsg] = useState("");
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null);
  const [isCorrelating, setIsCorrelating] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const tRef = useRef("");

  const doSummarize = useCallback(async (text: string) => {
    setIsSummarizing(true);
    setSummary(null);
    try {
      const res = await apiRequest("POST", "/api/summarize", { conversation: text });
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary({ error: true });
    }
    setIsSummarizing(false);
  }, []);

  const startRec = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Chrome または Safari をご利用ください（音声認識が必要）");
      return;
    }
    const r = new SR();
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = true;
    tRef.current = transcript;
    r.onresult = (e: SpeechRecognitionEvent) => {
      let fin = tRef.current;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          fin += e.results[i][0].transcript;
          tRef.current = fin;
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      setTranscript(fin + (interim ? `【${interim}】` : ""));
    };
    r.onerror = () => {
      recRef.current?.stop();
      setIsRecording(false);
    };
    r.onend = () => setIsRecording(false);
    recRef.current = r;
    r.start();
    setIsRecording(true);
  }, [transcript]);

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    setIsRecording(false);
    const clean = tRef.current.replace(/【.*?】/g, "").trim();
    setTranscript(clean);
    if (clean.length > 20) doSummarize(clean);
  }, [doSummarize]);

  const loadSample = useCallback(() => {
    setTranscript(SAMPLE_CONVERSATION);
    tRef.current = SAMPLE_CONVERSATION;
    doSummarize(SAMPLE_CONVERSATION);
  }, [doSummarize]);

  const doKarte = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsAnalyzing(true);
    setKarte(null);
    const hd = healthSynced
      ? `歩数${HEALTH_DATA.steps}歩, 睡眠${HEALTH_DATA.sleep}h, HRV${HEALTH_DATA.hrv}`
      : "健康データ未連携";
    try {
      const res = await apiRequest("POST", "/api/analyze", {
        conversation: transcript,
        healthData: hd,
        products: DEMO_PRODUCTS.map(p => ({ id: p.id, name: p.name, desc: p.desc })),
      });
      const data = await res.json();
      setKarte(data);
      setIpadTab("karte");
    } catch {
      setKarte({ error: "エラーが発生しました。" });
    }
    setIsAnalyzing(false);
  }, [transcript, healthSynced]);

  const doCorrelation = useCallback(async () => {
    setIsCorrelating(true);
    setCorrelationResult(null);
    const historyText = TREATMENT_HISTORY.map((h, i) =>
      `[${i + 1}] ${h.date} 治療部位:${h.area} 疼痛度:${h.pain}/10 歩数:${h.steps} 睡眠:${h.sleep}h HRV:${h.hrv} メモ:${h.note}`
    ).join("\n");
    try {
      const res = await apiRequest("POST", "/api/correlate", {
        historyText,
        todayData: `歩数${HEALTH_DATA.steps}, 睡眠${HEALTH_DATA.sleep}h, 心拍${HEALTH_DATA.heartRate}bpm, HRV${HEALTH_DATA.hrv}`,
      });
      const data = await res.json();
      setCorrelationResult(data);
    } catch {
      setCorrelationResult({ error: true });
    }
    setIsCorrelating(false);
  }, []);

  const syncHealth = useCallback(() => {
    setHealthSyncing(true);
    setTimeout(() => {
      setHealthSyncing(false);
      setHealthSynced(true);
      setIpadTab("health");
    }, 2200);
  }, []);

  const syncHealthPhone = useCallback(() => {
    setHealthSyncing(true);
    setTimeout(() => {
      setHealthSyncing(false);
      setHealthSynced(true);
    }, 2000);
  }, []);

  const sendToPatient = useCallback(() => {
    setPatientSent(true);
    setScreen("smartphone");
    setPhoneTab("timeline");
  }, []);

  const addCart = useCallback((p: Product) => {
    if (!cart.find(c => c.id === p.id)) {
      setCart(prev => [...prev, p]);
      setCartMsg(p.name);
      setTimeout(() => setCartMsg(""), 2500);
    }
  }, [cart]);

  const recProds = karte?.recommended_products
    ? DEMO_PRODUCTS.filter(p => karte.recommended_products!.includes(p.id))
    : DEMO_PRODUCTS.slice(0, 2);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="bg-gradient-to-r from-card to-background border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-mono text-[13px] font-bold text-primary tracking-[2px]" data-testid="text-app-title">
              CONNECTED HEALTHCARE
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[3px]">ECOSYSTEM DEMO v2.3</p>
          </div>
        </div>
        <div className="flex gap-2">
          {([
            ["ipad", "医院 iPad", Stethoscope],
            ["smartphone", "患者 スマホ", Smartphone],
          ] as const).map(([view, label, Icon]) => (
            <Button
              key={view}
              variant={screen === view ? "outline" : "ghost"}
              size="sm"
              className={`relative font-mono text-[11px] tracking-wider ${
                screen === view ? "text-primary border-primary/50" : "text-muted-foreground"
              }`}
              onClick={() => setScreen(view)}
              data-testid={`nav-${view}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {view === "smartphone" && patientSent && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              )}
            </Button>
          ))}
        </div>
      </header>

      {screen === "ipad" && (
        <IPadView
          ipadTab={ipadTab}
          onIpadTabChange={setIpadTab}
          transcript={transcript}
          onTranscriptChange={(val) => { setTranscript(val); tRef.current = val; }}
          isRecording={isRecording}
          onStartRec={startRec}
          onStopRec={stopRec}
          onLoadSample={loadSample}
          summary={summary}
          isSummarizing={isSummarizing}
          karte={karte}
          isAnalyzing={isAnalyzing}
          onDoKarte={doKarte}
          correlationResult={correlationResult}
          isCorrelating={isCorrelating}
          onDoCorrelation={doCorrelation}
          healthSynced={healthSynced}
          healthSyncing={healthSyncing}
          onSyncHealth={syncHealth}
          onSendToPatient={sendToPatient}
        />
      )}

      {screen === "smartphone" && (
        <SmartphoneView
          patientSent={patientSent}
          karte={karte}
          phoneTab={phoneTab}
          onPhoneTabChange={setPhoneTab}
          cart={cart}
          onAddToCart={addCart}
          purchaseMsg={cartMsg}
          recommendedProducts={recProds}
          healthSynced={healthSynced}
          healthSyncing={healthSyncing}
          onSyncHealth={syncHealthPhone}
        />
      )}
    </div>
  );
}
