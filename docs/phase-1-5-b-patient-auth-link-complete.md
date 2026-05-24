# VLUX Phase 1.5-B patient Auth 紐付け完了メモ

作成日：2026年5月24日

## 結論

KEEP_AUTH_LINK_CANDIDATE 1件に対して、Phase 1.5-D の JWT / RLS 検証用 patient Auth user を作成し、patients.user_id に紐付けた。

これは本番患者認証ではなく、検証用 Email Auth である。

本番患者認証方針は引き続き、日本SMSサービス + Supabase Send SMS Hook を検討する。

## 対象患者

- patient_id: bbbbbbbb-0000-0000-0000-000000000001
- clinic: 堺整骨院（テスト）
- clinic_owner_id: 22dbb066-fd6a-4112-b0db-ab44fa9da70c
- deleted_at: null
- visits_count: 1
- health_data_count: 7

## 作成した検証用 Auth user

- email: patient.test01@vlux.local
- auth.users.id: b7144bdb-e0c2-48d5-88aa-f9bb51b89223
- phone: null
- email_confirmed_at: 2026-05-24 03:41:33.327678+00
- created_at: 2026-05-24 03:41:33.320146+00

## 実行内容

- patients.id: bbbbbbbb-0000-0000-0000-000000000001
- patients.user_id: b7144bdb-e0c2-48d5-88aa-f9bb51b89223

## 実施していないこと

- 本番患者SMS認証の実装
- Twilio実装
- 日本SMSサービス連携
- Supabase Send SMS Hook 実装
- RLS変更
- server / client / shared のコード変更
- npm実行

## 現在のPhase 1.5-B状態

- SOFT_DELETE_CANDIDATE 4件: 論理削除済み
- KEEP_AUTH_LINK_CANDIDATE 1件: 検証用 patient Auth user 紐付け済み
- DEMO_ISOLATION_CANDIDATE 1件: Default Deny / isolated demo data として保留

## 次にやること

次の本線は Phase 1.5-D の JWT / RLS 結合検証準備。
patient.test01@vlux.local のJWTで、自分の patient record / visits / health_data のみ参照できるかを確認する。
