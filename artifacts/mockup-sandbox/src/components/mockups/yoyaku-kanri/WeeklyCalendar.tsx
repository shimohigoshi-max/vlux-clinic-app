import { useState } from "react";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  User,
  Bell,
  MoreHorizontal,
  Phone,
} from "lucide-react";

type RequestStatus = "pending" | "confirmed" | "declined" | "alternative";

interface BookingRequest {
  id: string;
  patientName: string;
  kana: string;
  requestedDate: string;
  requestedTime: string;
  type: string;
  note: string;
  status: RequestStatus;
  phone: string;
}

const MOCK_REQUESTS: BookingRequest[] = [
  {
    id: "1",
    patientName: "田中 花子",
    kana: "タナカ ハナコ",
    requestedDate: "2026-05-11",
    requestedTime: "10:00",
    type: "定期施術",
    note: "先週から右肩が痛い",
    status: "pending",
    phone: "090-1234-5678",
  },
  {
    id: "2",
    patientName: "山田 太郎",
    kana: "ヤマダ タロウ",
    requestedDate: "2026-05-11",
    requestedTime: "14:00",
    type: "初診",
    note: "腰痛で歩くのが辛い",
    status: "pending",
    phone: "080-9876-5432",
  },
  {
    id: "3",
    patientName: "鈴木 美咲",
    kana: "スズキ ミサキ",
    requestedDate: "2026-05-12",
    requestedTime: "11:00",
    type: "再診",
    note: "",
    status: "confirmed",
    phone: "070-1111-2222",
  },
  {
    id: "4",
    patientName: "佐藤 健一",
    kana: "サトウ ケンイチ",
    requestedDate: "2026-05-13",
    requestedTime: "09:00",
    type: "定期施術",
    note: "膝のリハビリ継続",
    status: "declined",
    phone: "090-3333-4444",
  },
];

const WEEK_DAYS = ["月", "火", "水", "木", "金", "土"];
const DATES = ["5/11", "5/12", "5/13", "5/14", "5/15", "5/16"];
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const CALENDAR_EVENTS: Record<string, { name: string; type: string; color: string }[]> = {
  "09:00-月": [{ name: "佐藤 健一", type: "定期", color: "bg-red-900/60 border-red-500" }],
  "10:00-月": [{ name: "田中 花子", type: "定期 ※未承認", color: "bg-amber-900/60 border-amber-400 border-dashed" }],
  "11:00-火": [{ name: "鈴木 美咲", type: "再診", color: "bg-teal-900/60 border-teal-500" }],
  "14:00-月": [{ name: "山田 太郎", type: "初診 ※未承認", color: "bg-amber-900/60 border-amber-400 border-dashed" }],
  "10:00-水": [{ name: "中村 恵子", type: "定期", color: "bg-teal-900/60 border-teal-500" }],
  "15:00-木": [{ name: "伊藤 正男", type: "初診", color: "bg-blue-900/60 border-blue-500" }],
  "13:00-金": [{ name: "高橋 由美", type: "再診", color: "bg-teal-900/60 border-teal-500" }],
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const config = {
    pending: { label: "未承認", cls: "bg-amber-500/20 text-amber-300 border border-amber-500/40" },
    confirmed: { label: "承認済", cls: "bg-teal-500/20 text-teal-300 border border-teal-500/40" },
    declined: { label: "却下", cls: "bg-red-500/20 text-red-300 border border-red-500/40" },
    alternative: { label: "代替提案", cls: "bg-blue-500/20 text-blue-300 border border-blue-500/40" },
  };
  const { label, cls } = config[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export function WeeklyCalendar() {
  const [selected, setSelected] = useState<BookingRequest | null>(MOCK_REQUESTS[0]);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  const updateStatus = (id: string, status: RequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
  };

  const filtered = activeTab === "pending" ? requests.filter((r) => r.status === "pending") : requests;
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex h-screen bg-[#0a0f1a] text-white font-sans overflow-hidden">
      {/* Left: Calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0d1525]">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-teal-400" />
            <span className="font-semibold text-base tracking-wide">予約カレンダー</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-sm font-medium text-gray-300 px-2">2026年5月 第2週</span>
            <button className="p-1.5 rounded hover:bg-white/10 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#0d1525]">
                <th className="w-14 py-2 text-gray-500 font-medium text-center border-b border-r border-white/10"></th>
                {WEEK_DAYS.map((day, i) => (
                  <th
                    key={day}
                    className={`py-2 text-center border-b border-r border-white/10 font-medium ${
                      i === 5 ? "text-teal-300" : "text-gray-300"
                    }`}
                  >
                    <div className="text-xs text-gray-500">{DATES[i]}</div>
                    <div>{day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((time) => (
                <tr key={time} className="h-[52px]">
                  <td className="text-gray-500 text-center border-r border-b border-white/10 px-1 align-top pt-1">
                    {time}
                  </td>
                  {WEEK_DAYS.map((day) => {
                    const key = `${time}-${day}`;
                    const events = CALENDAR_EVENTS[key];
                    return (
                      <td
                        key={day}
                        className="border-r border-b border-white/10 p-0.5 align-top relative"
                      >
                        {events?.map((ev, idx) => (
                          <div
                            key={idx}
                            className={`rounded px-1.5 py-1 border text-xs cursor-pointer mb-0.5 ${ev.color}`}
                          >
                            <div className="font-medium truncate">{ev.name}</div>
                            <div className="text-gray-400 text-[10px]">{ev.type}</div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Request Panel */}
      <div className="w-72 flex flex-col border-l border-white/10 bg-[#0d1525]">
        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              予約リクエスト
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-1">
            {(["pending", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "pending" ? "未承認のみ" : "すべて"}
              </button>
            ))}
          </div>
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/10">
          {filtered.map((req) => (
            <div
              key={req.id}
              onClick={() => setSelected(req)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                selected?.id === req.id ? "bg-teal-900/30" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-medium text-sm">{req.patientName}</div>
                  <div className="text-gray-500 text-[10px]">{req.kana}</div>
                </div>
                <StatusBadge status={req.status} />
              </div>
              <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                <Clock className="w-3 h-3" />
                <span>{req.requestedDate} {req.requestedTime}</span>
              </div>
              <div className="text-teal-400 text-xs mt-0.5">{req.type}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-8">未承認の予約はありません</div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="border-t border-white/10 p-4 bg-[#0a0f1a]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-900 flex items-center justify-center">
                  <User className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{selected.patientName}</div>
                  <div className="text-gray-500 text-[10px] flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" />
                    {selected.phone}
                  </div>
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="bg-white/5 rounded-lg p-3 mb-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">希望日時</span>
                <span className="text-white">{selected.requestedDate} {selected.requestedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">種別</span>
                <span className="text-teal-300">{selected.type}</span>
              </div>
              {selected.note && (
                <div className="pt-1 border-t border-white/10">
                  <span className="text-gray-500 block mb-1">患者メモ</span>
                  <span className="text-gray-300">{selected.note}</span>
                </div>
              )}
            </div>

            {selected.status === "pending" && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateStatus(selected.id, "confirmed")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 transition-colors text-xs font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  承認
                </button>
                <button
                  onClick={() => updateStatus(selected.id, "declined")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-900/60 hover:bg-red-800/60 border border-red-700/50 transition-colors text-xs font-medium text-red-300"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  却下
                </button>
                <button
                  onClick={() => updateStatus(selected.id, "alternative")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-900/60 hover:bg-blue-800/60 border border-blue-700/50 transition-colors text-xs font-medium text-blue-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  代替提案
                </button>
                <button className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs font-medium text-gray-300">
                  <MessageSquare className="w-3.5 h-3.5" />
                  メッセージ
                </button>
              </div>
            )}
            {selected.status !== "pending" && (
              <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs font-medium text-gray-300">
                <MoreHorizontal className="w-3.5 h-3.5" />
                操作
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
