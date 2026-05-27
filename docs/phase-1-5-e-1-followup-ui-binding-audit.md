# VLUX Phase 1.5-E-1 Follow-up #1
## UI Binding / Patient API Security Audit

作成日：2026-05-27
対象：Phase 1.5-E-1 Follow-up #1 UI Binding / Patient API Security Audit
現在 HEAD：`41ede0d`
判定：**診断完了・実装修正は未着手**

---

## 1. 前提

Phase 1.5-E-1 Runtime Verification は **PASS 済み**である。

確認済み：

```txt
/patient/login HTTP 200
未ログイン /api/patient/me HTTP 401
patient.test01@vlux.local ログイン成功
/patient 遷移成功
SmartphoneView 表示成功
ログイン済み JWT 付き /api/patient/me HTTP 200
```

ただし Runtime Verification 後の追跡調査により、**UI 上はログイン患者本人データにバインドされていない**疑いが浮上した。本メモはその診断結果を実装修正**前**に記録するもの。

---

## 2. 監査結果

### 2-a. PatientApp（client/src/pages/patient.tsx）

| 観点 | 状態 |
|------|------|
| `useAuth` のインポート | ❌ なし |
| `/api/patient/me` の自動呼び出し | ❌ なし |
| `patient_id` / `user_id` を `SmartphoneView` に渡す | ❌ なし |

→ PatientApp は **Auth コンテキストを使わず**、SmartphoneView をただレンダリングしている。

### 2-b. SmartphoneView（client/src/components/smartphone-view.tsx）

| 観点 | 状態 |
|------|------|
| 患者情報取得 | `useQuery({ queryKey: ["/api/patient/profile"] })` |
| 呼び出し先 | **`/api/patient/profile`**（`/api/patient/me` ではない） |
| クーポン取得 | `fetch(`/api/coupons?patient_id=${profile!.id}`)` |
| `profile.id` の出所 | `/api/patient/profile` のレスポンス |

### 2-c. `/api/patient/profile`（server/routes.ts:1148）

| 観点 | 状態 |
|------|------|
| `requireAuth` の適用 | ❌ **なし**（第二引数欠如） |
| patient_id の決定方法 | `getDemoPatientId()` |
| `getDemoPatientId` の挙動 | `TEST_PATIENT_ID` env → なければ `getOrCreateDemoClinicAndPatient()`（VLUXデモクリニック + "タナカ ダイスケ"） |
| 返却列 | `id, clinic_id, name_kana, member_grade, gender, birth_date`（**PHI 含む**） |

### 2-d. 観測された patient_id

ブラウザ実機検証時の `/api/coupons?patient_id=...` のクエリパラメータに **`8704acf9-...`** が含まれていた。これは Phase 1.5-B 判断メモ（`docs/phase-1-5-b-patient-decision.md`）の **DEMO_ISOLATION_CANDIDATE**（VLUXデモクリニック所属、visits 26 件）と一致。

→ UI は **patient.test01（KEEP_AUTH_LINK_CANDIDATE: `bbbbbbbb-...`）ではなく、デモ患者（`8704acf9-...`）を表示している**ことが確定。

### 2-e. `/api/coupons?patient_id=...` の 500

| 観点 | 内容 |
|------|------|
| HTTP ステータス | 500 |
| 想定原因 | `coupons` テーブルが存在しない（Phase 1.5-B B-0 schema discovery で確認済み） |
| 切り分け | UI バインド問題とは**独立**、別タスク |

---

## 3. セキュリティ懸念（CLAUDE.md 最優先事項に抵触の可能性）

### 3-a. `/api/patient/profile` が無認証で PHI を返す

| 列 | 種別 | PHI 該当 |
|----|------|---------|
| `id` | UUID | ❌ |
| `clinic_id` | UUID | ❌ |
| `name_kana` | カナ氏名 | ⚠ **PHI** |
| `member_grade` | bronze/silver/gold | ❌ |
| `gender` | 性別 | ⚠ **PHI** |
| `birth_date` | 生年月日 | ⚠ **PHI** |

しかも実装は `_req` 引数（リクエスト無視）で、**誰でも** `curl http://host/api/patient/profile` で取得可能。

CLAUDE.md「患者データの不正アクセス・漏洩防止」最優先原則に抵触の可能性がある。

### 3-b. 同系統エンドポイントの状況

| エンドポイント | 認証 | PHI/医療情報の返却 |
|--------------|------|-------------------|
| `/api/patient/me`（Phase 1.5-E-1 新設） | ✅ `requireAuth` あり | ❌ なし（最小情報のみ） |
| `/api/patient/profile` | ❌ なし | ⚠ あり（カナ氏名 / 性別 / 生年月日） |
| `/api/patient/visits` | ❌ なし | ⚠ あり（主訴 / SOAP / 生活アドバイス） |
| `/api/patient/health-data` | ❌ なし | ⚠ あり（歩数 / 心拍 / 睡眠データ） |

→ Phase 1.5-E-1 で `/api/patient/me` は防御できたが、他の patient API ファミリーは無防備。

---

## 4. 切り分け

| 項目 | 評価 |
|------|------|
| `/api/patient/me` の認証境界 | ✅ Phase 1.5-E-1 PASS のまま |
| UI 全体のログイン本人バインド | ❌ **未完了**（デモ患者を表示） |
| `/api/coupons` 500 | ⚠ `coupons` テーブル不在による別タスク |
| `/api/patient/profile` / visits / health-data の PHI 漏洩可能性 | ⚠ 別 PR / フェーズで対処必要 |

→ Phase 1.5-E-1 Runtime Verification の **PASS 判定は維持**。本フォローアップは**スコープ外の追加課題**として記録。

---

## 5. 推奨修正方針

### 案 A：SmartphoneView を `/api/patient/me` 経由に切替（最小・限定的）
- smartphone-view.tsx の useQuery を `/api/patient/profile` → `/api/patient/me` に変更
- `/api/patient/me` の返却列を UI 要件に合わせて拡張するか判断
- PatientApp で `useAuth()` を使ってログイン状態確認
- 既存の `/api/patient/profile` はデモ用に残す or 削除

**メリット：** 最小差分
**デメリット：** `/api/patient/me` に PHI を加えると、Phase 1.5-E-1 設計と矛盾

### 案 B：`/api/patient/profile` 自体を認証化（広い影響、推奨）
- `/api/patient/profile` に `requireAuth` を適用
- 内部で `getDemoPatientId()` の代わりに `req.authUser.id` から `patients.user_id` 照合
- 同じパターンを `/api/patient/visits` / `/api/patient/health-data` にも適用
- SmartphoneView は既存のまま使える（URL も変えない）

**メリット：** UI 側変更最小、セキュリティ統一
**デメリット：** PR が大きい、既存デモ動作（未ログインアクセス）が壊れる → 移行戦略が必要

### 案 C：両方の混合（推奨実装）
Phase 1.5-E-2 の一部として：
1. `/api/patient/profile` / `/visits` / `/health-data` に `requireAuth` + `user_id` 照合
2. SmartphoneView で `useAuth()` で session 確認
3. coupons の 500 は別途 `coupons` テーブル不在で graceful return（`[]` を返す）

→ Phase 1.5-B 候補 C（`/api/coupons` の coupons テーブル不存在対応）と組み合わせ可。

---

## 6. 優先度

| 観点 | 判定 |
|------|------|
| PHI 漏洩可能性 | **高**（CLAUDE.md 最優先事項抵触の可能性） |
| 実害の有無 | Phase 1 β は 2〜3 院クローズドのため即時実害は限定的、ただし**設計上の早期解消推奨** |
| Phase 1.5-E-1 Runtime Verification への影響 | なし（PASS 維持） |
| ブロッカー性 | Phase 1.5-E-2 / E-3 着手前に対処すべき |

優先度：**高**。次フェーズ着手前に Phase 1.5-E-2 と統合して解消することを推奨。

---

## 7. 禁止・遵守事項（本ドキュメント作成時点）

- ✅ コード変更なし（read-only audit のみ）
- ✅ `.env.local` 中身表示なし
- ✅ secret / key / token 値の表示なし
- ✅ SQL 未実行
- ✅ Supabase Dashboard 操作なし
- ✅ 関係ないファイル変更なし

---

## 8. 関連 reference

- `docs/phase-1-5-e-1-patient-auth-minimum-complete.md` — Phase 1.5-E-1 実装完了メモ
- `docs/phase-1-5-e-1-runtime-verification-complete.md` — Phase 1.5-E-1 Runtime Verification 完了メモ
- `docs/phase-1-5-b-patient-decision.md` — 患者既存 6 件の取り扱い決定（DEMO_ISOLATION_CANDIDATE = `8704acf9-...`）
- `server/lib/supabaseService.ts` — Service Role 集約 + JWT 検証ヘルパー
- `server/middleware/requireAuth.ts` — Bearer JWT 検証ミドルウェア
- `server/routes.ts:1148` — `/api/patient/profile`（無認証 + デモ ID + PHI 返却の問題箇所）
- `client/src/components/smartphone-view.tsx:532` — `/api/patient/profile` 呼び出し箇所
- `client/src/pages/patient.tsx` — `useAuth` 未使用の PatientApp
