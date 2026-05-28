# VLUX Phase 1.5-E-2-3 Staff / Clinic Admin API Hardening Complete

作成日：2026-05-28  
対象：Phase 1.5-E-2-3 staff / clinic admin API hardening  
判定：PASS with staff positive check deferred  
実装commit：736c0d2  
commit message：fix(auth): protect staff and clinic admin APIs

---

## 1. 背景

Phase 1.5-E-2-2 で `/clinic/login`、`StaffProtected`、`/api/staff/me` を追加し、院側画面の入口を staff membership で保護した。

E-2-3 では次段階として、院側UIが利用する staff / clinic 管理APIの入口を `requireStaffAuth` で保護した。

目的は、以下の2点。

```txt
未ログインユーザーが院側管理APIを叩けないこと
patient auth user が院側管理APIを叩けないこと
```

---

## 2. 対象API

今回hardeningしたAPIは以下の5本。

```txt
GET    /api/admin/clinic
PATCH  /api/admin/clinic
GET    /api/staffs
POST   /api/staffs
DELETE /api/staffs/:id
```

---

## 3. 実装内容

### 3.1 GET /api/admin/clinic

```txt
requireStaffAuth を適用
clinic_id は req.staffContext.clinicId を使用
自院clinicのみ返却
owner / staff / reception すべて閲覧可
```

### 3.2 PATCH /api/admin/clinic

```txt
requireStaffAuth を適用
owner のみ許可
owner以外は 403
更新対象 clinic_id は req.staffContext.clinicId
client body の clinic_id は信用しない
```

### 3.3 GET /api/staffs

```txt
requireStaffAuth を適用
clinic_id は req.staffContext.clinicId を使用
query clinic_id は信用しない
自院staffのみ返却
owner / staff / reception すべて閲覧可
```

### 3.4 POST /api/staffs

```txt
requireStaffAuth を適用
owner のみ許可
owner以外は 403
clinic_id は req.staffContext.clinicId を強制
client body の clinic_id は信用しない
```

### 3.5 DELETE /api/staffs/:id

```txt
requireStaffAuth を適用
owner のみ許可
owner以外は 403
削除対象staffが req.staffContext.clinicId に属する場合のみ削除
自己削除は禁止
最後の owner 削除は禁止
```

---

## 4. 重要な設計判断

今回のhardeningでは、クライアント由来の `clinic_id` を信用しない。

```txt
NG: req.query.clinic_id
NG: req.body.clinic_id
OK: req.staffContext.clinicId
```

これにより、URL query や request body の改ざんによる他院データ参照・更新を防ぐ。

---

## 5. Runtime Verification

確認済み：

```txt
npm run build = PASS
npm run check = known 9 errors only
未ログイン /api/admin/clinic = 401
未ログイン /api/staffs = 401
patient.test01 JWT /api/admin/clinic = 403
patient.test01 JWT /api/staffs = 403
error = "not a staff"
passIfPatientUser = true
```

---

## 6. Staff Positive Check

staff JWT による positive check は、staff password 未確認のため deferred。

対象staff auth user：

```txt
yamada@vlux.local
sato@vlux.local
tanaka@vlux.local
```

password reset / service_role による auth user 操作は安全のため実施していない。

---

## 7. セキュリティ判定

E-2-3 の最低安全条件は以下。

```txt
未ログイン /api/admin/clinic = 401
未ログイン /api/staffs = 401
patient.test01 JWT /api/admin/clinic = 403
patient.test01 JWT /api/staffs = 403
```

この条件は PASS。

これにより、院側 staff / clinic 管理APIの入口は、少なくとも未ログインユーザーおよび patient auth user から保護された。

---

## 8. スコープ外

今回触っていないもの：

```txt
GET /api/clinics
POST /api/clinics
DELETE /api/clinics/:id
/api/patient/*
/api/coupons
visits / patients 系API
audio-upload
role-based API 制御の詳細化
staff positive runtime verification
Supabase RLS
SQL
Supabase Dashboard
```

---

## 9. 完了判定

```txt
Phase 1.5-E-2-3 staff / clinic admin API hardening = PASS with staff positive check deferred
```

次候補：

```txt
E-2-3 runtime follow-up: staff JWT positive check
E-2-4: patient / visits 系API hardening
E-2-5: role-based API 制御
follow-up: coupons API 500 graceful return
follow-up: getDemoPatientId 残存整理
```
