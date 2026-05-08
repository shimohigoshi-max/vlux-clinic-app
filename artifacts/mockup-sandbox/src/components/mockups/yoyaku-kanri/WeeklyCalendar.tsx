import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronRight,
  User,
  Bell,
  Send,
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  CheckCheck,
  ArrowRight,
} from "lucide-react";

type Stage = "new" | "alt_sent" | "patient_replied" | "confirmed" | "closed";

interface AltSlot {
  date: string;
  time: string;
  selected?: boolean;
}

interface BookingRequest {
  id: string;
  patientName: string;
  kana: string;
  requestedDate: string;
  requestedTime: string;
  type: string;
  note: string;
  stage: Stage;
  altSlots?: AltSlot[];
  patientChoice?: AltSlot;
  receivedAt: string;
}

const INITIAL_REQUESTS: BookingRequest[] = [
  {
    id: "1",
    patientName: "田中 花子",
    kana: "タナカ ハナコ",
    requestedDate: "5/13（水）",
    requestedTime: "10:00",
    type: "定期施術",
    note: "先週から右肩が痛い。早めに来たい。",
    stage: "new",
    receivedAt: "14分前",
  },
  {
    id: "2",
    patientName: "山田 太郎",
    kana: "ヤマダ タロウ",
    requestedDate: "5/14（木）",
    requestedTime: "14:00",
    type: "初診",
    note: "腰痛で歩くのが辛い",
    stage: "alt_sent",
    altSlots: [
      { date: "5/15（金）", time: "10:00" },
      { date: "5/15（金）", time: "14:30" },
      { date: "5/16（土）", time: "11:00" },
    ],
    receivedAt: "1時間前",
  },
  {
    id: "3",
    patientName: "鈴木 美咲",
    kana: "スズキ ミサキ",
    requestedDate: "5/11（月）",
    requestedTime: "11:00",
    type: "再診",
    note: "",
    stage: "patient_replied",
    altSlots: [
      { date: "5/15（金）", time: "10:00" },
      { date: "5/15（金）", time: "14:30" },
    ],
    patientChoice: { date: "5/15（金）", time: "14:30" },
    receivedAt: "昨日",
  },
  {
    id: "4",
    patientName: "佐藤 健一",
    kana: "サトウ ケンイチ",
    requestedDate: "5/10（日）",
    requestedTime: "09:00",
    type: "定期施術",
    note: "膝のリハビリ継続",
    stage: "confirmed",
    receivedAt: "2日前",
  },
];

const STAGE_CONFIG: Record<Stage, { label: string; color: string; icon: React.ReactNode }> = {
  new: {
    label: "新着",
    color: "text-amber-300 bg-amber-500/15 border-amber-500/40",
    icon: <Bell className="w-3 h-3" />,
  },
  alt_sent: {
    label: "代替提案送信済",
    color: "text-blue-300 bg-blue-500/15 border-blue-500/40",
    icon: <Send className="w-3 h-3" />,
  },
  patient_replied: {
    label: "患者が返答",
    color: "text-violet-300 bg-violet-500/15 border-violet-500/40",
    icon: <MessageSquare className="w-3 h-3" />,
  },
  confirmed: {
    label: "予約確定",
    color: "text-teal-300 bg-teal-500/15 border-teal-500/40",
    icon: <CalendarCheck className="w-3 h-3" />,
  },
  closed: {
    label: "対応済",
    color: "text-gray-500 bg-white/5 border-white/10",
    icon: <CheckCheck className="w-3 h-3" />,
  },
};

const STAGES: Stage[] = ["new", "alt_sent", "patient_replied", "confirmed"];

function StagePill({ stage }: { stage: Stage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function AltSlotBubble({ slot, chosen }: { slot: AltSlot; chosen?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all ${
        chosen
          ? "bg-violet-900/60 border-violet-400/60 text-violet-200 font-medium"
          : "bg-white/5 border-white/15 text-gray-300"
      }`}
    >
      <Clock className="w-3 h-3 opacity-60" />
      {slot.date} {slot.time}
      {chosen && <CheckCircle2 className="w-3 h-3 text-violet-300 ml-0.5" />}
    </span>
  );
}

export function WeeklyCalendar() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [selected, setSelected] = useState<BookingRequest>(INITIAL_REQUESTS[0]);
  const [altDraft, setAltDraft] = useState<AltSlot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [filterStage, setFilterStage] = useState<Stage | "all">("all");

  const sync = (id: string, patch: Partial<BookingRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelected((prev) => (prev.id === id ? { ...prev, ...patch } : prev));
  };

  const addAlt = () => {
    if (!newSlotDate || !newSlotTime) return;
    setAltDraft((prev) => [...prev, { date: newSlotDate, time: newSlotTime }]);
    setNewSlotDate("");
    setNewSlotTime("");
  };

  const sendAlts = () => {
    sync(selected.id, { stage: "alt_sent", altSlots: altDraft });
    setAltDraft([]);
  };

  const confirm = () => sync(selected.id, { stage: "confirmed" });
  const decline = () => sync(selected.id, { stage: "closed" });

  const filtered = filterStage === "all" ? requests : requests.filter((r) => r.stage === filterStage);
  const newCount = requests.filter((r) => r.stage === "new").length;
  const replyCount = requests.filter((r) => r.stage === "patient_replied").length;

  return (
    <div className="flex h-screen bg-[#0a0f1a] text-white font-sans overflow-hidden">

      {/* Left: Request List */}
      <div className="w-72 flex flex-col border-r border-white/10 bg-[#0d1525]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">予約リクエスト</span>
            <div className="flex gap-1.5">
              {newCount > 0 && (
                <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  新着 {newCount}
                </span>
              )}
              {replyCount > 0 && (
                <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  返答 {replyCount}
                </span>
              )}
            </div>
          </div>
          {/* Stage filter */}
          <div className="flex flex-wrap gap-1">
            {(["all", ...STAGES] as (Stage | "all")[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStage(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                  filterStage === s
                    ? "bg-teal-500/25 text-teal-300 border-teal-500/50"
                    : "text-gray-600 border-white/10 hover:text-gray-400"
                }`}
              >
                {s === "all" ? "すべて" : STAGE_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Request Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/10">
          {filtered.map((req) => (
            <div
              key={req.id}
              onClick={() => { setSelected(req); setAltDraft([]); }}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                selected.id === req.id ? "bg-teal-900/25" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-sm">{req.patientName}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs mb-1.5">
                <Clock className="w-3 h-3" />
                {req.requestedDate} {req.requestedTime}
                <span className="ml-auto text-gray-600 text-[10px]">{req.receivedAt}</span>
              </div>
              <StagePill stage={req.stage} />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail + Action */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Patient header */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#0d1525] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-900 to-blue-900 flex items-center justify-center border border-white/15">
              <User className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="font-semibold">{selected.patientName}</div>
              <div className="text-gray-500 text-xs">{selected.kana} ・ {selected.type}</div>
            </div>
          </div>
          <StagePill stage={selected.stage} />
        </div>

        {/* Flow timeline */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2 text-xs overflow-x-auto">
          {(["new", "alt_sent", "patient_replied", "confirmed"] as Stage[]).map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                selected.stage === s
                  ? STAGE_CONFIG[s].color + " font-medium"
                  : STAGES.indexOf(selected.stage) > STAGES.indexOf(s)
                  ? "text-gray-500 bg-white/5 border-white/10"
                  : "text-gray-700 border-transparent"
              }`}>
                {STAGE_CONFIG[s].icon}
                {STAGE_CONFIG[s].label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-gray-700 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Original request */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">患者リクエスト</div>
            <div className="flex gap-6 text-sm mb-2">
              <div>
                <span className="text-gray-500 text-xs">希望日時</span>
                <div className="font-medium text-white mt-0.5">{selected.requestedDate} {selected.requestedTime}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">種別</span>
                <div className="text-teal-300 mt-0.5">{selected.type}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">受信</span>
                <div className="text-gray-400 mt-0.5">{selected.receivedAt}</div>
              </div>
            </div>
            {selected.note && (
              <div className="text-sm text-gray-300 italic border-t border-white/10 pt-2 mt-2">
                「{selected.note}」
              </div>
            )}
          </div>

          {/* Alt slots sent */}
          {selected.altSlots && (
            <div className="bg-blue-950/40 rounded-xl p-4 border border-blue-700/30">
              <div className="text-xs text-blue-300 mb-2 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3 h-3" /> 代替候補を送信済
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.altSlots.map((s, i) => (
                  <AltSlotBubble
                    key={i}
                    slot={s}
                    chosen={
                      selected.patientChoice?.date === s.date &&
                      selected.patientChoice?.time === s.time
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Patient replied */}
          {selected.stage === "patient_replied" && selected.patientChoice && (
            <div className="bg-violet-950/40 rounded-xl p-4 border border-violet-600/40">
              <div className="text-xs text-violet-300 mb-2 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> 患者が候補を選択しました
              </div>
              <div className="flex items-center gap-3">
                <AltSlotBubble slot={selected.patientChoice} chosen />
                <span className="text-gray-400 text-xs">を希望しています</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={confirm}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 transition-colors text-sm font-medium"
                >
                  <CalendarCheck className="w-4 h-4" />
                  予約を確定する
                </button>
                <button
                  onClick={() => sync(selected.id, { stage: "alt_sent", patientChoice: undefined })}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-sm text-gray-300"
                >
                  再提案
                </button>
              </div>
            </div>
          )}

          {/* Confirmed */}
          {selected.stage === "confirmed" && (
            <div className="bg-teal-950/40 rounded-xl p-4 border border-teal-600/40 flex items-center gap-3">
              <CalendarCheck className="w-8 h-8 text-teal-400 flex-shrink-0" />
              <div>
                <div className="font-semibold text-teal-300">予約確定済み</div>
                <div className="text-gray-400 text-sm mt-0.5">外部予約システムに登録してください</div>
              </div>
            </div>
          )}
        </div>

        {/* Action zone for "new" stage */}
        {selected.stage === "new" && (
          <div className="border-t border-white/10 p-4 bg-[#0d1525] space-y-3">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">アクション</div>
            <div className="flex gap-2">
              <button
                onClick={confirm}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 transition-colors text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                そのまま承認
              </button>
              <button
                onClick={decline}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/50 hover:bg-red-800/50 border border-red-700/40 transition-colors text-sm text-red-300"
              >
                <XCircle className="w-4 h-4" />
                対応不可
              </button>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> 代替日時を提案する
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {altDraft.map((s, i) => (
                  <AltSlotBubble key={i} slot={s} />
                ))}
                {altDraft.length === 0 && (
                  <span className="text-gray-600 text-xs">候補を追加してください</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSlotDate}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                  placeholder="例: 5/15（金）"
                  className="flex-1 bg-black/30 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500/60"
                />
                <input
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                  placeholder="10:00"
                  className="w-20 bg-black/30 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500/60"
                />
                <button
                  onClick={addAlt}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-gray-300 transition-colors"
                >
                  追加
                </button>
              </div>
              {altDraft.length > 0 && (
                <button
                  onClick={sendAlts}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  <Send className="w-3.5 h-3.5" />
                  患者アプリへ送信
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
