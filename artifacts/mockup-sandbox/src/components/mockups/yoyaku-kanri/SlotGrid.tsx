import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  CalendarCheck,
  User,
  Bell,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  CheckCheck,
  RefreshCw,
} from "lucide-react";

type Stage = "new" | "alt_sent" | "patient_replied" | "confirmed" | "closed";

interface AltSlot {
  id: string;
  date: string;
  time: string;
}

interface Message {
  from: "clinic" | "patient";
  text: string;
  time: string;
  altSlots?: AltSlot[];
  chosenSlotId?: string;
  type?: "text" | "alt_proposal" | "alt_choice" | "confirmed";
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
  messages: Message[];
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
    messages: [],
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
    kana: "スズキ ミサキ",
    requestedDate: "5/11（月）",
    requestedTime: "11:00",
    type: "再診",
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
];

const STAGE_DOT: Record<Stage, string> = {
  new: "bg-amber-400",
  alt_sent: "bg-blue-400",
  patient_replied: "bg-violet-400 animate-pulse",
  confirmed: "bg-teal-400",
  closed: "bg-gray-600",
};

const STAGE_LABEL: Record<Stage, string> = {
  new: "新着",
  alt_sent: "代替提案送信済",
  patient_replied: "患者返答あり",
  confirmed: "予約確定",
  closed: "対応済",
};

const PRESET_MESSAGES = [
  "ご希望の日時は施術者の都合により対応が難しい状況です。以下の候補日はいかがでしょうか？",
  "ご連絡ありがとうございます。大変恐れ入りますが、ご希望の日は満員となっております。",
  "ご予約を承りました。ご来院をお待ちしております。",
];

export function SlotGrid() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [selectedId, setSelectedId] = useState("2");
  const [altDraft, setAltDraft] = useState<AltSlot[]>([]);
  const [msgText, setMsgText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [addingAlt, setAddingAlt] = useState(false);
  const [altDate, setAltDate] = useState("");
  const [altTime, setAltTime] = useState("");

  const selected = requests.find((r) => r.id === selectedId)!;

  const updateReq = (id: string, patch: Partial<BookingRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addMessage = (msg: Message) => {
    updateReq(selected.id, { messages: [...selected.messages, msg] });
  };

  const sendAltProposal = () => {
    if (altDraft.length === 0) return;
    addMessage({
      from: "clinic",
      text: msgText || PRESET_MESSAGES[0],
      time: "今",
      type: "alt_proposal",
      altSlots: altDraft,
    });
    updateReq(selected.id, { stage: "alt_sent" });
    setAltDraft([]);
    setMsgText("");
  };

  const confirmBooking = () => {
    addMessage({
      from: "clinic",
      text: "予約を確定しました。ご来院をお待ちしております。",
      time: "今",
      type: "confirmed",
    });
    updateReq(selected.id, { stage: "confirmed" });
  };

  const addAltSlot = () => {
    if (!altDate || !altTime) return;
    setAltDraft((prev) => [...prev, { id: String(Date.now()), date: altDate, time: altTime }]);
    setAltDate("");
    setAltTime("");
    setAddingAlt(false);
  };

  const removeAlt = (id: string) => setAltDraft((prev) => prev.filter((s) => s.id !== id));

  const newCount = requests.filter((r) => r.stage === "new").length;
  const replyCount = requests.filter((r) => r.stage === "patient_replied").length;

  return (
    <div className="flex h-screen bg-[#0a0f1a] text-white font-['Inter',sans-serif] overflow-hidden text-sm">

      {/* Sidebar: Request list */}
      <div className="w-64 flex flex-col border-r border-white/10 bg-[#0c1220]">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">予約リクエスト</span>
            <div className="flex gap-1">
              {newCount > 0 && (
                <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
              )}
              {replyCount > 0 && (
                <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{replyCount}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/10">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => { setSelectedId(req.id); setAltDraft([]); setMsgText(""); }}
              className={`px-4 py-3 cursor-pointer transition-all ${
                selectedId === req.id ? "bg-teal-900/25 border-l-2 border-teal-500" : "hover:bg-white/5 border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[req.stage]}`} />
                <span className="font-medium text-sm truncate">{req.patientName}</span>
              </div>
              <div className="text-gray-500 text-xs ml-4">{STAGE_LABEL[req.stage]}</div>
              <div className="text-gray-600 text-xs ml-4 mt-0.5">
                {req.requestedDate} {req.requestedTime}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Conversation + Action */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Patient header */}
        <div className="px-5 py-3 border-b border-white/10 bg-[#0c1220] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-900 to-blue-900 flex items-center justify-center border border-white/10 flex-shrink-0">
            <User className="w-4 h-4 text-teal-300" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-none">{selected.patientName}</div>
            <div className="text-gray-500 text-xs mt-0.5">{selected.kana} ・ {selected.type}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STAGE_DOT[selected.stage]}`} />
            <span className="text-xs text-gray-400">{STAGE_LABEL[selected.stage]}</span>
          </div>
        </div>

        {/* Conversation area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Original request bubble */}
          <div className="flex justify-start">
            <div className="max-w-sm">
              <div className="text-[10px] text-gray-600 mb-1 ml-1">患者 ・ {selected.receivedAt}</div>
              <div className="bg-white/8 border border-white/12 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="text-xs text-teal-400 font-medium mb-1.5">予約リクエスト</div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">希望日時</div>
                    <div className="font-medium mt-0.5">{selected.requestedDate} {selected.requestedTime}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">種別</div>
                    <div className="text-teal-300 mt-0.5">{selected.type}</div>
                  </div>
                </div>
                {selected.note && (
                  <div className="text-xs text-gray-400 italic mt-2 pt-2 border-t border-white/10">「{selected.note}」</div>
                )}
              </div>
            </div>
          </div>

          {/* Message history */}
          {selected.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "clinic" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-sm ${msg.from === "clinic" ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`text-[10px] text-gray-600 mb-1 ${msg.from === "clinic" ? "text-right mr-1" : "ml-1"}`}>
                  {msg.from === "clinic" ? "クリニック" : selected.patientName} ・ {msg.time}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    msg.from === "clinic"
                      ? "bg-teal-900/60 border border-teal-700/40 rounded-tr-none"
                      : "bg-white/8 border border-white/12 rounded-tl-none"
                  }`}
                >
                  <p className="text-gray-200 mb-2">{msg.text}</p>

                  {/* Alt proposal */}
                  {msg.type === "alt_proposal" && msg.altSlots && (
                    <div className="space-y-1.5 mt-1">
                      {msg.altSlots.map((slot) => {
                        const isChosen = selected.messages.some(
                          (m) => m.type === "alt_choice" && m.chosenSlotId === slot.id
                        );
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                              isChosen
                                ? "bg-violet-900/60 border-violet-500/50 text-violet-200"
                                : "bg-white/8 border-white/15 text-gray-300"
                            }`}
                          >
                            <Clock className="w-3 h-3 opacity-70" />
                            {slot.date} {slot.time}
                            {isChosen && <CheckCircle2 className="w-3.5 h-3.5 text-violet-300 ml-auto" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Patient chose */}
                  {msg.type === "alt_choice" && msg.chosenSlotId && (
                    <div className="mt-1 px-3 py-1.5 rounded-xl bg-violet-900/50 border border-violet-500/40 text-xs text-violet-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      上記の候補を選択しました
                    </div>
                  )}

                  {/* Confirmed */}
                  {msg.type === "confirmed" && (
                    <div className="mt-1 flex items-center gap-1.5 text-teal-300 text-xs">
                      <CalendarCheck className="w-3.5 h-3.5" /> 予約確定済み
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action panel */}
        {selected.stage === "patient_replied" && (
          <div className="border-t border-white/10 p-4 bg-[#0c1220]">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-950/50 border border-violet-600/30 mb-3">
              <MessageSquare className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="text-sm text-violet-200">患者が候補日時を選択しました。予約を確定しますか？</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmBooking}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 transition-colors font-medium"
              >
                <CalendarCheck className="w-4 h-4" />
                予約確定
              </button>
              <button
                onClick={() => updateReq(selected.id, { stage: "alt_sent" })}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-gray-300"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {selected.stage === "confirmed" && (
          <div className="border-t border-white/10 p-4 bg-[#0c1220]">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-950/60 border border-teal-600/30">
              <CheckCheck className="w-5 h-5 text-teal-400" />
              <div>
                <div className="font-semibold text-teal-300 text-sm">予約確定済み</div>
                <div className="text-gray-500 text-xs">外部予約システムに登録してください</div>
              </div>
            </div>
          </div>
        )}

        {selected.stage === "new" && (
          <div className="border-t border-white/10 p-4 bg-[#0c1220] space-y-3">
            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={confirmBooking}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 transition-colors text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                そのまま承認
              </button>
              <button
                onClick={() => updateReq(selected.id, { stage: "closed" })}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-900/50 hover:bg-red-800/50 border border-red-700/30 transition-colors text-sm text-red-300"
              >
                <XCircle className="w-4 h-4" />
                対応不可
              </button>
            </div>

            {/* Alt proposal builder */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> 代替日時を提案
              </div>
              {/* Preset message */}
              <div className="relative mb-2">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-400 text-left"
                >
                  <span className="truncate">{msgText || "メッセージを選択..."}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
                </button>
                {showPresets && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#1a2235] border border-white/20 rounded-xl overflow-hidden z-10 shadow-xl">
                    {PRESET_MESSAGES.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setMsgText(p); setShowPresets(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/10 border-b border-white/5 last:border-0"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Alt slots */}
              <div className="space-y-1 mb-2">
                {altDraft.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/8 border border-white/12 text-xs">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-300">{s.date} {s.time}</span>
                    <button onClick={() => removeAlt(s.id)} className="ml-auto text-gray-600 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {addingAlt ? (
                <div className="flex gap-1 mb-2">
                  <input
                    value={altDate}
                    onChange={(e) => setAltDate(e.target.value)}
                    placeholder="5/15（金）"
                    className="flex-1 bg-black/30 border border-white/15 rounded-lg px-2 py-1 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500/60"
                  />
                  <input
                    value={altTime}
                    onChange={(e) => setAltTime(e.target.value)}
                    placeholder="10:00"
                    className="w-16 bg-black/30 border border-white/15 rounded-lg px-2 py-1 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500/60"
                  />
                  <button onClick={addAltSlot} className="px-2 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-xs">追加</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingAlt(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/20 text-xs text-gray-500 hover:text-gray-300 hover:border-white/30 transition-all mb-2"
                >
                  <Plus className="w-3 h-3" /> 候補日時を追加
                </button>
              )}
              <button
                onClick={sendAltProposal}
                disabled={altDraft.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                患者アプリへ送信
              </button>
            </div>
          </div>
        )}

        {selected.stage === "alt_sent" && (
          <div className="border-t border-white/10 p-4 bg-[#0c1220]">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-950/50 border border-blue-600/30 text-sm text-blue-300">
              <Bell className="w-4 h-4 flex-shrink-0" />
              代替候補を送信しました。患者の返答をお待ちください。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
