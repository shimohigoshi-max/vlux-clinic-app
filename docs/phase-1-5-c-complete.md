# VLUX Phase 1.5-C前処理 Service Role Key 集約 完了メモ

**完了日：** 2026-05-22
**commit：** `c41494f`
**対象作業：** Phase 1.5-C 前処理（Service Role Key 集約）

---

## 結論

- Service Role Key の参照経路は **`server/lib/supabaseService.ts` に一本化済み**
- `server/supabase.ts` は**完全削除済み**
- `server/routes.ts` の `getSupabaseAdmin()` **30 箇所は `serviceClient` に置換済み**
- Mac mini local `main` / GitHub `origin/main` は `c41494f` で **同期済み**
- working tree **clean**

---

## 実施内容

- `server/supabase.ts` を完全削除
- `server/routes.ts` の import を `getSupabaseAdmin` から `serviceClient` に差し替え
- `const supabase = getSupabaseAdmin();` を `const supabase = serviceClient;` に置換
- `const admin = getSupabaseAdmin();` を `const admin = serviceClient;` に置換
- `SUPABASE_SERVICE_ROLE_KEY` / `createClient()` の実体を `server/lib/supabaseService.ts` に集約

---

## 検証結果

| チェック項目 | 結果 |
|--------------|------|
| `git status --short` | 空 |
| branch | `main` |
| HEAD | `c41494f` |
| `origin/main` | `c41494f` |
| `SUPABASE_SERVICE_ROLE_KEY` の出現箇所 | `server/lib/supabaseService.ts` のみ |
| `createClient(` の出現箇所 | `server/lib/supabaseService.ts` のみ |
| `getSupabaseAdmin` / `getSupabaseClient` | 0 件 |
| `from "./supabase"` | 0 件 |
| `npm run build` | 成功 |
| `npm run check` | 既知 9 件のまま（増減なし） |

---

## 未対応（後続で扱う）

### 既知 9 件の TypeScript errors（Phase 1.5-C 集約とは無関係、継続）

- `smartphone-view.tsx` Coupon 型不整合 — 1 件
- `batch utils` AbortError / p-retry API 変更 — 2 件
- `chat routes` / `storage` 関連 — 6 件

### その他の後続タスク

- chat persistence は未着手
- patient 既存 6 件の取り扱いは未決定
- JWT middleware 横断適用は未着手
- RLS 結合検証は未着手
- フロント Auth UI は未着手
- Twilio は不採用のまま（patient SMS OTP は後続フェーズで日本 SMS + Supabase Send SMS Hook）

---

## 関連 reference

- `docs/phase-1-5-a-complete.md` — Phase 1.5-A staff Auth 接続確認 完了メモ
- `server/lib/supabaseService.ts` — Service Role 集約ファイル（本タスクの一本化先）
- `phase2_rls_apply.sql` — Phase 2 RLS 適用 SQL（未適用）
