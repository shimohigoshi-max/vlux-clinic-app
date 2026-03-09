export interface HealthData {
  steps: number;
  sleep: number;
  heartRate: number;
  hrv: number;
  water: number;
  stepsGoal: number;
  sleepGoal: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  desc: string;
}

export interface SummaryResult {
  chief_complaint?: string;
  key_symptoms?: string[];
  lifestyle_issues?: string[];
  treatment_done?: string;
  home_care?: string[];
  follow_up?: string;
  error?: boolean;
}

export interface SupplementAdvice {
  name: string;
  timing: string;
  reason: string;
}

export interface KarteResult {
  chief_complaint?: string;
  findings?: string;
  treatment?: string;
  advice?: string[];
  patient_message?: string;
  lifestyle_notes?: string[];
  diet_advice?: string[];
  supplement_advice?: SupplementAdvice[];
  self_care?: string[];
  recommended_products?: string[];
  reason?: string;
  error?: string;
}

export interface Correlation {
  title: string;
  finding: string;
  strength: string;
  data_evidence: string;
}

export interface RiskArea {
  area: string;
  risk_level: string;
  reason: string;
}

export interface LifestyleTrigger {
  trigger: string;
  impact: string;
}

export interface ImprovementTrend {
  score: number;
  direction: string;
  comment: string;
}

export interface CorrelationResult {
  summary?: string;
  correlations?: Correlation[];
  risk_areas?: RiskArea[];
  lifestyle_triggers?: LifestyleTrigger[];
  improvement_trend?: ImprovementTrend;
  next_session_focus?: string[];
  prediction?: string;
  error?: boolean;
}

export interface TreatmentRecord {
  date: string;
  area: string;
  treatment: string;
  pain: number;
  steps: number;
  sleep: number;
  hrv: number;
  note: string;
}

export interface Rank {
  id: string;
  label: string;
  labelEn: string;
  visits: number;
  color: string;
  glow: string;
  gradient: string;
  border: string;
  couponDiscount: number;
  pointRate: number;
  ecDiscount: number;
  referralBonus: number;
  perks: string[];
}

export const RANKS: Rank[] = [
  { id: "eternal_platinum", label: "永久プラチナ", labelEn: "ETERNAL PLATINUM", visits: 80, color: "#e0f0ff", glow: "#80c8ff", gradient: "linear-gradient(135deg,#0a2a50,#061828,#0a3560)", border: "#80c8ff", couponDiscount: 2000, pointRate: 10, ecDiscount: 20, referralBonus: 2000, perks: ["施術¥2,000 OFF（毎回）","通販20%OFF","ポイント10%還元","紹介ボーナス¥2,000","専任担当制","優先予約枠","特別イベント招待"] },
  { id: "platinum", label: "プラチナ", labelEn: "PLATINUM", visits: 50, color: "#f0e8ff", glow: "#c090ff", gradient: "linear-gradient(135deg,#2a1a4a,#160a2a,#3a1a5a)", border: "#c090ff", couponDiscount: 1500, pointRate: 7, ecDiscount: 15, referralBonus: 1500, perks: ["施術¥1,500 OFF（毎回）","通販15%OFF","ポイント7%還元","紹介ボーナス¥1,500","優先予約枠","バースデークーポン"] },
  { id: "gold", label: "ゴールド", labelEn: "GOLD", visits: 30, color: "#fff8e0", glow: "#ffd060", gradient: "linear-gradient(135deg,#3a2a00,#201800,#3a3000)", border: "#d4a030", couponDiscount: 1000, pointRate: 5, ecDiscount: 10, referralBonus: 1000, perks: ["施術¥1,000 OFF（毎回）","通販10%OFF","ポイント5%還元","紹介ボーナス¥1,000","先行商品案内"] },
  { id: "silver", label: "シルバー", labelEn: "SILVER", visits: 15, color: "#e8eff8", glow: "#90a8c8", gradient: "linear-gradient(135deg,#1a2030,#0e1520,#202838)", border: "#7090b8", couponDiscount: 700, pointRate: 3, ecDiscount: 7, referralBonus: 700, perks: ["施術¥700 OFF（毎回）","通販7%OFF","ポイント3%還元","紹介ボーナス¥700"] },
  { id: "bronze", label: "ブロンズ", labelEn: "BRONZE", visits: 5, color: "#f8ede0", glow: "#c08060", gradient: "linear-gradient(135deg,#2a1a0a,#180e06,#2a2010)", border: "#a07040", couponDiscount: 500, pointRate: 1, ecDiscount: 3, referralBonus: 500, perks: ["施術¥500 OFF（毎回）","通販3%OFF","ポイント1%還元","紹介ボーナス¥500"] },
];

export function getRank(visits: number): Rank | null {
  return RANKS.find(r => visits >= r.visits) || null;
}

export function getNextRank(visits: number): Rank | null {
  const i = RANKS.findIndex(r => visits >= r.visits);
  return i > 0 ? RANKS[i - 1] : null;
}

export const SAMPLE_CONVERSATION = `先生： お疲れ様です、田中さん。今日は腰がかなりお辛いということで。
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

export const HEALTH_DATA: HealthData = {
  steps: 1840,
  sleep: 5.2,
  heartRate: 72,
  hrv: 38,
  water: 0.6,
  stepsGoal: 8000,
  sleepGoal: 7.0,
};

export const DEMO_PRODUCTS: Product[] = [
  { id: "W001", name: "3D骨盤サポートベルト", price: 4980, category: "サポーター", desc: "デスクワーク中の姿勢維持に。薄手で着用感ゼロ。" },
  { id: "S001", name: "リカバリーMag（マグネシウム）", price: 3280, category: "サプリ", desc: "筋肉の弛緩と睡眠の質向上。就寝前1錠。" },
  { id: "S002", name: "電解質ウォーター concentrate", price: 2480, category: "ドリンク", desc: "水分補給の習慣化に。1本で1L分。" },
  { id: "W002", name: "腰椎クッション（低反発）", price: 5980, category: "器具", desc: "仰向け時に膝下へ。腰の反りを自然に補正。" },
];

export const TREATMENT_HISTORY: TreatmentRecord[] = [
  { date: "2026/03/09", area: "仙腸関節・腰部", treatment: "高周波＋手技（骨盤矯正）", pain: 7, steps: 1840, sleep: 5.2, hrv: 38, note: "急性腰痛。米袋持ち上げが誘因。大臀筋機能低下あり。" },
  { date: "2026/02/23", area: "腰部・臀部", treatment: "超音波＋ストレッチ指導", pain: 5, steps: 2100, sleep: 5.8, hrv: 42, note: "慢性疲労感。デスクワーク10h継続中。改善傾向なし。" },
  { date: "2026/02/09", area: "頸部・肩甲骨周囲", treatment: "手技（僧帽筋リリース）＋テーピング", pain: 6, steps: 3200, sleep: 6.0, hrv: 44, note: "PC作業増加による頸部痛。右側優位。" },
  { date: "2026/01/26", area: "腰部・仙腸関節", treatment: "電気治療＋骨盤矯正", pain: 4, steps: 4100, sleep: 6.5, hrv: 52, note: "腰部の鈍痛が再燃。睡眠不足の週と一致。" },
  { date: "2026/01/12", area: "膝関節・大腿四頭筋", treatment: "超音波＋テーピング", pain: 3, steps: 6800, sleep: 7.1, hrv: 58, note: "ランニング再開後の膝痛。筋力不足。" },
  { date: "2025/12/22", area: "腰部・腸腰筋", treatment: "手技（腸腰筋リリース）", pain: 5, steps: 2900, sleep: 5.5, hrv: 40, note: "年末繁忙期。長時間座位で腸腰筋短縮。" },
  { date: "2025/12/08", area: "肩関節・回旋筋腱板", treatment: "マニピュレーション＋アイシング", pain: 4, steps: 5200, sleep: 6.8, hrv: 55, note: "荷物運搬後の肩痛。可動域制限あり。" },
  { date: "2025/11/24", area: "頸部・腰部（初診）", treatment: "姿勢評価＋全身調整", pain: 6, steps: 3800, sleep: 6.2, hrv: 48, note: "初診。全体的な姿勢不良。骨盤前傾パターン。" },
];

export const PAST_TIMELINE_ITEMS = [
  { date: "2週間前", msg: "肩甲骨の緊張が改善。週3回ストレッチを続けてください。" },
  { date: "1ヶ月前", msg: "初診時より歩行バランスが15%改善しています。" },
];

export function statusColor(value: number, good: number, warn: number): string {
  if (value >= good) return "text-emerald-400";
  if (value >= warn) return "text-amber-400";
  return "text-red-400";
}

export function statusBg(value: number, good: number, warn: number): string {
  if (value >= good) return "bg-emerald-400";
  if (value >= warn) return "bg-amber-400";
  return "bg-red-400";
}

export function genWeeklyData() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
      steps: Math.floor(Math.random() * 5000 + 800),
    };
  });
}
