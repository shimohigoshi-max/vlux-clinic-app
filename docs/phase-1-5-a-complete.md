# Phase 1.5-A 完了メモ

**日付：** 2026-05-22
**スコープ：** VLUX Phase 1 — staff Auth 接続確認
**判定：** ✅ 完了（追加アクション不要）

---

## 1. 完了判定

Phase 1.5-A の目的（=「Supabase Auth の staff user を Email + Password で運用可能な状態にし、`staffs.user_id` および `clinics.owner_id` に紐付けを行うための基盤を整える」）について、**事前確認の結果すべて成立済みであることを確認した**。

- staff Auth user は既に 3 名作成済み（Email + Password、`@vlux.local` ドメイン）
- `staffs` 3 行はいずれも `user_id` が `NOT NULL`、`auth.users` への紐付け済み
- `clinics` 2 行のうち本番運用対象である**堺整骨院（テスト）**は `owner_id` 設定済み
- 残る **VLUXデモクリニック** の `owner_id NULL` は意図的な保留（後述）

このため、Phase 1.5-A としての追加 SQL 実行・Dashboard 作業・コード変更は不要。

---

## 2. 実行した read-only SQL の要約

Supabase SQL Editor で SELECT のみを実行。INSERT/UPDATE/DELETE/DDL は一切実行していない。

| ID | 目的 | 結果 |
|----|------|------|
| A-1 | `clinics` スナップショット | 2 行（堺整骨院・VLUXデモクリニック） |
| A-2 | `staffs` スナップショット | 3 行（山田・佐藤・田中） |
| B-1 | `auth.users` 総数 | 3 |
| B-2 | `auth.users` の中身 | `@vlux.local` ドメインで 3 名 |
| C-1 | 山田/佐藤/田中の既存 `staffs` 行 | 3 行ヒット |
| C-2 | 仮メール（.local / .test）の衝突確認 | **`public.staffs.email` では 0 行**。補足：`auth.users.email` 側に `@vlux.local` の 3 名が存在し、`staffs.user_id` 経由で正しく紐付いている |
| D | NULL サマリ | `staffs.user_id_null = 0` / `clinics.owner_id_null = 1` |

**メールドメインに関する補足：**
`public.staffs.email` と `auth.users.email` は**別ドメイン**で運用されている。前者は院内連絡用、後者は認証用というレイヤー分離。Phase 1.5-A ではこの分離をそのまま許容している（同一視を強制する制約は導入しない）。

---

## 3. auth.users / staffs / clinics の対応関係

確認できた 1:1 対応（`staffs.user_id = auth.users.id` で接続）：

| 役割 | 名前 | auth.users.email | staffs.email | auth.users.id |
|------|------|------------------|--------------|---------------|
| owner | 山田 | `yamada@vlux.local` | `yamada@sakai-seikotsu.jp` | `22dbb066-fd6a-4112-b0db-ab44fa9da70c` |
| staff | 佐藤 | `sato@vlux.local`   | `sato@sakai-seikotsu.jp`   | `51ca1726-b870-4a5d-b5e4-08db97ccb081` |
| staff | 田中 | `tanaka@vlux.local` | `tanaka@sakai-seikotsu.jp` | `05cb82c9-61a7-4c99-aca4-c0192d9aa0f5` |

clinics との紐付け：

| clinic | owner_id | 備考 |
|--------|----------|------|
| 堺整骨院(テスト) | 山田の `auth.users.id`(`22dbb066-...`) | Phase 1 の主たる運用対象 |
| VLUXデモクリニック | `NULL`(保留) | 次項参照 |

---

## 4. VLUXデモクリニック owner_id NULL の扱い

**結論：Phase 1.5-A では触らない。NULL のまま保持する。**

理由：
- VLUXデモクリニックは社内デモ・営業デモ用想定であり、特定の staff Auth user を「オーナー」として紐付ける必要性が**現時点では確定していない**
- 仮に既存 3 名のいずれかを紐付けると、後で「これはデモ用クリニックなので owner は別アカウントにしたい」となった場合に再度 backfill が発生する
- RLS ポリシーは将来 `phase2_rls_apply.sql` で `clinic_id` 単位の所属判定に依存するため、owner_id NULL のままだとデモクリニックは**「誰のものでもない」状態**になる点だけ留意 → これは Default Deny 寄りに振れる安全側の状態として現時点では許容

**フォローアップ条件：**
- VLUXデモクリニックを使う運用判断（誰がオーナーか）が決まった時点で、別途 backfill する
- `phase2_rls_apply.sql` 適用前には NULL を解消するか、「デモクリニックはアクセス不能で OK」という運用判断を明文化する必要がある

---

## 5. 今回あえて実行しなかったこと（明示的な不実行リスト）

| 項目 | 理由 |
|------|------|
| Auth user 新規作成 | 既に 3 名作成済みのため不要 |
| `staffs` INSERT | 既に 3 行あり `user_id` も紐付け済みのため不要 |
| `staffs.user_id` UPDATE | NULL 件数 0 のため不要 |
| 堺整骨院 `clinics.owner_id` UPDATE | 既に山田の id が入っているため不要 |
| VLUXデモクリニック `clinics.owner_id` UPDATE | 保留判断（上記 §4） |
| `phase2_rls_apply.sql` の適用 | Phase 2 スコープ。Phase 1.5-A では実行しない |
| Twilio 関連設定 | 不採用方針確定。patient SMS OTP は後続フェーズで日本 SMS + Supabase Send SMS Hook |
| Chat 永続化リファクタ | 候補 B(後述)として整理。Phase 1.5-B 正式スコープとは別扱い |
| `server/supabase.ts` の Service Role 直接参照の集約 | 候補 C(後述)として整理 |
| 9 件の pre-existing TS エラー対応 | 後続フェーズで扱う |

---

## 6. 次フェーズ候補

以下 3 候補は大きくは独立しているが、Phase 1.5-C 前処理（Service Role Key 集約）は、後続のJWT middleware / RLS検証前に済ませると安全性が高い。

### 候補 A：Phase 1.5-B — 患者既存 6 件の取り扱い決定（**正式ロードマップの次主題**）
- **内容：** 現状 `patients` に存在する 6 件について、運用に乗せるか・破棄するかを決める
  - 既存 `patients` を `user_id` 紐付けする（実患者として継続運用）
  - 一度削除（論理削除含む）して新規データから始める
- **着地点：** 判断後、`patients.user_id` の backfill 方針（実装手順・必要な auth.users 作成方針）へ進む
- **重さ：** 意思決定主体。技術タスクは判断後に派生

### 候補 B：Phase 1.5-B/C 関連 Tech Debt — chat persistence 整理
- **内容：** インメモリ実装になっている chat 履歴を Supabase 永続化に移行
- **接点：** 現在の chat routes / storage が抱える TS エラー 6 件に直結
- **設計対象：** `conversations` / `chat_messages` テーブル設計、RLS、storage 層リライト、routes 修正
- **位置付け：** 正式な Phase 1.5-B(=患者既存 6 件の判断)の主題とは**分けて扱う**。Tech Debt 解消枠

### 候補 C：Phase 1.5-C 前処理 — Service Role Key 集約
- **内容：** `server/supabase.ts` 内の `SUPABASE_SERVICE_ROLE_KEY` 直接参照を撤去し、`server/lib/supabaseService.ts` 経由に統一
- **理由：** Service Role Key 露出経路を 1 ファイルに絞り、JWT middleware / RLS 検証を入れる前に経路を見通せる状態にする
- **重さ：** 局所リファクタ（挙動は変えず import 経路の付け替えが中心）

**所感（参考）：**
- 業務判断の前進という意味では候補 A（患者 6 件の取扱判断）が本筋
- 一方、候補 C は他フェーズ着手時にも結局踏むため、判断待ちの間に **C を先に倒しておくと無駄が少ない**
- 候補 B は Phase 1.5-B/C どちらの実装にも乗っかりやすい立て付けなので、A の判断結果に合わせて優先度を決める

---

## 7. 関連 reference

- `/Users/katushi.s/Documents/vlux-clinic-app/phase2_rls_apply.sql` — Phase 2 RLS 適用 SQL（未適用）
- `/Users/katushi.s/Documents/vlux-clinic-app/server/lib/supabaseService.ts` — Service Role 集約ファイル（既存）
- メモリ：`chat-persistence-required.md`、`phase-1-5-c-service-role-cleanup.md`
