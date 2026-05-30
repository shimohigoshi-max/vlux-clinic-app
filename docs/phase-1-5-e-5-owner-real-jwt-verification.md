# VLUX Phase 1.5-E-5 Owner Real JWT Verification

作成日：2026-05-30
対象：Phase 1.5-E-5 / owner role real JWT runtime verification
ステータス：PASS with yamada exact deferred
変更種別：documentation only
コード変更：なし
DB変更：検証用一時データのみ作成し、rollback完了済み

---

## 0. 結論

Phase 1.5-E-5 の owner role runtime verification は PASS。

ただし、`yamada@vlux.local` 本人の exact owner 実 JWT 検証は deferred とした。

理由は、Supabase Dashboard 上で password 直接設定 UI / email 変更 UI が見当たらず、既存の `yamada / sato / tanaka / clinics.owner_id` を安全のため変更しない方針を維持したため。

代替として、検証用 Auth user と検証用 owner staff row を一時作成し、`/clinic/login` から owner role として実ログインし、実 JWT で API 境界を確認した。

結果：

```txt
✅ owner-role positive runtime verification = PASS
✅ logout + anon 401 verification = PASS
✅ rollback 完全成功
✅ 既存 yamada / sato / tanaka / clinics.owner_id / patients / visits / health_data は無傷
✅ Phase 1.5-E-5 = PASS with yamada exact deferred
```

---

## 1. 背景

Phase 1.5-D で patient.test01 実 JWT による REST API + RLS の end-to-end 検証は完了済み（`docs/phase-1-5-d-real-jwt-api-rls-verification.md`）。

しかし owner（yamada@vlux.local）側の実 JWT 検証は password 未確定のため defer されていた。

Phase 1.5-E-5 はこのギャップを閉じる目的で着手した。

---

## 2. yamada exact owner JWT verification — deferred

### 2.1 deferred の理由

Supabase Dashboard → Authentication → Users → yamada@vlux.local の詳細画面で表示された操作は以下のみ：

```txt
Send password recovery
Send magic link
Remove MFA factors
Ban user
Delete user
```

確認結果：

```txt
password 直接設定 UI: なし
email 編集 UI: なし
Auto-confirm email トグル: なし
Edit user / Update user: なし
```

`yamada@vlux.local` は `.local` ドメインのため `Send password recovery` を押しても受信不可。
service_role / Auth Admin API / auth.users 直接 SQL 更新は CLAUDE.md セキュリティルールにより禁止。

### 2.2 不採用とした代替案

C-1（既存 staffs.user_id / clinics.owner_id を一時書き換え）：既存データ整合性のリスク大、不採用。
C-3（service_role / Auth Admin API）：CLAUDE.md セキュリティルール違反、不採用。

### 2.3 再検証予定

Phase 2 で日本 SMS provider + Supabase Send SMS Hook 導入時、または yamada の auth.users 行を破壊せずに password 設定できる Dashboard バージョン更新後に再検証する。

---

## 3. 採用方針：C-4 + C-2 ハイブリッド

```txt
C-4: yamada exact owner JWT verification は deferred として正直に記録
C-2: owner-role positive runtime verification を新規 Auth user + 新規 staff row で実施
```

C-2 の前提：

```txt
既存 yamada / sato / tanaka / clinics.owner_id は一切変更しない
新規 staff row は role=owner で堺整骨院に INSERT
検証後は staffs row を DELETE + 新規 Auth user を Dashboard Delete user
```

---

## 4. C-2 実施内容

### 4.1 事前 read-only 確認（§4-a〜§4-d、§4-e〜§4-f）

すべて期待値どおり：

```txt
§4-a: staffs カラム定義に is_active 含むことを確認
§4-b: role CHECK 制約 (owner/staff/reception) 確認
§4-c: 堺整骨院（テスト）clinic_id 取得、owner_id = yamada UUID 確認
§4-d: 既存 staffs 3 件（yamada / sato / tanaka）スナップショット取得
§4-e: 新 Auth user UUID confirmed = true 確認
§4-f: 同 user_id / email を持つ既存 staff = 0 件確認
```

### 4.2 新 Auth user 作成

```txt
方法: Supabase Dashboard → Authentication → Users → Add user
Auto-confirm email: ON
Send invitation email: OFF
email: <E5 検証用 Auth user email — rollback で削除済み>
password: HIL が 1Password / Keychain に保存（チャット・docs・log には記載なし）
新 Auth user UUID: 31ed715c-caad-46ee-9034-3ba63347f5d0
```

### 4.3 検証用 staff row INSERT

```sql
INSERT INTO public.staffs (
  clinic_id, user_id, name, role, email, calendar_color
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  '31ed715c-caad-46ee-9034-3ba63347f5d0'::uuid,
  'E5検証用owner',
  'owner',
  '<E5 検証用 Auth user email — rollback で削除済み>',
  '#ff8800'
)
RETURNING id, ...;
```

RETURNING 結果：

```txt
inserted_staff_id: 1d1040ba-7f88-4545-ade7-282bfe02d88b
clinic_id: aaaaaaaa-0000-0000-0000-000000000001 (堺整骨院（テスト）)
user_id: 31ed715c-caad-46ee-9034-3ba63347f5d0
name: E5検証用owner
role: owner
calendar_color: #ff8800
is_active: true
created_at: 2026-05-29 03:38:08.31666+00
```

既存 yamada / sato / tanaka の 3 行は触らず。clinics.owner_id（yamada UUID）も触らず。

---

## 5. Runtime verification (owner-role positive)

### 5.1 dev server 起動

```txt
PORT=5001 npm run dev > /tmp/vlux-dev.log 2>&1 &
.env.local は set -a; source ; set +a 経路で読み込み、中身は表示せず
serving on port 5001 確認
```

### 5.2 unauth smoke（5 本すべて 401 期待）

```txt
/api/staff/me        http_code=401  body={"error":"unauthorized"}
/api/admin/clinic    http_code=401  body={"error":"unauthorized"}
/api/staffs          http_code=401  body={"error":"unauthorized"}
/api/patients        http_code=401  body={"error":"unauthorized"}
/api/visits          http_code=401  body={"error":"unauthorized"}
```

判定：PASS。E-2-2 / E-2-3 / E-2-4 で実装した認証境界が規定どおり動作。

### 5.3 実ログイン（owner-role JWT）

ブラウザで `http://localhost:5001/clinic/login` → 新 Auth user email + password でログイン。
StaffProtected が `/api/staff/me` を内部で 200 取得 → `/clinic` 描画成功。

DevTools Console で token を表示せずに 5 endpoint を verify：

```txt
/api/staff/me
  status = 200
  role_or_keys = owner

/api/admin/clinic
  status = 200

/api/staffs
  status = 200
  arrayLen = 4
  sample_clinic_id = aaaaaaaa-0000-0000-0000-000000000001

/api/patients
  status = 200
  arrayLen = 1
  sample_id = bbbbbbbb-0000-0000-0000-000000000001
  sample_clinic_id = aaaaaaaa-0000-0000-0000-000000000001

/api/visits
  status = 200
  arrayLen = 1
  sample_clinic_id = aaaaaaaa-0000-0000-0000-000000000001
```

判定：すべて期待値完全一致。clinic スコープが API 層で正しく機能。
VLUXデモクリニック（owner_id NULL）の active patient `8704acf9-...` および 26 visits は完全に遮断されている。

---

## 6. Logout + anon 401 verification

ログアウト後の確認結果：

```txt
lingeringTokenInLocalStorage = false
/api/staff/me        status=401  pass=true
/api/admin/clinic    status=401  pass=true
/api/staffs          status=401  pass=true
/api/patients        status=401  pass=true
/api/visits          status=401  pass=true
```

判定：PASS。logout が server セッションと client localStorage の両方を正しく無効化。

---

## 7. Rollback

### 7.1 DELETE 検証用 staffs row（id + name 二重ガード）

```txt
§6-a: 1 行ヒット、name='E5検証用owner' 確認
§6-b: DELETE 1, RETURNING name='E5検証用owner', role='owner'
§6-c: remaining = 0
```

### 7.2 既存データ無傷確認

```txt
§6-d: 堺整骨院 staffs = 3 行（yamada / sato / tanaka）
       is_test_row 全て false
       created_at スナップショット完全一致
§6-e: clinics.owner_id = 22dbb066-... (yamada UUID)
       owner_is_yamada = true
```

### 7.3 Auth user 削除（Dashboard）

```txt
Dashboard → Authentication → Users
検証用 Auth user (UUID: 31ed715c-...) を Delete user
削除後検索: 0 件ヒット
残存 Auth user: patient.test01@vlux.local / sato@vlux.local / tanaka@vlux.local / yamada@vlux.local の 4 件
```

### 7.4 rollback 後 anon smoke

```txt
/api/staff/me        http_code=401
/api/admin/clinic    http_code=401
/api/staffs          http_code=401
/api/patients        http_code=401
/api/visits          http_code=401
```

判定：rollback 完全成功。regression なし。

---

## 8. セキュリティ遵守

```txt
✅ service_role による Auth user 操作なし
✅ Auth Admin API 使用なし
✅ auth.users 直接 SQL 更新なし
✅ RLS / schema / Edge Functions 変更なし
✅ password / access_token / refresh_token をログ・チャット・git に出さず
✅ .env.local 中身を表示せず
✅ 既存 yamada / sato / tanaka / clinics.owner_id 変更なし
✅ patients / visits / health_data 変更なし
✅ 検証用 Auth user / 検証用 staff row は rollback で完全削除
```

---

## 9. 残課題

```txt
yamada exact owner 名義の実 JWT 検証
  → Phase 2 で日本 SMS provider 導入 / Dashboard UI 更新時に再検証

/api/health-data の API 層 clinic スコープ
  → E-2-5 / E-2-7 候補（DB 層 RLS は Appendix A で動作確認済み）

/api/audio/upload / /api/transcribe / /api/summarize / /api/analyze / /api/correlate hardening
  → E-2-5 audit 完了（commit cb1e3b6）、実装未着手

Supabase RLS (DB 層) の phase2_rls_apply.sql 適用
  → Phase 2 候補

staff（sato / tanaka）の positive runtime check
  → 必要なら別途 owner-role と同様の手法で実施可能、現状 deferred
```

---

## Appendix A. DB 層 RLS シミュレーション補助証跡

実施日時：2026-05-29 JST

実施方法：

```txt
Supabase Dashboard → Table Editor → public.health_data
role = authenticated, user = yamada@vlux.local を選択（impersonate）
```

期待：

```txt
bbbbbbbb-0000-0000-0000-000000000001（堺整骨院 active patient）の health_data のみ表示
8704acf9-ad6a-4626-ad8b-03adf66b56b7（VLUXデモ active patient）の health_data は非表示
```

実測：

```txt
bbbbbbbb-... の health_data 7 件のみ表示
8704acf9-... の health_data は表示されず
```

判定：DB 層 RLS は yamada owner JWT 相当のコンテキストで期待どおりに動作。

注意：

```txt
これは Table Editor の RLS シミュレーションであり、実 JWT を発行した /clinic/login 経路ではない
本記録は §5 の owner-role positive runtime verification（C-2）の代替ではなく補助証跡である
yamada exact 名義での実ログイン経路検証は §2 のとおり Phase 2 で再検証する
```

---

## Appendix B. 関連 reference

```txt
docs/phase-1-5-d-real-jwt-api-rls-verification.md    patient.test01 実 JWT 検証
docs/phase-1-5-a-complete.md                          auth.users 3 名バックフィル
docs/phase-1-5-b-patient-decision.md                  既存 6 患者の取り扱い決定
docs/phase-1-5-c-complete.md                          Service Role 集約（service_role 禁止方針の根拠）
docs/phase-1-5-e-1-patient-auth-minimum-complete.md   患者ログイン基盤
docs/phase-1-5-e-1-runtime-verification-complete.md   患者ログイン Runtime Verification
docs/phase-1-5-e-1-followup-ui-binding-audit.md       UI バインド audit
docs/phase-1-5-e-1-patient-api-hardening-complete.md  patient API hardening
docs/phase-1-5-e-2-staff-auth-design-audit.md         E-2 設計 audit
docs/phase-1-5-e-2-1-currentrole-fallback-fix.md      owner fallback 撤去
docs/phase-1-5-e-2-2-staff-login-clinic-protect-complete.md  staff login + StaffProtected
docs/phase-1-5-e-2-3-staff-clinic-api-hardening-complete.md  staff/clinic admin API hardening
docs/phase-1-5-e-2-4-patient-visits-api-audit.md      patient/visits API audit
docs/phase-1-5-e-2-4-patient-visits-api-hardening-complete.md  patient/visits API hardening
docs/phase-1-5-e-2-5-ai-audio-api-audit.md            AI/音声 API audit
```
