# VLUX Phase 1.5-D RLS 疑似JWT SELECT検証メモ

作成日：2026年5月25日

## 結論

Phase 1.5-D の入口検証として、RLS enabled確認、policy確認、補助関数確認、疑似JWTによるSELECT検証を実施した。

結果として、patient.test01、山田/owner、anon の3パターンで期待どおりの可視範囲になった。

## RLS enabled確認

- clinics: true
- staffs: true
- patients: true
- visits: true
- health_data: true

## policy / function確認

- patients SELECT は deleted_at IS NULL と user_id = auth.uid() を含む。
- visits SELECT は deleted_at IS NULL と vlux_owns_patient(patient_id) を含む。
- health_data SELECT は deleted_at IS NULL と vlux_owns_patient(patient_id) を含む。
- vlux_owns_patient は user_id = auth.uid() と deleted_at IS NULL を確認する。
- vlux_can_access_patient は patients.deleted_at IS NULL と vlux_can_access_clinic を確認する。
- vlux_can_access_clinic は clinic owner または active staff membership を確認する。

## patient.test01 疑似JWT SELECT検証

- auth.users.id: b7144bdb-e0c2-48d5-88aa-f9bb51b89223
- current_user_name: authenticated
- patients_visible_count: 1
- patients_visible_ids: bbbbbbbb-0000-0000-0000-000000000001
- visits_visible_count: 1
- visits_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- health_data_visible_count: 7
- health_data_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- 判定: PASS

## 山田/owner 疑似JWT SELECT検証

- auth.users.id: 22dbb066-fd6a-4112-b0db-ab44fa9da70c
- current_user_name: authenticated
- clinics_visible_count: 1
- clinics_visible_ids: aaaaaaaa-0000-0000-0000-000000000001
- patients_visible_count: 1
- patients_visible_ids: bbbbbbbb-0000-0000-0000-000000000001
- visits_visible_count: 1
- visits_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- health_data_visible_count: 7
- health_data_visible_patient_ids: bbbbbbbb-0000-0000-0000-000000000001
- 判定: PASS

## anon / 未認証 SELECT検証

- current_user_name: anon
- simulated_auth_uid: null
- clinics_visible_count: 0
- staffs_visible_count: 0
- patients_visible_count: 0
- visits_visible_count: 0
- health_data_visible_count: 0
- 判定: PASS

## 既知のhardening候補

visits の自院メンバー向けpolicyは visits.deleted_at と vlux_can_access_clinic(visits.clinic_id) を見ているが、親 patients.deleted_at までは直接見ていない。

今回のSOFT_DELETE済み4患者には visits が0件のため、現時点の実害はない。

将来的には、visits / health_data のstaff側policyでも親patientのdeleted_atを確認するhardeningを検討する。

## 次にやること

次の本線は実JWT / API経由のRLS検証。
