import { useState, useEffect } from "react";

const SAMPLE_CONVERSATION = `先生： お疲れ様です、田中さん。今日は腰がかなりお辛いということで。
患者： そうなんですよ。昨日、仕事帰りにスーパーで米の袋を持ち上げた瞬間に「あ、これやばい」と思って。今は座ってるだけでも重だるい感じです。
先生： あちゃー、それはしんどいですね。ちょっと失礼して触りますね……。仙腸関節のあたりがガチガチだ。これ、昨日だけじゃなくて、普段からデスクワークで座りっぱなしなのが響いてますね。
患者： 確かに……。最近、プロジェクトの追い込みで1日10時間くらい椅子に座りっぱなしなんですよ。
先生： 10時間は長いですね。今週の平均歩数も2,000歩いってないじゃないですか。座りすぎてお尻の筋肉（大臀筋）がサボっちゃって、腰だけで体重を支えてる状態です。
患者： 夜も腰が痛くて、なかなか寝付けない日もあるんですよね。
先生： それは自律神経も昂ぶってますね。今日は腰に高周波を当てて深部を緩めたあと、手技で骨盤の角度を整えていきます。水分ちゃんと摂ってます？
患者： いえ、コーヒーばかりで水はあんまり……。
先生： それだと筋肉が脱水状態で余計に硬くなりますよ。施術後はしっかりお水飲んでください。あと、膝の下にクッション入れると楽になりますよ。
患者： サポーターとかした方がいいですかね？
先生： 骨盤を立ててくれる薄手のサポーターはあった方がいいですね。あと、夜寝る前にマグネシウムを摂るのがおすすめです。`;

const HEALTH_DATA = {
  steps: 1840,
  sleep: 5.2,
  heartRate: 78,
  water: 0.6,
  stepsGoal: 8000,
  sleepGoal: 7.0,
};

const DEMO_PRODUCTS = [
  { id: "W001", name: "3D骨盤サポートベルト", price: 4980, category: "サポーター", icon: "🩹", desc: "デスクワーク中の姿勢維持に。薄手で着用感ゼロ。" },
  { id: "S001", name: "リカバリーMag（マグネシウム）", price: 3280, category: "サプリ", icon: "💊", desc: "筋肉の弛緩と睡眠の質向上に。就寝前1錠。" },
  { id: "S002", name: "電解質ウォーター concentrate", price: 2480, category: "ドリンク", icon: "💧", desc: "水分補給の習慣化に。1本で1L分。" },
  { id: "W002", name: "腰椎クッション（低反発）", price: 5980, category: "器具", icon: "🛋️", desc: "仰向け時に膝下へ。腰の反りを自然に補正。" },
];

export default function App() {
  const [view, setView] = useState("ipad");
  const [conversation, setConversation] = useState(SAMPLE_CONVERSATION);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [cart, setCart] = useState([]);
  const [patientNotified, setPatientNotified] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline");
  const [purchaseMsg, setPurchaseMsg] = useState("");

  const analyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `あなたは整骨院AIアシスタントです。施術会話から以下をJSON形式で抽出してください。余分なテキストや\`\`\`jsonは不要。JSONのみ出力。
{
  "chief_complaint": "主訴（1文）",
  "findings": "所見（2〜3項目、箇条書き）",
  "treatment": "処置内容（1〜2文）",
  "advice": ["アドバイス1", "アドバイス2"],
  "patient_message": "患者スマホに送る親しみやすいメッセージ（150字以内）",
  "recommended_products": ["W001", "S001"],
  "reason": "推薦理由（1文）"
}`,
          messages: [{ role: "user", content: `会話:\n${conversation}\n\n生活データ: 歩数${HEALTH_DATA.steps}歩、睡眠${HEALTH_DATA.sleep}時間、水分${HEALTH_DATA.water}L\n\n商品マスタ: ${JSON.stringify(DEMO_PRODUCTS.map(p => ({ id: p.id, name: p.name, desc: p.desc })))}` }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      setAnalysisResult(JSON.parse(clean));
    } catch (e) {
      setAnalysisResult({ error: "解析エラー。APIキーを確認してください。" });
    }
    setIsAnalyzing(false);
  };

  const sendToPatient = () => {
    setPatientNotified(true);
    setView("smartphone");
    setActiveTab("timeline");
  };

  const addToCart = (product) => {
    if (!cart.find(p => p.id === product.id)) {
      setCart([...cart, product]);
      setPurchaseMsg(`✓ ${product.name} をカートに追加`);
      setTimeout(() => setPurchaseMsg(""), 2500);
    }
  };

  const recommendedProducts = analysisResult?.recommended_products
    ? DEMO_PRODUCTS.filter(p => analysisResult.recommended_products.includes(p.id))
    : DEMO_PRODUCTS.slice(0, 2);

  const stepsPct = Math.min((HEALTH_DATA.steps / HEALTH_DATA.stepsGoal) * 100, 100);
  const sleepPct = Math.min((HEALTH_DATA.sleep / HEALTH_DATA.sleepGoal) * 100, 100);

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", background: "#080f1a", minHeight: "100vh", color: "#e8edf5" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2040 100%)", borderBottom: "1px solid #1a3a5c", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #00c896, #0080ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚕</div>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#00c896", letterSpacing: 2 }}>CONNECTED HEALTHCARE</div>
            <div style={{ fontSize: 10, color: "#4a6fa0", letterSpacing: 3 }}>ECOSYSTEM DEMO v1.0</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["ipad", "smartphone"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid",
              borderColor: view === v ? "#00c896" : "#1a3a5c",
              background: view === v ? "rgba(0,200,150,0.1)" : "transparent",
              color: view === v ? "#00c896" : "#4a6fa0",
              fontSize: 12, cursor: "pointer", fontFamily: "'Space Mono', monospace",
              letterSpacing: 1, transition: "all 0.2s",
            }}>
              {v === "ipad" ? "📋 医院 iPad" : "📱 患者 スマホ"}
              {v === "smartphone" && patientNotified && <span style={{ marginLeft: 6, background: "#ff4466", borderRadius: "50%", padding: "1px 5px", fontSize: 10 }}>1</span>}
            </button>
          ))}
        </div>
      </div>

      {/* iPad View */}
      {view === "ipad" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#4a6fa0", letterSpacing: 2, marginBottom: 6 }}>CLINICIAN TERMINAL — PATIENT: 田中 大輔 (42歳 男性)</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["初診日", "2024.03.09"], ["前回来院", "2週間前"], ["通院回数", "8回"], ["主訴", "腰痛 / デスクワーク"]].map(([k, v]) => (
                <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a3a5c", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 10, color: "#4a6fa0" }}>{k}</div>
                  <div style={{ fontSize: 13, color: "#a0c4e0", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left: Conversation Input */}
            <div>
              <div style={{ fontSize: 11, color: "#4a6fa0", letterSpacing: 2, marginBottom: 10 }}>▸ 施術会話（ピンマイク入力）</div>
              <div style={{ position: "relative" }}>
                <textarea
                  value={conversation}
                  onChange={e => setConversation(e.target.value)}
                  style={{
                    width: "100%", height: 280, background: "rgba(0,20,40,0.8)",
                    border: "1px solid #1a3a5c", borderRadius: 10, padding: 14,
                    color: "#c8dff0", fontSize: 13, lineHeight: 1.7, resize: "none",
                    outline: "none", boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                />
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, color: "#00c896", background: "rgba(0,200,150,0.1)", padding: "2px 8px", borderRadius: 4 }}>● REC</div>
              </div>
              <button
                onClick={analyze}
                disabled={isAnalyzing}
                style={{
                  width: "100%", marginTop: 12, padding: "14px 0",
                  background: isAnalyzing ? "rgba(0,200,150,0.1)" : "linear-gradient(135deg, #00c896, #0080ff)",
                  border: "none", borderRadius: 10, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: isAnalyzing ? "not-allowed" : "pointer",
                  letterSpacing: 2, transition: "all 0.3s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {isAnalyzing ? (
                  <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> AI解析中...</>
                ) : "⚡ AI解析 → カルテ自動生成"}
              </button>
            </div>

            {/* Right: Analysis Result */}
            <div>
              <div style={{ fontSize: 11, color: "#4a6fa0", letterSpacing: 2, marginBottom: 10 }}>▸ AI生成カルテ</div>
              {!analysisResult && !isAnalyzing && (
                <div style={{ height: 280, background: "rgba(0,20,40,0.5)", border: "1px dashed #1a3a5c", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#2a5070", fontSize: 13 }}>
                  会話を入力して「AI解析」を押してください
                </div>
              )}
              {isAnalyzing && (
                <div style={{ height: 280, background: "rgba(0,200,150,0.03)", border: "1px solid #00c89640", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>🧠</div>
                    <div style={{ color: "#00c896", fontSize: 13, letterSpacing: 1 }}>Gemini 解析中...</div>
                    <div style={{ color: "#2a5070", fontSize: 11, marginTop: 6 }}>会話 × 生活データ 統合分析</div>
                  </div>
                </div>
              )}
              {analysisResult && !analysisResult.error && (
                <div style={{ background: "rgba(0,20,40,0.8)", border: "1px solid #00c89640", borderRadius: 10, padding: 16, height: 280, overflowY: "auto" }}>
                  {[
                    ["主訴", analysisResult.chief_complaint],
                    ["所見", analysisResult.findings],
                    ["処置", analysisResult.treatment],
                  ].map(([k, v]) => (
                    <div key={k} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "#00c896", letterSpacing: 2, marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 12, color: "#a0c4e0", lineHeight: 1.6, whiteSpace: "pre-line" }}>{v}</div>
                    </div>
                  ))}
                  {analysisResult.advice && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "#00c896", letterSpacing: 2, marginBottom: 4 }}>アドバイス</div>
                      {analysisResult.advice.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#a0c4e0", lineHeight: 1.6 }}>・{a}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {analysisResult?.error && (
                <div style={{ height: 280, background: "rgba(255,50,50,0.05)", border: "1px solid #ff4466", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#ff4466", fontSize: 13 }}>
                  {analysisResult.error}
                </div>
              )}
            </div>
          </div>

          {/* Product Recommendations */}
          {analysisResult && !analysisResult.error && (
            <div style={{ marginTop: 24, background: "rgba(0,20,40,0.6)", border: "1px solid #1a3a5c", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#4a6fa0", letterSpacing: 2, marginBottom: 4 }}>▸ AIレコメンド商品</div>
              {analysisResult.reason && <div style={{ fontSize: 12, color: "#5a8aa0", marginBottom: 14 }}>{analysisResult.reason}</div>}
              <div style={{ display: "flex", gap: 12 }}>
                {recommendedProducts.map(p => (
                  <div key={p.id} style={{ flex: 1, background: "rgba(0,200,150,0.05)", border: "1px solid #00c89630", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
                    <div style={{ fontSize: 13, color: "#c8dff0", fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#4a6fa0", marginTop: 4, lineHeight: 1.5 }}>{p.desc}</div>
                    <div style={{ fontSize: 14, color: "#00c896", marginTop: 8, fontFamily: "'Space Mono', monospace" }}>¥{p.price.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={sendToPatient}
                style={{
                  width: "100%", marginTop: 16, padding: "12px 0",
                  background: "rgba(0,200,150,0.1)", border: "1px solid #00c896",
                  borderRadius: 10, color: "#00c896", fontSize: 13,
                  cursor: "pointer", letterSpacing: 1, fontWeight: 700,
                }}
              >
                📲 患者スマホへ送信 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Smartphone View */}
      {view === "smartphone" && (
        <div style={{ maxWidth: 390, margin: "0 auto", padding: "16px 0" }}>
          {/* Phone frame */}
          <div style={{ background: "#0a1628", borderRadius: 40, border: "3px solid #1a3a5c", overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
            {/* Status bar */}
            <div style={{ background: "#060d18", padding: "12px 24px 8px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4a6fa0" }}>
              <span>9:41</span><span>Connected Healthcare</span><span>100%</span>
            </div>

            {/* Profile Header */}
            <div style={{ background: "linear-gradient(160deg, #0a1e3a, #061226)", padding: "16px 20px 0" }}>
              {patientNotified && (
                <div style={{ background: "rgba(0,200,150,0.1)", border: "1px solid #00c896", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.5s ease" }}>
                  <span style={{ fontSize: 18 }}>📩</span>
                  <div>
                    <div style={{ fontSize: 12, color: "#00c896", fontWeight: 700 }}>本日の施術レポートが届きました</div>
                    <div style={{ fontSize: 11, color: "#4a6fa0" }}>先生からのアドバイスを確認しましょう</div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #00c896, #0080ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e8edf5" }}>田中 大輔 さん</div>
                  <div style={{ fontSize: 11, color: "#4a6fa0" }}>次回予約: 3月16日（土）14:00</div>
                </div>
              </div>

              {/* Health Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { icon: "👣", label: "歩数", value: HEALTH_DATA.steps.toLocaleString(), unit: "steps", pct: stepsPct, color: stepsPct < 40 ? "#ff6644" : "#00c896" },
                  { icon: "😴", label: "睡眠", value: HEALTH_DATA.sleep, unit: "h", pct: sleepPct, color: sleepPct < 80 ? "#ff9944" : "#00c896" },
                  { icon: "💧", label: "水分", value: HEALTH_DATA.water, unit: "L", pct: HEALTH_DATA.water / 2 * 100, color: "#4488ff" },
                ].map(m => (
                  <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 18 }}>{m.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: "'Space Mono', monospace" }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: "#3a5a7a" }}>{m.label} / {m.unit}</div>
                    <div style={{ height: 3, background: "#1a3a5c", borderRadius: 2, marginTop: 6 }}>
                      <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 2, transition: "width 1s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #1a3a5c" }}>
                {[["timeline", "タイムライン"], ["shop", "あなたのショップ"]].map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, padding: "10px 0", border: "none", background: "transparent",
                    color: activeTab === tab ? "#00c896" : "#3a5a7a", fontSize: 12,
                    borderBottom: `2px solid ${activeTab === tab ? "#00c896" : "transparent"}`,
                    cursor: "pointer", letterSpacing: 1,
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ padding: 16, minHeight: 360 }}>
              {activeTab === "timeline" && (
                <div>
                  {patientNotified && analysisResult && !analysisResult.error ? (
                    <div>
                      <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid #00c89630", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 14 }}>⚕</span>
                          <div style={{ fontSize: 11, color: "#00c896" }}>今日の施術レポート</div>
                          <div style={{ marginLeft: "auto", fontSize: 10, color: "#2a4a6a" }}>今日</div>
                        </div>
                        <div style={{ fontSize: 13, color: "#a0c4e0", lineHeight: 1.7 }}>{analysisResult.patient_message}</div>
                        {analysisResult.advice && (
                          <div style={{ marginTop: 10 }}>
                            {analysisResult.advice.map((a, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                                <span style={{ color: "#00c896", fontSize: 10, marginTop: 3 }}>✓</span>
                                <span style={{ fontSize: 12, color: "#6a9ab0", lineHeight: 1.5 }}>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#2a4a6a", fontSize: 13 }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                      iPadから施術データを送信すると<br />ここに表示されます
                    </div>
                  )}
                  {/* Past timeline items */}
                  {[
                    { date: "2週間前", msg: "肩甲骨周りの緊張が改善しています。週3回の肩回しストレッチを続けてください。", good: true },
                    { date: "1ヶ月前", msg: "初診時より歩行バランスが15%改善。このまま継続しましょう。", good: true },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1a3a5c", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: item.good ? "#00c896" : "#ff6644" }}>⚕ 施術レポート</div>
                        <div style={{ fontSize: 10, color: "#2a4a6a" }}>{item.date}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6a8aaa", lineHeight: 1.6 }}>{item.msg}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "shop" && (
                <div>
                  {purchaseMsg && (
                    <div style={{ background: "rgba(0,200,150,0.1)", border: "1px solid #00c896", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#00c896" }}>
                      {purchaseMsg}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#4a6fa0", letterSpacing: 1, marginBottom: 12 }}>
                    {patientNotified ? "🎯 今日の施術データに基づくおすすめ" : "あなたの健康状態に合わせたおすすめ"}
                  </div>
                  {(patientNotified ? recommendedProducts : DEMO_PRODUCTS.slice(0, 2)).map(p => (
                    <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1a3a5c", borderRadius: 14, padding: 14, marginBottom: 10, display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 32, minWidth: 44, textAlign: "center" }}>{p.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#c8dff0", fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#3a5a7a", marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span style={{ fontSize: 14, color: "#00c896", fontFamily: "'Space Mono', monospace" }}>¥{p.price.toLocaleString()}</span>
                          <button onClick={() => addToCart(p)} style={{
                            padding: "5px 14px", background: "linear-gradient(135deg, #00c896, #0080ff)",
                            border: "none", borderRadius: 8, color: "white", fontSize: 11,
                            cursor: "pointer", fontWeight: 700,
                          }}>
                            {cart.find(c => c.id === p.id) ? "✓ 追加済み" : "カートへ"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #1a3a5c", marginTop: 8, paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: "#2a4a6a", marginBottom: 10 }}>その他の商品</div>
                    {DEMO_PRODUCTS.slice(2).map(p => (
                      <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #0f2540", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 24 }}>{p.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#8aaac0" }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: "#4a7a90", fontFamily: "'Space Mono', monospace" }}>¥{p.price.toLocaleString()}</div>
                        </div>
                        <button onClick={() => addToCart(p)} style={{
                          padding: "4px 12px", background: "rgba(0,200,150,0.1)", border: "1px solid #00c89650",
                          borderRadius: 8, color: "#00c896", fontSize: 11, cursor: "pointer",
                        }}>
                          {cart.find(c => c.id === p.id) ? "✓" : "+"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {cart.length > 0 && (
                    <div style={{ position: "sticky", bottom: 0, background: "#0a1628", borderTop: "1px solid #1a3a5c", padding: "12px 0", marginTop: 12 }}>
                      <button style={{
                        width: "100%", padding: "13px 0",
                        background: "linear-gradient(135deg, #00c896, #0080ff)",
                        border: "none", borderRadius: 12, color: "white",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 1,
                      }}>
                        🛒 カート ({cart.length}点) · ¥{cart.reduce((s, p) => s + p.price, 0).toLocaleString()} — 購入する
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: #0a1628; }
        textarea::-webkit-scrollbar-thumb { background: #1a3a5c; border-radius: 4px; }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: #1a3a5c; border-radius: 4px; }
      `}</style>
    </div>
  );
}
