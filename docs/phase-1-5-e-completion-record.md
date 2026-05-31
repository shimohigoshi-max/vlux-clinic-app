# VLUX Phase 1.5-E 統合完了記録

作成日：2026-05-30
追記更新日：2026-05-31（E-2-5 AI / 音声 API hardening 実装完了を反映）
対象：Phase 1.5-E（フロント Auth UI / セッション接続 / API 認証境界）全体
ステータス：**PASS with documented deferrals**
現在地：HEAD = `bb4b8d6`、local main = origin/main = `bb4b8d6`、working tree clean
変更種別：documentation only（コード変更なし）

---

## 0. 結論

Phase 1.5-E は以下の判定で完了とする。

```txt
✅ patient login / session 接続 = PASS
✅ patient API hardening = PASS
✅ owner fallback 撤去 = PASS
✅ staff login / clinic protect / StaffProtected = PASS
✅ /api/staff/me = PASS
✅ staff / clinic admin API hardening = PASS
✅ patient / visits API hardening + 論理削除化 = PASS
✅ owner-role positive runtime verification（C-2）= PASS
✅ logout + anon 401 verification = PASS
✅ AI / 音声 API hardening = PASS（cf3879f で実装、bb4b8d6 で完了 docs）
⚠ yamada exact owner JWT verification = deferred（Phase 2 再構築時）
⚠ staff / reception positive runtime check = deferred
⚠ 本物 analyze 1 回（Claude 実呼び出し）= deferred
```

これにより、**Phase 1 βテスト前の最重要関門である「フロント Auth UI / セッション接続」「API 認証境界」「マルチテナント分離」**は確立された。

---

## 1. 完了したサブフェーズと判定

### E-1：Patient PWA Auth + patient API hardening

| 項目 | 状態 |
|------|------|
| Supabase client（Anon Key、persistSession） | ✅ `client/src/lib/supabase.ts` |
| `useAuth` hook / `AuthProvider` | ✅ `client/src/hooks/use-auth.tsx` |
| `/patient/login` UI | ✅ `client/src/pages/login-patient.tsx` |
| `/patient` 保護（`PatientProtected`） | ✅ `client/src/App.tsx` |
| TanStack Query への Authorization 自動付与 | ✅ `client/src/lib/queryClient.ts` |
| `server/middleware/requireAuth.ts` | ✅ JWT 検証 |
| `GET /api/patient/me` | ✅ PHI を返さない最小エンドポイント |
| `/api/patient/profile` / `/visits` / `/health-data` 認証化 | ✅ E-1 hardening 完了 |
| Runtime Verification（patient.test01 実ログイン） | ✅ PASS |
| Follow-up audit（UI バインド / PHI 漏洩懸念） | ✅ 監査 + hardening 完了 |

### E-2-1：owner fallback 撤去

| 項目 | 状態 |
|------|------|
| `currentRole ?? "owner"` 危険フォールバック撤去 | ✅ |
| role 未解決時は `null` → 全 tabs 非表示 / 設定歯車非表示 | ✅ |
| build / check 既知 9 件のまま | ✅ |

### E-2-2：staff login + clinic protect + /api/staff/me

| 項目 | 状態 |
|------|------|
| `/clinic/login` UI | ✅ `client/src/pages/login-staff.tsx` |
| `StaffProtected` コンポーネント | ✅ `/api/staff/me` 二段判定 |
| `/clinic` 保護 | ✅ `client/src/App.tsx` |
| `requireStaffAuth` middleware | ✅ JWT 検証 + staffs.user_id 照合 + clinic owner_id NULL は 403 |
| `GET /api/staff/me` | ✅ staff / clinic 最小情報を返却 |
| 未ログイン 401 / patient JWT 403 | ✅ smoke check 確認 |

### E-2-3：staff / clinic admin API hardening（5 本）

| API | role 制御 | clinic スコープ |
|-----|----------|----------------|
| `GET /api/admin/clinic` | all | ✅ staffContext.clinicId 強制 |
| `PATCH /api/admin/clinic` | owner only | ✅ |
| `GET /api/staffs` | all | ✅ query clinic_id 無視 |
| `POST /api/staffs` | owner only | ✅ body clinic_id 上書き |
| `DELETE /api/staffs/:id` | owner only | ✅ clinic 一致 + 自己削除禁止 + 最後の owner 削除禁止 |

未ログイン 401 / patient JWT 403 PASS。

### E-2-4：patient / visits API hardening（5 本 + 論理削除化）

| API | role 制御 | clinic スコープ | 追加防御 |
|-----|----------|----------------|---------|
| `GET /api/patients` | all | ✅ deleted_at NULL | — |
| `POST /api/patients` | all | ✅ body clinic_id 上書き | — |
| `GET /api/visits` | all | ✅ patient_id 検証 | deleted_at NULL |
| `PATCH /api/visits/:id` | owner / staff | ✅ visit clinic 一致確認 | 二重ガード |
| `DELETE /api/visits/:id` | owner only | ✅ clinic 一致確認 | **物理 DELETE → 論理削除化**（deleted_at / deleted_by / delete_reason） |

未ログイン 401 / patient JWT 403 PASS。

### E-2-5：AI / 音声 API hardening（**完了、2026-05-31 追記**）

| API | role 制御 | clinic スコープ | patient スコープ | 追加変更 |
|-----|----------|----------------|----------------|---------|
| `POST /api/audio/upload` | owner / staff | ✅ staffContext.clinicId 強制（X-Clinic-Id 無視）| ✅ X-Patient-Id を verify | filePath を ctx.clinicId 経路に統一 |
| `POST /api/transcribe` | owner / staff | — | — | direct fetch に Authorization Bearer 付与 |
| `POST /api/summarize` | owner / staff | — | — | rate limit 維持 |
| `POST /api/analyze` | owner / staff | ✅ staffContext.clinicId 強制（body.clinic_id 無視）| ✅ body.patient_id 必須化 + verify | **demo fallback 撤去** |
| `POST /api/correlate` | owner / staff | — | — | rate limit 維持 |

証跡チェーン：

```txt
cb1e3b6  docs: record phase 1.5-e-2-5 ai audio api audit            （audit、2026-05-28）
cf3879f  fix(auth): protect ai audio staff APIs                      （実装、2026-05-31）
bb4b8d6  docs: record phase 1.5-e-2-5 ai audio api hardening         （完了 docs、2026-05-31）
```

未ログイン 5 本 401 / patient JWT 5 本 403 "not a staff" PASS。AI コスト 0、DB 影響 0、regression なし。

### E-5：owner real JWT runtime verification

| 項目 | 状態 |
|------|------|
| yamada exact owner JWT 検証 | ⚠ **deferred**（Dashboard UI 制約 + `.local` ドメイン + service_role 禁止のため） |
| owner-role positive runtime verification（C-2 方式） | ✅ PASS |
| logout + anon 401 | ✅ PASS |
| rollback（検証用 staff row DELETE + Dashboard Delete user） | ✅ 完全成功、既存データ無傷 |
| DB 層 RLS シミュレーション補助証跡（Table Editor） | ✅ Appendix A 記録 |

---

## 2. 完了した認証境界（API レベル）

### 防御済みエンドポイント

| エンドポイント | middleware | role | clinic scope | hardening commit |
|-------------|-----------|------|-------------|------------------|
| `GET /api/patient/me` | requireAuth | — | user_id 照合 | E-1（`37b040e`）|
| `GET /api/patient/profile` | requireAuth | — | user_id 照合 | E-1 hardening（`8000f48`）|
| `GET /api/patient/visits` | requireAuth | — | user_id 照合 | E-1 hardening |
| `GET /api/patient/health-data` | requireAuth | — | user_id 照合 | E-1 hardening |
| `GET /api/staff/me` | requireStaffAuth | — | staffContext | E-2-2（`bb0c91f`）|
| `GET /api/admin/clinic` | requireStaffAuth | all | staffContext.clinicId | E-2-3（`736c0d2`）|
| `PATCH /api/admin/clinic` | requireStaffAuth | owner | staffContext.clinicId | E-2-3 |
| `GET /api/staffs` | requireStaffAuth | all | staffContext.clinicId（query 無視）| E-2-3 |
| `POST /api/staffs` | requireStaffAuth | owner | staffContext.clinicId（body 上書き）| E-2-3 |
| `DELETE /api/staffs/:id` | requireStaffAuth | owner | clinic 一致 + 自己 / 最後 owner 削除禁止 | E-2-3 |
| `GET /api/patients` | requireStaffAuth | all | staffContext.clinicId | E-2-4（`c18c761`）|
| `POST /api/patients` | requireStaffAuth | all | body clinic_id 上書き | E-2-4 |
| `GET /api/visits` | requireStaffAuth | all | clinic + patient_id 検証 | E-2-4 |
| `PATCH /api/visits/:id` | requireStaffAuth | owner / staff | visit clinic 一致確認 | E-2-4 |
| `DELETE /api/visits/:id` | requireStaffAuth | owner | clinic 一致 + 論理削除 | E-2-4 |
| `POST /api/audio/upload` | requireStaffAuth | owner / staff | staffContext.clinicId 強制 + X-Patient-Id verify | E-2-5（`cf3879f`）|
| `POST /api/transcribe` | requireStaffAuth | owner / staff | — | E-2-5 |
| `POST /api/summarize` | requireStaffAuth | owner / staff | — | E-2-5 |
| `POST /api/analyze` | requireStaffAuth | owner / staff | staffContext.clinicId 強制 + body.patient_id verify + demo fallback 撤去 | E-2-5 |
| `POST /api/correlate` | requireStaffAuth | owner / staff | — | E-2-5 |

### 未防御エンドポイント（次フェーズ対象）

| エンドポイント | 推奨 hardening |
|-------------|--------------|
| `PATCH /api/patients/:id` | requireStaffAuth + role + clinic 一致 |
| `DELETE /api/patients/:id` | requireStaffAuth + owner + clinic 一致 + 論理削除 |
| `POST /api/patients/invite` | requireStaffAuth + clinic 一致 |
| `POST /api/visits` | requireStaffAuth + clinic 強制 + patient 検証 |
| `GET /api/health-data` / `POST` / `DELETE` | API 層 clinic スコープ未適用 |
| `POST /api/health-data/sync` | patient PWA 由来、requireAuth（patient JWT）|
| `POST /api/coupons/issue` / `GET /api/coupons` | coupons テーブル不在問題と統合 |
| `GET /api/clinics` / `POST` / `DELETE /:id` | システム admin 層、Phase 2 multi-tenant 設計 |

---

## 3. 検証方式と PASS 一覧

### 自動化された smoke check（CLI curl）

```txt
未ログイン /api/patient/me              → 401  ✅
未ログイン /api/patient/profile         → 401  ✅
未ログイン /api/patient/visits          → 401  ✅
未ログイン /api/patient/health-data     → 401  ✅
未ログイン /api/staff/me                → 401  ✅
未ログイン /api/admin/clinic            → 401  ✅
未ログイン /api/staffs                  → 401  ✅
未ログイン /api/patients                → 401  ✅
未ログイン /api/visits                  → 401  ✅
未ログイン PATCH /api/admin/clinic      → 401  ✅
未ログイン POST  /api/staffs            → 401  ✅
未ログイン DELETE /api/staffs/:id       → 401  ✅
未ログイン PATCH /api/visits/:id        → 401  ✅
未ログイン DELETE /api/visits/:id       → 401  ✅
未ログイン POST  /api/audio/upload      → 401  ✅  （E-2-5）
未ログイン POST  /api/transcribe        → 401  ✅  （E-2-5）
未ログイン POST  /api/summarize         → 401  ✅  （E-2-5）
未ログイン POST  /api/analyze           → 401  ✅  （E-2-5）
未ログイン POST  /api/correlate         → 401  ✅  （E-2-5）
```

### ブラウザ実機検証（patient.test01 JWT）

```txt
/api/patient/me      → 200 + 最小情報   ✅
/api/patient/profile → 200             ✅
/api/patient/visits  → 200             ✅
/api/patient/health-data → 200         ✅
/api/staff/me        → 403 not a staff ✅
/api/admin/clinic    → 403 not a staff ✅
/api/staffs          → 403 not a staff ✅
/api/patients        → 403 not a staff ✅
/api/visits          → 403 not a staff ✅
/api/audio/upload    → 403 not a staff ✅  （E-2-5）
/api/transcribe      → 403 not a staff ✅  （E-2-5）
/api/summarize       → 403 not a staff ✅  （E-2-5）
/api/analyze         → 403 not a staff ✅  （E-2-5）
/api/correlate       → 403 not a staff ✅  （E-2-5）
```

### E-2-5 補足（build / typecheck / コスト / DB 影響）

```txt
npm run build          : 成功（client 不変、server 958.7 → 959.0 KB +0.3 KB）
npm run check          : 既知 9 件のまま、新規 0 件
AI / OpenAI コスト     : 0 円（minimal body smoke で外部 API 未呼び出し）
DB 影響                : 0 行（新規 visit / patient / clinic / staff / health_data 変更なし）
regression             : なし（既存 11 本がすべて 401 維持）
```

### ブラウザ実機検証（owner-role JWT、C-2 方式）

```txt
/api/staff/me        → 200, role=owner                          ✅
/api/admin/clinic    → 200, name=堺整骨院（テスト）             ✅
/api/staffs          → 200, arrayLen=4, 全 clinic_id=aaaaaaaa-… ✅
/api/patients        → 200, arrayLen=1, id=bbbbbbbb-…           ✅
/api/visits          → 200, arrayLen=1, clinic_id=aaaaaaaa-…    ✅
```

### Logout + anon 401（C-2 後）

```txt
lingeringTokenInLocalStorage = false ✅
5 本すべて 401                       ✅
```

### DB 層 RLS（補助証跡）

```txt
Supabase Table Editor で role=authenticated / user=yamada
  → public.health_data は bbbbbbbb-... の 7 件のみ表示
  → 8704acf9-... の health_data は非表示
  → DB 層 RLS は yamada owner JWT 相当コンテキストで期待どおり動作 ✅
```

---

## 4. Deferred 項目

### 4.1 yamada exact owner JWT verification

| 項目 | 内容 |
|------|------|
| 状態 | deferred |
| 理由 | Supabase Dashboard UI に password 直接設定 UI / email 編集 UI / Auto-confirm トグルが見当たらず、`.local` ドメインでメール受信不可。service_role / Auth Admin API / auth.users 直接 SQL 更新は CLAUDE.md セキュリティルールにより禁止 |
| 代替 | C-2 で owner-role positive runtime verification を実施（`docs/phase-1-5-e-5-owner-real-jwt-verification.md`） |
| 補助証跡 | Table Editor RLS シミュレーション |
| 再検証予定 | Phase 2 で日本 SMS provider + Supabase Send SMS Hook 導入時 |

### 4.2 staff / reception positive runtime check

| 項目 | 内容 |
|------|------|
| 状態 | deferred |
| 対象 | sato / tanaka の実ログイン + role 別 API 挙動の確認 |
| 推奨手段 | C-2 と同様の手法（新 Auth user + 一時 staff row）または既存 user の password 設定後に直接ログイン |

---

## 5. 残課題（次フェーズの優先順位）

### 5.1 AI / 音声 API hardening（E-2-5 implementation）— **完了済み（2026-05-31 追記）**

```txt
✅ 完了：cf3879f で 5 endpoint hardening 実装、bb4b8d6 で完了 docs
対象：
  POST /api/audio/upload       requireStaffAuth + clinic 強制 + patient_id verify  ✅
  POST /api/transcribe         requireStaffAuth + role (owner/staff)               ✅
  POST /api/summarize          requireStaffAuth + role                             ✅
  POST /api/analyze            requireStaffAuth + clinic + patient_id verify       ✅
                               getOrCreateDemoClinicAndPatient fallback 撤去       ✅
  POST /api/correlate          requireStaffAuth + role                             ✅
副次：
  client/src/pages/clinic.tsx の audio/upload / transcribe fetch に Authorization Bearer 手動付与  ✅
```

→ 詳細は `docs/phase-1-5-e-2-5-ai-audio-api-hardening-complete.md` 参照。

### 5.2 残り PHI 系 API hardening

```txt
PATCH /api/patients/:id        requireStaffAuth + role + clinic 一致 + 論理削除化候補
DELETE /api/patients/:id       requireStaffAuth + owner + 論理削除化
POST  /api/patients/invite     requireStaffAuth + clinic 一致 + SMS 連動見直し
POST  /api/visits              requireStaffAuth + clinic 強制 + patient verify
GET   /api/health-data         requireStaffAuth + clinic スコープ
POST  /api/health-data         requireStaffAuth + clinic + patient verify
DELETE /api/health-data/:id    requireStaffAuth + owner + 論理削除化
POST  /api/health-data/sync    requireAuth（patient PWA 由来）
DELETE /api/visits/:id 周辺の物理 DELETE 残存（staffs / clinics / patients / health_data）も論理削除化検討
```

### 5.3 follow-up 残課題（既知の小規模改善）

| 項目 | 内容 | 規模 |
|------|------|------|
| **staff JWT positive runtime check** | E-2-5 対象 5 endpoint で staff JWT 非 401 / 期待動作確認、deferred 中 | 軽量 |
| **本物 analyze 1 回（Claude 実呼び出し）** | bbbbbbbb-... patient で 1 visit 作成、AI コスト発生 | 軽量 |
| coupons 500 graceful return | `coupons` テーブル不在による 500 を `[]` 返却に切替 | 軽量 |
| `getDemoPatientId` 残存整理 | `/api/dev/seed` / `/api/health-data/sync` 等に残る demo fallback を撤去 | 軽量 |
| `getUserFromToken` err logging | `server/lib/supabaseService.ts:110` の `console.error('[getUserFromToken] 例外:', err)` を `err?.message` に絞る | 軽量 |
| `buildAuthHeaders` simplification | `client/src/lib/queryClient.ts` の `Headers` / `Array` 形式分岐は未使用、簡素化 | 軽量 |
| audio-recordings bucket の signed URL 化 | 現状 `getPublicUrl()`（public:false なので即時漏洩リスクは限定的）→ `createSignedUrl()` 化 | 軽量 |
| audio retention policy | 過去音声の保存期間 / 自動削除設計 | 中 |
| staff 単位 rate limit | 現状 IP 単位 10/min → staff_id 単位へ | 中 |
| staff (sato / tanaka) positive runtime check | sato / tanaka の実ログイン検証 | 中（password 設定が必要）|
| 残り PHI 系 API hardening | §5.2 全項目 | 中〜大 |

### 5.4 Phase 2 候補（本フェーズ範囲外）

```txt
phase2_rls_apply.sql の適用（DB 層 RLS 本格化）
日本 SMS provider 接続 + Supabase Send SMS Hook
本物のメールで yamada exact owner JWT verification 再構築
3 院クローズドβ実装
multi-tenant 管理 UI
audio-recordings bucket の lifecycle / retention 本格設計
既知 9 件の TypeScript エラー解消
```

---

## 6. Phase 1.5-E 関連 commit 列（24 commits、追記更新時点）

```txt
bb4b8d6 docs: record phase 1.5-e-2-5 ai audio api hardening            ← E-2-5 完了 docs（2026-05-31）
cf3879f fix(auth): protect ai audio staff APIs                          ← E-2-5 実装（2026-05-31）
c69ad6b docs: record phase 1.5-e completion                             ← 統合完了記録 初版
349a2f7 docs: record phase 1.5-e-5 owner real jwt verification
cb1e3b6 docs: record phase 1.5-e-2-5 ai audio api audit
8fabdf6 docs: record phase 1.5-e-2-4 patient visits api hardening
c18c761 fix(auth): protect patient and visit staff APIs
297ca90 docs: record phase 1.5-e-2-4 patient visits api audit
9ef6948 docs: record phase 1.5-e-2-3 staff clinic api hardening
736c0d2 fix(auth): protect staff and clinic admin APIs
140c602 docs: record phase 1.5-e-2-2 staff login clinic protect
bb0c91f feat(auth): add staff login and clinic route protection
d1fbbfc docs: record phase 1.5-e-2-1 currentrole fallback fix
3ab6c68 fix(auth): remove owner fallback from clinic role UI
07299b0 docs: record phase 1.5-e-2 staff auth design audit
42502e5 docs: record phase 1.5-e-1 patient api hardening pass
8000f48 fix(auth): require patient auth for patient APIs
0693fa1 docs: record phase 1.5-e-1 follow-up ui binding audit
41ede0d docs: record phase 1.5-e-1 runtime verification pass
8a024bc fix(server): enable reusePort only on linux
b78beb5 chore(env): add .env.example with required variable names
cc2c754 chore(gitignore): exclude local env files except .env.example
e2e688e docs: record phase 1.5-e-1 patient auth minimum completion
37b040e feat(auth): add patient login session and patient me endpoint
```

実装 / 修正 commit：7 件（feat × 2, fix × 5）
docs commit：15 件
chore commit：2 件

※ 本 docs（completion record）の本追記更新は HEAD 上記 bb4b8d6 から派生する次の commit で記録される。

---

## 7. 関連 docs 一覧

```txt
docs/phase-1-5-a-complete.md                                  staff auth.users 3 名バックフィル
docs/phase-1-5-b-patient-decision.md                          既存 6 患者の取り扱い決定
docs/phase-1-5-c-complete.md                                  Service Role 集約（service_role 禁止方針の根拠）
docs/phase-1-5-d-real-jwt-api-rls-verification.md             patient.test01 実 JWT / API / RLS 検証
docs/phase-1-5-d-rls-simulated-select-verification.md         patient RLS シミュ検証

docs/phase-1-5-e-1-patient-auth-minimum-complete.md           E-1 実装完了メモ
docs/phase-1-5-e-1-runtime-verification-complete.md           E-1 Runtime Verification
docs/phase-1-5-e-1-followup-ui-binding-audit.md               E-1 UI バインド audit
docs/phase-1-5-e-1-patient-api-hardening-complete.md          E-1 patient API hardening

docs/phase-1-5-e-2-staff-auth-design-audit.md                 E-2 設計 audit
docs/phase-1-5-e-2-1-currentrole-fallback-fix.md              E-2-1 owner fallback 撤去
docs/phase-1-5-e-2-2-staff-login-clinic-protect-complete.md   E-2-2 staff login + clinic protect
docs/phase-1-5-e-2-3-staff-clinic-api-hardening-complete.md   E-2-3 staff/clinic admin API hardening
docs/phase-1-5-e-2-4-patient-visits-api-audit.md              E-2-4 audit
docs/phase-1-5-e-2-4-patient-visits-api-hardening-complete.md E-2-4 patient/visits API hardening
docs/phase-1-5-e-2-5-ai-audio-api-audit.md                    E-2-5 AI/音声 audit
docs/phase-1-5-e-2-5-ai-audio-api-hardening-complete.md       E-2-5 AI/音声 API hardening 完了（2026-05-31）
docs/phase-1-5-e-5-owner-real-jwt-verification.md             E-5 owner JWT verification

docs/phase-1-5-e-completion-record.md                         本文書（統合完了記録、2026-05-31 追記更新）
```

---

## 8. HIL 手動 E2E 再実行チェックリスト

3 院クローズドβ 前に HIL 自身が iPhone / iPad で再現できる手順。

### 8.1 患者 PWA 経路（patient.test01）

```txt
□ 1. ブラウザで <PWA URL>/patient/login を開く
□ 2. patient.test01@vlux.local + password でログイン
□ 3. /patient に遷移し SmartphoneView が描画される
□ 4. DevTools Network で /api/patient/me が 200 で返ることを確認
□ 5. ログアウト → /patient/login にリダイレクト
□ 6. Logout 後 /api/patient/me が 401 を返す（curl で確認）
```

### 8.2 staff iPad 経路（owner-role 検証は C-2 一時 staff で実施済み、本番は staff password 設定後）

```txt
□ 1. ブラウザで <Clinic URL>/clinic/login を開く
□ 2. staff Auth user の email + password でログイン
□ 3. /clinic に遷移し IPadView が描画される
□ 4. ヘッダーに「堺整骨院（テスト）」（自院）が表示される
□ 5. 患者選択タブで自院 active patient（bbbbbbbb-...）が表示される
□ 6. 治療履歴タブで自院 visit（1 件）が表示される
□ 7. DevTools Network で /api/staff/me 200 / /api/patients 200 / /api/visits 200 を確認
□ 8. デモクリニック（VLUXデモクリニック）の patient / visits が表示されないこと
□ 9. patient.test01 でログインを試行 → /clinic に入れず denied 画面 / 401 確認
□ 10. ログアウト → /clinic/login にリダイレクト、再アクセスで 401
```

### 8.3 マルチテナント分離（DB 層）

```txt
□ 1. Supabase Table Editor → Authentication → public.health_data
□ 2. role = authenticated, user = yamada@vlux.local を選択
□ 3. 7 件（bbbbbbbb-...）のみ表示、8704acf9-... は表示されないこと
□ 4. role = anon を選択 → 0 件確認（RLS で全件遮断）
```

---

## 9. セキュリティ遵守（Phase 1.5-E 全体）

```txt
✅ service_role key を server/lib/supabaseService.ts のみで参照（Phase 1.5-C 集約完了）
✅ Service Role を経由する処理は全て serviceClient export 経由
✅ Auth Admin API 使用なし
✅ auth.users 直接 SQL 更新なし
✅ RLS / schema / Edge Functions 変更なし
✅ password / access_token / refresh_token をログ・チャット・git・docs に出さず
✅ .env.local 中身を表示せず、git ignore で除外
✅ secret 関連 env は .env.example に変数名のみ記載
✅ 既存 yamada / sato / tanaka / clinics.owner_id / patients / visits / health_data は全フェーズで無傷
✅ E-5 検証で作成した一時データ（Auth user + staff row）は rollback で完全削除
✅ DELETE /api/visits/:id は物理 DELETE から論理削除（deleted_at / deleted_by / delete_reason）へ移行
✅ requireOwnerRole / requireStaffOrOwnerRole で role-based API 制御
```

---

## 10. 現状の git / DB 状態（2026-05-31 追記更新時点）

```txt
HEAD                    : bb4b8d6
origin/main             : bb4b8d6
branch                  : main
working tree            : clean（本 docs 追記更新前）
dev server              : 起動中（PID 28309、port 5001）※ 区切りで停止予定
port 5001               : LISTEN

DB:
  patients              : total=6, active=2, soft-deleted=4
  active 堺整骨院 patient : bbbbbbbb-0000-0000-0000-000000000001
  active VLUXデモ patient: 8704acf9-ad6a-4626-ad8b-03adf66b56b7
  clinics               : 2（堺整骨院（テスト）owner=yamada, VLUXデモ owner=NULL）
  staffs                : 3（yamada / sato / tanaka）
  auth.users            : 4（patient.test01 / yamada / sato / tanaka）
  検証用一時データ      : 完全削除済み（E-5 C-2 rollback で除去）
  E-2-5 検証で追加された visit / health_data / audio file : なし（minimal body smoke のみ実施、AI コスト 0）
```

---

## 11. Phase 1.5-E 完了宣言

```txt
Phase 1.5-E（フロント Auth UI / セッション接続 / API 認証境界）= PASS with documented deferrals
追記更新（2026-05-31）：AI / 音声 API hardening も完了。CLAUDE.md「Claude API への PHI 混入を防ぐ」
「音声データの適切な管理」最優先原則への直接対応も完結。
```

deferrals は §4 で明示。次のフェーズで継続対応する。

### 追記更新差分（c69ad6b → bb4b8d6、2026-05-31）

```txt
c69ad6b → cf3879f → bb4b8d6 の 2 commit 追加：
  cf3879f  fix(auth): protect ai audio staff APIs                       （実装）
  bb4b8d6  docs: record phase 1.5-e-2-5 ai audio api hardening          （完了 docs）

変更：
  §0 結論                : E-2-5 を ⚠ deferred から ✅ 完了に格上げ
  §1 サブフェーズ         : E-2-5 のテーブルを未実装一覧から完了一覧に書き換え
  §2 認証境界            : 防御済みエンドポイントに 5 本追加、未防御から削除
  §3 検証 PASS 一覧      : 未ログイン smoke / patient JWT smoke に 5 本追加、E-2-5 補足を追記
  §5 残課題             : §5.1 を「完了済み」表記に変更、§5.3 に「本物 analyze 1 回」「signed URL 化」等を移動
  §6 commit 列          : 21 → 24 commits（cf3879f / bb4b8d6 / c69ad6b 追加）
  §7 関連 docs          : E-2-5 hardening complete docs 追加
  §10 git / DB 状態     : HEAD = bb4b8d6 に更新
  §11 完了宣言          : AI / 音声境界完結を追記
```
