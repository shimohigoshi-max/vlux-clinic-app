import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { IPadView } from "@/components/ipad-view";
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

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

async function splitStereoToWavBlobs(blob: Blob): Promise<{ teacher: Blob; patient: Blob }> {
  const arrayBuf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const audioBuf = await ctx.decodeAudioData(arrayBuf);
  const left = audioBuf.getChannelData(0);
  const right = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : audioBuf.getChannelData(0);
  await ctx.close();
  return {
    teacher: encodeWAV(left, audioBuf.sampleRate),
    patient: encodeWAV(right, audioBuf.sampleRate),
  };
}

async function callTranscribe(wavBlob: Blob, speaker: "teacher" | "patient"): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/wav", "X-Speaker": speaker },
    body: wavBlob,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "transcription failed");
  return data.text as string;
}

type TickerItem = {
  id: string;
  type: "unsent" | "booking" | "ec";
  label: string;
};

const TICKER_ITEMS: TickerItem[] = [
  { id: "1", type: "unsent",  label: "📩 未送信：田中 花子さんへのカルテメッセージが未送信です" },
  { id: "2", type: "booking", label: "📅 新規予約：鈴木 一郎さん — 明日 10:30（腰痛フォロー）" },
  { id: "3", type: "unsent",  label: "📩 未送信：山本 次郎さんへのホームケア案内が未送信です" },
  { id: "4", type: "ec",      label: "🛒 通販売上：今月の売上集計は準備中です（フェーズ２で公開予定）" },
  { id: "5", type: "booking", label: "📅 新規予約：佐藤 美咲さん — 明後日 14:00（初診）" },
];

function NotificationTicker() {
  const items = TICKER_ITEMS;
  const colorMap: Record<TickerItem["type"], string> = {
    unsent:  "text-amber-400",
    booking: "text-primary",
    ec:      "text-muted-foreground/50",
  };

  const separator = <span className="mx-6 text-muted-foreground/30 select-none">◆</span>;
  const content = items.map((item, i) => (
    <span key={item.id} className={`whitespace-nowrap ${colorMap[item.type]}`}>
      {item.label}
      {i < items.length - 1 && separator}
    </span>
  ));

  return (
    <div className="relative overflow-hidden bg-card/60 border-b border-border h-7 flex items-center">
      <style>{`
        @keyframes vlux-ticker {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .vlux-ticker-track {
          display: inline-flex;
          animation: vlux-ticker 40s linear infinite;
          will-change: transform;
        }
        .vlux-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <span className="flex-shrink-0 z-10 px-2 font-mono text-[9px] tracking-[2px] text-primary/70 bg-card/60 border-r border-border h-full flex items-center select-none">
        INFO
      </span>
      <div className="overflow-hidden flex-1 h-full flex items-center">
        <span className="vlux-ticker-track text-[11px] font-mono gap-0">
          {content}
          {separator}
          {content}
        </span>
      </div>
    </div>
  );
}

export default function ClinicApp() {
  const [ipadTab, setIpadTab] = useState("voice");
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [isRecordingPre, setIsRecordingPre] = useState(false);
  const [isRecordingPost, setIsRecordingPost] = useState(false);
  const [preRecDone, setPreRecDone] = useState(false);
  const [postRecDone, setPostRecDone] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [preTranscript, setPreTranscript] = useState<{ teacher: string; patient: string } | null>(null);
  const [postTranscript, setPostTranscript] = useState<{ teacher: string; patient: string } | null>(null);
  const [isTranscribingPre, setIsTranscribingPre] = useState(false);
  const [isTranscribingPost, setIsTranscribingPost] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [karte, setKarte] = useState<KarteResult | null>(null);
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
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        if (phase === "pre") { setPreRecDone(true); setIsRecordingPre(false); setIsTranscribingPre(true); }
        else { setPostRecDone(true); setIsRecordingPost(false); setIsTranscribingPost(true); }

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

        try {
          const { teacher: teacherWav, patient: patientWav } = await splitStereoToWavBlobs(blob);
          const [teacherText, patientText] = await Promise.all([
            callTranscribe(teacherWav, "teacher"),
            callTranscribe(patientWav, "patient"),
          ]);
          const result = { teacher: teacherText, patient: patientText };
          if (phase === "pre") {
            setPreTranscript(result);
            setIsTranscribingPre(false);
          } else {
            setPostTranscript(result);
            setIsTranscribingPost(false);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "文字起こしに失敗しました。再試行してください";
          if (phase === "pre") setIsTranscribingPre(false);
          else setIsTranscribingPost(false);
          setAudioUploadError(msg);
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

  useEffect(() => {
    if (!preTranscript && !postTranscript) return;
    const parts: string[] = [];
    if (preTranscript) {
      parts.push("【施術前】");
      parts.push(`先生：${preTranscript.teacher}`);
      parts.push(`患者：${preTranscript.patient}`);
    }
    if (postTranscript) {
      if (parts.length > 0) parts.push("");
      parts.push("【施術後】");
      parts.push(`先生：${postTranscript.teacher}`);
      parts.push(`患者：${postTranscript.patient}`);
    }
    setTranscript(parts.join("\n"));
  }, [preTranscript, postTranscript]);

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
        ...(preTranscript || postTranscript ? {
          structured_transcripts: {
            ...(preTranscript ? { pre: preTranscript } : {}),
            ...(postTranscript ? { post: postTranscript } : {}),
          }
        } : {}),
      });
      const data = await res.json();
      setKarte(data);
      if (!data.error) {
        const entry: KarteHistoryEntry = {
          id: Date.now().toString(),
          createdAt: new Date().toLocaleString("ja-JP", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          }),
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
  }, [transcript, healthSynced, summary, selectedPatientId, selectedClinicId, staffName, preTranscript, postTranscript]);

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

  const handlePatientSelect = useCallback((patientId: string, clinicId: string) => {
    setSelectedPatientId(patientId);
    setSelectedClinicId(clinicId);
    setIpadTab("voice");
  }, []);

  const sendToPatient = useCallback(() => {
    // In split mode: real karte sending is via Supabase (visit already saved)
    // Just show a toast-level confirmation; patient will see it on their /patient URL
    alert("カルテを送信しました。患者が /patient を開くと確認できます。");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="bg-gradient-to-r from-card to-background border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/vlux-logo-white.png" alt="VLUX" className="h-9 w-auto object-contain" />
          <div>
            <h1 className="font-mono text-[15px] font-bold tracking-[4px]" data-testid="text-clinic-title">
              <span className="bg-gradient-to-r from-primary via-chart-3 to-purple-400 bg-clip-text text-transparent">VLUX</span>
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[3px]">CLINIC · 院内端末</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground/60 tracking-[2px] hidden sm:block">iPAD MODE</span>
          <a href="/patient" className="text-[11px] text-muted-foreground hover:text-primary transition-colors font-mono tracking-wider" data-testid="link-to-patient">
            患者ビュー →
          </a>
        </div>
      </header>

      <NotificationTicker />

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
        preTranscript={preTranscript}
        postTranscript={postTranscript}
        isTranscribingPre={isTranscribingPre}
        isTranscribingPost={isTranscribingPost}
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
    </div>
  );
}
