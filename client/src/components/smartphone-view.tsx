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
  RefreshCw, Wifi, WifiOff, Flame, X,
} from "lucide-react";
import type { KarteResult, Product, LifeAdvice, SupabaseVisit, SupabaseHealthData, PatientProfile, Coupon } from "@/lib/constants";
import {
  DEMO_PRODUCTS, TREATMENT_HISTORY,
  RANKS, getRank, getNextRank,
  CLINIC_MASTER,
  statusColor, statusBg,
} from "@/lib/constants";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

function parseFollowUpDays(text: string): number {
  const s = text.replace(/\s/g, "");
  const week = s.match(/(\d+)[週週](?:間)?後?/);
  if (week) return parseInt(week[1]) * 7;
  const month = s.match(/(\d+)[ヶかカ]?月後?/);
  if (month) return parseInt(month[1]) * 30;
  const day = s.match(/(\d+)日/);
  if (day) return parseInt(day[1]);
  return 7;
}

function buildGCalUrl(followUpText: string, clinicName = "整骨院"): string {
  const days = parseFollowUpDays(followUpText);
  const date = new Date();
  date.setDate(date.getDate() + days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${clinicName} 施術予約`,
    dates: `${fmt(date)}/${fmt(end)}`,
    details: `${clinicName}での施術予約\n次回来院目安：${followUpText}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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
  const [issuedCoupon, setIssuedCoupon] = useState<Coupon | null>(null);
  const [couponIssuing, setCouponIssuing] = useState(false);
  const [connectedSource, setConnectedSource] = useState<"healthkit" | "googlefit" | "mock" | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: profile } = useQuery<PatientProfile>({
    queryKey: ["/api/patient/profile"],
    staleTime: 30000,
  });

  const { data: coupons = [], isLoading: couponsLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons", profile?.id],
    queryFn: async () => {
      const r = await fetch(`/api/coupons?patient_id=${profile!.id}`);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!profile?.id,
    staleTime: 15000,
  });

  const issueCoupon = async () => {
    if (!profile?.id || !profile?.clinic_id) return;
    setCouponIssuing(true);
    try {
      const data = await apiRequest("POST", "/api/coupons/issue", {
        patient_id: profile.id,
        clinic_id: profile.clinic_id,
      });
      setIssuedCoupon(data);
      queryClient.invalidateQueries({ queryKey: ["/api/coupons", profile.id] });
    } catch {
      // 既存クーポンがある場合はサイレントに無視
    } finally {
      setCouponIssuing(false);
    }
  };

  useEffect(() => {
    const handler = () => { issueCoupon(); };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, [profile?.id, profile?.clinic_id]);

  // ── HealthKit / Google Fit / Mock sync ───────────────────────────
  const buildMockRecords = () => {
    const steps    = [8432, 6201, 11043, 4892, 7654, 9321, 5678];
    const hr       = [72,   68,   75,    70,   73,   71,   69];
    const sleep    = [390,  420,  360,   450,  400,  385,  435];
    const calories = [320,  280,  445,   210,  305,  380,  245];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toISOString().split("T")[0],
        steps: steps[i],
        heart_rate_avg: hr[i],
        sleep_minutes: sleep[i],
        active_calories: calories[i],
      };
    });
  };

  const doSync = async (source: "healthkit" | "googlefit" | "mock", records: ReturnType<typeof buildMockRecords>) => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await apiRequest("POST", "/api/health-data/sync", { source, records });
      setConnectedSource(source);
      setLastSyncTime(new Date());
      setSyncMessage("同期完了");
      queryClient.invalidateQueries({ queryKey: ["/api/patient/health-data"] });
      onSyncHealth();
    } catch {
      setSyncMessage("同期に失敗しました");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const connectHealthKit = async () => {
    const nav = navigator as Navigator & { health?: { requestAuthorization: (types: string[]) => Promise<void>; query: (opts: Record<string, unknown>) => Promise<{ dataPoints?: { value?: number }[] }> } };
    if (nav.health) {
      try {
        await nav.health.requestAuthorization(["steps", "heartRate", "sleepAnalysis", "activeEnergyBurned"]);
        // 認証成功後: 過去7日分を取得して送信
        const today = new Date();
        const records = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split("T")[0];
          const startDate = new Date(d); startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(d); endDate.setHours(23, 59, 59, 999);
          const [stepsData, hrData, sleepData, calData] = await Promise.allSettled([
            nav.health!.query({ startDate, endDate, type: "steps" }),
            nav.health!.query({ startDate, endDate, type: "heartRate" }),
            nav.health!.query({ startDate, endDate, type: "sleepAnalysis" }),
            nav.health!.query({ startDate, endDate, type: "activeEnergyBurned" }),
          ]);
          const sum = (res: PromiseSettledResult<{ dataPoints?: { value?: number }[] }>) =>
            res.status === "fulfilled" ? (res.value.dataPoints ?? []).reduce((a, p) => a + (p.value ?? 0), 0) : 0;
          return { date: dateStr, steps: Math.round(sum(stepsData)), heart_rate_avg: Math.round(sum(hrData) / 7), sleep_minutes: Math.round(sum(sleepData) / 60), active_calories: Math.round(sum(calData)) };
        }));
        await doSync("healthkit", records);
      } catch (e) {
        setSyncMessage("HealthKit認証に失敗しました");
        setTimeout(() => setSyncMessage(null), 3000);
      }
    } else {
      // 非対応端末 → モックで動作確認
      await doSync("mock", buildMockRecords());
      setSyncMessage("モックデータで同期しました（HealthKit非対応環境）");
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const connectGoogleFit = () => {
    const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
    if (!clientId) {
      // 未設定 → モックデータで動作確認
      doSync("mock", buildMockRecords());
      setSyncMessage("Google Fit Client IDが未設定のためモックデータで同期しました");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + "/oauth/callback");
    const scopes = encodeURIComponent([
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
    ].join(" "));
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scopes}`;
    const popup = window.open(authUrl, "google_fit", "width=600,height=700");
    const listener = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "google_fit_token" && e.data?.token) {
        window.removeEventListener("message", listener);
        popup?.close();
        doGoogleFitFetch(e.data.token);
      }
    };
    window.addEventListener("message", listener);
  };

  const doGoogleFitFetch = async (accessToken: string) => {
    setIsSyncing(true);
    try {
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const body = {
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.heart_rate.bpm" },
          { dataTypeName: "com.google.sleep.segment" },
          { dataTypeName: "com.google.calories.expended" },
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: now - weekMs,
        endTimeMillis: now,
      };
      const resp = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error("Google Fit API error");
      const fitData = await resp.json();
      const records = (fitData.bucket ?? []).map((b: Record<string, unknown>) => {
        const date = new Date(Number(b.startTimeMillis)).toISOString().split("T")[0];
        const getVal = (idx: number) => {
          const ds = (b.dataset as Record<string, unknown>[])?.[idx];
          const pts = (ds as { point?: { value?: { intVal?: number; fpVal?: number }[] }[] })?.point ?? [];
          return pts.reduce((sum: number, p) => sum + (p.value?.[0]?.intVal ?? p.value?.[0]?.fpVal ?? 0), 0);
        };
        return { date, steps: Math.round(getVal(0)), heart_rate_avg: Math.round(getVal(1)), sleep_minutes: Math.round(getVal(2) / 60000), active_calories: Math.round(getVal(3)) };
      });
      await doSync("googlefit", records);
    } catch {
      setSyncMessage("Google Fit データ取得に失敗しました");
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (d: Date | null) => {
    if (!d) return null;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "たった今";
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    return `${Math.floor(diff / 3600)}時間前`;
  };

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
              <p className="text-[14px] font-bold text-foreground" data-testid="text-phone-patient-name">{profile?.name_kana ? `${profile.name_kana} さん` : "---"}</p>
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

          <div className="flex border-b border-border overflow-x-auto no-scrollbar">
            {([["timeline", "タイムライン"], ["health", "健康データ"], ["shop", "VLUXストア"], ["rank", "VLUXスコア"], ["coupon", "クーポン"]] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => onPhoneTabChange(tab)}
                className={`flex-none px-2 py-2 text-[11px] tracking-wider border-b-2 transition-colors whitespace-nowrap ${
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
                      <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center justify-between gap-2" data-testid="card-follow-up">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                          <p className="text-[11px] text-muted-foreground">{karte.follow_up}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] text-primary border border-primary/30 hover:bg-primary/10"
                          onClick={() => window.open(buildGCalUrl(karte.follow_up!, "整骨院"), "_blank")}
                          data-testid="button-gcal-from-followup"
                        >
                          <Calendar className="w-3 h-3 mr-1" />Googleカレンダー
                        </Button>
                      </div>
                    )}

                    <CouponWallet expanded />

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => window.open(buildGCalUrl(karte?.follow_up ?? "1週間後", "整骨院"), "_blank")}
                      data-testid="button-book-appointment"
                    >
                      <Calendar className="w-4 h-4" /> Googleカレンダーに予約を追加
                    </Button>
                  </>
                ) : (
                  <>
                    <CouponWallet expanded={false} />

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => window.open(buildGCalUrl("1週間後", "整骨院"), "_blank")}
                      data-testid="button-book-appointment-initial"
                    >
                      <Calendar className="w-4 h-4" /> Googleカレンダーに予約を追加
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
              <div className="space-y-3" data-testid="section-health-tab">

                {/* ── 連携サービス選択 ── */}
                {!connectedSource && (
                  <div className="space-y-2" data-testid="health-connect-panel">
                    <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2">健康データ連携</p>
                    <button
                      className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3.5 hover:border-primary/50 transition-colors text-left"
                      onClick={connectHealthKit}
                      disabled={isSyncing}
                      data-testid="button-connect-healthkit"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                        <Heart className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">Apple HealthKit</p>
                        <p className="text-[10px] text-muted-foreground">iOS 16.4以降対応</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3.5 hover:border-primary/50 transition-colors text-left"
                      onClick={connectGoogleFit}
                      disabled={isSyncing}
                      data-testid="button-connect-googlefit"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">Google Fit</p>
                        <p className="text-[10px] text-muted-foreground">Android対応</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div className="border-t border-border pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[11px] border-dashed border-muted-foreground/30 text-muted-foreground"
                        onClick={() => doSync("mock", buildMockRecords())}
                        disabled={isSyncing}
                        data-testid="button-mock-sync"
                      >
                        {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wifi className="w-3.5 h-3.5 mr-1" />}
                        モックデータで同期する
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── 連携済みヘッダー ── */}
                {connectedSource && (
                  <div className="flex items-center justify-between" data-testid="health-connected-header">
                    <div className="flex items-center gap-2">
                      {connectedSource === "healthkit" && <Badge variant="outline" className="border-red-500/40 text-red-400 text-[9px]"><Heart className="w-2.5 h-2.5 mr-0.5" /> HealthKit</Badge>}
                      {connectedSource === "googlefit" && <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[9px]"><Activity className="w-2.5 h-2.5 mr-0.5" /> Google Fit</Badge>}
                      {connectedSource === "mock" && <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-[9px]"><Wifi className="w-2.5 h-2.5 mr-0.5" /> モック</Badge>}
                      {lastSyncTime && <span className="text-[9px] text-muted-foreground">最終同期: {formatLastSync(lastSyncTime)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-primary" onClick={() => doSync(connectedSource, buildMockRecords())} disabled={isSyncing} data-testid="button-now-sync">
                        {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        <span className="ml-1">今すぐ同期</span>
                      </Button>
                      <button className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground" onClick={() => setConnectedSource(null)} data-testid="button-disconnect-health"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}

                {/* ── 同期メッセージ ── */}
                {syncMessage && (
                  <div className={`text-[11px] text-center py-1.5 rounded-md ${syncMessage.includes("失敗") ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`} data-testid="text-sync-message">
                    {syncMessage}
                  </div>
                )}

                {/* ── ローディング ── */}
                {(healthLoading || isSyncing) && (
                  <div className="flex items-center justify-center py-6 gap-2" data-testid="health-loading">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[12px] text-muted-foreground">{isSyncing ? "同期中..." : "読み込み中..."}</span>
                  </div>
                )}

                {/* ── データなし ── */}
                {!healthLoading && !isSyncing && healthRows.length === 0 && connectedSource && (
                  <div className="text-center py-8" data-testid="health-empty">
                    <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-[12px] text-muted-foreground/50">まだ記録がありません</p>
                  </div>
                )}

                {/* ── データ表示 ── */}
                {!healthLoading && !isSyncing && healthRows.length > 0 && (() => {
                  const latest = healthRows[healthRows.length - 1];
                  const steps = latest.steps ?? 0;
                  const sleepH = latest.sleep_minutes ? (latest.sleep_minutes / 60) : 0;
                  const hr = latest.heart_rate_avg ?? 0;
                  const calories = latest.active_calories ?? 0;
                  const metrics = [
                    { icon: Footprints, label: "今日の歩数", value: steps > 0 ? steps.toLocaleString() : "--", unit: "steps", pct: (steps / 8000) * 100, color: statusColor(steps, 5000, 2000), bar: statusBg(steps, 5000, 2000), goal: 8000, goalLabel: "目標8,000" },
                    { icon: Moon, label: "昨夜の睡眠", value: sleepH > 0 ? sleepH.toFixed(1) : "--", unit: "時間", pct: (sleepH / 9) * 100, color: statusColor(sleepH, 7, 5.5), bar: statusBg(sleepH, 7, 5.5), goal: 420, goalLabel: "目標7h" },
                    { icon: Heart, label: "安静時心拍", value: hr > 0 ? String(hr) : "--", unit: "bpm", pct: hr > 0 ? Math.min(hr / 120 * 100, 100) : 0, color: "text-red-400", bar: "bg-red-400", goal: null, goalLabel: null },
                    { icon: Flame, label: "消費カロリー", value: calories > 0 ? calories.toLocaleString() : "--", unit: "kcal", pct: (calories / 500) * 100, color: "text-orange-400", bar: "bg-orange-400", goal: null, goalLabel: null },
                  ];
                  return (
                    <div className="space-y-2">
                      {metrics.map(m => (
                        <div key={m.label} className="bg-card border border-border rounded-md p-3" data-testid={`phone-health-${m.label}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                            <div className="flex-1">
                              <div className="flex justify-between items-baseline">
                                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                {m.goalLabel && <p className="text-[8px] text-muted-foreground/60">{m.goalLabel}</p>}
                              </div>
                              <p className={`font-mono text-base font-bold ${m.color}`}>
                                {m.value} <span className="text-[10px] text-muted-foreground font-normal">{m.unit}</span>
                              </p>
                            </div>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden relative">
                            <div className={`h-full rounded-full ${m.bar} transition-all duration-1000`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                            {m.goal && (
                              <div className="absolute top-0 h-full w-px bg-white/40" style={{ left: "100%" }} />
                            )}
                          </div>
                        </div>
                      ))}

                      {/* ── 歩数7日グラフ ── */}
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[9px] text-muted-foreground tracking-[2px]">歩数 7日間</p>
                          <p className="text-[8px] text-muted-foreground/60">目標 8,000歩</p>
                        </div>
                        <div className="grid grid-cols-7 gap-1" data-testid="health-week-chart-steps">
                          {healthRows.map((row, i) => {
                            const s = row.steps ?? 0;
                            const pct = Math.min((s / 8000) * 100, 100);
                            const goalPct = Math.min((8000 / 8000) * 100, 100);
                            const d = new Date(row.recorded_date);
                            const dayLabel = d.toLocaleDateString("ja-JP", { weekday: "short" });
                            return (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <div className="w-full h-14 bg-border/30 rounded-sm relative overflow-hidden">
                                  <div className={`absolute bottom-0 w-full rounded-sm transition-all ${statusBg(s, 5000, 2000)}`} style={{ height: `${pct}%` }} />
                                  <div className="absolute w-full border-t border-dashed border-white/20" style={{ bottom: `${goalPct}%` }} />
                                </div>
                                <span className="text-[8px] text-muted-foreground">{dayLabel}</span>
                                <span className="text-[7px] text-muted-foreground/50 font-mono">{s > 0 ? (s / 1000).toFixed(1) + "k" : "--"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── 睡眠7日グラフ ── */}
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[9px] text-muted-foreground tracking-[2px]">睡眠時間 7日間</p>
                          <p className="text-[8px] text-muted-foreground/60">目標 7時間</p>
                        </div>
                        <div className="grid grid-cols-7 gap-1" data-testid="health-week-chart-sleep">
                          {healthRows.map((row, i) => {
                            const sm = row.sleep_minutes ?? 0;
                            const h = sm / 60;
                            const pct = Math.min((h / 9) * 100, 100);
                            const d = new Date(row.recorded_date);
                            const dayLabel = d.toLocaleDateString("ja-JP", { weekday: "short" });
                            return (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <div className="w-full h-10 bg-border/30 rounded-sm relative overflow-hidden">
                                  <div className={`absolute bottom-0 w-full rounded-sm transition-all ${statusBg(h, 7, 5.5)}`} style={{ height: `${pct}%` }} />
                                  <div className="absolute w-full border-t border-dashed border-white/20" style={{ bottom: `${(7 / 9) * 100}%` }} />
                                </div>
                                <span className="text-[8px] text-muted-foreground">{dayLabel}</span>
                                <span className="text-[7px] text-muted-foreground/50 font-mono">{sm > 0 ? h.toFixed(1) + "h" : "--"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── 心拍折れ線グラフ ── */}
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[9px] text-muted-foreground tracking-[2px]">心拍平均 7日間</p>
                          <p className="text-[8px] text-red-400/70 font-mono">bpm</p>
                        </div>
                        <div className="relative h-12 bg-border/20 rounded-sm" data-testid="health-week-chart-hr">
                          {(() => {
                            const validRows = healthRows.filter(r => (r.heart_rate_avg ?? 0) > 0);
                            if (validRows.length < 2) return <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground/40">データ不足</div>;
                            const vals = validRows.map(r => r.heart_rate_avg ?? 0);
                            const min = Math.min(...vals) - 5;
                            const max = Math.max(...vals) + 5;
                            const w = 100 / (healthRows.length - 1);
                            const points = healthRows.map((r, i) => {
                              const v = r.heart_rate_avg ?? 0;
                              const x = i * w;
                              const y = v > 0 ? 100 - ((v - min) / (max - min)) * 100 : null;
                              return { x, y, v };
                            }).filter(p => p.y !== null);
                            const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                            return (
                              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                                <path d={pathD} fill="none" stroke="rgb(248,113,113)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                {points.map((p, i) => (
                                  <circle key={i} cx={p.x} cy={p.y!} r="3" fill="rgb(248,113,113)" vectorEffect="non-scaling-stroke" />
                                ))}
                              </svg>
                            );
                          })()}
                        </div>
                        <div className="grid grid-cols-7 mt-0.5">
                          {healthRows.map((row, i) => {
                            const d = new Date(row.recorded_date);
                            return (
                              <div key={i} className="flex flex-col items-center">
                                <span className="text-[7px] text-muted-foreground">{d.toLocaleDateString("ja-JP", { weekday: "short" })}</span>
                                <span className="text-[7px] text-red-400/70 font-mono">{row.heart_rate_avg ?? "--"}</span>
                              </div>
                            );
                          })}
                        </div>
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

            {phoneTab === "coupon" && (
              <div className="space-y-3" data-testid="section-coupon-wallet">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-muted-foreground tracking-[2px]">クーポンウォレット</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] border-primary/40 text-primary"
                    disabled={couponIssuing || !profile?.id}
                    onClick={issueCoupon}
                    data-testid="button-issue-coupon"
                  >
                    {couponIssuing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Ticket className="w-3 h-3 mr-1" />テスト発行</>}
                  </Button>
                </div>
                {couponsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : coupons.length === 0 ? (
                  <div className="text-center py-8" data-testid="text-no-coupons">
                    <Ticket className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-[12px] text-muted-foreground">クーポンはありません</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">アプリインストール完了時に自動発行されます</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {coupons.map((c) => {
                      const now = new Date();
                      const expired = new Date(c.expires_at) < now;
                      const isActive = c.status === "active" && !expired;
                      const displayStatus = c.status === "used" ? "使用済み" : expired ? "期限切れ" : "使用可能";
                      const expiresDate = new Date(c.expires_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
                      return (
                        <div
                          key={c.id}
                          className={`rounded-xl border p-3.5 transition-all ${
                            isActive
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-border bg-muted/10 opacity-50"
                          }`}
                          data-testid={`card-coupon-${c.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Ticket className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-muted-foreground"}`} />
                              <span className="text-[10px] text-muted-foreground">{c.description}</span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                            }`} data-testid={`status-coupon-${c.id}`}>
                              {displayStatus}
                            </span>
                          </div>
                          <p className="font-mono text-[20px] font-bold text-foreground tracking-widest mb-2" data-testid={`code-coupon-${c.id}`}>
                            {c.code}
                          </p>
                          <div className="flex justify-between items-center">
                            <p className={`text-[18px] font-bold ${isActive ? "text-emerald-400" : "text-muted-foreground"}`}>
                              ¥{c.discount_amount.toLocaleString()}OFF
                            </p>
                            <p className="text-[9px] text-muted-foreground">有効期限: {expiresDate}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {issuedCoupon && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-[2.5rem]" data-testid="modal-coupon-issued">
            <div className="mx-4 bg-card border border-emerald-500/40 rounded-2xl p-5 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-[13px] font-bold text-emerald-400 mb-1">🎁 500円OFFクーポンが発行されました！</p>
              <div className="bg-muted/30 rounded-lg p-3 my-3">
                <p className="font-mono text-[18px] font-bold text-foreground tracking-widest" data-testid="text-issued-coupon-code">{issuedCoupon.code}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  有効期限: {new Date(issuedCoupon.expires_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mb-4">次回来院時にスタッフにお伝えください</p>
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]"
                onClick={() => setIssuedCoupon(null)}
                data-testid="button-close-coupon-modal"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> 確認しました
              </Button>
            </div>
          </div>
        )}
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
