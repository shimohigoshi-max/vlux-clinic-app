# Replit Agent 指示書：両 GitHub リポジトリへの全コード push

## このタスクの目的

現在のプロジェクト（Connected Healthcare = vlux-phase1）の最新コードを、新しく作成された以下2つの GitHub リポジトリの **両方に push** してください。

- `https://github.com/shimohigoshi-max/vlux-clinic-app`（空・新規作成済み）
- `https://github.com/shimohigoshi-max/vlux-patient-app`（空・新規作成済み）

push 後、両リポジトリには現在のコードが完全に同じ内容で入ります。その後の「院側／患者側への分割作業」は別タスクで実施します。**このタスクではコードを一切変更しないでください**。git 操作のみ実施します。

---

## 重要なルール

1. **コードを変更しない・新規ファイルを作らない・削除もしない**
2. **元のリポジトリ（origin = vlux-phase1）には絶対に push しない**
3. **エラーが出たら進まずに HIL（人間の開発者）に報告**
4. **各ステップ完了後に必ず結果を報告してから次に進む**

---

## ステップ1：現状確認

以下のコマンドを **すべて** 実行して、結果をそのまま報告してください。

```bash
git status
git remote -v
git branch
```

### 報告フォーマット

```
ステップ1 結果：
- 現在のブランチ名: ?
- リモート設定: ?
- 未コミットの変更: あり / なし
```

### ⚠️ 停止条件

`git status` で **未コミットの変更がある** と表示された場合、**ここで止まって HIL に報告してください**。先に進まないでください。

---

## ステップ2：新しいリモートを追加

ステップ1が問題なく完了したら、以下を実行してください。

```bash
git remote add clinic https://github.com/shimohigoshi-max/vlux-clinic-app.git
git remote add patient https://github.com/shimohigoshi-max/vlux-patient-app.git
```

確認のため：

```bash
git remote -v
```

### 報告フォーマット

```
ステップ2 結果：
- clinic リモート追加: 成功 / 失敗
- patient リモート追加: 成功 / 失敗
- git remote -v の出力をそのまま貼り付け
```

### ⚠️ 既に同名のリモートが存在する場合

「remote clinic already exists」のようなエラーが出たら、そのまま報告してください。**進まないでください**。HIL が判断します。

---

## ステップ3：vlux-clinic-app に push

ステップ2が成功したら、以下を実行してください。

```bash
git push clinic main
```

### 報告フォーマット

```
ステップ3 結果：
- push 結果: 成功 / 失敗
- 出力メッセージ全文:
（ここにコマンドの全出力を貼り付け）
```

### ⚠️ エラーが出た場合の対処

**ケース1：「src refspec main does not match any」**
→ ブランチ名が main ではない可能性。以下を実行して報告：
```bash
git branch -a
```

**ケース2：「Authentication failed」または「Permission denied」**
→ Replit と GitHub の連携設定に問題あり。**進まずに HIL に報告**。

**ケース3：その他のエラー**
→ エラー全文を報告。

---

## ステップ4：vlux-patient-app に push

ステップ3が成功した場合のみ実行してください。失敗していたら、ここはスキップして HIL に報告。

```bash
git push patient main
```

### 報告フォーマット

```
ステップ4 結果：
- push 結果: 成功 / 失敗
- 出力メッセージ全文:
（ここにコマンドの全出力を貼り付け）
```

---

## ステップ5：完了確認

すべて成功したら、以下を最終確認として報告してください。

```bash
git log -3 --oneline
git remote -v
```

### 報告フォーマット

```
ステップ5 完了報告：
- 最新コミット3件:
（git log の出力）
- リモート一覧:
（git remote -v の出力）
- vlux-clinic-app に push: 完了
- vlux-patient-app に push: 完了
- 元のリポジトリ（origin）への push: 行っていない（重要）
```

---

## 全体としての成功条件

以下がすべて満たされていれば成功です：

- [ ] git status は clean（未コミット変更なし）
- [ ] clinic と patient の2つのリモートが追加された
- [ ] vlux-clinic-app に main ブランチが push された
- [ ] vlux-patient-app に main ブランチが push された
- [ ] origin（vlux-phase1）には何も push されていない
- [ ] 現プロジェクトのコードは一切変更されていない

---

## 質問・困ったとき

各ステップで以下のいずれかが起きたら、**進まずに止まって HIL に報告**：

- 想定外のエラーメッセージ
- どの選択肢に該当するか不明
- 「これで合ってますか？」と聞きたくなった瞬間

判断に迷ったら、進まないことが正解です。
