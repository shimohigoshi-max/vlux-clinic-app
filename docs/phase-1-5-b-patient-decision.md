# VLUX Phase 1.5-B 患者既存6件の取り扱い決定メモ

## 結論

Phase 1.5-B の判断は **C：一部残す**。

既存 patients 6件は以下に分類する。

---

### KEEP_AUTH_LINK_CANDIDATE

- patient_id: `bbbbbbbb-0000-0000-0000-000000000001`
- clinic: 堺整骨院（テスト）
- clinic_owner_unset: `false`
- auth_link: `unlinked`
- visits: 1
- health_data: 7
- 判断:
  - Phase 1.5-B 以降の患者 Auth 接続候補
  - 患者 PWA / HealthData / RLS 結合検証に使える代表データ
  - active のまま残す

---

### DEMO_ISOLATION_CANDIDATE

- patient_id: `8704acf9-ad6a-4626-ad8b-03adf66b56b7`
- clinic: VLUXデモクリニック
- clinic_owner_unset: `true`
- auth_link: `unlinked`
- visits: 26
- health_data: 0
- 判断:
  - owner_id NULL のデモクリニック所属
  - activity が 26 件あるため雑に削除しない
  - 山田には紐付けない
  - patient Auth user も今は作らない
  - Default Deny / isolated demo data として保留

---

### SOFT_DELETE_CANDIDATE

- patient_id: `48c2cb5b-e135-4589-90dc-2e06fdf66f4b`
- patient_id: `739099dc-a391-4d66-9ce6-292a7661de5a`
- patient_id: `05b559aa-5ee0-4cef-8300-0eaf3a2b4e87`
- patient_id: `e135970b-0bb4-4698-a48a-694d4c271c87`

共通条件:

- clinic: 堺整骨院（テスト）
- clinic_owner_unset: `false`
- auth_link: `unlinked`
- visits: 0
- health_data: 0
- member_grade: `bronze`
- created_at が連続しており seed / demo / mock 由来の可能性が高い

判断:

- Phase 1.5-D RLS 検証ではノイズになりやすい
- 物理削除ではなく、既存の `deleted_at` / `deleted_by` / `delete_reason` による論理削除候補
- 今回はまだ UPDATE しない

---

## B-0 schema discovery で確認したこと

- `coupons` テーブルは存在しない
- `patients` に `email` / `name` は存在しない
- `patients` には `name_kana` / `birth_date` / `gender` / `phone` / `member_grade` / `address` が存在する
- `patients` / `visits` / `health_data` には `deleted_at` / `deleted_by` / `delete_reason` が存在する
- `visits` の日時カラムは `visited_at`
- `health_data` の日付カラムは `recorded_date` / `synced_at`

---

## read-only 調査結果

- 生存患者 6 件
- 全件 `user_id` 未紐付け
- VLUXデモクリニック owner_id NULL の患者 1 件に visits 26 件
- 堺整骨院（テスト）の患者 1 件に visits 1 件 / health_data 7 件
- 堺整骨院（テスト）の患者 4 件は visits 0 件 / health_data 0 件

---

## 方針補足：Twilio / chat persistence

- Twilio は不採用。実装しない。
- staff 認証は Email + Password 方針で進める。
- patient 認証は後続で日本SMSサービス + Supabase Send SMS Hook を検討する。
- chat persistence は未着手。Phase 1.5-B の主題ではなく、患者既存6件の扱い決定後に別タスクとして扱う。
- 注意：Twilio と chat persistence を同じ「未着手」扱いにしない。Twilio は不採用、chat persistence は後続タスク。

---

## 次にやること

1. この判断メモを確認
2. docs のみ commit / push
3. その後、SOFT_DELETE_CANDIDATE 4 件に対する論理削除 SQL を設計
4. KEEP_AUTH_LINK_CANDIDATE 1 件の patient Auth user 作成・`user_id` 紐付け設計へ進む

---

## 禁止・未実施

- DB 変更は未実施
- UPDATE / DELETE / INSERT / DDL は未実施
- Auth user 作成は未実施
- RLS 変更は未実施
- server / client / shared のコード変更は未実施
- npm 実行は未実施
