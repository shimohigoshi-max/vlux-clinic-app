# VLUX Phase 1.5-B 論理削除完了メモ

作成日：2026年5月24日

## 結論

Phase 1.5-B の SOFT_DELETE_CANDIDATE 4件を、物理削除せずに論理削除した。

使用カラム：

- patients.deleted_at
- patients.deleted_by
- patients.delete_reason

---

## 論理削除した患者ID

- 48c2cb5b-e135-4589-90dc-2e06fdf66f4b
- 739099dc-a391-4d66-9ce6-292a7661de5a
- 05b559aa-5ee0-4cef-8300-0eaf3a2b4e87
- e135970b-0bb4-4698-a48a-694d4c271c87

---

## 実行結果

Supabase SQL Editor で限定UPDATEを実行。

結果：

- returned rows: 4
- deleted_at: 2026-05-24 03:16:31.486969+00
- deleted_by: null
- delete_reason: Phase 1.5-B cleanup: seed/demo/mock patient with no visits, no health_data, no auth link

---

## 実行後の状態

active patient は2件。

### KEEP_AUTH_LINK_CANDIDATE

- patient_id: bbbbbbbb-0000-0000-0000-000000000001
- clinic: 堺整骨院（テスト）
- clinic_owner_id: 22dbb066-fd6a-4112-b0db-ab44fa9da70c
- user_id: null
- deleted_at: null
- visits_count: 1
- health_data_count: 7

### DEMO_ISOLATION_CANDIDATE

- patient_id: 8704acf9-ad6a-4626-ad8b-03adf66b56b7
- clinic: VLUXデモクリニック
- clinic_owner_id: null
- user_id: null
- deleted_at: null
- visits_count: 26
- health_data_count: 0

---

## 実施していないこと

- 物理DELETE
- TRUNCATE
- DROP
- ALTER
- INSERT
- Auth user 作成
- patient user_id 紐付け
- RLS変更
- server / client / shared のコード変更
- npm実行

---

## 次にやること

次の本線は、KEEP_AUTH_LINK_CANDIDATE 1件の patient Auth user 作成と patients.user_id 紐付け設計。

今後のクエリ・API・RLS検証では、原則として patients.deleted_at is null を active patient 条件として扱う。
