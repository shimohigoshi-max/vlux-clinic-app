# VLUX Phase 1.5-E-2-1 CurrentRole Owner Fallback Fix

作成日：2026-05-28  
対象：Phase 1.5-E-2-1 currentRole owner fallback hardening  
判定：PASS  
実装commit：3ab6c68  
commit message：fix(auth): remove owner fallback from clinic role UI

---

## 1. 背景

Phase 1.5-E-2 read-only audit により、院側 iPad UI に以下の危険な fallback が存在することを確認した。

```txt
currentRole ?? "owner"
```

この実装では、staffName が staff list に一致しない場合や role が未解決の場合に、UI 上 owner 扱いとなる可能性があった。

これは staff login / API認証化の前段でも単独で修正可能な権限上昇リスクであるため、E-2-1 として最小修正を実施した。

---

## 2. 変更ファイル

```txt
client/src/components/ipad-view.tsx
```

変更量：

```txt
+3 / -3
```

関係ないファイルは変更していない。

---

## 3. 修正内容

修正前：

```txt
role 未解決時に currentRole が "owner" へ倒れる可能性があった
```

修正後：

```txt
role 未解決時は currentRole = null
owner 専用 UI は表示しない
role badge も表示しない
tabs filter も null 時は deny 側に倒す
```

---

## 4. 解消したリスク

```txt
staffName が staff list にヒットしない場合に owner 扱いになるリスク
owner-only tab が fallback で表示されるリスク
設定歯車が fallback で表示されるリスク
role badge が誤表示されるリスク
全 tabs filter が owner ベースで動くリスク
```

---

## 5. 検証結果

```txt
npm run build = PASS
owner fallback 残存確認 = 0件
working tree after push = clean
local main = origin/main = 3ab6c68
```

確認済みパターン：

```txt
?? "owner" = 0件
|| "owner" = 0件
```

---

## 6. スコープ外

今回触っていないもの：

```txt
staff login 新規実装
/clinic/login
StaffProtected
requireStaffAuth
/api/staff/me
API認証化
coupons API 500
patient API
Supabase RLS
SQL
Supabase Dashboard
```

---

## 7. 完了判定

```txt
Phase 1.5-E-2-1 currentRole owner fallback hardening = PASS
```

次候補:

```txt
E-2-2: /clinic/login + StaffProtected
E-2-3: requireStaffAuth + /api/staff/me
```
