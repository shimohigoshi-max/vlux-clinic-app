# VLUX Phase 1.5-E-2-2 Staff Login / Clinic Protect Complete

作成日：2026-05-28  
対象：Phase 1.5-E-2-2 staff login / clinic protect  
判定：PASS with staff positive check deferred  
実装commit：bb0c91f  
commit message：feat(auth): add staff login and clinic route protection

---

## 1. 背景

Phase 1.5-E-2 では、院側画面 `/clinic` が未保護であり、staff login / clinic protect / iPad route protection が必要と判断された。

単なる Supabase Auth ログイン判定だけで `/clinic` を保護すると、patient auth user が院側画面に入れる可能性がある。

そのため、E-2-2 では staff membership を確認する `/api/staff/me` を追加し、`StaffProtected` は `/api/staff/me` の結果で `/clinic` 表示可否を判定する方針とした。

---

## 2. 実装内容

追加・変更内容：

```txt
server/middleware/requireStaffAuth.ts
client/src/pages/login-staff.tsx
client/src/components/StaffProtected.tsx
client/src/App.tsx
server/routes.ts
```

主な実装：

```txt
requireStaffAuth middleware 追加
GET /api/staff/me 追加
/clinic/login ページ追加
StaffProtected 追加
/clinic route を StaffProtected で保護
/patient route は既存 PatientProtected を維持
```

---

## 3. requireStaffAuth の仕様

```txt
JWTなし・JWT不正 = 401
Auth user は存在するが staff ではない = 403
staff / clinic scope が成立 = req.staffContext を付与
```

staff context には以下を含める。

```txt
userId
staffId
clinicId
role
staffName
clinicName
```

---

## 4. /api/staff/me

`GET /api/staff/me` を追加。

目的：

```txt
ログイン済みAuth userが院側staffであるか確認する
staff / clinic 情報をStaffProtectedへ返す
patient userを403で拒否する
```

返却対象：

```txt
staff id
staff name
staff role
clinic id
clinic name
```

secret / token / user_id は返さない。

---

## 5. Runtime Verification

確認済み：

```txt
npm run build = PASS
npm run check = known 9 errors only
未ログイン /api/staff/me = 401
patient.test01 JWT /api/staff/me = 403
error = "not a staff"
passIfPatientUser = true
/clinic = SPA 200
/clinic/login = SPA 200
/patient = SPA 200
/patient/login = SPA 200
```

---

## 6. Staff Positive Check

staff JWT `/api/staff/me = 200` は、staff password 未確認のため deferred。

対象staff auth user：

```txt
yamada@vlux.local
sato@vlux.local
tanaka@vlux.local
```

password reset / service_role による auth user 操作は安全のため実施していない。

---

## 7. セキュリティ判定

E-2-2 の最低安全条件は以下。

```txt
patient.test01 JWT /api/staff/me = 403
```

この条件は PASS。

これにより、patient auth user が staff membership を持たない限り、`StaffProtected` を通過できない設計になった。

---

## 8. スコープ外

今回触っていないもの：

```txt
大量API認証化
role-based API制御
coupons API 500
patient API
Supabase RLS
SQL
Supabase Dashboard
password reset
staff positive runtime verification
```

---

## 9. 完了判定

```txt
Phase 1.5-E-2-2 staff login / clinic protect = PASS with staff positive check deferred
```

次候補：

```txt
E-2-2 runtime follow-up: staff JWT /api/staff/me = 200
E-2-3: staff API / clinic API の最小hardening
E-2-4: role-based API制御
```
