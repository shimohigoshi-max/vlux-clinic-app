# VLUX Phase 1.5-D Real JWT / API RLS Verification

作成日：2026-05-26  
対象：Supabase Auth 実JWT + Supabase REST API + RLS 検証  
目的：SQL simulation ではなく、実際の Auth JWT / anon key / REST API 経由で RLS が期待通り機能することを確認する。

---

## 1. 検証対象

対象テーブル：

- public.clinics
- public.staffs
- public.patients
- public.visits
- public.health_data

検証方式：

- Supabase Auth password grant により実JWTを取得
- Supabase REST API /rest/v1/* を anon key + Authorization Bearer JWT で呼び出し
- anonymous access は anon key のみで呼び出し
- service_role key は使用しない

---

## 2. patient.test01 実JWT/API RLS 検証

Auth user：

- email: patient.test01@vlux.local
- expected_user_id: b7144bdb-e0c2-48d5-88aa-f9bb51b89223

結果：

- patients_visible_count: 1
- patients_visible_ids: bbbbbbbb-0000-0000-0000-000000000001
- visits_visible_count: 1
- visits_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- health_data_visible_count: 7
- health_data_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- clinics_visible_count: 0
- staffs_visible_count: 0

判定：

- PASS: patient.test01 real JWT/API RLS matched expected scope.

確認できたこと：

- patient.test01 は本人 patient record 1件のみ参照できる。
- patient.test01 は本人 visits 1件のみ参照できる。
- patient.test01 は本人 health_data 7件のみ参照できる。
- patient.test01 は clinics / staffs を参照できない。
- soft-deleted patients は表示されない。
- VLUXデモクリニック側の isolated demo data は表示されない。

---

## 3. anon API RLS 検証

結果：

- clinics_visible_count: 0
- staffs_visible_count: 0
- patients_visible_count: 0
- visits_visible_count: 0
- health_data_visible_count: 0

判定：

- PASS: anon API RLS returned zero visible rows.

確認できたこと：

- 未ログイン状態では clinics / staffs / patients / visits / health_data の全てが 0件。
- anon key 単体では患者・医院・来院・ヘルスデータを参照できない。
- SQL simulation の anon 0件結果と一致した。

---

## 4. yamada owner 実JWT/API RLS 検証の扱い

山田 owner アカウント：

- email: yamada@vlux.local
- expected_user_id: 22dbb066-fd6a-4112-b0db-ab44fa9da70c

Supabase Auth user の存在確認：

- id: 22dbb066-fd6a-4112-b0db-ab44fa9da70c
- email: yamada@vlux.local
- email_confirmed_at: 2026-05-15 02:08:58.217565+00
- banned_until: null

ただし、実JWTログインでは以下が発生した。

- status: 400
- error_code: invalid_credentials
- msg: Invalid login credentials

判断：

- Auth user / user_id / email_confirmed_at / banned_until は正常。
- RLS設計の問題ではなく、検証用パスワード未確定の問題。
- service_role key を使ったパスワード上書きは、安全性を優先して今回は実施しない。
- owner側のRLSは、前段の SQL/RLS simulation で期待スコープを確認済み。

---

## 5. セキュリティメモ

- access_token / refresh_token は記録しない。
- anon key は記録しない。
- service_role key は使用していない。
- patient.test01 は Phase 1.5-D 検証専用の Email Auth user。
- production patient auth は引き続き日本SMS provider + Supabase Send SMS Hook 方針。
- Twilio は Phase 1.5 では不採用。

---

## 6. 総合判定

PASS_WITH_OWNER_REAL_JWT_DEFERRED

Phase 1.5-D の実API RLS検証として、以下は合格扱いとする。

- PASS: patient self-scope real JWT/API RLS
- PASS: anon zero-visibility API RLS
- PASS: owner/staff scope SQL/RLS simulation
- DEFER: owner real JWT/API RLS due to password management issue

現時点で、患者本人スコープと匿名アクセス遮断については、実JWT/API経由で期待通り確認済み。
