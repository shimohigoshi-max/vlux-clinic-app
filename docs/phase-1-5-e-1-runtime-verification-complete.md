# VLUX Phase 1.5-E-1 Runtime Verification Complete

作成日：2026-05-27
対象：Phase 1.5-E-1 Patient Auth Minimum Runtime Verification
判定：**PASS**

---

## 1. 現在 HEAD

```txt
HEAD = 8a024bc
origin/main = 8a024bc
working tree = clean before this documentation commit
```

---

## 2. 関連 commit

| commit | 種別 | 内容 |
|--------|------|------|
| `37b040e` | feat | add patient login session and patient me endpoint |
| `e2e688e` | docs | record phase 1.5-e-1 patient auth minimum completion |
| `cc2c754` | chore | exclude local env files except .env.example |
| `b78beb5` | chore | add .env.example with required variable names |
| `8a024bc` | fix | enable reusePort only on linux |

---

## 3. 検証環境

| 項目 | 値 |
|------|-----|
| 実行マシン | Mac local |
| ポート | `PORT=5001`（macOS の ControlCenter が 5000 を占有していたため回避） |
| 環境変数 | `.env.local` 使用 |
| `.env.local` の Git 管理 | `.gitignore` の `.env.*` ルールにより**追跡対象外** |
| `.env.local.bak.before-supabase-url-protocol-fix` | 同上、Git 管理外 |
| Node | v24.9.0 |
| Vite | v7.3.0（middleware mode、単一ポートで API + SPA を配信） |

---

## 4. 検証結果

### 4-a. プログラム的に検証可能なステップ

| # | チェック項目 | 結果 |
|---|------------|------|
| 1 | `npm run build` | ✅ 成功（1755 modules transformed、既知 9 件 TS は変化なし） |
| 2 | dev server 起動（`PORT=5001 npm run dev`） | ✅ 成功（`serving on port 5001`） |
| 3 | `/patient/login` HTTP 応答 | ✅ **200**（SPA エントリ） |
| 4 | 未ログイン `/api/patient/me` HTTP 応答 | ✅ **401** + `{"error":"unauthorized"}` |

### 4-b. ブラウザ実機で確認したステップ

| # | チェック項目 | 結果 |
|---|------------|------|
| 5 | `patient.test01@vlux.local` でログイン | ✅ 成功 |
| 6 | `/patient` への遷移 | ✅ 成功 |
| 7 | `SmartphoneView` 表示 | ✅ 表示成功 |
| 8 | ログイン済み JWT 付き `/api/patient/me` | ✅ **HTTP 200** |
| 9 | レスポンスキー数 | ✅ **4 項目** |
| 10 | レスポンス内容 | ✅ `id` / `clinic_id` / `member_grade` / `created_at` の最小情報 |

### 4-c. 認証境界の実証

- `requireAuth` middleware は JWT 無しを 401 で確実に弾く
- JWT 付きリクエストは `patients.user_id` 照合で本人レコードのみ返却
- PHI（氏名・生年月日・電話・住所・性別）は API レスポンスに**含まれない**

---

## 5. セキュリティ遵守

| 項目 | 状態 |
|------|------|
| `access_token` / `refresh_token` の表示・記録 | ❌ なし |
| secret / key / token 値の表示・記録 | ❌ なし |
| `.env.local` の commit | ❌ していない（`.gitignore` で除外、`git check-ignore` で確認） |
| `.env.local.bak.*` の commit | ❌ していない（同上） |
| Service Role Key の経路 | `server/lib/supabaseService.ts` のみで参照、JWT 検証経路で間接利用 |
| Anon Key の経路 | クライアント側 `client/src/lib/supabase.ts` のみで参照 |
| URL 全文 / project ID 等の表示 | ❌ なし（diagnostic は `<REDACTED>` 等のラベルのみ） |

---

## 6. 判定

✅ **Phase 1.5-E-1 Runtime Verification PASS**

患者 PWA ログイン導線（`/patient/login` → `signInWithPassword` → `/patient`）と `/api/patient/me` の認証境界（JWT 必須・user_id 照合・PHI 不返却）は、Mac local + Supabase Auth + Replit-deployable な構成で正常動作することを実機で確認した。

---

## 7. follow-up（Phase 1.5-E-1 のブロッカーではない、別タスク）

検証中に観測された残課題：

| # | 観測内容 | 想定原因 | 切り分け方針 |
|---|---------|---------|-------------|
| 1 | 患者 PWA 画面が `/api/patient/me` を**自動呼び出ししていない**可能性 | TanStack Query のフックがログイン後にトリガーされていない、または useEffect 未設置 | 次タスクで `smartphone-view.tsx` / `patient.tsx` を read-only で確認 |
| 2 | 画面上の患者情報が既存**デモ患者データ**を参照している疑い | `DEMO_PRODUCTS` / `getDemoPatientId` 経由の旧データバインド残骸 | 「ログイン患者本人データへの UI バインド」を別タスク化 |
| 3 | `/api/coupons?patient_id=8704...` が **500** を返している | `coupons` テーブルが存在しない（Phase 1.5-B B-0 schema discovery で確認済み） | 「coupon API 500」は coupons テーブル設計と分離して扱う |

これらはいずれも **Phase 1.5-E-1 認証境界 PASS のブロッカーではない**。Phase 1.5-E-1 のスコープは「ログイン → JWT 取得 → 認証境界の 1 本目を通る」までであり、UI バインド・coupon は別 PR / 別フェーズで対応する。

---

## 8. 関連 reference

- `docs/phase-1-5-a-complete.md` — Phase 1.5-A staff Auth 接続確認 完了メモ
- `docs/phase-1-5-b-patient-decision.md` — 患者既存 6 件の取り扱い決定（patient.test01 接続候補）
- `docs/phase-1-5-c-complete.md` — Phase 1.5-C 前処理 Service Role Key 集約 完了メモ
- `docs/phase-1-5-e-1-patient-auth-minimum-complete.md` — Phase 1.5-E-1 実装完了メモ
- `server/lib/supabaseService.ts` — Service Role 集約 + JWT 検証ヘルパー
- `server/middleware/requireAuth.ts` — Bearer JWT 検証ミドルウェア
- `server/routes.ts` — `/api/patient/me` 実装箇所（`requireAuth` 適用先）
