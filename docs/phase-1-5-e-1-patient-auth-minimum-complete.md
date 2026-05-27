# VLUX Phase 1.5-E-1 Patient PWA Auth Minimum Implementation Complete

作成日：2026-05-27
対象：Phase 1.5-E-1 患者PWAログイン最小実装
対象commit：`37b040e feat(auth): add patient login session and patient me endpoint`

---

## 1. 目的

Phase 1.5-E-1 の目的は、患者 PWA 側に Supabase Auth session を保持する最小構造を追加し、`patient.test01` の JWT を使ってサーバー API へ到達できる**最初の認証境界**を作ること。

今回の到達点は以下。

```txt
patient.test01 でログイン
↓
React 側で Supabase Auth session を保持
↓
/patient へ遷移
↓
API リクエストに Authorization: Bearer <token> を自動付与
↓
/api/patient/me で本人 patient 最小情報だけを返す
```

---

## 2. 実装内容

| ファイル | 種別 | 内容 |
|----------|------|------|
| `client/src/lib/supabase.ts` | 新規 | Anon Key client、`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を参照、未設定時は名前のみで throw |
| `client/src/hooks/use-auth.tsx` | 新規 | `AuthProvider` / `useAuth()`、`session` / `user` / `loading` / `signInWithPassword` / `signOut` を提供。`onAuthStateChange` を購読 |
| `client/src/pages/login-patient.tsx` | 新規 | Email + Password フォーム、成功時 `/patient` 遷移、失敗時はエラー表示 |
| `client/src/App.tsx` | 編集 | `AuthProvider` でラップ、`/patient/login` ルート追加、`/patient` を `<PatientProtected>` で保護、loading 中は `Loading…` 表示 |
| `client/src/lib/queryClient.ts` | 編集 | `buildAuthHeaders()` を追加。session があれば `Authorization: Bearer <token>` を自動付与。既存挙動（`credentials: "include"`、`on401`）を維持 |
| `server/middleware/requireAuth.ts` | 新規 | `getUserFromToken` 経由で Bearer JWT を検証、`req.authUser` に `id` / `email` を格納、失敗時は 401 JSON |
| `server/routes.ts` | 編集 | `import { requireAuth }` 追加、`/api/patient/me` を新設（**requireAuth はこの 1 本のみ**） |

---

## 3. 認証境界

### 3-a. クライアント側

| 境界 | 挙動 |
|------|------|
| `/patient`（未ログイン） | `<PatientProtected>` が `useEffect` で `/patient/login` へリダイレクト |
| `/patient/login` | Email + Password で `signInWithPassword` を呼ぶ |
| `/patient/login`（既ログイン） | 自動で `/patient` へ遷移（再ログイン不要） |
| Supabase session | React Context（`AuthProvider`）で全体共有、`onAuthStateChange` で同期 |
| TanStack Query 経由の API | session の `access_token` があれば `Authorization: Bearer <token>` を自動付与 |

### 3-b. サーバー側

| 境界 | 挙動 |
|------|------|
| `/api/patient/me` | **`requireAuth` 適用**。JWT 無し / 無効なら 401 |
| JWT 検証経路 | `serviceClient.auth.getUser(token)`（独自 decode は使わない） |
| user_id 照合 | `req.authUser.id` を `patients.user_id` と `.eq` で厳密一致 |
| 論理削除フィルタ | `.is("deleted_at", null)` で SOFT_DELETE_CANDIDATE を除外 |
| 既存 30+ エンドポイント | **middleware 未適用**。これまでどおり Service Role 動作 |

---

## 4. /api/patient/me の返却仕様

### 返す（最小フィールド）

| 列 | 種別 |
|----|------|
| `id` | 患者 UUID |
| `clinic_id` | クリニック UUID |
| `member_grade` | bronze / silver / gold |
| `created_at` | 登録時刻 |

### 返さない（PHI を完全に除外）

| 列 | 種別 |
|----|------|
| 氏名 | （`name_kana`） |
| カナ | （`name_kana`） |
| 電話番号 | （`phone`） |
| 住所 | （`address`） |
| 生年月日 | （`birth_date`） |
| 性別 | （`gender`） |

### HTTP レスポンス

| ステータス | 条件 | ボディ |
|-----------|------|--------|
| 200 | 認証成功 + 該当 patient 存在 + `deleted_at` NULL | `{ id, clinic_id, member_grade, created_at }` |
| 401 | Authorization 欠如 or JWT 無効 | `{ error: "unauthorized" }` |
| 404 | 認証通過したが対応する patients 行なし | `{ error: "patient not found" }` |
| 500 | DB アクセスエラー | `{ error: <message> }` |

---

## 5. 検証結果

| 項目 | 結果 |
|------|------|
| `npm run build` | ✅ 成功（client 680.94 KB / server 955.2 KB） |
| `npm run check` | ✅ 既知 9 件のまま（増減なし） |
| Phase 1.5-E-1 起因の TypeScript エラー | **0 件** |
| security review | ✅ PASS（重大指摘なし） |
| token / secret のログ出力 | ✅ なし（新規コードに `console.*` 0 件） |
| middleware の過剰適用 | ✅ なし（`/api/patient/me` の 1 箇所のみ） |
| PHI の漏洩 | ✅ なし（返却列は識別子と grade のみ） |
| 既存 API の動作互換性 | ✅ 維持（`credentials: "include"` / `on401` 不変） |

---

## 6. 既知の注意点

| 項目 | 内容 |
|------|------|
| 環境変数の依存 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が実行環境に**無い**と、起動時に `supabase.ts` の throw が発火して画面が真っ白になる |
| 環境変数の確認 | Replit / Vercel Secrets の存在確認が次タスク（Mac mini ローカルの `.env` / shell には未注入） |
| staff login / clinic 保護 | 未実装。Phase 1.5-E-2 以降で対応 |
| 既存 30+ API | まだ Service Role 前提で動作。middleware は未適用（段階導入方針） |
| `server/lib/supabaseService.ts` の err ログ | `console.error('[getUserFromToken] 例外:', err)` は err オブジェクトをそのまま出すため、SDK 実装次第で token 値が間接的に漏れる可能性。`err?.message` への絞り込みは後続 PR で |
| `client/src/lib/queryClient.ts` の `buildAuthHeaders` | `Headers` / `Array` 形式分岐は現状未使用。簡素化は後続候補 |
| Anon Key の扱い | Anon Key は「公開を許容するキー」（RLS で守る前提）。Service Role Key とは扱いが違うことに注意 |

---

## 7. 次の推奨タスク

**Phase 1.5-E-1 Runtime Verification**（実機動作確認）

| # | 確認項目 | 期待結果 |
|---|---------|---------|
| 1 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` の存在 | Replit / Vercel Secrets に登録済み |
| 2 | `npm run dev` で起動 | エラーなく起動 |
| 3 | `/patient/login` 表示確認 | ログインフォームが描画される |
| 4 | `patient.test01` でログイン | `signInWithPassword` 成功、エラー表示なし |
| 5 | `/patient` への遷移 | ログイン直後に PatientApp が表示される |
| 6 | `/api/patient/me` 呼び出し | 200 + `{ id, clinic_id, member_grade, created_at }` の最小情報のみ |
| 7 | 未ログイン時の `/api/patient/me` | 401 + `{ error: "unauthorized" }` |

---

## 8. 関連 reference

- `docs/phase-1-5-a-complete.md` — Phase 1.5-A staff Auth 接続確認 完了メモ
- `docs/phase-1-5-c-complete.md` — Phase 1.5-C 前処理 Service Role Key 集約 完了メモ
- `docs/phase-1-5-b-patient-decision.md` — 患者既存 6 件の取り扱い決定（KEEP_AUTH_LINK_CANDIDATE が今回の `patient.test01` 接続先）
- `server/lib/supabaseService.ts` — Service Role 集約ファイル + JWT 検証ヘルパー
- `phase2_rls_apply.sql` — Phase 2 RLS 適用 SQL（未適用、本フェーズの認証境界とは独立）
