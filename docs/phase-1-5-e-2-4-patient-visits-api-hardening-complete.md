# VLUX Phase 1.5-E-2-4 Patient / Visits API Hardening Complete

作成日：2026-05-28  
対象：Phase 1.5-E-2-4 patient / visits API hardening  
判定：PASS with staff positive check deferred  
実装commit：c18c761  
commit message：fix(auth): protect patient and visit staff APIs

---

## 1. 背景

Phase 1.5-E-2-4 では、PHIを扱う patient / visits 系APIのうち、staff iPad UIが実際に利用する最優先5本を `requireStaffAuth` と `staffContext.clinicId` によって保護した。

目的は以下。

```txt
未ログインユーザーが患者・来院APIを叩けないこと
patient auth user がstaff用APIを叩けないこと
clinic_id / patient_id の任意指定による他院PHI参照を防ぐこと
```

---

## 2. 対象API

```txt
GET    /api/patients
GET    /api/visits
PATCH  /api/visits/:id
DELETE /api/visits/:id
POST   /api/patients
```

---

## 3. 実装内容

### 3.1 GET /api/patients

```txt
requireStaffAuth を適用
clinic_id は req.staffContext.clinicId を使用
query clinic_id は信用しない
deleted_at is null を考慮
自院患者のみ返却
owner / staff / reception 全員閲覧可
```

### 3.2 GET /api/visits

```txt
requireStaffAuth を適用
clinic_id は req.staffContext.clinicId を使用
query clinic_id は信用しない
deleted_at is null を考慮
自院visitのみ返却
query patient_id 指定時は患者が自院所属か検証
```

### 3.3 PATCH /api/visits/:id

```txt
requireStaffAuth を適用
owner / staff のみ許可
reception は 403
visit.id が req.staffContext.clinicId に属することを検証
更新時も clinic_id 二重ガード
body の clinic_id / patient_id は信用しない
```

### 3.4 DELETE /api/visits/:id

```txt
requireStaffAuth を適用
owner のみ許可
staff / reception は 403
visit.id が req.staffContext.clinicId に属することを検証
物理DELETEではなく論理削除
deleted_at / deleted_by / delete_reason を利用
```

### 3.5 POST /api/patients

```txt
requireStaffAuth を適用
owner / staff / reception 全員作成可
clinic_id は req.staffContext.clinicId を強制
body clinic_id は信用しない
```

---

## 4. 追加helper

```txt
requireStaffOrOwnerRole
verifyPatientBelongsToStaffClinic
verifyVisitBelongsToStaffClinic
```

---

## 5. Runtime Verification

確認済み：

```txt
npm run build = PASS
npm run check = known 9 errors only
未ログイン /api/patients = 401
未ログイン /api/visits = 401
patient.test01 JWT /api/patients = 403
patient.test01 JWT /api/visits = 403
error = "not a staff"
passIfPatientUser = true
```

---

## 6. 重要な修正：visit削除の論理削除化

当初、`DELETE /api/visits/:id` は既存実装に合わせて物理DELETEのままになっていた。

commit前レビューでこれを停止し、医療情報・監査性方針に合わせて論理削除へ変更した。

```txt
物理DELETE = 不採用
deleted_at / deleted_by / delete_reason による論理削除 = 採用
```

---

## 7. セキュリティ判定

E-2-4 の最低安全条件は以下。

```txt
未ログイン /api/patients = 401
未ログイン /api/visits = 401
patient.test01 JWT /api/patients = 403
patient.test01 JWT /api/visits = 403
```

この条件は PASS。

これにより、staff用の患者一覧・来院一覧APIは、未ログインユーザーおよび patient auth user から保護された。

---

## 8. スコープ外

今回触っていないもの：

```txt
PATCH /api/patients/:id
DELETE /api/patients/:id
POST /api/patients/invite
POST /api/visits
GET /api/health-data
POST /api/health-data
POST /api/health-data/sync
POST /api/audio/upload
POST /api/summarize
POST /api/analyze
POST /api/correlate
/api/coupons
patient PWA /api/patient/*
staff positive runtime verification
```

---

## 9. 完了判定

```txt
Phase 1.5-E-2-4 patient / visits API hardening = PASS with staff positive check deferred
```

次候補：

```txt
E-2-5: 残りPHI系API hardening
E-2-6: AI / 音声系API hardening
E-2-7: health-data系API hardening
follow-up: coupons API 500 graceful return
follow-up: staff JWT positive runtime check
```
