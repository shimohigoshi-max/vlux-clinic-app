import { useState, useRef } from "react";

const DEMO_PRODUCTS = [
  { id: "W001", name: "3D骨盤サポートベルト", price: 4980, category: "サポーター", icon: "🩹", desc: "デスクワーク中の姿勢維持に。薄手で着用感ゼロ。" },
  { id: "S001", name: "リカバリーMag（マグネシウム）", price: 3280, category: "サプリ", icon: "💊", desc: "筋肉の弛緩と睡眠の質向上。就寝前1錠。" },
  { id: "S002", name: "電解質ウォーター concentrate", price: 2480, category: "ドリンク", icon: "💧", desc: "水分補給の習慣化に。1本で1L分。" },
  { id: "W002", name: "腰椎クッション（低反発）", price: 5980, category: "器具", icon: "🛋️", desc: "仰向け時に膝下へ。腰の反りを自然に補正。" },
];

const SAMPLE_CONV = `先生： お疲れ様です、田中さん。今日は腰がかなりお辛いということで。
患者： そうなんですよ。昨日、スーパーで米の袋を持ち上げた瞬間に「あ、これやばい」と思って。今は座ってるだけでも重だるい感じです。
先生： あちゃー、それはしんどいですね。触りますね……。仙腸関節のあたりがガチガチだ。デスクワークで座りっぱなしなのが響いてますね。
患者： 最近、プロジェクトの追い込みで1日10時間くらい座りっぱなしなんですよ。
先生： 今週の平均歩数も2,000歩いってないじゃないですか。大臀筋がサボっちゃって、腰だけで体重を支えてる状態です。
患者： 夜も腰が痛くて、なかなか寝付けない日もあるんですよね。
先生： 今日は高周波を当てて深部を緩めたあと、骨盤の角度を整えていきます。水分は摂ってます？
患者： コーヒーばかりで水はあんまり……。
先生： 筋肉が脱水状態で硬くなりますよ。膝の下にクッション入れると楽になります。
患者： サポーターとかした方がいいですかね？
先生： 骨盤を立ててくれる薄手のサポーターはあった方がいい。夜、マグネシウムを摂るのがおすすめです。`;

function genWeeklyData() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i));
    return { date: d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }), steps: Math.floor(Math.random() * 5000 + 800) };
  });
}

const sc = (v, g, w) => v >= g ? "#00c896" : v >= w ? "#ffaa44" : "#ff5566";

const TREATMENT_HISTORY = [
  { date: "2026/03/09", area: "仙腸関節・腰部", treatment: "高周波＋手技（骨盤矯正）", pain: 7, steps: 1840, sleep: 5.2, hrv: 38, note: "急性腰痛。米袋持ち上げが誘因。大臀筋機能低下あり。" },
  { date: "2026/02/23", area: "腰部・臀部", treatment: "超音波＋ストレッチ指導", pain: 5, steps: 2100, sleep: 5.8, hrv: 42, note: "慢性疲労感。デスクワーク10h継続中。改善傾向なし。" },
  { date: "2026/02/09", area: "頸部・肩甲骨周囲", treatment: "手技（僧帽筋リリース）＋テーピング", pain: 6, steps: 3200, sleep: 6.0, hrv: 44, note: "PC作業増加による頸部痛。右側優位。" },
  { date: "2026/01/26", area: "腰部・仙腸関節", treatment: "電気治療＋骨盤矯正", pain: 4, steps: 4100, sleep: 6.5, hrv: 52, note: "腰部の鈍痛が再燃。睡眠不足の週と一致。" },
  { date: "2026/01/12", area: "膝関節・大腿四頭筋", treatment: "超音波＋テーピング", pain: 3, steps: 6800, sleep: 7.1, hrv: 58, note: "ランニング再開後の膝痛。筋力不足。" },
  { date: "2025/12/22", area: "腰部・腸腰筋", treatment: "手技（腸腰筋リリース）", pain: 5, steps: 2900, sleep: 5.5, hrv: 40, note: "年末繁忙期。長時間座位で腸腰筋短縮。" },
  { date: "2025/12/08", area: "肩関節・回旋筋腱板", treatment: "マニピュレーション＋アイシング", pain: 4, steps: 5200, sleep: 6.8, hrv: 55, note: "荷物運搬後の肩痛。可動域制限あり。" },
  { date: "2025/11/24", area: "頸部・腰部（初診）", treatment: "姿勢評価＋全身調整", pain: 6, steps: 3800, sleep: 6.2, hrv: 48, note: "初診。全体的な姿勢不良。骨盤前傾パターン。" },
];

export default function App() {
  const [screen, setScreen] = useState("ipad");
  const [ipadTab, setIpadTab] = useState("voice");
  const [phoneTab, setPhoneTab] = useState("timeline");
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const weeklyData = genWeeklyData();
  const todayHealth = { steps: 1840, sleep: 5.2, heartRate: 72, hrv: 38, water: 0.6 };

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [karte, setKarte] = useState(null);
  const [patientSent, setPatientSent] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartMsg, setCartMsg] = useState("");
  const [correlationResult, setCorrelationResult] = useState(null);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const recRef = useRef(null);
  const tRef = useRef("");

  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome または Safari をご利用ください（音声認識が必要）"); return; }
    const r = new SR(); r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    tRef.current = transcript;
    r.onresult = (e) => {
      let fin = tRef.current, interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { fin += e.results[i][0].transcript; tRef.current = fin; }
        else interim = e.results[i][0].transcript;
      }
      setTranscript(fin + (interim ? `【${interim}】` : ""));
    };
    r.onerror = stopRec; r.onend = () => setIsRecording(false);
    recRef.current = r; r.start(); setIsRecording(true);
  };

  const stopRec = () => {
    recRef.current?.stop(); setIsRecording(false);
    const clean = tRef.current.replace(/【.*?】/g, "").trim();
    setTranscript(clean);
    if (clean.length > 20) doSummarize(clean);
  };

  const loadSample = () => { setTranscript(SAMPLE_CONV); tRef.current = SAMPLE_CONV; doSummarize(SAMPLE_CONV); };

  const doSummarize = async (text) => {
    setIsSummarizing(true); setSummary(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 700,
          system: "整骨院会話の要点をJSONのみで出力（```不要）: {\"chief_complaint\":\"主訴\",\"key_symptoms\":[\"症状\"],\"lifestyle_issues\":[\"生活習慣問題\"],\"treatment_done\":\"処置\",\"home_care\":[\"ホームケア\"],\"follow_up\":\"次回注意\"}",
          messages: [{ role: "user", content: text }],
        }),
      });
      const d = await res.json();
      setSummary(JSON.parse((d.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim()));
    } catch { setSummary({ error: true }); }
    setIsSummarizing(false);
  };

  const doKarte = async () => {
    if (!transcript.trim()) return;
    setIsAnalyzing(true); setKarte(null);
    const hd = healthSynced ? `歩数${todayHealth.steps}歩, 睡眠${todayHealth.sleep}h, HRV${todayHealth.hrv}` : "健康データ未連携";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 900,
          system: "整骨院AIカルテ。JSONのみ出力（```不要）: {\"chief_complaint\":\"\",\"findings\":\"\",\"treatment\":\"\",\"advice\":[],\"patient_message\":\"患者への親しみやすいメッセージ150字以内\",\"lifestyle_notes\":[\"生活習慣の注意点1\",\"注意点2\"],\"diet_advice\":[\"食事アドバイス1\",\"アドバイス2\"],\"supplement_advice\":[{\"name\":\"サプリ名\",\"timing\":\"摂取タイミング\",\"reason\":\"理由\"}],\"self_care\":[\"自分でできるケア1\",\"ケア2\"],\"recommended_products\":[\"W001\"],\"reason\":\"\"}",
          messages: [{ role: "user", content: `会話:\n${transcript}\n生活データ: ${hd}\n商品: ${JSON.stringify(DEMO_PRODUCTS.map(p => ({ id: p.id, name: p.name, desc: p.desc })))}` }],
        }),
      });
      const d = await res.json();
      setKarte(JSON.parse((d.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim()));
      setIpadTab("karte");
    } catch { setKarte({ error: true }); }
    setIsAnalyzing(false);
  };

  const doCorrelation = async () => {
    setIsCorrelating(true); setCorrelationResult(null);
    const historyText = TREATMENT_HISTORY.map((h, i) =>
      `[${i + 1}] ${h.date} 治療部位:${h.area} 疼痛度:${h.pain}/10 歩数:${h.steps} 睡眠:${h.sleep}h HRV:${h.hrv} メモ:${h.note}`
    ).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1200,
          system: `あなたは整骨院の臨床データアナリストです。患者の過去の治療履歴と生活習慣データ（HealthKit）を分析し、相関性・パターン・リスク予測をJSONのみで出力してください（\`\`\`不要）:
{
  "summary": "患者の全体的な状態の総括（2〜3文）",
  "correlations": [
    {"title": "相関パターン名", "finding": "発見内容", "strength": "強/中/弱", "data_evidence": "根拠となるデータ"}
  ],
  "risk_areas": [{"area": "リスク部位", "risk_level": "高/中/低", "reason": "理由"}],
  "lifestyle_triggers": [{"trigger": "悪化トリガー", "impact": "影響内容"}],
  "improvement_trend": {"score": 0から100, "direction": "改善/悪化/横ばい", "comment": "コメント"},
  "next_session_focus": ["次回施術で重点的に見るべき点1", "点2"],
  "prediction": "このまま続いた場合の1ヶ月後の予測（1文）"
}`,
          messages: [{ role: "user", content: `患者: 田中大輔（42歳男性、デスクワーク）\n\n治療履歴（新しい順）:\n${historyText}\n\n本日の生活データ: 歩数${todayHealth.steps}, 睡眠${todayHealth.sleep}h, 心拍${todayHealth.heartRate}bpm, HRV${todayHealth.hrv}` }],
        }),
      });
      const d = await res.json();
      setCorrelationResult(JSON.parse((d.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim()));
    } catch { setCorrelationResult({ error: true }); }
    setIsCorrelating(false);
  };

  const syncHealth = () => { setHealthSyncing(true); setTimeout(() => { setHealthSyncing(false); setHealthSynced(true); setIpadTab("health"); }, 2200); };
  const sendToPatient = () => { setPatientSent(true); setScreen("smartphone"); setPhoneTab("timeline"); };
  const addCart = (p) => { if (!cart.find(c => c.id === p.id)) { setCart(prev => [...prev, p]); setCartMsg(`✓ ${p.name}`); setTimeout(() => setCartMsg(""), 2500); } };

  const recProds = karte?.recommended_products ? DEMO_PRODUCTS.filter(p => karte.recommended_products.includes(p.id)) : DEMO_PRODUCTS.slice(0, 2);

  const C = {
    bg: "#06101e", card: { background: "rgba(8,20,38,.9)", border: "1px solid #102840", borderRadius: 12, padding: 16 },
    tab: (a) => ({ flex: 1, padding: "9px 0", border: "none", background: "transparent", color: a ? "#00c896" : "#2a5070", fontSize: 11, borderBottom: `2px solid ${a ? "#00c896" : "transparent"}`, cursor: "pointer", letterSpacing: 1 }),
    navBtn: (a) => ({ padding: "7px 18px", borderRadius: 8, border: `1px solid ${a ? "#00c896" : "#102840"}`, background: a ? "rgba(0,200,150,.1)" : "transparent", color: a ? "#00c896" : "#2a5070", fontSize: 11, cursor: "pointer", fontFamily: "'Space Mono',monospace", letterSpacing: 1 }),
    lbl: { fontSize: 10, color: "#2a6080", letterSpacing: 2, marginBottom: 6 },
    chip: (c) => ({ display: "inline-flex", gap: 4, background: `${c}18`, border: `1px solid ${c}50`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: c }),
    bigBtn: (col) => ({ width: "100%", padding: "13px 0", background: col || "linear-gradient(135deg,#00c896,#0073e6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }),
  };

  return (
    <div style={{ fontFamily: "'Noto Sans JP',sans-serif", background: C.bg, minHeight: "100vh", color: "#dceaf5" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(90deg,#060f20,#0b1e3a)", borderBottom: "1px solid #102840", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#00c896,#0073e6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚕</div>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700, color: "#00c896", letterSpacing: 2 }}>CONNECTED HEALTHCARE</div>
            <div style={{ fontSize: 9, color: "#2a5070", letterSpacing: 3 }}>ECOSYSTEM DEMO v2.2</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["ipad", "📋 医院 iPad"], ["smartphone", "📱 患者 スマホ"]].map(([v, l]) => (
            <button key={v} onClick={() => setScreen(v)} style={{ ...C.navBtn(screen === v), position: "relative" }}>
              {l}{v === "smartphone" && patientSent && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#ff4466" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* ─── iPad ─────────────────────────────────────────────────────── */}
      {screen === "ipad" && (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
          {/* Patient bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>田中 大輔</span>
            <span style={C.chip("#4488ff")}>42歳 男性</span>
            <span style={C.chip("#ffaa44")}>腰痛 / デスクワーク</span>
            {healthSynced && <span style={C.chip("#00c896")}>✓ HealthKit 連携済</span>}
            <div style={{ marginLeft: "auto" }}>
              {!healthSynced && (
                <button onClick={syncHealth} disabled={healthSyncing} style={{ padding: "7px 18px", background: "transparent", border: "1px solid #00c896", borderRadius: 8, color: "#00c896", fontSize: 11, cursor: "pointer" }}>
                  {healthSyncing ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> 同期中...</> : "📲 HealthKit 同期"}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #102840", marginBottom: 20 }}>
            {[["voice", "🎙️ 音声入力"], ["karte", "📄 カルテ生成"], ["history", "📊 履歴・相関分析"], ...(healthSynced ? [["health", "❤️ 健康データ"]] : [])].map(([t, l]) => (
              <button key={t} onClick={() => setIpadTab(t)} style={C.tab(ipadTab === t)}>{l}</button>
            ))}
          </div>

          {/* Voice Tab */}
          {ipadTab === "voice" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={C.lbl}>施術中の会話（マイク入力 or サンプル読込）</div>
                <div style={{ position: "relative" }}>
                  <textarea value={transcript} onChange={e => { setTranscript(e.target.value); tRef.current = e.target.value; }}
                    style={{ width: "100%", height: 260, background: "#050e1c", border: `1px solid ${isRecording ? "#00c896" : "#102840"}`, borderRadius: 10, padding: 14, color: "#a8cce0", fontSize: 12, lineHeight: 1.8, resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "'Noto Sans JP',sans-serif", transition: "border-color .3s" }}
                    placeholder="ここに会話テキストが入ります。録音するかサンプルを読み込んでください..." />
                  {isRecording && <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, color: "#ff4466", animation: "pulse 1s ease-in-out infinite" }}>● REC</div>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={isRecording ? stopRec : startRec} style={{ flex: 1, padding: "11px 0", background: isRecording ? "rgba(255,68,102,.15)" : "linear-gradient(135deg,#00c896,#0073e6)", border: isRecording ? "1px solid #ff4466" : "none", borderRadius: 10, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
                    {isRecording ? "⏹ 録音停止 → 要約" : "🎙️ 録音開始"}
                  </button>
                  <button onClick={loadSample} style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid #102840", borderRadius: 10, color: "#4a7090", fontSize: 12, cursor: "pointer" }}>
                    📄 サンプル読込
                  </button>
                </div>
                <button onClick={doKarte} disabled={isAnalyzing || !transcript.trim()} style={{ ...C.bigBtn(), marginTop: 10, opacity: transcript.trim() ? 1 : 0.4 }}>
                  {isAnalyzing ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> カルテ生成中...</> : "⚡ 正式カルテ + 商品推薦を生成"}
                </button>
              </div>

              {/* Summary */}
              <div>
                <div style={C.lbl}>AI 要点整理（自動）</div>
                {!summary && !isSummarizing && (
                  <div style={{ height: 260, background: "#050e1c", border: "1px dashed #102840", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#1a4060", gap: 8 }}>
                    <div style={{ fontSize: 28 }}>📋</div>
                    <div style={{ fontSize: 12 }}>音声入力後、自動で要約</div>
                  </div>
                )}
                {isSummarizing && (
                  <div style={{ height: 260, background: "rgba(0,200,150,.03)", border: "1px solid #00c89630", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 28, animation: "pulse 1.5s ease-in-out infinite" }}>🧠</div>
                    <div style={{ color: "#00c896", fontSize: 12, marginTop: 8 }}>要点を整理中...</div>
                  </div>
                )}
                {summary && !summary.error && (
                  <div style={{ height: 260, overflowY: "auto", background: "#050e1c", border: "1px solid #00c89640", borderRadius: 10, padding: 14 }}>
                    {[["主訴", summary.chief_complaint], ["主要症状", summary.key_symptoms?.join(" / ")], ["生活習慣の問題", summary.lifestyle_issues?.join(" / ")], ["処置内容", summary.treatment_done], ["ホームケア", summary.home_care?.join(" / ")], ["次回注意点", summary.follow_up]].map(([k, v]) => v ? (
                      <div key={k} style={{ marginBottom: 11 }}>
                        <div style={{ fontSize: 9, color: "#00c896", letterSpacing: 2 }}>{k}</div>
                        <div style={{ fontSize: 12, color: "#90b8d0", lineHeight: 1.6, marginTop: 3 }}>{v}</div>
                      </div>
                    ) : null)}
                  </div>
                )}
                {summary?.error && <div style={{ height: 260, border: "1px solid #ff5566", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#ff5566", fontSize: 12 }}>エラー。APIを確認してください。</div>}
              </div>
            </div>
          )}

          {/* Karte Tab */}
          {ipadTab === "karte" && (
            <div>
              {!karte && <div style={{ textAlign: "center", padding: 60, color: "#1a4060" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>音声入力タブで会話を入力しカルテを生成してください</div>}
              {karte?.error && <div style={{ color: "#ff5566", padding: 20 }}>エラーが発生しました。</div>}
              {karte && !karte.error && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={C.card}>
                    {[["主訴", karte.chief_complaint], ["所見", karte.findings], ["処置内容", karte.treatment]].map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: "#00c896", letterSpacing: 2, marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, color: "#90b8d0", lineHeight: 1.7, whiteSpace: "pre-line" }}>{v}</div>
                      </div>
                    ))}
                    {karte.advice && <div><div style={{ fontSize: 9, color: "#00c896", letterSpacing: 2, marginBottom: 4 }}>アドバイス</div>{karte.advice.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#90b8d0", lineHeight: 1.6 }}>・{a}</div>)}</div>}
                  </div>
                  <div>
                    <div style={{ ...C.card, border: "1px solid #00c89640" }}>
                      <div style={{ fontSize: 9, color: "#00c896", letterSpacing: 2, marginBottom: 8 }}>AI レコメンド商品</div>
                      {karte.reason && <div style={{ fontSize: 11, color: "#3a6080", marginBottom: 12, lineHeight: 1.6 }}>{karte.reason}</div>}
                      {recProds.map(p => (
                        <div key={p.id} style={{ display: "flex", gap: 10, marginBottom: 12, background: "rgba(0,200,150,.05)", borderRadius: 8, padding: 10 }}>
                          <span style={{ fontSize: 28 }}>{p.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, color: "#c0daf0" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "#2a5070", marginTop: 2 }}>{p.desc}</div>
                            <div style={{ fontSize: 13, color: "#00c896", fontFamily: "'Space Mono',monospace", marginTop: 4 }}>¥{p.price.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                      {karte.patient_message && (
                        <div style={{ marginTop: 10, padding: 10, background: "rgba(0,120,220,.08)", borderRadius: 8, border: "1px solid #0060aa30" }}>
                          <div style={{ fontSize: 9, color: "#4488ff", letterSpacing: 2, marginBottom: 4 }}>患者へのメッセージ</div>
                          <div style={{ fontSize: 12, color: "#80aad0", lineHeight: 1.7 }}>{karte.patient_message}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={sendToPatient} style={{ ...C.bigBtn("rgba(0,200,150,.1)"), marginTop: 12, border: "1px solid #00c896", color: "#00c896" }}>
                      📲 患者スマホへ送信 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History & Correlation Tab */}
          {ipadTab === "history" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Left: Treatment history timeline */}
              <div>
                <div style={C.lbl}>治療履歴（通院 {TREATMENT_HISTORY.length} 回）</div>
                <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                  {TREATMENT_HISTORY.map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      {/* Timeline line */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 20 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: i === 0 ? "#00c896" : "#1a4060", marginTop: 4, flexShrink: 0 }} />
                        {i < TREATMENT_HISTORY.length - 1 && <div style={{ width: 1, flex: 1, background: "#102840", marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, background: i === 0 ? "rgba(0,200,150,.06)" : "rgba(255,255,255,.02)", border: `1px solid ${i === 0 ? "#00c89640" : "#0e2438"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontSize: 10, color: i === 0 ? "#00c896" : "#2a5070", fontFamily: "'Space Mono',monospace" }}>{h.date}</div>
                          {i === 0 && <div style={{ fontSize: 9, background: "rgba(0,200,150,.15)", color: "#00c896", borderRadius: 4, padding: "1px 6px" }}>今日</div>}
                        </div>
                        <div style={{ fontSize: 12, color: "#c0d8f0", fontWeight: 600, marginBottom: 3 }}>📍 {h.area}</div>
                        <div style={{ fontSize: 11, color: "#4a7090", marginBottom: 6 }}>{h.treatment}</div>
                        {/* Mini stats */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[
                            { label: "疼痛", val: `${h.pain}/10`, color: h.pain >= 6 ? "#ff5566" : h.pain >= 4 ? "#ffaa44" : "#00c896" },
                            { label: "歩数", val: h.steps.toLocaleString(), color: sc(h.steps, 5000, 2000) },
                            { label: "睡眠", val: `${h.sleep}h`, color: sc(h.sleep, 7, 5.5) },
                            { label: "HRV", val: h.hrv, color: sc(h.hrv, 50, 35) },
                          ].map(m => (
                            <div key={m.label} style={{ background: "rgba(0,0,0,.3)", borderRadius: 4, padding: "2px 7px", fontSize: 10 }}>
                              <span style={{ color: "#2a5070" }}>{m.label} </span>
                              <span style={{ color: m.color, fontFamily: "'Space Mono',monospace" }}>{m.val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: "#2a4a60", marginTop: 6, lineHeight: 1.5 }}>{h.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: AI Correlation Analysis */}
              <div>
                <div style={C.lbl}>AI 相関分析</div>
                <button onClick={doCorrelation} disabled={isCorrelating}
                  style={{ ...C.bigBtn(), marginBottom: 14, opacity: isCorrelating ? 0.7 : 1 }}>
                  {isCorrelating
                    ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> 相関分析中...</>
                    : "🔬 治療履歴 × 生活データ 相関分析"}
                </button>

                {!correlationResult && !isCorrelating && (
                  <div style={{ background: "#050e1c", border: "1px dashed #102840", borderRadius: 12, padding: 30, textAlign: "center", color: "#1a4060" }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🔬</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>ボタンを押すとAIが<br />過去8回の治療データと<br />生活習慣の相関を分析します</div>
                  </div>
                )}

                {isCorrelating && (
                  <div style={{ background: "rgba(0,200,150,.03)", border: "1px solid #00c89630", borderRadius: 12, padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 32, animation: "pulse 1.5s ease-in-out infinite", marginBottom: 12 }}>🧠</div>
                    <div style={{ color: "#00c896", fontSize: 12, marginBottom: 6 }}>8回分のデータを解析中...</div>
                    <div style={{ color: "#1a4060", fontSize: 11 }}>治療部位 × 歩数 × 睡眠 × HRV の相関を計算しています</div>
                  </div>
                )}

                {correlationResult && !correlationResult.error && (
                  <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                    {/* Summary */}
                    <div style={{ ...C.card, border: "1px solid #00c89640", marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#00c896", letterSpacing: 2, marginBottom: 6 }}>総括</div>
                      <div style={{ fontSize: 12, color: "#90b8d0", lineHeight: 1.7 }}>{correlationResult.summary}</div>
                    </div>

                    {/* Improvement trend */}
                    {correlationResult.improvement_trend && (
                      <div style={{ ...C.card, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, color: "#4488ff", letterSpacing: 2, marginBottom: 8 }}>回復トレンド</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ position: "relative", width: 56, height: 56 }}>
                            <svg viewBox="0 0 36 36" style={{ width: 56, height: 56, transform: "rotate(-90deg)" }}>
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0e2438" strokeWidth="3" />
                              <circle cx="18" cy="18" r="15.9" fill="none"
                                stroke={correlationResult.improvement_trend.score >= 60 ? "#00c896" : correlationResult.improvement_trend.score >= 40 ? "#ffaa44" : "#ff5566"}
                                strokeWidth="3" strokeDasharray={`${correlationResult.improvement_trend.score} 100`} strokeLinecap="round" />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#dceaf5", fontFamily: "'Space Mono',monospace" }}>
                              {correlationResult.improvement_trend.score}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: correlationResult.improvement_trend.direction === "改善" ? "#00c896" : correlationResult.improvement_trend.direction === "悪化" ? "#ff5566" : "#ffaa44", fontWeight: 700 }}>
                              {correlationResult.improvement_trend.direction === "改善" ? "↗" : correlationResult.improvement_trend.direction === "悪化" ? "↘" : "→"} {correlationResult.improvement_trend.direction}
                            </div>
                            <div style={{ fontSize: 11, color: "#4a7090", lineHeight: 1.5, marginTop: 2 }}>{correlationResult.improvement_trend.comment}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Correlations */}
                    {correlationResult.correlations?.length > 0 && (
                      <div style={{ ...C.card, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, color: "#ffaa44", letterSpacing: 2, marginBottom: 8 }}>発見された相関パターン</div>
                        {correlationResult.correlations.map((c, i) => (
                          <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < correlationResult.correlations.length - 1 ? "1px solid #102840" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: "#d0b060", fontWeight: 600 }}>{c.title}</div>
                              <div style={{ marginLeft: "auto", fontSize: 9, padding: "2px 7px", borderRadius: 4, background: c.strength === "強" ? "rgba(255,80,80,.15)" : c.strength === "中" ? "rgba(255,170,0,.15)" : "rgba(0,200,150,.15)", color: c.strength === "強" ? "#ff6666" : c.strength === "中" ? "#ffaa44" : "#00c896" }}>
                                相関 {c.strength}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: "#7090a8", lineHeight: 1.6 }}>{c.finding}</div>
                            <div style={{ fontSize: 10, color: "#2a4a60", marginTop: 3 }}>根拠: {c.data_evidence}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Risk areas */}
                    {correlationResult.risk_areas?.length > 0 && (
                      <div style={{ ...C.card, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, color: "#ff6666", letterSpacing: 2, marginBottom: 8 }}>リスク部位</div>
                        {correlationResult.risk_areas.map((r, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, marginTop: 2, background: r.risk_level === "高" ? "rgba(255,80,80,.15)" : r.risk_level === "中" ? "rgba(255,170,0,.15)" : "rgba(0,200,150,.1)", color: r.risk_level === "高" ? "#ff6666" : r.risk_level === "中" ? "#ffaa44" : "#00c896", whiteSpace: "nowrap" }}>
                              {r.risk_level}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#c0d0e0" }}>{r.area}</div>
                              <div style={{ fontSize: 11, color: "#4a6070", lineHeight: 1.5 }}>{r.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lifestyle triggers */}
                    {correlationResult.lifestyle_triggers?.length > 0 && (
                      <div style={{ ...C.card, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, color: "#bb88ff", letterSpacing: 2, marginBottom: 8 }}>悪化トリガー</div>
                        {correlationResult.lifestyle_triggers.map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <span style={{ color: "#bb88ff", fontSize: 12 }}>⚡</span>
                            <div>
                              <span style={{ fontSize: 12, color: "#aa80e0" }}>{t.trigger}</span>
                              <span style={{ fontSize: 11, color: "#5a4080", marginLeft: 6 }}>→ {t.impact}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Next session & Prediction */}
                    <div style={{ ...C.card, border: "1px solid #0073e640" }}>
                      {correlationResult.next_session_focus?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, color: "#4488ff", letterSpacing: 2, marginBottom: 6 }}>次回施術の重点ポイント</div>
                          {correlationResult.next_session_focus.map((f, i) => (
                            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                              <span style={{ color: "#4488ff", fontSize: 11 }}>▸</span>
                              <span style={{ fontSize: 12, color: "#6090c0", lineHeight: 1.5 }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {correlationResult.prediction && (
                        <div>
                          <div style={{ fontSize: 9, color: "#888", letterSpacing: 2, marginBottom: 4 }}>1ヶ月後の予測</div>
                          <div style={{ fontSize: 12, color: "#607080", lineHeight: 1.6, fontStyle: "italic" }}>"{correlationResult.prediction}"</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {correlationResult?.error && (
                  <div style={{ border: "1px solid #ff5566", borderRadius: 12, padding: 20, color: "#ff5566", fontSize: 12, textAlign: "center" }}>エラーが発生しました。APIキーを確認してください。</div>
                )}
              </div>
            </div>
          )}

          {/* Health Tab */}
          {ipadTab === "health" && healthSynced && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <span style={C.chip("#00c896")}>✓ Apple HealthKit</span>
                <span style={C.chip("#4488ff")}>Google Fit 対応</span>
                <span style={C.chip("#888")}>最終同期: 今日 9:38</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { icon: "👣", label: "歩数", value: todayHealth.steps.toLocaleString(), unit: "steps", color: sc(todayHealth.steps, 5000, 2000) },
                  { icon: "😴", label: "睡眠", value: todayHealth.sleep, unit: "h", color: sc(todayHealth.sleep, 7, 5.5) },
                  { icon: "❤️", label: "心拍", value: todayHealth.heartRate, unit: "bpm", color: "#ff8888" },
                  { icon: "⚡", label: "HRV", value: todayHealth.hrv, unit: "ms", color: sc(todayHealth.hrv, 50, 35) },
                ].map(m => (
                  <div key={m.label} style={{ ...C.card, textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, color: m.color, fontWeight: 700 }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: "#2a5070", marginTop: 2 }}>{m.label} / {m.unit}</div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.lbl}>過去7日間 歩数トレンド</div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
                  {weeklyData.map((d, i) => {
                    const h = Math.max((d.steps / 8000) * 90, 6);
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: "100%", height: h, borderRadius: "4px 4px 0 0", background: i === 6 ? "#00c896" : "#0e2a42" }} />
                        <div style={{ fontSize: 9, color: i === 6 ? "#00c896" : "#2a5070" }}>{d.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Smartphone ───────────────────────────────────────────────── */}
      {screen === "smartphone" && (
        <div style={{ maxWidth: 390, margin: "0 auto", padding: "16px 0 40px" }}>
          <div style={{ background: "#0a1628", borderRadius: 40, border: "2px solid #102840", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,.7)" }}>
            <div style={{ background: "#05101a", padding: "10px 22px 6px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a5070" }}>
              <span>9:41</span><span style={{ color: "#00c896", fontFamily: "'Space Mono',monospace", fontSize: 9 }}>Connected Health</span><span>100%</span>
            </div>
            <div style={{ background: "linear-gradient(160deg,#0a1e3a,#050f1e)", padding: "14px 18px 0" }}>
              {patientSent && (
                <div style={{ background: "rgba(0,200,150,.1)", border: "1px solid #00c89660", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10, animation: "fadeIn .4s ease" }}>
                  <span style={{ fontSize: 18 }}>📩</span>
                  <div><div style={{ fontSize: 12, color: "#00c896", fontWeight: 700 }}>本日の施術レポートが届きました</div><div style={{ fontSize: 10, color: "#2a5070" }}>先生からのアドバイスを確認しましょう</div></div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#00c896,#0073e6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
                <div><div style={{ fontSize: 14, fontWeight: 700 }}>田中 大輔 さん</div><div style={{ fontSize: 10, color: "#2a5070" }}>次回: 3月16日（土）14:00</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                {[
                  { icon: "👣", v: healthSynced ? todayHealth.steps.toLocaleString() : "---", label: "歩数", color: "#ff6644" },
                  { icon: "😴", v: healthSynced ? `${todayHealth.sleep}h` : "---", label: "睡眠", color: "#ff9944" },
                  { icon: "❤️", v: healthSynced ? `${todayHealth.heartRate}` : "---", label: "心拍", color: "#ff8888" },
                ].map(m => (
                  <div key={m.label} style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 16 }}>{m.icon}</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: m.color, fontWeight: 700 }}>{m.v}</div>
                    <div style={{ fontSize: 9, color: "#2a4060" }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {!healthSynced ? (
                <button onClick={() => { setHealthSyncing(true); setTimeout(() => { setHealthSyncing(false); setHealthSynced(true); }, 2000); }}
                  style={{ width: "100%", marginBottom: 12, padding: "9px 0", background: "rgba(0,200,150,.08)", border: "1px solid #00c89640", borderRadius: 10, color: "#00c896", fontSize: 11, cursor: "pointer" }}>
                  {healthSyncing ? "⟳ 同期中..." : "🍎 Apple HealthKit を接続する"}
                </button>
              ) : <div style={{ textAlign: "center", fontSize: 10, color: "#00c896", marginBottom: 10 }}>✓ Apple HealthKit 連携済 · 自動同期 ON</div>}
              <div style={{ display: "flex", borderBottom: "1px solid #102840" }}>
                {[["timeline", "タイムライン"], ["health", "健康データ"], ["shop", "ショップ"]].map(([t, l]) => (
                  <button key={t} onClick={() => setPhoneTab(t)} style={C.tab(phoneTab === t)}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, minHeight: 380 }}>
              {/* Timeline */}
              {phoneTab === "timeline" && (
                <div>
                  {patientSent && karte && !karte.error ? (
                    <div>
                      {/* 施術メッセージ */}
                      <div style={{ background: "rgba(0,200,150,.06)", border: "1px solid #00c89630", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 13 }}>⚕</span>
                          <div style={{ fontSize: 10, color: "#00c896" }}>今日の施術レポート</div>
                          <div style={{ marginLeft: "auto", fontSize: 9, color: "#1a3a5a" }}>今日</div>
                        </div>
                        <div style={{ fontSize: 12, color: "#90b8d0", lineHeight: 1.7 }}>{karte.patient_message}</div>
                      </div>

                      {/* 先生からのノート */}
                      <div style={{ background: "rgba(255,200,50,.04)", border: "1px solid #c8902050", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                          <span style={{ fontSize: 14 }}>📓</span>
                          <div style={{ fontSize: 11, color: "#d4a040", fontWeight: 700 }}>先生からのノート</div>
                        </div>

                        {/* 生活習慣 */}
                        {karte.lifestyle_notes?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 9, color: "#d4a040", letterSpacing: 2, marginBottom: 6 }}>🏃 生活習慣の改善ポイント</div>
                            {karte.lifestyle_notes.map((n, i) => (
                              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                                <span style={{ color: "#d4a040", fontSize: 11, marginTop: 1 }}>▸</span>
                                <span style={{ fontSize: 12, color: "#c0a060", lineHeight: 1.6 }}>{n}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 食事 */}
                        {karte.diet_advice?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 9, color: "#60cc88", letterSpacing: 2, marginBottom: 6 }}>🥗 食事・水分アドバイス</div>
                            {karte.diet_advice.map((n, i) => (
                              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                                <span style={{ color: "#60cc88", fontSize: 11, marginTop: 1 }}>▸</span>
                                <span style={{ fontSize: 12, color: "#80b890", lineHeight: 1.6 }}>{n}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* サプリ */}
                        {karte.supplement_advice?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 9, color: "#8888ff", letterSpacing: 2, marginBottom: 6 }}>💊 サプリメントの推奨</div>
                            {karte.supplement_advice.map((s, i) => (
                              <div key={i} style={{ background: "rgba(100,100,255,.08)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                                <div style={{ fontSize: 12, color: "#aaaaff", fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 10, color: "#6060a0", marginTop: 2 }}>⏰ {s.timing}</div>
                                <div style={{ fontSize: 11, color: "#7070b0", marginTop: 2, lineHeight: 1.5 }}>→ {s.reason}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* セルフケア */}
                        {karte.self_care?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 9, color: "#44aaee", letterSpacing: 2, marginBottom: 6 }}>🙆 自分でできるケア</div>
                            {karte.self_care.map((n, i) => (
                              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                                <span style={{ color: "#44aaee", fontSize: 11, marginTop: 1 }}>▸</span>
                                <span style={{ fontSize: 12, color: "#6090b0", lineHeight: 1.6 }}>{n}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* クーポン */}
                      <div style={{ background: "linear-gradient(135deg,rgba(255,80,120,.12),rgba(180,40,80,.08))", border: "1px dashed #ff406070", borderRadius: 14, padding: 14, marginBottom: 10, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: -8, right: -8, fontSize: 40, opacity: 0.07 }}>🎟</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 14 }}>🎫</span>
                          <div style={{ fontSize: 11, color: "#ff7090", fontWeight: 700 }}>今月のご来院クーポン</div>
                          <div style={{ marginLeft: "auto", background: "rgba(255,80,120,.2)", border: "1px solid #ff406060", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#ff7090" }}>3/31まで</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#ff9090", fontFamily: "'Space Mono',monospace", marginBottom: 4 }}>¥500 OFF</div>
                        <div style={{ fontSize: 11, color: "#80404a", marginBottom: 10 }}>次回施術料金より割引。1回限り有効。</div>
                        <div style={{ background: "#0a0818", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: "#ff7090", letterSpacing: 4 }}>CHE-0309</div>
                          <div style={{ fontSize: 10, color: "#3a2030" }}>提示してご利用ください</div>
                        </div>
                      </div>

                      {/* 次回予約ボタン */}
                      <button
                        onClick={() => alert("デモ：予約システム連携\n実装時はカレンダーUIを表示")}
                        style={{ width: "100%", padding: "15px 0", background: "linear-gradient(135deg,#0073e6,#005bbf)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        📅 次回の予約を取る
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* クーポン（初期表示でも見せる） */}
                      <div style={{ background: "linear-gradient(135deg,rgba(255,80,120,.12),rgba(180,40,80,.08))", border: "1px dashed #ff406070", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 14 }}>🎫</span>
                          <div style={{ fontSize: 11, color: "#ff7090", fontWeight: 700 }}>今月のご来院クーポン</div>
                          <div style={{ marginLeft: "auto", background: "rgba(255,80,120,.2)", border: "1px solid #ff406060", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#ff7090" }}>3/31まで</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#ff9090", fontFamily: "'Space Mono',monospace", marginBottom: 4 }}>¥500 OFF</div>
                        <div style={{ fontSize: 11, color: "#80404a", marginBottom: 10 }}>次回施術料金より割引。1回限り有効。</div>
                        <div style={{ background: "#0a0818", borderRadius: 8, padding: "8px 12px", fontFamily: "'Space Mono',monospace", fontSize: 14, color: "#ff7090", letterSpacing: 4 }}>CHE-0309</div>
                      </div>

                      <button
                        onClick={() => alert("デモ：予約システム連携")}
                        style={{ width: "100%", padding: "15px 0", background: "linear-gradient(135deg,#0073e6,#005bbf)", border: "none", borderRadius: 14, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        📅 次回の予約を取る
                      </button>

                      <div style={{ textAlign: "center", padding: "16px 0", color: "#1a3a5a", fontSize: 12 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                        施術後、先生からのノートがここに届きます
                      </div>
                    </div>
                  )}

                  {/* 過去の施術履歴 */}
                  {[{ date: "2週間前", msg: "肩甲骨の緊張が改善。週3回ストレッチを続けてください。" }, { date: "1ヶ月前", msg: "初診時より歩行バランスが15%改善しています。" }].map((item, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,.02)", border: "1px solid #0e2438", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "#00c896" }}>⚕ 施術レポート</div>
                        <div style={{ fontSize: 9, color: "#1a3a5a" }}>{item.date}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#507090", lineHeight: 1.6 }}>{item.msg}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Health */}
              {phoneTab === "health" && (
                <div>
                  {!healthSynced ? <div style={{ textAlign: "center", padding: "40px 0", color: "#1a3a5a", fontSize: 12 }}><div style={{ fontSize: 32, marginBottom: 10 }}>🍎</div>Apple HealthKit を接続してください</div> : (
                    <div>
                      <div style={{ fontSize: 10, color: "#00c896", textAlign: "right", marginBottom: 10 }}>最終同期: 今日 9:38</div>
                      {[
                        { icon: "👣", label: "今日の歩数", value: todayHealth.steps.toLocaleString(), unit: "steps", pct: (todayHealth.steps / 8000) * 100, color: sc(todayHealth.steps, 5000, 2000) },
                        { icon: "😴", label: "昨夜の睡眠", value: todayHealth.sleep, unit: "時間", pct: (todayHealth.sleep / 9) * 100, color: sc(todayHealth.sleep, 7, 5.5) },
                        { icon: "❤️", label: "安静時心拍", value: todayHealth.heartRate, unit: "bpm", pct: 60, color: "#ff8888" },
                        { icon: "⚡", label: "HRV", value: todayHealth.hrv, unit: "ms", pct: (todayHealth.hrv / 80) * 100, color: sc(todayHealth.hrv, 50, 35) },
                      ].map(m => (
                        <div key={m.label} style={{ background: "rgba(255,255,255,.02)", border: "1px solid #0e2438", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 18 }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: "#2a5070" }}>{m.label}</div>
                              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, color: m.color, fontWeight: 700 }}>{m.value} <span style={{ fontSize: 10, color: "#2a5070" }}>{m.unit}</span></div>
                            </div>
                          </div>
                          <div style={{ height: 4, background: "#0e2438", borderRadius: 2 }}>
                            <div style={{ width: `${Math.min(m.pct, 100)}%`, height: "100%", background: m.color, borderRadius: 2, transition: "width 1s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shop */}
              {phoneTab === "shop" && (
                <div>
                  {cartMsg && <div style={{ background: "rgba(0,200,150,.1)", border: "1px solid #00c896", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 11, color: "#00c896" }}>{cartMsg}</div>}
                  <div style={{ fontSize: 10, color: "#2a5070", marginBottom: 10 }}>{patientSent ? "🎯 今日の施術データに基づくおすすめ" : "あなたの健康状態に合わせたおすすめ"}</div>
                  {recProds.map(p => (
                    <div key={p.id} style={{ background: "rgba(0,200,150,.04)", border: "1px solid #00c89620", borderRadius: 14, padding: 12, marginBottom: 10, display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 30, minWidth: 40, textAlign: "center" }}>{p.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#c0daf0", fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: "#2a5070", marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: "#00c896" }}>¥{p.price.toLocaleString()}</span>
                          <button onClick={() => addCart(p)} style={{ padding: "5px 14px", background: cart.find(c => c.id === p.id) ? "rgba(0,200,150,.15)" : "linear-gradient(135deg,#00c896,#0073e6)", border: "none", borderRadius: 8, color: "white", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                            {cart.find(c => c.id === p.id) ? "✓ 追加済" : "カートへ"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #0e2438", paddingTop: 10, marginTop: 4 }}>
                    {DEMO_PRODUCTS.filter(p => !recProds.find(r => r.id === p.id)).map(p => (
                      <div key={p.id} style={{ background: "rgba(255,255,255,.02)", border: "1px solid #0e2438", borderRadius: 12, padding: 10, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 22 }}>{p.icon}</span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "#7090a8" }}>{p.name}</div><div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#3a6070" }}>¥{p.price.toLocaleString()}</div></div>
                        <button onClick={() => addCart(p)} style={{ padding: "4px 12px", background: "rgba(0,200,150,.08)", border: "1px solid #00c89640", borderRadius: 8, color: "#00c896", fontSize: 11, cursor: "pointer" }}>
                          {cart.find(c => c.id === p.id) ? "✓" : "+"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {cart.length > 0 && (
                    <div style={{ position: "sticky", bottom: 0, background: "#0a1628", borderTop: "1px solid #102840", paddingTop: 10, marginTop: 8 }}>
                      <button style={C.bigBtn()}>🛒 カート {cart.length}点 · ¥{cart.reduce((s, p) => s + p.price, 0).toLocaleString()} — 購入する</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:#102840;border-radius:4px}
      `}</style>
    </div>
  );
}
