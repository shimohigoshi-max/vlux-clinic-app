export interface HealthData {
  steps: number;
  sleep: number;
  heartRate: number;
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

export interface AnalysisResult {
  chief_complaint?: string;
  findings?: string;
  treatment?: string;
  advice?: string[];
  patient_message?: string;
  recommended_products?: string[];
  reason?: string;
  error?: string;
}

export const SAMPLE_CONVERSATION = `先生： お疲れ様です、田中さん。今日は腰がかなりお辛いということで。
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

export const HEALTH_DATA: HealthData = {
  steps: 1840,
  sleep: 5.2,
  heartRate: 78,
  water: 0.6,
  stepsGoal: 8000,
  sleepGoal: 7.0,
};

export const DEMO_PRODUCTS: Product[] = [
  { id: "W001", name: "3D骨盤サポートベルト", price: 4980, category: "サポーター", desc: "デスクワーク中の姿勢維持に。薄手で着用感ゼロ。" },
  { id: "S001", name: "リカバリーMag（マグネシウム）", price: 3280, category: "サプリ", desc: "筋肉の弛緩と睡眠の質向上に。就寝前1錠。" },
  { id: "S002", name: "電解質ウォーター concentrate", price: 2480, category: "ドリンク", desc: "水分補給の習慣化に。1本で1L分。" },
  { id: "W002", name: "腰椎クッション（低反発）", price: 5980, category: "器具", desc: "仰向け時に膝下へ。腰の反りを自然に補正。" },
];

export const PRODUCT_ICON_MAP: Record<string, string> = {
  "W001": "shield",
  "S001": "sparkles",
  "S002": "droplets",
  "W002": "layers",
};

export const PAST_TIMELINE_ITEMS = [
  { date: "2週間前", msg: "肩甲骨周りの緊張が改善しています。週3回の肩回しストレッチを続けてください。", good: true },
  { date: "1ヶ月前", msg: "初診時より歩行バランスが15%改善。このまま継続しましょう。", good: true },
];
