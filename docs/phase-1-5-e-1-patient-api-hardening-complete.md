# VLUX Phase 1.5-E-1 Patient API Hardening Complete

作成日：2026-05-27
対象：Phase 1.5-E-1 Patient API Hardening
判定：**PASS**
現在 HEAD：`8000f48`

---

## 1. 背景

Phase 1.5-E-1 Runtime Verification により、以下は PASS 済みだった。

```txt
/patient/login HTTP 200
未ログイン /api/patient/me HTTP 401
ログイン済み JWT 付き /api/patient/me HTTP 200
```

しかし Follow-up #1 audit（`docs/phase-1-5-e-1-followup-ui-binding-audit.md`）により、以下の懸念が確認された：

- 患者 PWA UI（SmartphoneView）は `/api/patient/profile` を呼ぶが、`/api/patient/me` を呼ばない
- `/api/patient/profile` / `/visits` / `/health-data` は **`requireAuth` なし**で動作
- `getDemoPatientId()` 経由で**デモ患者**（DEMO_ISOLATION_CANDIDATE `8704acf9-...`）を返却
- 返却列に PHI（`name_kana` / `gender` / `birth_date`）を含むため、**無認証 PHI 漏洩**の可能性

本フェーズはこの懸念を解消する hardening 作業。

---

## 2. 関連 commit

| commit | 種別 | 内容 |
|--------|------|------|
| `0693fa1` | docs | record phase 1.5-e-1 follow-up ui binding audit（懸念の記録） |
| `8000f48` | fix | require patient auth for patient APIs（本タスクの実装） |

---

## 3. 実施内容

### 3-a. `/api/patient/profile` の認証化
- `requireAuth` ミドルウェア適用
- `getDemoPatientId()` 依存を撤去
- `req.authUser.id` → `patients.user_id` で本人 patient を解決
- `patients.deleted_at IS NULL` 必須
- `visits.deleted_at IS NULL` も付与（visit_count のカウント整合性）
- `.single()` → `.maybeSingle()` に変更し、見つからない時は 404 を明示返却

### 3-b. `/api/patient/visits` の認証化
- `requireAuth` ミドルウェア適用
- `getDemoPatientId()` 依存を撤去
- 共通ヘルパー `getAuthenticatedPatientId(userId)` 経由で本人 patient.id 解決
- `visits.deleted_at IS NULL` 付与

### 3-c. `/api/patient/health-data` の認証化
- `requireAuth` ミドルウェア適用
- `getDemoPatientId()` 依存を撤去
- 同ヘルパー経由で本人 patient.id 解決
- `health_data.deleted_at IS NULL` 付与

### 3-d. 共通ヘルパー追加

`server/routes.ts` に新規追加：

```typescript
async function getAuthenticatedPatientId(userId: string): Promise<string | null> {
  const { data, error } = await serviceClient
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}
```

### 3-e. `getDemoPatientId()` 関数本体について

- 関数本体は**残存**（`/api/dev/seed` および `/api/health-data/sync` がまだ参照）
- patient API 3 本からの依存だけ撤去
- これら 2 つの未対応箇所は別タスク扱い

---

## 4. 検証結果

### 4-a. ビルド・型チェック

| 項目 | 結果 |
|------|------|
| `npm run build` | ✅ 成功（1755 modules transformed） |
| client bundle hash | 不変（クライアント側未編集を裏付け） |
| server bundle | 955.2 → 955.9 KB（+0.7 KB、新規ヘルパー + 認証ロジック） |
| 既存 9 件の TypeScript エラー | 増減なし |

### 4-b. 未ログイン 401 smoke check（curl）

| エンドポイント | 修正前 | 修正後 |
|---------------|--------|--------|
| `/api/patient/me` | 401 ✅ | **401** ✅（変化なし） |
| `/api/patient/profile` | 200（デモデータ漏洩） ❌ | **401** ✅ |
| `/api/patient/visits` | 200（デモデータ漏洩） ❌ | **401** ✅ |
| `/api/patient/health-data` | 200（デモデータ漏洩） ❌ | **401** ✅ |

全 4 エンドポイントが未ログインで 401 + `{"error":"unauthorized"}` を返却。

### 4-c. ログイン済み 200 smoke check（ブラウザ実機）

| エンドポイント | 結果 |
|---------------|------|
| `/api/patient/profile` | ✅ 200 |
| `profileIdMatchesExpected`（KEEP_AUTH_LINK_CANDIDATE と一致） | ✅ **true** |
| `containsDemoPatientId`（`8704acf9-...` が含まれるか） | ✅ **false** |
| `/api/patient/visits` | ✅ 200 |
| `/api/patient/health-data` | ✅ 200 |

→ patient.test01 ログイン時、UI は**ログイン本人データ**（KEEP_AUTH_LINK_CANDIDATE = `bbbbbbbb-...`）にバインドされ、デモ患者（`8704acf9-...`）には**到達していない**。

---

## 5. セキュリティ判定

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| PHI 無認証取得 | ⚠ 可能（`/api/patient/profile` で `name_kana` / `gender` / `birth_date` 取得可能） | ✅ 不可（401） |
| 別患者データへのアクセス | ⚠ 可能（デモ患者にフォールバック） | ✅ 不可（`user_id` 厳密照合） |
| 論理削除済みデータの混入 | ⚠ 可能（フィルタなし） | ✅ 不可（`deleted_at IS NULL` 強制） |
| Phase 1.5-E-1 認証境界の整合 | `/api/patient/me` のみ防御 | **patient API ファミリー全体が防御** |

判定：**PASS**

---

## 6. follow-up（別タスク）

| # | 内容 | 優先度 |
|---|------|--------|
| 1 | `/api/coupons` の 500 エラー（`coupons` テーブル不在） | 中（UI は graceful return で動作中） |
| 2 | `server/lib/supabaseService.ts:110` の err ログを `err?.message` に絞る | 低（PHI / token 流出リスクは小さい） |
| 3 | `client/src/lib/queryClient.ts` の `buildAuthHeaders` 簡素化 | 低（未使用分岐の整理） |
| 4 | `/api/dev/seed` / `/api/health-data/sync` の `getDemoPatientId` 依存撤去 | 中（dev / sync 系の責務分離） |
| 5 | Phase 1.5-E-2：staff login / clinic 保護 + iPad ルート保護 | **次の主タスク候補** |

---

## 7. 制約遵守

- ✅ `.env.local` 中身表示なし
- ✅ secret / key / token 値の表示なし
- ✅ access_token / refresh_token 表示なし
- ✅ `.env.local` / バックアップは `.gitignore` で除外、git add せず
- ✅ SQL / Supabase Dashboard 操作なし
- ✅ coupons API 未修正
- ✅ 関係ないコード変更なし
- ✅ 通常 push（`--force` 系未使用）

---

## 8. 関連 reference

- `docs/phase-1-5-e-1-patient-auth-minimum-complete.md` — Phase 1.5-E-1 実装完了メモ
- `docs/phase-1-5-e-1-runtime-verification-complete.md` — Phase 1.5-E-1 Runtime Verification 完了メモ
- `docs/phase-1-5-e-1-followup-ui-binding-audit.md` — Follow-up #1 audit（本タスクのトリガー）
- `docs/phase-1-5-b-patient-decision.md` — 患者既存 6 件の取り扱い決定（KEEP_AUTH_LINK_CANDIDATE = `bbbbbbbb-...` がログイン対象）
- `server/middleware/requireAuth.ts` — Bearer JWT 検証ミドルウェア
- `server/lib/supabaseService.ts` — Service Role 集約 + JWT 検証ヘルパー
- `server/routes.ts:1123-1132` — `getAuthenticatedPatientId` ヘルパー（本タスクで追加）
- `server/routes.ts:1158, 1186, 1209` — 認証化された 3 エンドポイント
