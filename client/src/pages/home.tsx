import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Stethoscope, Smartphone } from "lucide-react";
import { IPadView } from "@/components/ipad-view";
import { SmartphoneView } from "@/components/smartphone-view";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  SummaryResult, KarteResult, CorrelationResult, Product, KarteHistoryEntry,
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

function VLUXLogo() {
  return (
    <svg viewBox="0 0 44 44" className="w-9 h-9" fill="none">
      <defs>
        <linearGradient id="vl-g1" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C896" />
          <stop offset="55%" stopColor="#0073E6" />
          <stop offset="100%" stopColor="#8866FF" />
        </linearGradient>
        <linearGradient id="vl-g2" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C896" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8866FF" stopOpacity="0.25" />
        </linearGradient>
        <filter id="vl-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer hexagon */}
      <polygon
        points="22,2 40,12 40,32 22,42 4,32 4,12"
        stroke="url(#vl-g1)"
        strokeWidth="1.2"
        fill="url(#vl-g2)"
      />

      {/* Inner ring */}
      <polygon
        points="22,7 35,14.5 35,29.5 22,37 9,29.5 9,14.5"
        stroke="url(#vl-g1)"
        strokeWidth="0.5"
        fill="none"
        opacity="0.4"
      />

      {/* ECG-style V pulse line */}
      <polyline
        points="9,22 14,22 17,15 22,29 27,15 30,22 35,22"
        stroke="url(#vl-g1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#vl-glow)"
      />

      {/* Center dot */}
      <circle cx="22" cy="22" r="1.5" fill="url(#vl-g1)" />
    </svg>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"ipad" | "smartphone">("ipad");
  const [ipadTab, setIpadTab] = useState("voice");
  const [phoneTab, setPhoneTab] = useState("timeline");
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [isRecordingPre, setIsRecordingPre] = useState(false);
  const [isRecordingPost, setIsRecordingPost] = useState(false);
  const [preRecDone, setPreRecDone] = useState(false);
  const [postRecDone, setPostRecDone] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [karte, setKarte] = useState<KarteResult | null>(null);
  const [patientSent, setPatientSent] = useState(false);
  const [cart, setCart] = useState<Product[]>([]);
  const [cartMsg, setCartMsg] = useState("");
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const [karteHistory, setKarteHistory] = useState<KarteHistoryEntry[]>([]);
  const [karteSaved, setKarteSaved] = useState(false);
  const [karteVisitId, setKarteVisitId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("院長 山田");

  const tRef = useRef("");
  const preMediaRef = useRef<MediaRecorder | null>(null);
  const postMediaRef = useRef<MediaRecorder | null>(null);

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

  const startRecPhase = useCallback(async (phase: "pre" | "post") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        if (phase === "pre") { setPreRecDone(true); setIsRecordingPre(false); }
        else { setPostRecDone(true); setIsRecordingPost(false); }
        try {
          const ts = Date.now().toString();
          const res = await fetch("/api/audio/upload", {
            method: "POST",
            headers: {
              "Content-Type": mimeType,
              "X-Phase": phase,
              "X-Clinic-Id": selectedClinicId || "unknown",
              "X-Patient-Id": selectedPatientId || "unknown",
              "X-Timestamp": ts,
            },
            body: blob,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "upload failed");
          console.log("[audio] uploaded:", data.url);
          setAudioUploadError(null);
        } catch (e) {
          console.error("[audio] upload failed:", e);
          setAudioUploadError("録音の保存に失敗しました");
        }
      };
      if (phase === "pre") {
        preMediaRef.current = mr;
        setIsRecordingPre(true);
        setPreRecDone(false);
      } else {
        postMediaRef.current = mr;
        setIsRecordingPost(true);
        setPostRecDone(false);
      }
      mr.start();
    } catch {
      alert("マイクへのアクセスが必要です。ブラウザの設定を確認してください。");
    }
  }, [selectedClinicId, selectedPatientId]);

  const stopRecPhase = useCallback((phase: "pre" | "post") => {
    if (phase === "pre") preMediaRef.current?.stop();
    else postMediaRef.current?.stop();
  }, []);

  const loadSample = useCallback(() => {
    setTranscript(SAMPLE_CONVERSATION);
    tRef.current = SAMPLE_CONVERSATION;
    doSummarize(SAMPLE_CONVERSATION);
  }, [doSummarize]);

  const doKarte = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsAnalyzing(true);
    setKarte(null);
    setKarteSaved(false);
    setKarteVisitId(null);
    const hd = healthSynced
      ? `歩数${HEALTH_DATA.steps}歩, 睡眠${HEALTH_DATA.sleep}h, HRV${HEALTH_DATA.hrv}`
      : "健康データ未連携";
    try {
      const res = await apiRequest("POST", "/api/analyze", {
        transcription: transcript,
        healthData: hd,
        staff_name: staffName,
        ...(selectedPatientId ? { patient_id: selectedPatientId } : {}),
        ...(selectedClinicId ? { clinic_id: selectedClinicId } : {}),
        products: DEMO_PRODUCTS.map(p => ({ id: p.id, name: p.name, desc: p.desc })),
      });
      const data = await res.json();
      setKarte(data);
      if (!data.error) {
        const entry: KarteHistoryEntry = {
          id: Date.now().toString(),
          createdAt: new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
          summary,
          karte: data,
        };
        setKarteHistory(prev => [entry, ...prev]);
        if (data.visit_id) {
          setKarteSaved(true);
          setKarteVisitId(data.visit_id);
          queryClient.invalidateQueries({ queryKey: ["/api/patient/visits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/patient/profile"] });
          queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
        }
      }
      setIpadTab("karte");
    } catch {
      setKarte({ error: "エラーが発生しました。" });
    }
    setIsAnalyzing(false);
  }, [transcript, healthSynced, summary, selectedPatientId, selectedClinicId]);

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

  const handlePatientSelect = useCallback((patientId: string, clinicId: string) => {
    setSelectedPatientId(patientId);
    setSelectedClinicId(clinicId);
    setIpadTab("voice");
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
          <VLUXLogo />
          <div>
            <h1 className="font-mono text-[15px] font-bold tracking-[4px] flex items-center gap-2" data-testid="text-app-title">
              <span className="bg-gradient-to-r from-primary via-chart-3 to-purple-400 bg-clip-text text-transparent">VLUX</span>
              {import.meta.env.VITE_TEST_MODE === 'true' && (
                <span className="text-[9px] font-mono tracking-[2px] px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-400 bg-amber-500/10" data-testid="badge-test-mode">TEST</span>
              )}
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[3px]">CONNECTED HEALTHCARE v3.1</p>
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
          isRecordingPre={isRecordingPre}
          isRecordingPost={isRecordingPost}
          preRecDone={preRecDone}
          postRecDone={postRecDone}
          audioUploadError={audioUploadError}
          onStartRecPhase={startRecPhase}
          onStopRecPhase={stopRecPhase}
          onLoadSample={loadSample}
          summary={summary}
          isSummarizing={isSummarizing}
          karte={karte}
          isAnalyzing={isAnalyzing}
          onDoKarte={doKarte}
          karteSaved={karteSaved}
          karteVisitId={karteVisitId}
          correlationResult={correlationResult}
          isCorrelating={isCorrelating}
          onDoCorrelation={doCorrelation}
          healthSynced={healthSynced}
          healthSyncing={healthSyncing}
          onSyncHealth={syncHealth}
          onSendToPatient={sendToPatient}
          karteHistory={karteHistory}
          selectedPatientId={selectedPatientId}
          selectedClinicId={selectedClinicId}
          onPatientSelect={handlePatientSelect}
          staffName={staffName}
          onStaffChange={setStaffName}
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
