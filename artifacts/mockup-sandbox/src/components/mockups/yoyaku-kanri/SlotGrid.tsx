import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  User,
  ChevronLeft,
  ChevronRight,
  Grid,
  Filter,
  Send,
  AlertCircle,
} from "lucide-react";

type SlotStatus = "open" | "booked" | "pending" | "blocked";
type RequestStatus = "pending" | "confirmed" | "declined" | "alternative";

interface TimeSlot {
  time: string;
  status: SlotStatus;
  patientName?: string;
  requestId?: string;
}

interface BookingRequest {
  id: string;
  patientName: string;
  kana: string;
  requestedTime: string;
  type: string;
  note: string;
  status: RequestStatus;
  receivedAt: string;
}

const MOCK_SLOTS: TimeSlot[] = [
  { time: "09:00", status: "booked", patientName: "佐藤 健一" },
  { time: "09:30", status: "open" },
  { time: "10:00", status: "pending", patientName: "田中 花子", requestId: "1" },
  { time: "10:30", status: "open" },
  { time: "11:00", status: "booked", patientName: "鈴木 美咲" },
  { time: "11:30", status: "blocked" },
  { time: "12:00", status: "blocked" },
  { time: "12:30", status: "blocked" },
  { time: "13:00", status: "open" },
  { time: "13:30", status: "open" },
  { time: "14:00", status: "pending", patientName: "山田 太郎", requestId: "2" },
  { time: "14:30", status: "open" },
  { time: "15:00", status: "booked", patientName: "中村 恵子" },
  { time: "15:30", status: "open" },
  { time: "16:00", status: "open" },
  { time: "16:30", status: "open" },
  { time: "17:00", status: "open" },
  { time: "17:30", status: "open" },
];

const MOCK_REQUESTS: BookingRequest[] = [
  {
    id: "1",
    patientName: "田中 花子",
    kana: "タナカ ハナコ",
    requestedTime: "10:00",
    type: "定期施術",
    note: "先週から右肩が痛い",
    status: "pending",
    receivedAt: "14分前",
  },
  {
    id: "2",
    patientName: "山田 太郎",
    kana: "ヤマダ タロウ",
    requestedTime: "14:00",
    type: "初診",
    note: "腰痛で歩くのが辛い",
    status: "pending",
    receivedAt: "1時間前",
  },
  {
    id: "3",
    patientName: "高橋 由美",
    kana: "タカハシ ユミ",
    requestedTime: "16:00",
    type: "再診",
    note: "",
    status: "confirmed",
    receivedAt: "昨日",
  },
];

const SLOT_STYLES: Record<SlotStatus, string> = {
  open: "bg-white/5 border-white/10 hover:bg-teal-900/30 hover:border-teal-500/40 cursor-pointer",
  booked: "bg-teal-900/40 border-teal-600/50",
  pending: "bg-amber-900/40 border-amber-500/60 border-dashed animate-pulse",
  blocked: "bg-white/3 border-white/5 opacity-40",
};

const SLOT_TEXT: Record<SlotStatus, string> = {
  open: "text-gray-600",
  booked: "text-teal-200",
  pending: "text-amber-200",
  blocked: "text-gray-700",
};

export function SlotGrid() {
  const [slots, setSlots] = useState(MOCK_SLOTS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [selectedReqId, setSelectedReqId] = useState<string | null>("1");
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState("");

  const selectedReq = requests.find((r) => r.id === selectedReqId) ?? null;
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const updateRequest = (id: string, status: RequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setSlots((prev) =>
      prev.map((s) =>
        s.requestId === id
          ? { ...s, status: status === "confirmed" ? "booked" : status === "declined" ? "open" : s.status }
          : s
      )
    );
  };

  const reqStatusConfig: Record<RequestStatus, { label: string; cls: string }> = {
    pending: { label: "未承認", cls: "bg-amber-500/20 text-amber-300 border border-amber-500/40" },
    confirmed: { label: "承認済", cls: "bg-teal-500/20 text-teal-300 border border-teal-500/40" },
    declined: { label: "却下", cls: "bg-red-500/20 text-red-300 border border-red-500/40" },
    alternative: { label: "代替提案", cls: "bg-blue-500/20 text-blue-300 border border-blue-500/40" },
  };

  return (
    <div className="flex h-screen bg-[#0a0f1a] text-white font-sans overflow-hidden">

      {/* Left: Slot Grid */}
      <div className="w-64 flex flex-col border-r border-white/10 bg-[#0d1525]">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-teal-400" />
              <span className="font-semibold text-sm">空き時間枠</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded hover:bg-white/10">
                <ChevronLeft className="w-3 h-3 text-gray-400" />
              </button>
              <span className="text-xs text-gray-400">5/11（月）</span>
              <button className="p-1 rounded hover:bg-white/10">
                <ChevronRight className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-teal-900/70 border border-teal-600 inline-block" /> 予約済
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amber-900/70 border border-amber-500 border-dashed inline-block" /> 未承認
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-white/10 border border-white/15 inline-block" /> 空き
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {slots.map((slot) => (
            <div
              key={slot.time}
              onClick={() => {
                if (slot.requestId) setSelectedReqId(slot.requestId);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${SLOT_STYLES[slot.status]}`}
            >
              <Clock className={`w-3 h-3 flex-shrink-0 ${SLOT_TEXT[slot.status]}`} />
              <span className={`font-mono w-10 flex-shrink-0 ${SLOT_TEXT[slot.status]}`}>{slot.time}</span>
              {slot.status === "open" ? (
                <span className="text-gray-600">空き</span>
              ) : slot.status === "blocked" ? (
                <span className="text-gray-700">休憩</span>
              ) : slot.status === "pending" ? (
                <span className="text-amber-300 font-medium truncate">{slot.patientName}</span>
              ) : (
                <span className="text-teal-200 truncate">{slot.patientName}</span>
              )}
              {slot.status === "pending" && (
                <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0 ml-auto" />
              )}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="border-t border-white/10 p-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-bold text-teal-400">{slots.filter((s) => s.status === "booked").length}</div>
            <div className="text-gray-600">予約済</div>
          </div>
          <div>
            <div className="font-bold text-amber-400">{slots.filter((s) => s.status === "pending").length}</div>
            <div className="text-gray-600">未承認</div>
          </div>
          <div>
            <div className="font-bold text-gray-300">{slots.filter((s) => s.status === "open").length}</div>
            <div className="text-gray-600">空き</div>
          </div>
        </div>
      </div>

      {/* Center: Request Inbox */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-white/10 bg-[#0d1525] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">予約リクエスト受信ボックス</span>
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}件
              </span>
            )}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs text-gray-300">
            <Filter className="w-3 h-3" />
            フィルター
          </button>
        </div>

        {/* Request Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {requests.map((req) => {
            const { label, cls } = reqStatusConfig[req.status];
            return (
              <div
                key={req.id}
                onClick={() => setSelectedReqId(req.id)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  selectedReqId === req.id
                    ? "border-teal-500/60 bg-teal-900/20"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-900 to-blue-900 flex items-center justify-center border border-white/10">
                      <User className="w-4 h-4 text-teal-300" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{req.patientName}</div>
                      <div className="text-gray-500 text-[10px]">{req.kana}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                    <span className="text-gray-600 text-xs">{req.receivedAt}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {req.requestedTime}
                  </span>
                  <span className="text-teal-400">{req.type}</span>
                </div>

                {req.note && (
                  <div className="bg-white/5 rounded-lg px-3 py-2 text-xs text-gray-300 italic border border-white/10">
                    「{req.note}」
                  </div>
                )}

                {req.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateRequest(req.id, "confirmed"); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 transition-colors text-xs font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      承認
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateRequest(req.id, "declined"); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/60 border border-red-700/50 transition-colors text-xs text-red-300"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      却下
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateRequest(req.id, "alternative"); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800/60 border border-blue-700/50 transition-colors text-xs text-blue-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      代替提案
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedReqId(req.id); setShowMessage(true); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs text-gray-300"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Detail + Message Panel */}
      {selectedReq && (
        <div className="w-64 flex flex-col border-l border-white/10 bg-[#0d1525]">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-900 to-blue-900 flex items-center justify-center border border-white/10">
                <User className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <div className="font-semibold text-sm">{selectedReq.patientName}</div>
                <div className="text-gray-500 text-[10px]">{selectedReq.kana}</div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">希望時間</span>
                <span className="text-white font-mono">{selectedReq.requestedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">施術種別</span>
                <span className="text-teal-300">{selectedReq.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">受信</span>
                <span className="text-gray-400">{selectedReq.receivedAt}</span>
              </div>
            </div>
          </div>

          {/* Available Slots to Suggest */}
          <div className="px-4 py-3 border-b border-white/10 flex-1">
            <div className="text-xs text-gray-500 mb-2">代替可能な空き枠</div>
            <div className="space-y-1.5">
              {slots
                .filter((s) => s.status === "open")
                .slice(0, 5)
                .map((s) => (
                  <button
                    key={s.time}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-teal-500/50 hover:bg-teal-900/20 transition-all text-xs group"
                  >
                    <Clock className="w-3 h-3 text-gray-500 group-hover:text-teal-400" />
                    <span className="font-mono text-gray-300 group-hover:text-white">{s.time}</span>
                    <span className="ml-auto text-[10px] text-gray-600 group-hover:text-teal-400">提案 →</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Message */}
          <div className="p-3">
            {showMessage ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-500">患者へメッセージ送信</div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="例: ご希望の時間はすでに埋まっておりますが、10:30または13:00はいかがでしょうか？"
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-xs text-gray-200 placeholder:text-gray-600 resize-none h-20 focus:outline-none focus:border-teal-500/60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowMessage(false); setMessageText(""); }}
                    className="flex-1 py-1.5 rounded-lg bg-white/10 text-xs text-gray-400 hover:bg-white/15"
                  >
                    キャンセル
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-medium">
                    <Send className="w-3 h-3" />
                    送信
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowMessage(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs text-gray-300"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                メッセージを送る
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
