# VLUX Phase 1.5-E-2-4 Patient / Visits API Hardening Audit

作成日：2026-05-28  
対象：Phase 1.5-E-2-4 patient / visits API hardening read-only audit  
判定：read-only audit 完了・実装着手前  
現在HEAD：9ef6948

---

## 1. 背景

Phase 1.5-E-2-3 までで、院側ログイン、StaffProtected、`/api/staff/me`、staff / clinic admin API 5本のhardeningが完了した。

次の対象は、患者情報・カルテ・健康データなどPHIを扱う patient / visits 系APIである。

E-2-4では、実装前にread-only auditを実施し、認証境界・clinic scope・patient scope・role制御の現状を確認した。

---

## 2. 監査結果サマリ

検出された patient / visits / health / AI / audio 系APIは17本。

そのうち、13本以上のPHI系APIが無認証であり、`clinic_id` / `patient_id` をクライアント由来で信用している箇所が確認された。

重要な問題：

```txt
requireStaffAuth 未適用
clinic_id を query / body から受け取っている
patient_id を query / body / params から受け取り、clinic照合していない
patient_id 経由の clinic 照合が存在しない
audio upload は X-Patient-Id / X-Clinic-Id ヘッダを信用している
```

---

## 3. 既に防御済みのAPI

### 3.1 Patient PWA系

E-1で防御済み：

```txt
GET /api/patient/me
GET /api/patient/profile
GET /api/patient/visits
GET /api/patient/health-data
```

### 3.2 Staff / Clinic admin系

E-2-2 / E-2-3で防御済み：

```txt
GET /api/staff/me
GET /api/admin/clinic
PATCH /api/admin/clinic
GET /api/staffs
POST /api/staffs
DELETE /api/staffs/:id
```

---

## 4. 問題が確認された主なAPI

```txt
GET /api/patients
POST /api/patients
PATCH /api/patients/:id
DELETE /api/patients/:id
POST /api/patients/invite
GET /api/visits
POST /api/visits
PATCH /api/visits/:id
DELETE /api/visits/:id
GET /api/health-data
POST /api/health-data
POST /api/health-data/sync
POST /api/audio/upload
POST /api/summarize
POST /api/analyze
POST /api/correlate
```

---

## 5. クライアント由来値を信用している箇所

```txt
req.query.clinic_id
req.query.patient_id
req.body.clinic_id
req.body.patient_id
req.params.id
X-Patient-Id header
X-Clinic-Id header
```

これらは、E-2-4以降で `staffContext.clinicId` または patient本人JWTに基づく値へ寄せる必要がある。

---

## 6. 既存UIとの関係

staff iPad UIが実際に呼んでいる主要API：

```txt
GET /api/patients?clinic_id=${clinicId}
POST /api/patients
POST /api/patients/invite
GET /api/visits?clinic_id=${clinicId}
PATCH /api/visits/:id
POST /api/summarize
POST /api/audio/upload
POST /api/analyze
POST /api/correlate
```

patient PWA由来：

```txt
POST /api/health-data/sync
/api/coupons*
```

注意：

```txt
/api/health-data/sync は patient PWA 由来のため、staff authを一律適用しない。
```

---

## 7. E-2-4で最初にhardeningすべき5本

E-2-4の最小実装対象：

```txt
GET /api/patients
GET /api/visits
PATCH /api/visits/:id
DELETE /api/visits/:id
POST /api/patients
```

理由：

```txt
staff iPad UIが実際に使っている
PHIを直接扱う
clinic_id / patient_id の不正指定リスクが高い
既存 patient PWA /api/patient/* とパス分離されている
影響範囲を5本に限定できる
```

---

## 8. role方針

```txt
GET /api/patients       = owner / staff / reception
GET /api/visits         = owner / staff / reception
PATCH /api/visits/:id   = owner / staff
DELETE /api/visits/:id  = owner only
POST /api/patients      = owner / staff / reception
```

---

## 9. scope方針

```txt
clinic_id は req.staffContext.clinicId を強制
query/body由来 clinic_id は信用しない
patient_id指定時は patients.clinic_id === staffContext.clinicId を検証
visit操作時は visits.clinic_id === staffContext.clinicId を検証
deleted_at is null を考慮
```

---

## 10. helper候補

```txt
verifyPatientBelongsToStaffClinic(patientId, clinicId)
verifyVisitBelongsToStaffClinic(visitId, clinicId)
requireStaffOrOwnerRole(req, res)
```

---

## 11. E-2-4のスコープ外

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
GET /api/coupons
POST /api/coupons/issue
```

これらは後続PRで扱う。

---

## 12. 主要リスク

```txt
マルチテナントPHI漏洩
他院patient_id指定によるカルテ参照
他院visit_id指定による更新・削除
patient PWAとのregression
visit.clinic_id NULLレコードの扱い
staff positive runtime check deferred
```

E-2-4では NULL / deleted_at は deny側に倒す。

---

## 13. 完了判定

```txt
Phase 1.5-E-2-4 patient / visits API hardening read-only audit = 完了
```

次の推奨：

```txt
E-2-4 implementation:
Q1 GET /api/patients
Q2 GET /api/visits
Q3 PATCH /api/visits/:id
Q4 DELETE /api/visits/:id
Q5 POST /api/patients
```
