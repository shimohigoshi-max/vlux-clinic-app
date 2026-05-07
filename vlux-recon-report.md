# VLUX v3.1 — リポジトリ偵察レポート

---

## 1. ルートディレクトリの構造

### ルート直下（深さ1）

```
/
├── client/           ← フロントエンド（React + Vite）
├── server/           ← バックエンド（Express.js）
├── shared/           ← フロント・バック共通型定義
├── node_modules/
├── dist/             ← ビルド出力
├── script/           ← ビルドスクリプト
├── scripts/          ← 補助スクリプト
├── attached_assets/  ← 画像・ロゴアセット
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── drizzle.config.ts
├── components.json   ← shadcn/ui 設定
├── postcss.config.js
├── .replit           ← Replit 設定（デプロイ先: autoscale）
├── replit.md         ← プロジェクト概要
└── CLAUDE.md         ← AI エージェント向け仕様書
```

### package.json — scripts

```json
{
  "dev":      "NODE_ENV=development tsx server/index.ts",
  "build":    "tsx script/build.ts",
  "start":    "NODE_ENV=production node dist/index.cjs",
  "check":    "tsc",
  "db:push":  "drizzle-kit push"
}
```

### フレームワーク・ルーティング方式

| 項目 | 内容 |
|---|---|
| フロントエンド | React 18 + **Vite 7** |
| スタイリング | Tailwind CSS v3 + shadcn/ui |
| ルーティング | **wouter v3**（React Router ではない） |
| バックエンド | **Express.js v5**（Vite の開発サーバーと同一ポート 5000 で共存） |
| 型共有 | `shared/schema.ts`（Drizzle ORM + drizzle-zod） |

---

## 2. ページ・ルート一覧

### フロントエンド（`client/src/pages/`）

| ファイル | URL | 分類 | 根拠 |
|---|---|---|---|
| `home.tsx` | `/` | **共通（デモ用）** | 院側 iPad ビューと患者スマホビューを1画面で切り替えるデモ統合ページ |
| `clinic.tsx` | `/clinic` | **院側** | `IPadView` のみをレンダー。録音・カルテ生成・スタッフ管理など院内端末機能 |
| `patient.tsx` | `/patient` | **患者側** | `SmartphoneView` のみをレンダー。タイムライン・健康データ・EC 購入機能 |
| `not-found.tsx` | `*` | **共通** | 404 ページ |

### バックエンド API（`server/routes.ts`）

| エンドポイント群 | 分類 | 用途 |
|---|---|---|
| `POST /api/audio/upload` | 院側 | 録音ファイルを Supabase Storage へアップロード |
| `POST /api/transcribe` | 院側 | Whisper による音声文字起こし |
| `POST /api/summarize` | 院側 | AI（Haiku）による会話要約 |
| `POST /api/analyze` | 院側 | AI（Sonnet）によるフル SOAP カルテ生成 |
| `POST /api/correlate` | 院側 | AI による治療履歴×健康データ相関分析 |
| `GET/POST/DELETE /api/clinics` | 院側 | クリニック CRUD |
| `GET/POST/DELETE /api/staffs` | 院側 | スタッフ CRUD |
| `GET/POST/PATCH/DELETE /api/patients` | 院側 | 患者 CRUD |
| `POST /api/patients/invite` | 院側 | Twilio SMS 招待送信 |
| `GET/PATCH /api/admin/clinic` | 院側 | 管理画面向けクリニック情報 |
| `GET/POST/PATCH/DELETE /api/visits` | 院側 | 来院記録 CRUD |
| `GET/POST/DELETE /api/health-data` | 共通 | 健康データ CRUD |
| `POST /api/health-data/sync` | 患者側 | Google Fit 同期 |
| `GET/POST /api/coupons` | 患者側 | クーポン一覧・発行 |
| `GET /api/patient/profile` | 患者側 | デモ患者プロフィール |
| `GET /api/patient/visits` | 患者側 | 患者向け来院履歴 |
| `GET /api/patient/health-data` | 患者側 | 患者向け健康データ |
| `POST /api/dev/seed` | 共通（開発用）| テストデータ投入 |
| `GET /auth/google` / `/auth/google/callback` | 患者側 | Google OAuth 認証フロー |
| `GET/DELETE /api/google-fit/*` | 患者側 | Google Fit 接続状態・データ取得・切断 |

---

## 3. コンポーネント・ライブラリの分類

### 院側専用（`/clinic` のみで使用）

| ファイル | 内容 |
|---|---|
| `client/src/components/ipad-view.tsx` | iPad 院内端末 UI 本体（全 7 タブ：患者選択・音声入力・カルテ・治療履歴・相関分析・健康データ・通販売上） |

### 患者側専用（`/patient` のみで使用）

| ファイル | 内容 |
|---|---|
| `client/src/components/smartphone-view.tsx` | 患者スマホ UI 本体（全 4 タブ：タイムライン・健康データ・VLUXストア・VLUXスコア） |

### 共有（両側・または全体で使用）

| ファイル/ディレクトリ | 内容 |
|---|---|
| `client/src/lib/constants.ts` | 全型定義・定数・サンプルデータ・ランク計算関数（院側・患者側どちらも参照） |
| `client/src/lib/queryClient.ts` | TanStack Query クライアント + `apiRequest` ユーティリティ |
| `client/src/lib/utils.ts` | `cn()` などの Tailwind ユーティリティ |
| `client/src/components/ui/` | shadcn/ui プリミティブ全 45 コンポーネント（button, card, tabs など） |
| `shared/schema.ts` | Drizzle ORM スキーマ（フロント・バック共通型） |
| `server/supabase.ts` | Supabase クライアントファクトリ（`getSupabaseClient` / `getSupabaseAdmin`） |
| `server/routes.ts` | 全 API ルート（モノリシック、院側・患者側 API が混在） |
| `client/index.html` + `client/src/main.tsx` | エントリーポイント（共通） |
| `client/public/` | VLUX ロゴ画像・PWA manifest |

### 要判断

| ファイル | 判断が難しい理由 |
|---|---|
| `client/src/pages/home.tsx` | デモ統合ビューとして `/` に残っているが、院側と患者側の状態・ロジックを両方持っている。分割後に削除 or リダイレクト化すべきか検討が必要 |
| `server/routes.ts` | 院側 API と患者側 API が 1 ファイルに混在。分割デプロイ時は `/api/clinic/*` と `/api/patient/*` にネームスペースを分ける必要がある |
| `client/src/lib/constants.ts` | `DEMO_PRODUCTS`・`TREATMENT_HISTORY` など院側デモ用データと、`RANKS`・`PAST_TIMELINE_ITEMS` など患者側 UI 用データが同居している |

---

## 4. 環境変数・設定

### 変数名一覧（値なし）

| 変数名 | 利用箇所 |
|---|---|
| `SUPABASE_URL` | `server/supabase.ts`（Supabase 接続 URL） |
| `SUPABASE_PUBLISHABLE_KEY` | `server/supabase.ts`（Anon Key）|
| `SUPABASE_SERVICE_ROLE_KEY` | `server/supabase.ts`（Admin 用 Service Role Key） |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | `server/routes.ts`（Replit AI Integration 経由） |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | `server/routes.ts`（同上） |
| `OPENAI_API_KEY` | `server/routes.ts`（Whisper 文字起こし） |
| `SESSION_SECRET` | `server/index.ts`（Express セッション暗号化） |
| `TWILIO_ACCOUNT_SID` | `server/routes.ts`（SMS 招待） |
| `TWILIO_AUTH_TOKEN` | `server/routes.ts`（同上） |
| `TWILIO_PHONE_NUMBER` | `server/routes.ts`（同上） |
| `VITE_PWA_URL` / `PWA_URL` | `server/routes.ts`（患者招待 SMS の URL） |

> **`.env.example` ファイルは存在しない**。Replit の Secrets 管理（UI）で全変数を管理。

### 院側・患者側で分離が必要になりそうな変数

| 変数 | 理由 |
|---|---|
| `TWILIO_*` | 院側アプリからのみ SMS 招待を送るため、患者側デプロイには不要 |
| `AI_INTEGRATIONS_ANTHROPIC_*` / `OPENAI_API_KEY` | カルテ生成・文字起こしは院側のみ。患者側に渡す必要なし |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin 権限。院側バックエンドのみに限定すべき（患者側には Anon Key のみで十分） |
| `SESSION_SECRET` | Google Fit OAuth のセッション管理は患者側のみで必要 |

### Supabase の管理方法

- **現在の方式**：`server/supabase.ts` がサーバーサイドのみで Supabase クライアントを生成。フロントエンドは直接 Supabase に接続せず、全て Express の `/api/*` 経由でアクセス
- Anon Key (`SUPABASE_PUBLISHABLE_KEY`) と Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) の2種類を使い分け
- **クライアントサイドへの Supabase 直接露出なし**（VITE_ プレフィックスの Supabase 変数なし）

---

## 5. デプロイ設定

### `.replit` の deployment セクション

```toml
[deployment]
deploymentTarget = "autoscale"          # Replit Autoscale
run  = ["node", "./dist/index.cjs"]     # 本番起動コマンド
build = ["npm", "run", "build"]         # ビルドコマンド
publicDir = "dist/public"              # フロントエンド出力ディレクトリ
```

### ビルドの仕組み（`script/build.ts`）

- `tsx script/build.ts` で実行
- フロントエンド（Vite）+ バックエンド（esbuild）を1コマンドでバンドル
- 出力：`dist/public/`（フロント）+ `dist/index.cjs`（バック）

### 現在のデプロイ先

| 項目 | 値 |
|---|---|
| デプロイ先 | Replit Autoscale（`vercel.json` は存在しない） |
| 本番 URL | `https://app.vlux.health`（`server/routes.ts` の Google OAuth コールバックに明記） |
| 患者 PWA URL | `https://vlux.health`（`VITE_PWA_URL` のフォールバック値として routes.ts に明記） |
| ポート | 5000（内部）→ 80（外部公開） |
| 開発 URL パターン | `*.worf.replit.dev` |
