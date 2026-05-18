import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Zap, Send, Brain, Stethoscope, Check,
  Shield, Sparkles, Droplets, Layers,
  ClipboardList, Activity, Mic, MicOff, FileText,
  BarChart3, Heart, Footprints, Moon, Search,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  ChevronRight, MapPin, GlassWater, CircleDot,
  Users, ShoppingCart, Package, Calendar, ChevronDown, ChevronUp, Clock,
  UserCheck, Save, RefreshCw, Edit3, Plus, Trash2, AlertCircle, History, UserPlus, X,
  MessageSquare, Smartphone, CheckCircle2, XCircle, Ticket, CalendarDays, ChevronLeft, ChevronRight as ChevronRightIcon,
  Settings, Building2, Bell, Palette, Download,
  CalendarCheck, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  SummaryResult, KarteResult, CorrelationResult,
  Product, TreatmentRecord, KarteHistoryEntry, Coupon,
} from "@/lib/constants";
import {
  DEMO_PRODUCTS, TREATMENT_HISTORY, HEALTH_DATA,
  REV_CONV_RATE,
  statusColor, statusBg, genWeeklyData,
} from "@/lib/constants";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const toKatakana = (str: string) =>
  str.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

const normalizeJa = (str: string) => toKatakana(str.trim().toLowerCase());

function renderUnclearText(text: string): React.ReactNode {
  const parts = text.split(/(\[\[\?:[^\]]*\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[\?:(.*)\]\]$/);
    if (m) {
      return (
        <span key={i} className="text-red-500 font-bold" title="不明瞭・聞き取り困難">
          {m[1] || "〔不明〕"}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const DEMO_PATIENT_ENTRY = {
  id: "00000000-demo-0000-0000-000000000001",
  name_kana: "徳川家康",
  member_grade: "gold",
  gender: "male",
  birth_date: "1543-01-31",
  phone: "090-0000-1543",
  address: "愛知県岡崎市",
  created_at: "2026-01-01T00:00:00.000Z",
} as const;

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

interface ClinicInfo { id: string; name: string; }
interface AdminPatient {
  id: string;
  name_kana: string;
  member_grade: string;
  gender: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}
interface Staff {
  id: string;
  clinic_id: string;
  name: string;
  role: "owner" | "staff" | "reception";
  email: string | null;
  calendar_color: string;
  is_active: boolean;
  created_at: string;
}
interface AdminVisit {
  id: string;
  patient_id: string;
  visited_at: string;
  chief_complaint: string | null;
  soap_note: {
    assessment?: string;
    treatment_plan?: string;
    follow_up?: string;
    risk_flags?: string[];
    staff_name?: string;
  } | null;
  lifestyle_advice: string[] | null;
}

interface IPadViewProps {
  ipadTab: string;
  onIpadTabChange: (tab: string) => void;
  transcript: string;
  onTranscriptChange: (val: string) => void;
  isRecordingPre: boolean;
  isRecordingPost: boolean;
  preRecDone: boolean;
  postRecDone: boolean;
  audioUploadError: string | null;
  preTranscript: { teacher: string; patient: string } | null;
  postTranscript: { teacher: string; patient: string } | null;
  isTranscribingPre: boolean;
  isTranscribingPost: boolean;
  onStartRecPhase: (phase: "pre" | "post") => void;
  onStopRecPhase: (phase: "pre" | "post") => void;
  onLoadSample: () => void;
  summary: SummaryResult | null;
  isSummarizing: boolean;
  karte: KarteResult | null;
  isAnalyzing: boolean;
  onDoKarte: () => void;
  karteSaved?: boolean;
  karteVisitId: string | null;
  correlationResult: CorrelationResult | null;
  isCorrelating: boolean;
  onDoCorrelation: () => void;
  healthSynced: boolean;
  healthSyncing: boolean;
  onSyncHealth: () => void;
  onSendToPatient: () => void;
  karteHistory: KarteHistoryEntry[];
  selectedPatientId: string | null;
  selectedClinicId: string | null;
  onPatientSelect: (patientId: string, clinicId: string) => void;
  staffName: string;
  onStaffChange: (name: string) => void;
}

const PRODUCT_ICONS: Record<string, typeof Shield> = {
  "W001": Shield,
  "S001": Sparkles,
  "S002": GlassWater,
  "W002": Layers,
};

export function IPadView(props: IPadViewProps) {
  const {
    ipadTab, onIpadTabChange, transcript, onTranscriptChange,
    isRecordingPre, isRecordingPost, preRecDone, postRecDone, audioUploadError,
    preTranscript, postTranscript, isTranscribingPre, isTranscribingPost,
    onStartRecPhase, onStopRecPhase, onLoadSample,
    summary, isSummarizing, karte, isAnalyzing, onDoKarte, karteSaved, karteVisitId,
    correlationResult, isCorrelating, onDoCorrelation,
    healthSynced, healthSyncing, onSyncHealth, onSendToPatient,
    karteHistory, selectedPatientId, selectedClinicId, onPatientSelect,
    staffName, onStaffChange,
  } = props;

  const DEMO_STAFF = ["院長 山田", "スタッフ 佐藤", "スタッフ 田中"];

  const weeklyData = useMemo(() => genWeeklyData(), []);

  // ── Editable karte state ─────────────────────────────────────────
  const [editedKarte, setEditedKarte] = useState<KarteResult | null>(null);
  const [editSaved, setEditSaved] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (karte && !karte.error) {
      setEditedKarte({ ...karte });
      setEditSaved(false);
      setEditError(null);
    }
  }, [karte]);

  // ── Visit filter ─────────────────────────────────────────────────
  const [visitPatientFilter, setVisitPatientFilter] = useState("");
  const [visitStaffFilter, setVisitStaffFilter] = useState("");

  // ── Patient search ───────────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState("");

  // ── New patient modal ────────────────────────────────────────────
  const { toast } = useToast();

  // ── Settings modal state ──────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"clinic" | "staff" | "menu" | "notify">("clinic");
  const [clinicForm, setClinicForm] = useState({
    name: "", postal: "", address: "", phone: "", email: "", hours: "", website: "",
    closedDays: [] as string[],
    holidayDates: [] as { date: string; label: string }[],
  });
  const [holidayInput, setHolidayInput] = useState({ date: "", label: "" });
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState({
    name: "", role: "staff" as "owner" | "staff" | "reception", email: "", calendar_color: "#00c896",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [postalLooking, setPostalLooking] = useState(false);
  const [menuItems, setMenuItems] = useState([
    { name: "整体施術", duration: 30, price: 3300 },
    { name: "鍼施術", duration: 45, price: 5500 },
  ]);
  const [notifySettings, setNotifySettings] = useState({ smsEnabled: true, reminderDays: 2 });

  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name_kana: "", birth_date: "", gender: "", phone: "", address: "",
  });
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [newPatientError, setNewPatientError] = useState<string | null>(null);
  const [registeredPatient, setRegisteredPatient] = useState<{ id: string; name_kana: string } | null>(null);
  const [smsStatus, setSmsStatus] = useState<"sending" | "sent" | "failed" | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const closeNewPatientModal = () => {
    setShowNewPatient(false);
    setRegisteredPatient(null);
    setSmsStatus(null);
    setNewPatientError(null);
    setNewPatientForm({ name_kana: "", birth_date: "", gender: "", phone: "", address: "" });
  };

  const saveNewPatient = async () => {
    if (!newPatientForm.name_kana.trim() || !clinicId) return;
    if (!newPatientForm.birth_date) { setNewPatientError("生年月日は必須です。"); return; }
    if (!newPatientForm.phone.trim()) { setNewPatientError("電話番号は必須です。"); return; }
    setIsSavingPatient(true);
    setNewPatientError(null);
    try {
      const body: Record<string, string> = {
        name_kana: newPatientForm.name_kana.trim(),
        clinic_id: clinicId,
        member_grade: "bronze",
        birth_date: newPatientForm.birth_date,
        phone: newPatientForm.phone.trim(),
      };
      if (newPatientForm.gender) body.gender = newPatientForm.gender;
      if (newPatientForm.address.trim()) body.address = newPatientForm.address.trim();
      const saved = await apiRequest("POST", "/api/patients", body);
      const patient = await saved.json();
      queryClient.invalidateQueries({ queryKey: ["admin-patients", clinicId] });
      setRegisteredPatient({ id: patient.id, name_kana: patient.name_kana });

      if (newPatientForm.phone) {
        setSmsStatus("sending");
        try {
          await apiRequest("POST", "/api/patients/invite", {
            patient_id: patient.id,
            phone: newPatientForm.phone,
            clinic_name: clinicInfo?.name ?? "堺整骨院",
          });
          setSmsStatus("sent");
          toast({ title: "登録完了", description: "SMSを送信しました" });
        } catch {
          setSmsStatus("failed");
          toast({ title: "登録完了", description: "登録は完了しましたがSMS送信に失敗しました", variant: "destructive" });
        }
      } else {
        toast({ title: "登録完了", description: `${patient.name_kana} を登録しました` });
      }
    } catch {
      setNewPatientError("保存に失敗しました。再度お試しください。");
    }
    setIsSavingPatient(false);
  };

  // ── Supabase queries ─────────────────────────────────────────────
  const { data: clinicInfo } = useQuery<ClinicInfo>({
    queryKey: ["/api/admin/clinic"],
    staleTime: 60000,
  });

  const clinicId = clinicInfo?.id ?? null;

  const { data: staffs = [], refetch: refetchStaffs } = useQuery<Staff[]>({
    queryKey: ["staffs", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const res = await fetch(`/api/staffs?clinic_id=${clinicId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clinicId,
    staleTime: 30000,
  });

  // Sync clinic name to settings form when loaded
  useEffect(() => {
    if (clinicInfo?.name) setClinicForm(f => ({ ...f, name: f.name || clinicInfo.name }));
  }, [clinicInfo?.name]);

  const { data: patients = [], isLoading: patientsLoading, error: patientsError } = useQuery<AdminPatient[]>({
    queryKey: ["admin-patients", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const res = await fetch(`/api/patients?clinic_id=${clinicId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!clinicId,
    staleTime: 30000,
  });

  const { data: adminVisits = [], isLoading: visitsLoading, error: visitsError } = useQuery<AdminVisit[]>({
    queryKey: ["admin-visits", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const res = await fetch(`/api/visits?clinic_id=${clinicId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!clinicId,
    staleTime: 15000,
  });

  const patientMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    patients.forEach(p => { m[p.id] = p.name_kana; });
    return m;
  }, [patients]);

  const selectedPatient =
    selectedPatientId === DEMO_PATIENT_ENTRY.id
      ? DEMO_PATIENT_ENTRY
      : (patients.find(p => p.id === selectedPatientId) ?? null);

  const filteredPatients = useMemo(() => {
    if (patientSearch.trim().toLowerCase() === "demo") return [DEMO_PATIENT_ENTRY];
    if (!patientSearch.trim()) return patients;
    const q = normalizeJa(patientSearch);
    return patients.filter(p => normalizeJa(p.name_kana).includes(q));
  }, [patients, patientSearch]);

  const filteredVisits = useMemo(() => {
    let results = adminVisits;
    if (visitPatientFilter.trim()) {
      const q = normalizeJa(visitPatientFilter);
      results = results.filter(v => {
        const name = patientMap[v.patient_id] ?? "";
        return normalizeJa(name).includes(q);
      });
    }
    if (visitStaffFilter) {
      results = results.filter(v => v.soap_note?.staff_name === visitStaffFilter);
    }
    return results;
  }, [adminVisits, visitPatientFilter, visitStaffFilter, patientMap]);

  // ── 郵便番号 → 住所自動入力 ───────────────────────────────────────
  const lookupPostal = async (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    setClinicForm(f => ({ ...f, postal: raw }));
    if (digits.length !== 7) return;
    setPostalLooking(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        const addr = `${r.address1}${r.address2}${r.address3}`;
        setClinicForm(f => ({ ...f, address: addr }));
      }
    } catch {
    } finally {
      setPostalLooking(false);
    }
  };

  // ── Settings save ─────────────────────────────────────────────────
  const saveClinicSettings = async () => {
    if (!clinicForm.name.trim()) return;
    setIsSavingSettings(true);
    try {
      await apiRequest("PATCH", "/api/admin/clinic", { name: clinicForm.name.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinic"] });
      toast({ title: "保存完了", description: "医院情報を更新しました" });
    } catch {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
    }
    setIsSavingSettings(false);
  };

  const saveNewStaff = async () => {
    if (!addStaffForm.name.trim() || !clinicId) return;
    setIsSavingStaff(true);
    try {
      await apiRequest("POST", "/api/staffs", {
        clinic_id: clinicId,
        name: addStaffForm.name.trim(),
        role: addStaffForm.role,
        email: addStaffForm.email,
        calendar_color: addStaffForm.calendar_color,
      });
      await refetchStaffs();
      setAddStaffForm({ name: "", role: "staff", email: "", calendar_color: "#00c896" });
      setShowAddStaff(false);
      toast({ title: "追加完了", description: `${addStaffForm.name} を追加しました` });
    } catch {
      toast({ title: "エラー", description: "スタッフ追加に失敗しました", variant: "destructive" });
    }
    setIsSavingStaff(false);
  };

  const deleteStaff = async (id: string, name: string) => {
    try {
      await apiRequest("DELETE", `/api/staffs/${id}`, undefined);
      await refetchStaffs();
      toast({ title: "削除完了", description: `${name} を削除しました` });
    } catch {
      toast({ title: "エラー", description: "削除に失敗しました", variant: "destructive" });
    }
  };

  // ── Save edited karte ────────────────────────────────────────────
  const saveEditedKarte = async () => {
    if (!karteVisitId || !editedKarte) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await apiRequest("PATCH", `/api/visits/${karteVisitId}`, {
        chief_complaint: editedKarte.chief_complaint,
        soap_note: editedKarte,
        lifestyle_advice: editedKarte.lifestyle_advice ?? [],
        recommended_products: editedKarte.recommended_products ?? [],
        follow_up: editedKarte.follow_up,
        risk_flags: editedKarte.risk_flags ?? [],
      });
      setEditSaved(true);
      queryClient.invalidateQueries({ queryKey: ["admin-visits", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient/visits"] });
    } catch (e) {
      setEditError("保存に失敗しました。再度お試しください。");
    }
    setIsSavingEdit(false);
  };

  // ── Current staff role ────────────────────────────────────────────
  const currentStaff = staffs.find(s => s.name === staffName) ?? null;
  const currentRole: "owner" | "staff" | "reception" = currentStaff?.role ?? "owner";

  // ── Tabs (role-filtered) ──────────────────────────────────────────
  const allTabs = [
    { id: "patients",    label: "患者選択",   icon: Users,      roles: ["owner", "staff", "reception"], comingSoon: false },
    { id: "schedule",    label: "予約管理",   icon: CalendarDays, roles: ["owner", "staff", "reception"], comingSoon: false },
    { id: "voice",       label: "音声入力",   icon: Mic,        roles: ["owner", "staff"], comingSoon: false },
    { id: "karte",       label: "カルテ",     icon: FileText,   roles: ["owner", "staff"], comingSoon: false },
    { id: "visits",      label: "治療履歴",   icon: History,    roles: ["owner", "staff", "reception"], comingSoon: false },
    ...(healthSynced ? [{ id: "health", label: "健康データ", icon: Heart, roles: ["owner", "staff"], comingSoon: false }] : []),
    { id: "coupon-admin",label: "クーポン確認", icon: Ticket,   roles: ["owner", "reception"], comingSoon: false },
    { id: "history",     label: "相関分析",   icon: BarChart3,  roles: ["owner", "staff"], comingSoon: true },
    { id: "ec-sales",    label: "通販売上",   icon: ShoppingCart, roles: ["owner"], comingSoon: true },
  ];
  const tabs = allTabs.filter(t => t.roles.includes(currentRole));

  const gradeColor = (grade: string) => {
    if (grade === "platinum") return "text-purple-400 border-purple-400/30";
    if (grade === "gold") return "text-amber-400 border-amber-400/30";
    if (grade === "silver") return "text-slate-300 border-slate-300/30";
    return "text-amber-700 border-amber-700/30";
  };

  return (
    <div className="max-w-[980px] mx-auto px-4 py-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        {selectedPatient ? (
          <>
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="text-[15px] font-bold text-foreground" data-testid="text-patient-name-ipad">{selectedPatient.name_kana}</span>
            <Badge variant="outline" className={gradeColor(selectedPatient.member_grade)} data-testid="badge-grade">
              {selectedPatient.member_grade.toUpperCase()}
            </Badge>
          </>
        ) : (
          <>
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground" data-testid="text-patient-name-ipad">
              {clinicInfo?.name ?? "読み込み中..."} — 患者を選択してください
            </span>
          </>
        )}
        {healthSynced && <Badge data-testid="badge-healthkit">HealthKit 連携済</Badge>}
        <div className="ml-auto flex items-center gap-2">
          {/* Staff selector — uses real staffs from API, falls back to demo list */}
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-md px-2 py-1">
            <UserCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <select
              value={staffName}
              onChange={e => onStaffChange(e.target.value)}
              className="bg-transparent text-[12px] text-foreground outline-none cursor-pointer pr-1"
              data-testid="select-staff-name"
            >
              {(staffs.length > 0 ? staffs.map(s => s.name) : DEMO_STAFF).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {currentRole !== "owner" && (
              <span className={`text-[9px] px-1 rounded ${currentRole === "reception" ? "text-amber-400 bg-amber-500/15" : "text-sky-400 bg-sky-500/15"}`}>
                {currentRole === "reception" ? "受付" : "スタッフ"}
              </span>
            )}
          </div>
          {!healthSynced && (
            <Button variant="outline" size="sm" onClick={onSyncHealth} disabled={healthSyncing} data-testid="button-sync-health">
              {healthSyncing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 同期中...</> : <><Activity className="w-3.5 h-3.5" /> HealthKit 同期</>}
            </Button>
          )}
          {/* Settings gear — owner only */}
          {currentRole === "owner" && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-open-settings">
              <Settings className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5 overflow-x-auto">
        {tabs.filter(t => !t.comingSoon).map(t => (
          <button
            key={t.id}
            onClick={() => onIpadTabChange(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[11px] tracking-wider border-b-2 transition-colors ${
              ipadTab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            }`}
            data-testid={`tab-ipad-${t.id}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        {/* Coming Soon tabs — pushed to the right */}
        <div className="ml-auto flex items-center">
          {tabs.filter(t => t.comingSoon).map(t => (
            <span
              key={t.id}
              title="準備中"
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[11px] tracking-wider border-b-2 border-transparent text-muted-foreground/30 cursor-default select-none"
              data-testid={`tab-ipad-${t.id}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 患者選択 ───────────────────────────────────────────────── */}
      {ipadTab === "patients" && (
        <div data-testid="patients-tab">
          {/* ヘッダー行 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mr-auto">
              {clinicInfo ? `${clinicInfo.name} — 患者一覧（${patients.length}名）` : "クリニック情報を読み込み中..."}
            </p>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-patients", clinicId] })}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" onClick={() => { setNewPatientError(null); setShowNewPatient(true); }} data-testid="button-new-patient">
              <UserPlus className="w-3.5 h-3.5" /> 新規患者登録
            </Button>
          </div>

          {/* 検索バー */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              placeholder="患者名で検索（カナ）"
              className="pl-8 text-[12px] h-8"
              data-testid="input-patient-search"
            />
            {patientSearch && (
              <button onClick={() => setPatientSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {patientsLoading && (
            <div className="flex items-center justify-center py-16 gap-2" data-testid="patients-loading">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-[13px] text-muted-foreground">患者データを読み込んでいます...</span>
            </div>
          )}
          {patientsError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 flex items-center gap-2" data-testid="patients-error">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-[12px] text-red-300">患者データの取得に失敗しました。再度更新してください。</p>
            </div>
          )}
          {!patientsLoading && !patientsError && filteredPatients.length === 0 && (
            <div className="text-center py-16" data-testid="patients-empty">
              <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground/50">
                {patientSearch ? "該当する患者が見つかりません" : "患者が登録されていません"}
              </p>
            </div>
          )}

          {/* 同姓同名警告 */}
          {patientSearch.trim() && filteredPatients.length > 1 && (
            (() => {
              const nameSet = new Set(filteredPatients.map(p => p.name_kana));
              const hasDupe = nameSet.size < filteredPatients.length;
              return hasDupe ? (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 mb-3" data-testid="warning-duplicate-patients">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[12px] text-amber-300">同姓同名の患者が複数います。生年月日・電話番号で本人確認してから選択してください。</p>
                </div>
              ) : null;
            })()
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPatients.map(p => {
              const isSelected = selectedPatientId === p.id;
              const d = p.birth_date ? new Date(p.birth_date) : null;
              const bdLabel = d ? d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : null;
              const phoneLast4 = p.phone?.replace(/\D/g, "").slice(-4) ?? null;
              const dupeCount = filteredPatients.filter(x => x.name_kana === p.name_kana).length;
              return (
                <button
                  key={p.id}
                  onClick={() => onPatientSelect(p.id, clinicId!)}
                  className={`text-left rounded-lg border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                  }`}
                  data-testid={`patient-card-${p.id}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="font-bold text-[14px] text-foreground">{p.name_kana}</span>
                    {dupeCount > 1 && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 py-0 flex items-center gap-0.5" data-testid={`badge-dupe-${p.id}`}>
                        <AlertTriangle className="w-2.5 h-2.5" />同名
                      </span>
                    )}
                    <Badge variant="outline" className={`ml-auto text-[9px] h-5 ${gradeColor(p.member_grade)}`}>
                      {p.member_grade.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    {bdLabel && <span>{bdLabel}</span>}
                    {bdLabel && phoneLast4 && <span className="text-muted-foreground/40">·</span>}
                    {phoneLast4 && <span>末尾{phoneLast4}</span>}
                    {p.gender && <span className="ml-1">{p.gender}</span>}
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* ── 予約管理 ───────────────────────────────────────────────── */}
      {ipadTab === "schedule" && (
        <ScheduleTab clinicName={clinicInfo?.name ?? "整骨院"} />
      )}

      {/* ── 音声入力 ───────────────────────────────────────────────── */}
      {ipadTab === "voice" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            {/* Selected patient banner */}
            {selectedPatient ? (
              <div className="flex items-center gap-2 mb-3 bg-primary/10 border border-primary/20 rounded-md px-3 py-2" data-testid="selected-patient-banner">
                <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[12px] text-primary font-medium">施術対象: {selectedPatient.name_kana}</span>
                <Badge variant="outline" className={`ml-auto text-[9px] ${gradeColor(selectedPatient.member_grade)}`}>
                  {selectedPatient.member_grade.toUpperCase()}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2" data-testid="no-patient-warning">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[12px] text-amber-400">患者を選択してください</span>
                <button onClick={() => onIpadTabChange("patients")} className="ml-auto text-[11px] text-primary underline">患者選択 →</button>
              </div>
            )}

            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2">施術中の会話（マイク入力 or テキスト入力）</p>

            {/* 2-phase recording buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {/* 施術前 */}
              <div className="flex flex-col gap-1">
                <Button
                  variant={isRecordingPre ? "destructive" : preRecDone ? "outline" : "default"}
                  onClick={() => isRecordingPre ? onStopRecPhase("pre") : onStartRecPhase("pre")}
                  disabled={isRecordingPost}
                  className="w-full"
                  data-testid="button-record-pre"
                >
                  {isRecordingPre ? (
                    <><span className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" /><MicOff className="w-3.5 h-3.5 mr-1" />停止</>
                  ) : preRecDone ? (
                    <><Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /><span className="text-emerald-400">施術前 完了 ✓</span></>
                  ) : (
                    <><Mic className="w-3.5 h-3.5 mr-1" />🎙 施術前 録音開始</>
                  )}
                </Button>
                {isRecordingPre && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-[10px] font-mono text-destructive">REC 施術前...</span>
                  </div>
                )}
              </div>

              {/* 施術後 */}
              <div className="flex flex-col gap-1">
                <Button
                  variant={isRecordingPost ? "destructive" : postRecDone ? "outline" : "default"}
                  onClick={() => isRecordingPost ? onStopRecPhase("post") : onStartRecPhase("post")}
                  disabled={isRecordingPre}
                  className="w-full"
                  data-testid="button-record-post"
                >
                  {isRecordingPost ? (
                    <><span className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" /><MicOff className="w-3.5 h-3.5 mr-1" />停止</>
                  ) : postRecDone ? (
                    <><Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /><span className="text-emerald-400">施術後 完了 ✓</span></>
                  ) : (
                    <><Mic className="w-3.5 h-3.5 mr-1" />🎙 施術後 録音開始</>
                  )}
                </Button>
                {isRecordingPost && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-[10px] font-mono text-destructive">REC 施術後...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Transcription loading indicators */}
            {(isTranscribingPre || isTranscribingPost) && (
              <div className="flex gap-2 mb-2">
                {isTranscribingPre && (
                  <div className="flex items-center gap-1.5 flex-1 bg-primary/10 border border-primary/20 rounded px-2.5 py-1.5" data-testid="text-transcribing-pre">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-[11px] text-primary font-mono">施術前 文字起こし中...</span>
                  </div>
                )}
                {isTranscribingPost && (
                  <div className="flex items-center gap-1.5 flex-1 bg-primary/10 border border-primary/20 rounded px-2.5 py-1.5" data-testid="text-transcribing-post">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-[11px] text-primary font-mono">施術後 文字起こし中...</span>
                  </div>
                )}
              </div>
            )}

            {/* Upload / transcription error */}
            {audioUploadError && (
              <div className="flex items-center gap-1.5 mb-2 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5" data-testid="text-audio-upload-error">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400">{audioUploadError}</span>
              </div>
            )}

            {/* Transcript display: pre/post sections when available, otherwise plain textarea */}
            {(preTranscript || postTranscript) ? (
              <div className="bg-card border border-border rounded-md text-[12px] leading-[1.9] p-3 h-[180px] overflow-y-auto font-mono whitespace-pre-wrap" data-testid="input-transcript">
                {preTranscript && (
                  <>
                    <span className="text-primary font-bold">【施術前】</span>{"\n"}
                    <span className="text-cyan-400">先生：</span>{renderUnclearText(preTranscript.teacher)}{"\n"}
                    <span className="text-amber-400">患者：</span>{renderUnclearText(preTranscript.patient)}
                  </>
                )}
                {preTranscript && postTranscript && <>{"\n\n"}</>}
                {postTranscript && (
                  <>
                    <span className="text-primary font-bold">【施術後】</span>{"\n"}
                    <span className="text-cyan-400">先生：</span>{renderUnclearText(postTranscript.teacher)}{"\n"}
                    <span className="text-amber-400">患者：</span>{renderUnclearText(postTranscript.patient)}
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                <Textarea
                  value={transcript}
                  onChange={e => onTranscriptChange(e.target.value)}
                  placeholder="録音後に文字起こし結果が表示されます。サンプル読込も可。"
                  className="h-[180px] resize-none text-[12px] leading-[1.8] bg-card font-mono"
                  data-testid="input-transcript"
                />
              </div>
            )}
            {selectedPatientId === DEMO_PATIENT_ENTRY.id && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onLoadSample}
                  data-testid="button-load-sample"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border border-border/30 bg-transparent text-[11px] text-muted-foreground/40 hover:border-border/50 hover:bg-muted/10 transition-colors"
                >
                  <FileText className="w-3 h-3 opacity-40" />
                  <span className="text-amber-400/70">サンプル読込</span>
                </button>
              </div>
            )}
            <Button
              className="w-full mt-2.5"
              size="lg"
              onClick={onDoKarte}
              disabled={isAnalyzing || !(preRecDone && postRecDone) && !transcript.trim()}
              data-testid="button-generate-karte"
            >
              {isAnalyzing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> カルテ生成中...</>
                : <><Zap className="w-4 h-4" /> {preRecDone && postRecDone ? "正式カルテ＋商品推薦を生成" : "AIカルテを生成"}</>
              }
            </Button>
            {karteSaved && (
              <div className="flex items-center gap-1.5 mt-2 justify-center" data-testid="text-karte-saved">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-mono">Supabaseに自動保存済み</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-2">AI 要点整理（自動）</p>
            {!summary && !isSummarizing && (
              <div className="h-[240px] bg-card border border-dashed border-border rounded-md flex flex-col items-center justify-center gap-2">
                <ClipboardList className="w-7 h-7 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground/50" data-testid="text-empty-summary">音声入力後、自動で要約</p>
              </div>
            )}
            {isSummarizing && (
              <div className="h-[240px] bg-primary/5 border border-primary/20 rounded-md flex flex-col items-center justify-center">
                <Brain className="w-7 h-7 text-primary animate-pulse" />
                <p className="text-[12px] text-primary mt-2" data-testid="text-summarizing">要点を整理中...</p>
              </div>
            )}
            {summary && !summary.error && (
              <ScrollArea className="h-[240px] bg-card border border-primary/20 rounded-md">
                <div className="p-3.5 space-y-3" data-testid="panel-summary">
                  {([
                    ["主訴", summary.chief_complaint],
                    ["主要症状", summary.key_symptoms?.join(" / ")],
                    ["生活習慣の問題", summary.lifestyle_issues?.join(" / ")],
                    ["処置内容", summary.treatment_done],
                    ["ホームケア", summary.home_care?.join(" / ")],
                    ["次回注意点", summary.follow_up],
                  ] as [string, string | undefined][]).map(([k, v]) => v ? (
                    <div key={k}>
                      <p className="text-[9px] font-mono text-primary tracking-[2px]">{k}</p>
                      <p className="text-[12px] text-foreground/70 leading-relaxed mt-1">{v}</p>
                    </div>
                  ) : null)}
                </div>
              </ScrollArea>
            )}
            {summary?.error && (
              <div className="h-[240px] border border-destructive/30 rounded-md flex items-center justify-center">
                <p className="text-[12px] text-destructive" data-testid="text-summary-error">エラー。再度お試しください。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── カルテ (edit + history) ────────────────────────────────── */}
      {ipadTab === "karte" && (
        <div className="space-y-5">
          {/* Editable karte form */}
          {editedKarte && !editedKarte.error && (
            <Card className="border-primary/30 bg-primary/3" data-testid="karte-edit-form">
              <div className="p-4 border-b border-primary/20 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <p className="text-[11px] font-mono text-primary tracking-[2px]">カルテ確認・編集</p>
                {karteVisitId && (
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">ID: {karteVisitId.slice(0, 8)}…</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">主訴</p>
                    <Input
                      value={editedKarte.chief_complaint ?? ""}
                      onChange={e => setEditedKarte(prev => ({ ...prev!, chief_complaint: e.target.value }))}
                      className="text-[12px] bg-card"
                      data-testid="edit-chief-complaint"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">見立て（Assessment）</p>
                    <Textarea
                      value={editedKarte.assessment ?? ""}
                      onChange={e => setEditedKarte(prev => ({ ...prev!, assessment: e.target.value }))}
                      className="text-[12px] bg-card h-[80px] resize-none"
                      data-testid="edit-assessment"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">施術方針（Treatment Plan）</p>
                    <Textarea
                      value={editedKarte.treatment_plan ?? ""}
                      onChange={e => setEditedKarte(prev => ({ ...prev!, treatment_plan: e.target.value }))}
                      className="text-[12px] bg-card h-[80px] resize-none"
                      data-testid="edit-treatment-plan"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">次回来院</p>
                    <div className="flex gap-2">
                      <Input
                        value={editedKarte.follow_up ?? ""}
                        onChange={e => setEditedKarte(prev => ({ ...prev!, follow_up: e.target.value }))}
                        className="text-[12px] bg-card flex-1"
                        data-testid="edit-follow-up"
                      />
                      {editedKarte.follow_up && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 text-[11px] px-2 h-9"
                          onClick={() => window.open(buildGCalUrl(editedKarte.follow_up!, clinicInfo?.name ?? "整骨院"), "_blank")}
                          data-testid="button-gcal-ipad"
                        >
                          <Calendar className="w-3.5 h-3.5 mr-1" />GCal登録
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-mono text-amber-400/70 tracking-[2px] mb-1">生活アドバイス</p>
                    {(editedKarte.lifestyle_advice ?? []).map((a, i) => (
                      <div key={i} className="flex gap-1.5 mb-1">
                        <Input
                          value={a}
                          onChange={e => {
                            const arr = [...(editedKarte.lifestyle_advice ?? [])];
                            arr[i] = e.target.value;
                            setEditedKarte(prev => ({ ...prev!, lifestyle_advice: arr }));
                          }}
                          className="text-[11px] bg-card flex-1"
                          data-testid={`edit-lifestyle-advice-${i}`}
                        />
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => {
                          const arr = (editedKarte.lifestyle_advice ?? []).filter((_, j) => j !== i);
                          setEditedKarte(prev => ({ ...prev!, lifestyle_advice: arr }));
                        }}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-[11px] text-primary mt-0.5" onClick={() => {
                      setEditedKarte(prev => ({ ...prev!, lifestyle_advice: [...(prev?.lifestyle_advice ?? []), ""] }));
                    }}>
                      <Plus className="w-3 h-3" /> 追加
                    </Button>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-red-400/70 tracking-[2px] mb-1">注意事項（Risk Flags）</p>
                    {(editedKarte.risk_flags ?? []).map((f, i) => (
                      <div key={i} className="flex gap-1.5 mb-1">
                        <Input
                          value={f}
                          onChange={e => {
                            const arr = [...(editedKarte.risk_flags ?? [])];
                            arr[i] = e.target.value;
                            setEditedKarte(prev => ({ ...prev!, risk_flags: arr }));
                          }}
                          className="text-[11px] bg-card flex-1"
                          data-testid={`edit-risk-flag-${i}`}
                        />
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => {
                          const arr = (editedKarte.risk_flags ?? []).filter((_, j) => j !== i);
                          setEditedKarte(prev => ({ ...prev!, risk_flags: arr }));
                        }}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* SOAP + 5-axis read-only display */}
              {(editedKarte.subjective || editedKarte.objective || editedKarte.plan || editedKarte.treatment_summary || editedKarte.advice_5axis || editedKarte.next_visit_note) && (
                <div className="mx-4 mb-4 border border-primary/15 rounded-md bg-primary/3 p-3.5 space-y-3" data-testid="panel-soap-5axis">
                  <p className="text-[9px] font-mono text-primary tracking-[3px] border-b border-primary/15 pb-1.5">AI要点整理（自動）</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2.5">
                      {([
                        ["S — 自覚症状", editedKarte.subjective],
                        ["O — 所見", editedKarte.objective],
                        ["A — 見立て", editedKarte.assessment],
                        ["P — 施術方針", editedKarte.plan],
                        ["本日の施術内容", editedKarte.treatment_summary],
                        ["次回確認事項", editedKarte.next_visit_note],
                      ] as [string, string | undefined][]).map(([label, val]) => val ? (
                        <div key={label}>
                          <p className="text-[9px] font-mono text-primary/60 tracking-[2px] mb-0.5">{label}</p>
                          <p className="text-[11px] text-foreground/70 leading-relaxed">{val}</p>
                        </div>
                      ) : null)}
                    </div>
                    {editedKarte.advice_5axis && Object.values(editedKarte.advice_5axis).some(v => v) && (
                      <div>
                        <p className="text-[9px] font-mono text-amber-400/70 tracking-[2px] mb-1.5">5軸アドバイス</p>
                        <div className="space-y-1.5">
                          {([
                            ["🏃 運動", editedKarte.advice_5axis.exercise],
                            ["😴 睡眠", editedKarte.advice_5axis.sleep],
                            ["🥗 栄養", editedKarte.advice_5axis.nutrition],
                            ["🌿 生活習慣", editedKarte.advice_5axis.lifestyle],
                            ["🧘 メンタル", editedKarte.advice_5axis.mental],
                          ] as [string, string | undefined][]).map(([label, val]) => val ? (
                            <div key={label} className="flex items-start gap-2">
                              <span className="text-[10px] text-amber-400/80 shrink-0 w-[72px] font-mono leading-relaxed">{label}</span>
                              <span className="text-[11px] text-foreground/60 leading-relaxed">{val}</span>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="px-4 pb-4 flex items-center gap-3">
                <Button
                  onClick={saveEditedKarte}
                  disabled={isSavingEdit || !karteVisitId}
                  className="gap-2"
                  data-testid="button-save-karte"
                >
                  {isSavingEdit
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
                    : <><Save className="w-4 h-4" /> visitテーブルに保存</>
                  }
                </Button>
                {editSaved && (
                  <div className="flex items-center gap-1.5" data-testid="text-edit-saved">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-[12px] text-emerald-400 font-mono">保存しました</span>
                  </div>
                )}
                {editError && (
                  <div className="flex items-center gap-1.5" data-testid="text-edit-error">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-[12px] text-red-400">{editError}</span>
                    <Button variant="ghost" size="sm" onClick={saveEditedKarte} className="text-[11px] text-primary">
                      <RefreshCw className="w-3 h-3" /> 再試行
                    </Button>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={onSendToPatient} className="ml-auto gap-2" data-testid="button-send-to-patient">
                  <Send className="w-3.5 h-3.5" /> 患者スマホへ送信
                </Button>
              </div>
            </Card>
          )}

          {/* Karte history */}
          <KarteHistoryTab karteHistory={karteHistory} onSendToPatient={onSendToPatient} karteSaved={karteSaved} />
        </div>
      )}

      {/* ── 治療履歴（Supabase） ──────────────────────────────────── */}
      {ipadTab === "visits" && (
        <div data-testid="visits-tab">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px]">
              治療履歴（全 {adminVisits.length} 件）
            </p>
            <div className="flex-1 max-w-[200px]">
              <Input
                value={visitPatientFilter}
                onChange={e => setVisitPatientFilter(e.target.value)}
                placeholder="患者名で絞り込み..."
                className="h-7 text-[12px]"
                data-testid="input-visit-filter"
              />
            </div>
            {/* Staff filter */}
            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-md px-2 h-7">
              <UserCheck className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <select
                value={visitStaffFilter}
                onChange={e => setVisitStaffFilter(e.target.value)}
                className="bg-transparent text-[11px] text-foreground outline-none cursor-pointer"
                data-testid="select-visit-staff-filter"
              >
                <option value="">全スタッフ</option>
                {(staffs.length > 0 ? staffs.map(s => s.name) : DEMO_STAFF).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-visits", clinicId] })}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {visitsLoading && (
            <div className="flex items-center justify-center py-16 gap-2" data-testid="visits-loading">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-[13px] text-muted-foreground">治療履歴を読み込んでいます...</span>
            </div>
          )}
          {visitsError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 flex items-center gap-2" data-testid="visits-error">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-[12px] text-red-300">治療履歴の取得に失敗しました。</p>
            </div>
          )}
          {!visitsLoading && !visitsError && filteredVisits.length === 0 && (
            <div className="text-center py-16" data-testid="visits-empty">
              <History className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground/50">
                {visitPatientFilter ? "条件に一致する記録がありません" : "治療記録がありません"}
              </p>
            </div>
          )}

          <ScrollArea className="h-[520px] pr-1">
            <div className="space-y-0">
              {filteredVisits.map((v, i) => {
                const patientName = patientMap[v.patient_id] ?? "不明";
                const d = new Date(v.visited_at);
                const dateLabel = d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
                const timeLabel = d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={v.id} className="flex gap-2.5" data-testid={`visit-row-${i}`}>
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-primary" : "bg-muted"}`} />
                      {i < filteredVisits.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className={`flex-1 rounded-md p-2.5 mb-2.5 border ${i === 0 ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{dateLabel} {timeLabel}</span>
                        {i === 0 && <Badge variant="default" className="text-[9px] h-4">最新</Badge>}
                        {v.soap_note?.staff_name && (
                          <span className="flex items-center gap-0.5 text-[9px] text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0 h-4" data-testid={`badge-staff-${i}`}>
                            <UserCheck className="w-2.5 h-2.5" />
                            {v.soap_note.staff_name}
                          </span>
                        )}
                        <span className="ml-auto font-medium text-[12px] text-foreground">{patientName}</span>
                      </div>
                      <p className="text-[12px] text-foreground/80 font-medium mb-1">
                        {v.chief_complaint ?? "主訴なし"}
                      </p>
                      {v.soap_note?.treatment_plan && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">施術: {v.soap_note.treatment_plan}</p>
                      )}
                      {v.lifestyle_advice && v.lifestyle_advice.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {v.lifestyle_advice.slice(0, 1).map((a, j) => (
                            <span key={j} className="text-[10px] text-amber-400/70 bg-amber-500/10 rounded px-1.5 py-0.5">
                              {a.length > 40 ? a.slice(0, 40) + "…" : a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ── 相関分析（旧: 履歴・相関分析） ─────────────────────────── */}
      {ipadTab === "history" && (
        <div>
          <div className="flex justify-end mb-3">
            <Button className="gap-2" size="lg" onClick={onDoCorrelation} disabled={isCorrelating} data-testid="button-correlate">
              {isCorrelating ? <><Loader2 className="w-4 h-4 animate-spin" /> 相関分析中...</> : <><Search className="w-4 h-4" /> 治療履歴 x 生活データ 相関分析</>}
            </Button>
          </div>

          {!correlationResult && !isCorrelating && (
            <div className="bg-card border border-dashed border-border rounded-md p-8 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[12px] text-muted-foreground/50 leading-relaxed" data-testid="text-empty-correlation">
                ボタンを押すとAIが治療データと生活習慣の相関を分析します
              </p>
            </div>
          )}

          {isCorrelating && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-10 text-center">
              <Brain className="w-8 h-8 text-primary animate-pulse mx-auto mb-3" />
              <p className="text-[12px] text-primary mb-1" data-testid="text-correlating">データを解析中...</p>
              <p className="text-[11px] text-muted-foreground">治療部位 x 歩数 x 睡眠 x HRV の相関を計算しています</p>
            </div>
          )}

          {correlationResult && !correlationResult.error && (
            <ScrollArea className="h-[500px] pr-1" data-testid="panel-correlation">
              <div className="space-y-2.5 animate-slide-up">
                <Card className="p-3.5 border-primary/20">
                  <p className="text-[9px] font-mono text-primary tracking-[2px] mb-1.5">総括</p>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">{correlationResult.summary}</p>
                </Card>

                {correlationResult.improvement_trend && (
                  <Card className="p-3.5">
                    <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-2">回復トレンド</p>
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14">
                        <svg viewBox="0 0 36 36" className="w-14 h-14" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none"
                            stroke={correlationResult.improvement_trend!.score >= 60 ? "hsl(160, 80%, 45%)" : correlationResult.improvement_trend!.score >= 40 ? "hsl(40, 90%, 55%)" : "hsl(0, 70%, 55%)"}
                            strokeWidth="3"
                            strokeDasharray={`${correlationResult.improvement_trend!.score} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold font-mono text-foreground">
                          {correlationResult.improvement_trend!.score}
                        </div>
                      </div>
                      <div>
                        <div className={`text-[13px] font-bold flex items-center gap-1 ${correlationResult.improvement_trend!.direction === "改善" ? "text-emerald-400" : correlationResult.improvement_trend!.direction === "悪化" ? "text-red-400" : "text-amber-400"}`}>
                          {correlationResult.improvement_trend!.direction === "改善" ? <TrendingUp className="w-4 h-4" /> : correlationResult.improvement_trend!.direction === "悪化" ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          {correlationResult.improvement_trend!.direction}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{correlationResult.improvement_trend!.comment}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {correlationResult.correlations && correlationResult.correlations.length > 0 && (
                  <Card className="p-3.5">
                    <p className="text-[9px] font-mono text-amber-400 tracking-[2px] mb-2">発見された相関パターン</p>
                    {correlationResult.correlations.map((c, i) => (
                      <div key={i} className={`mb-2.5 pb-2.5 ${i < correlationResult.correlations!.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] text-amber-300 font-semibold">{c.title}</span>
                          <Badge variant="outline" className={`ml-auto text-[9px] h-4 ${c.strength === "強" ? "text-red-400 border-red-400/30" : c.strength === "中" ? "text-amber-400 border-amber-400/30" : "text-emerald-400 border-emerald-400/30"}`}>
                            相関 {c.strength}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-foreground/60 leading-relaxed">{c.finding}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">根拠: {c.data_evidence}</p>
                      </div>
                    ))}
                  </Card>
                )}

                {correlationResult.risk_areas && correlationResult.risk_areas.length > 0 && (
                  <Card className="p-3.5">
                    <p className="text-[9px] font-mono text-red-400 tracking-[2px] mb-2">リスク部位</p>
                    {correlationResult.risk_areas.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2">
                        <Badge variant="outline" className={`text-[9px] h-4 shrink-0 mt-0.5 ${r.risk_level === "高" ? "text-red-400 border-red-400/30" : r.risk_level === "中" ? "text-amber-400 border-amber-400/30" : "text-emerald-400 border-emerald-400/30"}`}>{r.risk_level}</Badge>
                        <div>
                          <p className="text-[12px] text-foreground/80">{r.area}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{r.reason}</p>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                {correlationResult.lifestyle_triggers && correlationResult.lifestyle_triggers.length > 0 && (
                  <Card className="p-3.5">
                    <p className="text-[9px] font-mono text-purple-400 tracking-[2px] mb-2">悪化トリガー</p>
                    {correlationResult.lifestyle_triggers.map((t, i) => (
                      <div key={i} className="flex gap-1.5 mb-1.5">
                        <Zap className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[12px] text-purple-300">{t.trigger}</span>
                          <span className="text-[11px] text-muted-foreground ml-1.5">→ {t.impact}</span>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                <Card className="p-3.5 border-chart-3/20">
                  {correlationResult.next_session_focus && correlationResult.next_session_focus.length > 0 && (
                    <div className="mb-2.5">
                      <p className="text-[9px] font-mono text-chart-3 tracking-[2px] mb-1.5">次回施術の重点ポイント</p>
                      {correlationResult.next_session_focus.map((f, i) => (
                        <div key={i} className="flex gap-1.5 mb-1">
                          <ChevronRight className="w-3 h-3 text-chart-3 mt-0.5 shrink-0" />
                          <span className="text-[12px] text-foreground/60 leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {correlationResult.prediction && (
                    <div>
                      <p className="text-[9px] font-mono text-muted-foreground tracking-[2px] mb-1">1ヶ月後の予測</p>
                      <p className="text-[12px] text-muted-foreground/70 leading-relaxed italic">"{correlationResult.prediction}"</p>
                    </div>
                  )}
                </Card>
              </div>
            </ScrollArea>
          )}

          {correlationResult?.error && (
            <div className="border border-destructive/30 rounded-md p-5 text-center">
              <p className="text-[12px] text-destructive" data-testid="text-correlation-error">エラーが発生しました。再度お試しください。</p>
            </div>
          )}
        </div>
      )}

      {/* ── 健康データ ─────────────────────────────────────────────── */}
      {ipadTab === "health" && healthSynced && (
        <div className="animate-fade-in">
          <div className="flex gap-2 mb-4 flex-wrap">
            <Badge>Apple HealthKit</Badge>
            <Badge variant="secondary">Google Fit 対応</Badge>
            <Badge variant="outline">最終同期: 今日 9:38</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { icon: Footprints, label: "歩数", value: HEALTH_DATA.steps.toLocaleString(), unit: "steps", color: statusColor(HEALTH_DATA.steps, 5000, 2000) },
              { icon: Moon, label: "睡眠", value: String(HEALTH_DATA.sleep), unit: "h", color: statusColor(HEALTH_DATA.sleep, 7, 5.5) },
              { icon: Heart, label: "心拍", value: String(HEALTH_DATA.heartRate), unit: "bpm", color: "text-red-400" },
              { icon: Zap, label: "HRV", value: String(HEALTH_DATA.hrv), unit: "ms", color: statusColor(HEALTH_DATA.hrv, 50, 35) },
            ].map(m => (
              <Card key={m.label} className="p-4 text-center" data-testid={`card-health-${m.label}`}>
                <m.icon className={`w-6 h-6 mx-auto mb-1.5 ${m.color}`} />
                <p className={`font-mono text-xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{m.label} / {m.unit}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4" data-testid="card-weekly-chart">
            <p className="text-[10px] font-mono text-muted-foreground tracking-[2px] mb-3">過去7日間 歩数トレンド</p>
            <div className="flex gap-1.5 items-end h-24">
              {weeklyData.map((d, i) => {
                const h = Math.max((d.steps / 8000) * 90, 6);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full rounded-t-sm ${i === 6 ? "bg-primary" : "bg-muted"}`} style={{ height: `${h}%` }} />
                    <span className={`text-[9px] ${i === 6 ? "text-primary" : "text-muted-foreground"}`}>{d.date}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {ipadTab === "ec-sales" && <ECSalesTab />}

      {ipadTab === "coupon-admin" && (
        <CouponAdminTab selectedPatientId={selectedPatientId} selectedPatient={selectedPatient} />
      )}

      {/* ── 設定モーダル ─────────────────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="modal-settings">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowSettings(false)} />
          <div className="relative z-10 w-full max-w-[680px] mx-4 bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <Settings className="w-4 h-4 text-primary" /> クリニック設定
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground" data-testid="button-close-settings">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border px-5">
              {([
                { id: "clinic" as const, label: "医院基本情報", icon: Building2 },
                { id: "staff"  as const, label: "スタッフ管理", icon: Users },
                { id: "menu"   as const, label: "施術メニュー", icon: ClipboardList },
                { id: "notify" as const, label: "通知設定", icon: Bell },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setSettingsTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                    settingsTab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                  data-testid={`settings-tab-${t.id}`}
                >
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ── 医院基本情報 ── */}
              {settingsTab === "clinic" && (
                <div className="space-y-4" data-testid="settings-clinic-tab">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[11px] font-mono text-primary/70 tracking-[1px]">院名<span className="text-red-400 ml-1">*</span></Label>
                      <Input value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} placeholder="例：堺整骨院" className="text-[13px]" data-testid="input-clinic-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">
                        郵便番号
                        {postalLooking && <span className="ml-2 text-primary animate-pulse">住所を検索中…</span>}
                      </Label>
                      <Input
                        value={clinicForm.postal}
                        onChange={e => lookupPostal(e.target.value)}
                        placeholder="〒1234567 または 123-4567"
                        className="text-[13px]"
                        maxLength={8}
                        data-testid="input-clinic-postal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">電話番号</Label>
                      <Input value={clinicForm.phone} onChange={e => setClinicForm(f => ({ ...f, phone: e.target.value }))} placeholder="072-000-0000" className="text-[13px]" data-testid="input-clinic-phone" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">住所</Label>
                      <Input value={clinicForm.address} onChange={e => setClinicForm(f => ({ ...f, address: e.target.value }))} placeholder="大阪府堺市北区〇〇町" className="text-[13px]" data-testid="input-clinic-address" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">メールアドレス</Label>
                      <Input type="email" value={clinicForm.email} onChange={e => setClinicForm(f => ({ ...f, email: e.target.value }))} placeholder="clinic@example.com" className="text-[13px]" data-testid="input-clinic-email" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">営業時間</Label>
                      <Input value={clinicForm.hours} onChange={e => setClinicForm(f => ({ ...f, hours: e.target.value }))} placeholder="9:00〜19:00" className="text-[13px]" data-testid="input-clinic-hours" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">定休日</Label>
                      <div className="flex gap-2 flex-wrap">
                        {["月", "火", "水", "木", "金", "土", "日"].map(d => (
                          <button
                            key={d}
                            onClick={() => setClinicForm(f => ({
                              ...f,
                              closedDays: f.closedDays.includes(d) ? f.closedDays.filter(x => x !== d) : [...f.closedDays, d],
                            }))}
                            className={`w-8 h-8 text-[12px] rounded-md border transition-colors ${
                              clinicForm.closedDays.includes(d)
                                ? "bg-primary border-primary text-background font-bold"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                            data-testid={`day-closed-${d}`}
                          >{d}</button>
                        ))}
                      </div>
                    </div>
                    {/* ── 特定休日 ── */}
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">特定休日（祝日・臨時休診など）</Label>
                      {/* プリセット */}
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "元旦", date: `${new Date().getFullYear()}-01-01` },
                          { label: "大晦日", date: `${new Date().getFullYear()}-12-31` },
                          { label: "お盆", date: `${new Date().getFullYear()}-08-15` },
                          { label: "年始2日", date: `${new Date().getFullYear()}-01-02` },
                          { label: "年始3日", date: `${new Date().getFullYear()}-01-03` },
                        ].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              if (!clinicForm.holidayDates.find(h => h.date === preset.date)) {
                                setClinicForm(f => ({ ...f, holidayDates: [...f.holidayDates, preset] }));
                              }
                            }}
                            className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                          >{preset.label}</button>
                        ))}
                      </div>
                      {/* 手動入力 */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] text-muted-foreground">日付</span>
                          <Input
                            type="date"
                            value={holidayInput.date}
                            onChange={e => setHolidayInput(h => ({ ...h, date: e.target.value }))}
                            className="text-[13px]"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] text-muted-foreground">名称（任意）</span>
                          <Input
                            value={holidayInput.label}
                            onChange={e => setHolidayInput(h => ({ ...h, label: e.target.value }))}
                            placeholder="例：臨時休診"
                            className="text-[13px]"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!holidayInput.date}
                          onClick={() => {
                            if (!holidayInput.date) return;
                            const entry = { date: holidayInput.date, label: holidayInput.label || holidayInput.date };
                            if (!clinicForm.holidayDates.find(h => h.date === entry.date)) {
                              setClinicForm(f => ({ ...f, holidayDates: [...f.holidayDates, entry].sort((a, b) => a.date.localeCompare(b.date)) }));
                            }
                            setHolidayInput({ date: "", label: "" });
                          }}
                        ><Plus className="w-3.5 h-3.5" /> 追加</Button>
                      </div>
                      {/* 登録済み一覧 */}
                      {clinicForm.holidayDates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {clinicForm.holidayDates.map(h => (
                            <span
                              key={h.date}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] text-primary"
                            >
                              {h.date} {h.label && h.label !== h.date ? `（${h.label}）` : ""}
                              <button
                                type="button"
                                onClick={() => setClinicForm(f => ({ ...f, holidayDates: f.holidayDates.filter(x => x.date !== h.date) }))}
                                className="ml-0.5 text-primary/60 hover:text-red-400 transition-colors"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">ウェブサイト URL</Label>
                      <Input value={clinicForm.website} onChange={e => setClinicForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" className="text-[13px]" data-testid="input-clinic-website" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={saveClinicSettings} disabled={isSavingSettings || !clinicForm.name.trim()} data-testid="button-save-clinic">
                      {isSavingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4" /> 保存</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── スタッフ管理 ── */}
              {settingsTab === "staff" && (
                <div className="space-y-3" data-testid="settings-staff-tab">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-mono text-muted-foreground tracking-[2px]">登録スタッフ（{staffs.length}名）</p>
                    <Button size="sm" onClick={() => setShowAddStaff(!showAddStaff)} data-testid="button-add-staff">
                      <Plus className="w-3.5 h-3.5" /> スタッフ追加
                    </Button>
                  </div>

                  {/* Add staff form */}
                  {showAddStaff && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3" data-testid="form-add-staff">
                      <p className="text-[11px] font-mono text-primary tracking-[1px]">新規スタッフ</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-mono text-primary/70">氏名<span className="text-red-400 ml-1">*</span></Label>
                          <Input value={addStaffForm.name} onChange={e => setAddStaffForm(f => ({ ...f, name: e.target.value }))} placeholder="氏名" className="text-[13px]" data-testid="input-staff-name" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-mono text-muted-foreground">役職</Label>
                          <Select value={addStaffForm.role} onValueChange={v => setAddStaffForm(f => ({ ...f, role: v as typeof f.role }))}>
                            <SelectTrigger className="text-[13px]" data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">院長</SelectItem>
                              <SelectItem value="staff">施術スタッフ</SelectItem>
                              <SelectItem value="reception">受付</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-mono text-muted-foreground">メールアドレス</Label>
                          <Input type="email" value={addStaffForm.email} onChange={e => setAddStaffForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@example.com" className="text-[13px]" data-testid="input-staff-email" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-mono text-muted-foreground">表示色（カレンダー用）</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={addStaffForm.calendar_color} onChange={e => setAddStaffForm(f => ({ ...f, calendar_color: e.target.value }))} className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer" data-testid="input-staff-color" />
                            <span className="text-[12px] text-muted-foreground font-mono">{addStaffForm.calendar_color}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowAddStaff(false)}>キャンセル</Button>
                        <Button size="sm" onClick={saveNewStaff} disabled={isSavingStaff || !addStaffForm.name.trim()} data-testid="button-save-staff">
                          {isSavingStaff ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...</> : <><Save className="w-3.5 h-3.5" /> 追加</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Staff list */}
                  <div className="space-y-2">
                    {staffs.length === 0 && !showAddStaff && (
                      <p className="text-center text-[12px] text-muted-foreground/50 py-8">スタッフが登録されていません</p>
                    )}
                    {staffs.map(s => (
                      <div key={s.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5 bg-card" data-testid={`staff-row-${s.id}`}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.calendar_color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.role === "owner" ? "院長" : s.role === "staff" ? "施術スタッフ" : "受付"}
                            {s.email && ` · ${s.email}`}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteStaff(s.id, s.name)}
                          className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                          data-testid={`button-delete-staff-${s.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 施術メニュー ── */}
              {settingsTab === "menu" && (
                <div className="space-y-3" data-testid="settings-menu-tab">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-mono text-muted-foreground tracking-[2px]">施術メニュー（{menuItems.length}件）</p>
                    <Button size="sm" onClick={() => setMenuItems(m => [...m, { name: "", duration: 30, price: 0 }])} data-testid="button-add-menu">
                      <Plus className="w-3.5 h-3.5" /> メニュー追加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {menuItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_90px_32px] gap-2 items-end" data-testid={`menu-row-${i}`}>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono text-muted-foreground">メニュー名</Label>
                          <Input value={item.name} onChange={e => setMenuItems(m => m.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="整体施術" className="text-[12px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono text-muted-foreground">時間(分)</Label>
                          <Input type="number" value={item.duration} onChange={e => setMenuItems(m => m.map((x, j) => j === i ? { ...x, duration: Number(e.target.value) } : x))} className="text-[12px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono text-muted-foreground">料金(円)</Label>
                          <Input type="number" value={item.price} onChange={e => setMenuItems(m => m.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} className="text-[12px]" />
                        </div>
                        <button onClick={() => setMenuItems(m => m.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 pb-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => toast({ title: "保存完了", description: "施術メニューを更新しました（デモ）" })} data-testid="button-save-menu">
                      <Save className="w-4 h-4" /> 保存
                    </Button>
                  </div>
                </div>
              )}

              {/* ── 通知設定 ── */}
              {settingsTab === "notify" && (
                <div className="space-y-5" data-testid="settings-notify-tab">
                  <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">SMS 送信</p>
                      <p className="text-[11px] text-muted-foreground">患者へのSMS送信を有効にする</p>
                    </div>
                    <button
                      onClick={() => setNotifySettings(n => ({ ...n, smsEnabled: !n.smsEnabled }))}
                      className={`w-10 h-6 rounded-full transition-colors relative ${notifySettings.smsEnabled ? "bg-primary" : "bg-muted"}`}
                      data-testid="toggle-sms"
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${notifySettings.smsEnabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div className="border border-border rounded-lg px-4 py-3 space-y-2">
                    <p className="text-[13px] font-medium text-foreground">予約リマインド送信タイミング</p>
                    <p className="text-[11px] text-muted-foreground">次回予約の何日前にSMSを送るか</p>
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 3].map(d => (
                        <button
                          key={d}
                          onClick={() => setNotifySettings(n => ({ ...n, reminderDays: d }))}
                          className={`px-4 py-1.5 rounded-md text-[12px] border transition-colors ${
                            notifySettings.reminderDays === d ? "bg-primary border-primary text-background font-bold" : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                          data-testid={`reminder-day-${d}`}
                        >
                          {d}日前
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => toast({ title: "保存完了", description: "通知設定を更新しました（デモ）" })} data-testid="button-save-notify">
                      <Save className="w-4 h-4" /> 保存
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {showNewPatient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="modal-new-patient">
          <div className="absolute inset-0 bg-black/70" onClick={!registeredPatient ? closeNewPatientModal : undefined} />
          <div className="relative z-10 w-full max-w-[420px] mx-4 bg-card border border-border rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                {registeredPatient
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 登録完了</>
                  : <><UserPlus className="w-4 h-4 text-primary" /> 新規患者登録</>
                }
              </h2>
              <button onClick={closeNewPatientModal} className="text-muted-foreground hover:text-foreground" data-testid="button-close-new-patient">
                <X className="w-4 h-4" />
              </button>
            </div>

            {registeredPatient ? (
              /* ── 登録完了後の画面 ── */
              <div className="space-y-5" data-testid="section-register-success">
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-[13px] text-emerald-300 font-medium">{registeredPatient.name_kana} 様を登録しました</p>
                </div>

                {/* SMS ステータス */}
                {smsStatus && (
                  <div className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
                    smsStatus === "sending" ? "bg-blue-500/10 border-blue-500/20" :
                    smsStatus === "sent"    ? "bg-primary/10 border-primary/20" :
                                             "bg-red-500/10 border-red-500/20"
                  }`} data-testid="sms-status">
                    {smsStatus === "sending" && <><Loader2 className="w-4 h-4 text-blue-400 shrink-0 animate-spin" /><p className="text-[12px] text-blue-300">SMS送信中...</p></>}
                    {smsStatus === "sent"    && <><MessageSquare className="w-4 h-4 text-primary shrink-0" /><p className="text-[12px] text-primary">アプリ招待SMSを送信しました</p></>}
                    {smsStatus === "failed"  && <><XCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-[12px] text-red-300">SMS送信に失敗しました（登録は完了済み）</p></>}
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => setShowOnboarding(true)}
                    data-testid="button-show-onboarding"
                  >
                    <Smartphone className="w-4 h-4" /> 初診説明を表示
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full" onClick={closeNewPatientModal} data-testid="button-done-new-patient">
                    閉じる
                  </Button>
                </div>
              </div>
            ) : (
              /* ── 登録フォーム ── */
              <>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-mono text-primary/70 tracking-[1px]">氏名（カナ）<span className="text-red-400 ml-1">*</span></Label>
                    <Input value={newPatientForm.name_kana} onChange={e => setNewPatientForm(f => ({ ...f, name_kana: e.target.value }))} placeholder="例：ヤマダ タロウ" className="text-[13px]" data-testid="input-new-patient-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-mono text-primary/70 tracking-[1px]">生年月日<span className="text-red-400 ml-1">*</span></Label>
                    <Input type="date" value={newPatientForm.birth_date} onChange={e => setNewPatientForm(f => ({ ...f, birth_date: e.target.value }))} className="text-[13px]" data-testid="input-new-patient-birth" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-mono text-primary/70 tracking-[1px]">電話番号<span className="text-red-400 ml-1">*</span></Label>
                    <Input type="tel" value={newPatientForm.phone} onChange={e => setNewPatientForm(f => ({ ...f, phone: e.target.value }))} placeholder="例：090-1234-5678" className="text-[13px]" data-testid="input-new-patient-phone" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">性別</Label>
                    <Select value={newPatientForm.gender} onValueChange={v => setNewPatientForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger className="text-[13px]" data-testid="select-new-patient-gender"><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="男性">男性</SelectItem>
                        <SelectItem value="女性">女性</SelectItem>
                        <SelectItem value="その他">その他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-mono text-muted-foreground tracking-[1px]">住所（市区町村まで）</Label>
                    <Input value={newPatientForm.address} onChange={e => setNewPatientForm(f => ({ ...f, address: e.target.value }))} placeholder="例：大阪府堺市北区" className="text-[13px]" data-testid="input-new-patient-address" />
                  </div>
                  {newPatientError && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2" data-testid="new-patient-error">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-[12px] text-red-300">{newPatientError}</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="ghost" size="sm" onClick={closeNewPatientModal} data-testid="button-cancel-new-patient">キャンセル</Button>
                  <Button onClick={saveNewPatient} disabled={isSavingPatient || !newPatientForm.name_kana.trim() || !newPatientForm.birth_date || !newPatientForm.phone.trim()} data-testid="button-save-new-patient">
                    {isSavingPatient ? <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4" /> 保存</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 初診説明フルスクリーン ── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[200] bg-[#0a0f1e] flex flex-col items-center justify-center p-8 overflow-y-auto" data-testid="screen-onboarding">
          <div className="w-full max-w-[600px] py-4">
            <p className="font-mono text-[10px] tracking-[4px] text-primary/60 text-center mb-2">VLUX PATIENT GUIDE</p>
            <h1 className="text-[24px] font-bold text-foreground text-center mb-8">VLUXアプリのはじめかた</h1>

            {/* ── 4 Steps ── */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { step: 1, title: "今SMSが届きます", desc: "URLをタップして開いてください", icon: MessageSquare },
                { step: 2, title: "「共有」ボタンをタップ", desc: "画面下の四角から矢印が出ているアイコンです", icon: Send },
                { step: 3, title: "「ホーム画面に追加」を選択", desc: "アプリとして使えるようになります", icon: Smartphone },
                { step: 4, title: "施術記録が届きます", desc: "来院のたびに記録・毎日の健康データも自動で記録されます", icon: Heart },
              ].map(({ step, title, desc, icon: Icon }) => (
                <div key={step} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                  <span className="font-mono text-[11px] text-primary/60 tracking-[2px]">STEP {step}</span>
                  <Icon className="w-7 h-7 text-primary" />
                  <div>
                    <p className="text-[15px] font-bold text-foreground mb-1">{title}</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── クーポン特典 ── */}
            <div className="border border-primary/30 rounded-xl p-6 bg-primary/5" data-testid="onboarding-coupon-section">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[18px]">🎁</span>
                <p className="text-[15px] font-bold text-foreground">アプリ登録特典</p>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-foreground">初回登録：<span className="text-primary font-bold">次回施術料 500円OFF</span></p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-foreground">毎回の来院でポイント付与</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-foreground">ランクが上がるほど割引率アップ</p>
                </div>
              </div>
              <div className="bg-background/60 rounded-lg p-3 mb-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-mono">
                  {[
                    { label: "Bronze", pct: "3%", color: "text-amber-700" },
                    { label: "Silver", pct: "7%", color: "text-slate-300" },
                    { label: "Gold", pct: "10%", color: "text-amber-400" },
                    { label: "Platinum", pct: "15%", color: "text-purple-400" },
                    { label: "永久会員", pct: "20%", color: "text-cyan-300" },
                  ].map(r => (
                    <span key={r.label} className={r.color}>{r.label} <span className="text-foreground font-bold">{r.pct}</span></span>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-primary/80 text-center font-medium">「来るたびにお得になる」仕組みです。</p>
            </div>

            <Button
              variant="ghost"
              className="mt-8 w-full gap-2 text-muted-foreground"
              onClick={() => setShowOnboarding(false)}
              data-testid="button-close-onboarding"
            >
              <X className="w-4 h-4" /> 閉じる
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


function KarteHistoryTab({ karteHistory, onSendToPatient, karteSaved }: { karteHistory: KarteHistoryEntry[]; onSendToPatient: () => void; karteSaved?: boolean }) {
  const latestId = karteHistory.length > 0 ? karteHistory[0].id : null;
  const [expandedId, setExpandedId] = useState<string | null>(latestId);
  const [prevLatestId, setPrevLatestId] = useState<string | null>(latestId);
  if (latestId !== prevLatestId) {
    setPrevLatestId(latestId);
    setExpandedId(latestId);
  }

  if (karteHistory.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-[12px] text-muted-foreground/50" data-testid="text-empty-karte">音声入力タブで会話を入力しカルテを生成してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="karte-history-tab">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-mono text-muted-foreground tracking-[2px]">
            カルテ履歴（{karteHistory.length}件）
          </p>
          {karteSaved && (
            <div className="flex items-center gap-1" data-testid="text-karte-saved">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-mono">カルテ保存済み</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSendToPatient}
          data-testid="button-send-to-patient"
        >
          <Send className="w-3.5 h-3.5" /> 患者スマホへ送信
        </Button>
      </div>

      <ScrollArea className="h-[560px]">
        <div className="space-y-3 pr-2">
          {karteHistory.map((entry, idx) => {
            const isExpanded = expandedId === entry.id;
            const k = entry.karte;
            const s = entry.summary;
            const entryProds = k.recommended_products
              ? DEMO_PRODUCTS.filter(p => k.recommended_products!.includes(p.id))
              : DEMO_PRODUCTS.slice(0, 2);

            return (
              <Card
                key={entry.id}
                className={`border transition-all ${idx === 0 ? "border-primary/30" : "border-border"}`}
                style={{ background: idx === 0 ? "rgba(0,200,150,.03)" : "rgba(255,255,255,.02)" }}
                data-testid={`karte-history-entry-${entry.id}`}
              >
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  data-testid={`karte-history-toggle-${entry.id}`}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono text-[12px] text-foreground/70">{entry.createdAt}</span>
                  </div>
                  {idx === 0 && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px]">最新</Badge>
                  )}
                  <span className="text-[12px] text-foreground/60 flex-1 truncate">
                    {k.chief_complaint || "カルテ"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 animate-slide-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-[9px] font-mono text-primary tracking-[3px] border-b border-primary/20 pb-1">正式カルテ (SOAP)</p>
                        {([
                          ["主訴", k.chief_complaint],
                          ["S — 自覚症状", k.subjective],
                          ["O — 所見", k.objective],
                          ["A — 見立て", k.assessment || k.treatment_plan],
                          ["P — 施術方針", k.plan],
                          ["本日の施術", k.treatment_summary],
                          ["次回確認事項", k.next_visit_note],
                          ["次回来院", k.follow_up],
                        ] as [string, string | undefined][]).map(([label, val]) => val ? (
                          <div key={label}>
                            <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-0.5">{label}</p>
                            <p className="text-[12px] text-foreground/70 leading-relaxed whitespace-pre-line">{val}</p>
                          </div>
                        ) : null)}
                        {k.advice_5axis && Object.values(k.advice_5axis).some(v => v) && (
                          <div>
                            <p className="text-[9px] font-mono text-amber-400/70 tracking-[2px] mb-1.5">5軸アドバイス</p>
                            <div className="space-y-1.5">
                              {([
                                ["🏃 運動", k.advice_5axis.exercise],
                                ["😴 睡眠", k.advice_5axis.sleep],
                                ["🥗 栄養", k.advice_5axis.nutrition],
                                ["🌿 生活習慣", k.advice_5axis.lifestyle],
                                ["🧘 メンタル", k.advice_5axis.mental],
                              ] as [string, string | undefined][]).map(([label, val]) => val ? (
                                <div key={label} className="flex items-start gap-2">
                                  <span className="text-[10px] text-amber-400/80 shrink-0 font-mono w-20">{label}</span>
                                  <span className="text-[11px] text-foreground/60 leading-relaxed">{val}</span>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}
                        {k.lifestyle_advice && k.lifestyle_advice.length > 0 && !k.advice_5axis && (
                          <div>
                            <p className="text-[9px] font-mono text-amber-400/70 tracking-[2px] mb-0.5">生活アドバイス</p>
                            {k.lifestyle_advice.map((a, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <Check className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                <span className="text-[11px] text-foreground/60 leading-relaxed">{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {k.risk_flags && k.risk_flags.length > 0 && (
                          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-md">
                            <p className="text-[9px] font-mono text-red-400 tracking-[2px] mb-1">注意事項</p>
                            {k.risk_flags.map((f, i) => (
                              <p key={i} className="text-[11px] text-red-300/70 leading-relaxed">{f}</p>
                            ))}
                          </div>
                        )}
                        {entryProds.length > 0 && (
                          <div>
                            <p className="text-[9px] font-mono text-primary/70 tracking-[2px] mb-1">AI レコメンド商品</p>
                            {entryProds.map(p => {
                              const Icon = PRODUCT_ICONS[p.id] || Shield;
                              return (
                                <div key={p.id} className="flex gap-2 mb-2 bg-primary/5 rounded-md p-2">
                                  <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-foreground/80">{p.name}</p>
                                    <p className="text-[11px] text-primary font-mono font-bold">¥{p.price.toLocaleString()}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] font-mono text-chart-3 tracking-[3px] border-b border-chart-3/20 pb-1">AI 要点整理</p>
                        {s && !s.error ? (
                          <div className="space-y-2.5">
                            {([
                              ["主訴", s.chief_complaint],
                              ["主要症状", s.key_symptoms?.join(" / ")],
                              ["生活習慣の問題", s.lifestyle_issues?.join(" / ")],
                              ["処置内容", s.treatment_done],
                              ["ホームケア", s.home_care?.join(" / ")],
                              ["次回注意点", s.follow_up],
                            ] as [string, string | undefined][]).map(([label, val]) => val ? (
                              <div key={label}>
                                <p className="text-[9px] font-mono text-chart-3/70 tracking-[2px] mb-0.5">{label}</p>
                                <p className="text-[12px] text-foreground/60 leading-relaxed">{val}</p>
                              </div>
                            ) : null)}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/50 py-4 text-center">要点整理データなし</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

type BookingStage = "new" | "alt_sent" | "patient_replied" | "confirmed" | "closed";

interface BookingAltSlot { id: string; date: string; time: string; }
interface BookingMessage {
  from: "clinic" | "patient";
  text: string;
  time: string;
  altSlots?: BookingAltSlot[];
  chosenSlotId?: string;
  type?: "text" | "alt_proposal" | "alt_choice" | "confirmed";
}
interface BookingRequest {
  id: string;
  patientName: string;
  requestedDate: string;
  requestedTime: string;
  treatmentType: string;
  note: string;
  stage: BookingStage;
  messages: BookingMessage[];
  receivedAt: string;
}

const BOOKING_STAGE_DOT: Record<BookingStage, string> = {
  new: "bg-amber-400",
  alt_sent: "bg-blue-400",
  patient_replied: "bg-violet-400 animate-pulse",
  confirmed: "bg-primary",
  closed: "bg-muted-foreground/40",
};
const BOOKING_STAGE_LABEL: Record<BookingStage, string> = {
  new: "新着",
  alt_sent: "代替提案済",
  patient_replied: "患者返答あり",
  confirmed: "予約確定",
  closed: "対応済",
};
const BOOKING_STAGE_COLOR: Record<BookingStage, string> = {
  new: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  alt_sent: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  patient_replied: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  confirmed: "text-primary bg-primary/10 border-primary/30",
  closed: "text-muted-foreground bg-muted/10 border-border",
};

const INITIAL_BOOKING_REQUESTS: BookingRequest[] = [
  {
    id: "1",
    patientName: "田中 花子",
    requestedDate: "5/13（水）",
    requestedTime: "10:00",
    treatmentType: "定期施術",
    note: "先週から右肩が痛い。早めに来たい。",
    stage: "new",
    receivedAt: "14分前",
    messages: [],
  },
  {
    id: "2",
    patientName: "山田 太郎",
    requestedDate: "5/14（木）",
    requestedTime: "14:00",
    treatmentType: "初診",
    note: "腰痛で歩くのが辛い",
    stage: "alt_sent",
    receivedAt: "1時間前",
    messages: [
      {
        from: "clinic",
        text: "ご希望の日時は施術者の都合により対応が難しい状況です。以下の候補日はいかがでしょうか？",
        time: "10:32",
        type: "alt_proposal",
        altSlots: [
          { id: "a", date: "5/15（金）", time: "10:00" },
          { id: "b", date: "5/15（金）", time: "14:30" },
          { id: "c", date: "5/16（土）", time: "11:00" },
        ],
      },
    ],
  },
  {
    id: "3",
    patientName: "鈴木 美咲",
    requestedDate: "5/11（月）",
    requestedTime: "11:00",
    treatmentType: "再診",
    note: "",
    stage: "patient_replied",
    receivedAt: "昨日",
    messages: [
      {
        from: "clinic",
        text: "以下の候補日はいかがでしょうか？",
        time: "昨日 09:15",
        type: "alt_proposal",
        altSlots: [
          { id: "a", date: "5/15（金）", time: "10:00" },
          { id: "b", date: "5/15（金）", time: "14:30" },
        ],
      },
      {
        from: "patient",
        text: "5/15（金）14:30 でお願いします！",
        time: "昨日 11:42",
        type: "alt_choice",
        chosenSlotId: "b",
      },
    ],
  },
  {
    id: "4",
    patientName: "佐藤 健一",
    requestedDate: "5/10（日）",
    requestedTime: "09:00",
    treatmentType: "定期施術",
    note: "膝のリハビリ継続",
    stage: "confirmed",
    receivedAt: "2日前",
    messages: [
      {
        from: "clinic",
        text: "ご予約を承りました。ご来院をお待ちしております。",
        time: "2日前",
        type: "confirmed",
      },
    ],
  },
];

const PRESET_BOOKING_MESSAGES = [
  "ご希望の日時は施術者の都合により対応が難しい状況です。以下の候補日はいかがでしょうか？",
  "ご連絡ありがとうございます。大変恐れ入りますが、ご希望の日は満員となっております。",
  "ご予約を承りました。ご来院をお待ちしております。",
];

function ScheduleTab({ clinicName }: {
  clinicName: string;
}) {
  const [requests, setRequests] = useState<BookingRequest[]>(INITIAL_BOOKING_REQUESTS);
  const [selectedId, setSelectedId] = useState("2");
  const [altDraft, setAltDraft] = useState<BookingAltSlot[]>([]);
  const [msgText, setMsgText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [altDate, setAltDate] = useState("");
  const [altTime, setAltTime] = useState("");
  const [addingAlt, setAddingAlt] = useState(false);

  const selected = requests.find(r => r.id === selectedId)!;

  const updateReq = (id: string, patch: Partial<BookingRequest>) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addMsg = (msg: BookingMessage) => {
    const req = requests.find(r => r.id === selectedId)!;
    updateReq(selectedId, { messages: [...req.messages, msg] });
  };

  const sendAltProposal = () => {
    if (altDraft.length === 0) return;
    addMsg({
      from: "clinic",
      text: msgText || PRESET_BOOKING_MESSAGES[0],
      time: "今",
      type: "alt_proposal",
      altSlots: altDraft,
    });
    updateReq(selectedId, { stage: "alt_sent" });
    setAltDraft([]);
    setMsgText("");
  };

  const confirmBooking = () => {
    addMsg({ from: "clinic", text: "ご予約を承りました。ご来院をお待ちしております。", time: "今", type: "confirmed" });
    updateReq(selectedId, { stage: "confirmed" });
  };

  const addAltSlot = () => {
    if (!altDate || !altTime) return;
    setAltDraft(prev => [...prev, { id: String(Date.now()), date: altDate, time: altTime }]);
    setAltDate(""); setAltTime(""); setAddingAlt(false);
  };

  const newCount = requests.filter(r => r.stage === "new").length;
  const replyCount = requests.filter(r => r.stage === "patient_replied").length;

  return (
    <div data-testid="schedule-tab" className="flex gap-4 h-[calc(100vh-160px)] min-h-[500px]">

      {/* ── 左列: リクエスト一覧 ── */}
      <div className="w-56 shrink-0 flex flex-col border border-border rounded-xl overflow-hidden bg-card/40">
        <div className="px-3 py-2.5 border-b border-border bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[11px] text-foreground font-bold tracking-wider">予約リクエスト</span>
            </div>
            <div className="flex gap-1">
              {newCount > 0 && (
                <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
              )}
              {replyCount > 0 && (
                <span className="bg-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{replyCount}</span>
              )}
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">{clinicName}</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/50">
            {requests.map(req => (
              <button
                key={req.id}
                onClick={() => { setSelectedId(req.id); setAltDraft([]); setMsgText(""); setAddingAlt(false); }}
                className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                  selectedId === req.id
                    ? "bg-primary/10 border-l-primary"
                    : "hover:bg-muted/30 border-l-transparent"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${BOOKING_STAGE_DOT[req.stage]}`} />
                  <span className="font-medium text-[12px] text-foreground truncate">{req.patientName}</span>
                </div>
                <p className="text-[10px] text-muted-foreground ml-3">{BOOKING_STAGE_LABEL[req.stage]}</p>
                <p className="text-[10px] text-muted-foreground/60 ml-3 mt-0.5">
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />{req.requestedDate} {req.requestedTime}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── 右列: 会話 + アクション ── */}
      <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden bg-card/40 min-w-0">

        {/* 患者ヘッダー */}
        <div className="px-4 py-2.5 border-b border-border bg-card/60 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">{selected.patientName[0]}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[13px] text-foreground">{selected.patientName}</div>
            <div className="text-[10px] text-muted-foreground">{selected.treatmentType}</div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${BOOKING_STAGE_COLOR[selected.stage]}`}
          >
            {BOOKING_STAGE_LABEL[selected.stage]}
          </Badge>
        </div>

        {/* 会話エリア */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">

            {/* 元リクエストバブル */}
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <p className="text-[9px] text-muted-foreground mb-1 ml-1">{selected.patientName} ・ {selected.receivedAt}</p>
                <div className="bg-muted/40 border border-border rounded-2xl rounded-tl-none px-3 py-2.5">
                  <p className="text-[10px] text-primary font-medium mb-1.5">📅 予約リクエスト</p>
                  <div className="flex gap-4 text-[12px] mb-1">
                    <div>
                      <span className="text-[9px] text-muted-foreground block">希望日時</span>
                      <span className="font-medium text-foreground">{selected.requestedDate} {selected.requestedTime}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block">種別</span>
                      <span className="text-primary">{selected.treatmentType}</span>
                    </div>
                  </div>
                  {selected.note && (
                    <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-1.5 mt-1">「{selected.note}」</p>
                  )}
                </div>
              </div>
            </div>

            {/* メッセージ履歴 */}
            {selected.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "clinic" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${msg.from === "clinic" ? "items-end" : "items-start"} flex flex-col`}>
                  <p className={`text-[9px] text-muted-foreground mb-1 ${msg.from === "clinic" ? "text-right mr-1" : "ml-1"}`}>
                    {msg.from === "clinic" ? clinicName : selected.patientName} ・ {msg.time}
                  </p>
                  <div className={`rounded-2xl px-3 py-2.5 text-[12px] ${
                    msg.from === "clinic"
                      ? "bg-primary/15 border border-primary/30 rounded-tr-none"
                      : "bg-muted/40 border border-border rounded-tl-none"
                  }`}>
                    <p className="text-foreground mb-1.5">{msg.text}</p>

                    {/* 代替候補 */}
                    {msg.type === "alt_proposal" && msg.altSlots && (
                      <div className="space-y-1 mt-1">
                        {msg.altSlots.map(slot => {
                          const chosen = selected.messages.some(m => m.type === "alt_choice" && m.chosenSlotId === slot.id);
                          return (
                            <div key={slot.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                              chosen
                                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                : "bg-background/40 border-border text-muted-foreground"
                            }`}>
                              <Clock className="w-3 h-3 opacity-70" />
                              {slot.date} {slot.time}
                              {chosen && <CheckCircle2 className="w-3 h-3 text-violet-400 ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 患者選択 */}
                    {msg.type === "alt_choice" && (
                      <div className="mt-1 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[10px] text-violet-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />上記の候補を選択しました
                      </div>
                    )}

                    {/* 確定 */}
                    {msg.type === "confirmed" && (
                      <div className="mt-1 flex items-center gap-1.5 text-primary text-[10px]">
                        <CalendarCheck className="w-3.5 h-3.5" /> 予約確定済み
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* ── アクションゾーン ── */}

        {/* 新着: 承認 / 対応不可 / 代替提案 */}
        {selected.stage === "new" && (
          <div className="border-t border-border p-3 space-y-2.5 shrink-0 bg-card/60">
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5 h-8 text-[12px]" onClick={confirmBooking}>
                <CheckCircle2 className="w-3.5 h-3.5" />そのまま承認
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-[12px] text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => updateReq(selectedId, { stage: "closed" })}>
                <XCircle className="w-3.5 h-3.5" />対応不可
              </Button>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 border border-border space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> 代替日時を提案する
              </p>
              {/* プリセット文言 */}
              <div className="relative">
                <button
                  onClick={() => setShowPresets(v => !v)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md bg-background border border-border text-[11px] text-muted-foreground text-left"
                >
                  <span className="truncate">{msgText || "メッセージを選択..."}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 ml-1" />
                </button>
                {showPresets && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-card border border-border rounded-lg overflow-hidden z-20 shadow-xl">
                    {PRESET_BOOKING_MESSAGES.map((p, i) => (
                      <button key={i} onClick={() => { setMsgText(p); setShowPresets(false); }}
                        className="w-full px-3 py-2 text-left text-[11px] text-foreground hover:bg-muted/50 border-b border-border/50 last:border-0">
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 候補スロット */}
              <div className="space-y-1">
                {altDraft.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border border-border text-[11px]">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-foreground">{s.date} {s.time}</span>
                    <button onClick={() => setAltDraft(prev => prev.filter(x => x.id !== s.id))}
                      className="ml-auto text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {addingAlt ? (
                <div className="flex gap-1">
                  <Input value={altDate} onChange={e => setAltDate(e.target.value)}
                    placeholder="5/15（金）" className="h-7 text-[11px] flex-1" />
                  <Input value={altTime} onChange={e => setAltTime(e.target.value)}
                    placeholder="10:00" className="h-7 text-[11px] w-16" />
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={addAltSlot}>追加</Button>
                </div>
              ) : (
                <button onClick={() => setAddingAlt(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">
                  <Plus className="w-3 h-3" /> 候補日時を追加
                </button>
              )}
              <Button size="sm" className="w-full gap-1.5 h-8 text-[12px] bg-blue-600 hover:bg-blue-500"
                disabled={altDraft.length === 0} onClick={sendAltProposal}>
                <Send className="w-3.5 h-3.5" /> 患者アプリへ送信
              </Button>
            </div>
          </div>
        )}

        {/* 代替提案送信済 */}
        {selected.stage === "alt_sent" && (
          <div className="border-t border-border p-3 shrink-0 bg-card/60">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[12px] text-blue-400">
              <Bell className="w-3.5 h-3.5 shrink-0" />
              代替候補を送信しました。患者の返答をお待ちください。
            </div>
          </div>
        )}

        {/* 患者返答あり */}
        {selected.stage === "patient_replied" && (
          <div className="border-t border-border p-3 space-y-2 shrink-0 bg-card/60">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[12px] text-violet-300">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              患者が候補日時を選択しました。予約を確定しますか？
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5 h-8 text-[12px]" onClick={confirmBooking}>
                <CalendarCheck className="w-3.5 h-3.5" /> 予約確定
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-[12px]"
                onClick={() => updateReq(selectedId, { stage: "alt_sent" })}>
                <RefreshCw className="w-3.5 h-3.5" /> 再提案
              </Button>
            </div>
          </div>
        )}

        {/* 予約確定済み */}
        {selected.stage === "confirmed" && (
          <div className="border-t border-border p-3 shrink-0 bg-card/60">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-[12px] text-primary">
              <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
              予約確定済み ─ 外部予約システムに登録してください
            </div>
          </div>
        )}

        {/* 対応済み */}
        {selected.stage === "closed" && (
          <div className="border-t border-border p-3 shrink-0 bg-card/60">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border text-[12px] text-muted-foreground">
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              対応済みとしてクローズしました
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ECSalesTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const salesData = {
    today: {
      orders: 3, revenue: 12740, avgPrice: 4247, topProduct: "3D骨盤サポートベルト",
      items: [
        { time: "09:15", patient: "田中太郎", product: "リカバリーMag", qty: 1, price: 3280, via: "AI推薦" },
        { time: "11:42", patient: "鈴木花子", product: "3D骨盤サポートベルト", qty: 1, price: 4980, via: "先生推薦" },
        { time: "14:30", patient: "佐藤健一", product: "電解質ウォーター", qty: 2, price: 4480, via: "リピート" },
      ],
    },
    week: {
      orders: 18, revenue: 68400, avgPrice: 3800, topProduct: "リカバリーMag",
      items: [
        { time: "3/10", patient: "田中太郎 他2名", product: "リカバリーMag", qty: 4, price: 13120, via: "AI推薦" },
        { time: "3/9", patient: "山田美咲 他1名", product: "3D骨盤サポートベルト", qty: 3, price: 14940, via: "先生推薦" },
        { time: "3/8", patient: "佐藤健一 他3名", product: "電解質ウォーター", qty: 6, price: 14880, via: "リピート" },
        { time: "3/7", patient: "高橋雄大 他1名", product: "腰椎クッション", qty: 2, price: 11960, via: "AI推薦" },
        { time: "3/6", patient: "渡辺麻衣 他2名", product: "リカバリーMag", qty: 3, price: 9840, via: "先生推薦" },
      ],
    },
    month: {
      orders: 67, revenue: 254600, avgPrice: 3800, topProduct: "リカバリーMag",
      items: [
        { time: "第2週", patient: "18件", product: "リカバリーMag", qty: 22, price: 72160, via: "AI推薦" },
        { time: "第2週", patient: "12件", product: "3D骨盤サポートベルト", qty: 15, price: 74700, via: "先生推薦" },
        { time: "第1週", patient: "15件", product: "電解質ウォーター", qty: 18, price: 44640, via: "リピート" },
        { time: "第1週", patient: "8件", product: "腰椎クッション", qty: 12, price: 71760, via: "AI推薦" },
      ],
    },
  };

  const current = salesData[period];

  const channelBreakdown = [
    { label: "AI推薦", pct: 45, color: "#0073e6", amount: Math.round(current.revenue * 0.45) },
    { label: "先生推薦", pct: 35, color: "#00c896", amount: Math.round(current.revenue * 0.35) },
    { label: "リピート", pct: 20, color: "#d4a030", amount: Math.round(current.revenue * 0.20) },
  ];

  const productRanking = [
    { name: "リカバリーMag", qty: period === "today" ? 1 : period === "week" ? 7 : 28, revenue: period === "today" ? 3280 : period === "week" ? 22960 : 91840, trend: "up" as const },
    { name: "3D骨盤サポートベルト", qty: period === "today" ? 1 : period === "week" ? 5 : 18, revenue: period === "today" ? 4980 : period === "week" ? 24900 : 89640, trend: "up" as const },
    { name: "電解質ウォーター", qty: period === "today" ? 2 : period === "week" ? 8 : 24, revenue: period === "today" ? 4480 : period === "week" ? 19840 : 59520, trend: "flat" as const },
    { name: "腰椎クッション", qty: period === "today" ? 0 : period === "week" ? 3 : 12, revenue: period === "today" ? 0 : period === "week" ? 17940 : 71760, trend: "down" as const },
  ];

  return (
    <div className="space-y-4" data-testid="ec-sales-tab">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[3px] text-primary/60 mb-0.5">EC SALES DASHBOARD</p>
          <p className="text-lg font-bold text-foreground">通販売上管理</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {([["today", "今日"], ["week", "週間"], ["month", "月間"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`px-3 py-1.5 text-[11px] transition-colors ${
                period === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`ec-period-${id}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3" data-testid="ec-kpi-cards">
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">売上</p>
          <p className="font-mono text-lg text-primary font-bold" data-testid="text-ec-revenue">
            ¥{current.revenue.toLocaleString()}
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">注文数</p>
          <p className="font-mono text-lg text-foreground font-bold" data-testid="text-ec-orders">
            {current.orders}件
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-[9px] text-muted-foreground mb-1">平均単価</p>
          <p className="font-mono text-lg text-foreground font-bold">
            ¥{current.avgPrice.toLocaleString()}
          </p>
        </Card>
        <Card className="p-3 border-border" style={{ background: "rgba(0,200,150,.06)", borderColor: "rgba(0,200,150,.2)" }}>
          <p className="text-[9px] text-emerald-400 mb-1">購入転換率</p>
          <p className="font-mono text-lg text-emerald-400 font-bold">
            {(REV_CONV_RATE * 100)}%
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> 商品別ランキング
          </p>
          <Card className="border-border" style={{ background: "rgba(255,255,255,.02)" }}>
            {productRanking.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < productRanking.length - 1 ? "border-b border-border" : ""}`}
                data-testid={`ec-product-rank-${i}`}
              >
                <span className={`font-mono text-[13px] font-bold w-5 ${i === 0 ? "text-amber-400" : i === 1 ? "text-foreground/60" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.qty}個販売</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12px] text-foreground font-bold">¥{p.revenue.toLocaleString()}</p>
                  {p.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400 ml-auto" />}
                  {p.trend === "down" && <TrendingDown className="w-3 h-3 text-red-400 ml-auto" />}
                  {p.trend === "flat" && <Minus className="w-3 h-3 text-muted-foreground ml-auto" />}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> 経路別内訳
          </p>
          <Card className="p-3 border-border space-y-3" style={{ background: "rgba(255,255,255,.02)" }}>
            {channelBreakdown.map(ch => (
              <div key={ch.label} data-testid={`ec-channel-${ch.label}`}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px]" style={{ color: ch.color }}>{ch.label}</span>
                  <span className="font-mono text-[11px] text-foreground/70">{ch.pct}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${ch.pct}%`, background: ch.color }}
                  />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  ¥{ch.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground tracking-[2px] mb-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {period === "today" ? "本日の注文" : period === "week" ? "今週の注文" : "今月の注文"}
        </p>
        <Card className="border-border" style={{ background: "rgba(255,255,255,.02)" }}>
          <div className="divide-y divide-border">
            {current.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5" data-testid={`ec-order-${i}`}>
                <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">{item.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate">{item.product} x{item.qty}</p>
                  <p className="text-[10px] text-muted-foreground">{item.patient}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] shrink-0 ${
                    item.via === "AI推薦" ? "border-blue-500/30 text-blue-400" :
                    item.via === "先生推薦" ? "border-emerald-500/30 text-emerald-400" :
                    "border-amber-500/30 text-amber-400"
                  }`}
                >
                  {item.via}
                </Badge>
                <span className="font-mono text-[12px] text-foreground font-bold w-20 text-right shrink-0">
                  ¥{item.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center pt-1">
        ※ デモ用のサンプルデータです
      </p>
    </div>
  );
}

function CouponAdminTab({
  selectedPatientId,
  selectedPatient,
}: {
  selectedPatientId: string | null;
  selectedPatient: AdminPatient | null;
}) {
  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons/admin", selectedPatientId],
    queryFn: async () => {
      const r = await fetch(`/api/coupons?patient_id=${selectedPatientId}`);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedPatientId,
    staleTime: 15000,
  });

  if (!selectedPatientId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="coupon-admin-no-patient">
        <Ticket className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-[13px]">患者を選択してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" data-testid="section-coupon-admin">
      <div className="flex items-center gap-2 mb-2">
        <Ticket className="w-4 h-4 text-primary" />
        <h3 className="text-[13px] font-semibold text-foreground">クーポン確認</h3>
        {selectedPatient && (
          <span className="text-[12px] text-muted-foreground ml-1">— {selectedPatient.name_kana}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-admin-coupons">
          <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-[13px]">クーポンがありません</p>
          <p className="text-[11px] mt-1 opacity-60">患者がPWAをインストールすると自動発行されます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => {
            const now = new Date();
            const expired = new Date(c.expires_at) < now;
            const isActive = c.status === "active" && !expired;
            const displayStatus = c.status === "used" ? "使用済み" : expired ? "期限切れ" : "使用可能";
            const expiresDate = new Date(c.expires_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
            return (
              <Card
                key={c.id}
                className={`p-4 border ${isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/10 opacity-60"}`}
                data-testid={`admin-card-coupon-${c.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">{c.description}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? "bg-emerald-500/20 text-emerald-400" :
                    c.status === "used" ? "bg-muted text-muted-foreground" :
                    "bg-muted text-muted-foreground"
                  }`} data-testid={`admin-status-coupon-${c.id}`}>
                    {displayStatus}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-mono text-[22px] font-bold text-foreground tracking-widest" data-testid={`admin-code-coupon-${c.id}`}>
                      {c.code}
                    </p>
                    <p className="text-[12px] font-bold text-emerald-400 mt-0.5">
                      ¥{c.discount_amount.toLocaleString()}OFF
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground pb-0.5">有効期限: {expiresDate}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
