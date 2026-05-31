# VLUX Phase 1.5-E-2-5 AI / Audio API Hardening Complete

作成日：2026-05-31
対象：Phase 1.5-E-2-5 AI / 音声 API hardening
判定：**PASS**
実装 commit：`cf3879f`
commit message：`fix(auth): protect ai audio staff APIs`

---

## 1. 背景

Phase 1.5-E-2-5 audit（`docs/phase-1-5-e-2-5-ai-audio-api-audit.md`、commit `cb1e3b6`）で、AI / 音声系 5 endpoint が完全無認証であり、外部 Claude / OpenAI Whisper API に PHI を送信し得る状態が確認されていた。

本 commit `cf3879f` により、5 endpoint すべてに staff 認証境界を導入し、E-2-2 / E-2-3 / E-2-4 と同じ防御パターンを適用した。

---

## 2. 変更ファイル

```txt
server/routes.ts
client/src/pages/clinic.tsx
```

変更行数：

```txt
+57 / -18
2 files changed
```

---

## 3. 対象 endpoint

```txt
POST /api/audio/upload    （Supabase Storage に音声 PHI を upload）
POST /api/transcribe      （OpenAI Whisper で音声 → テキスト）
POST /api/summarize       （Claude で会話 → 要約 JSON）
POST /api/analyze         （Claude Haiku + Sonnet 2 段で SOAP カルテ生成 + visit 作成）
POST /api/correlate       （Claude で履歴 + 当日 → 相関分析）
```

---

## 4. 防御方式

すべての対象 endpoint に以下を適用：

```txt
requireStaffAuth           : JWT 検証 + staffs.user_id 照合 + clinics.owner_id NULL は 403
requireStaffOrOwnerRole    : owner / staff のみ許可、reception は 403
```

加えて W1（audio/upload）と W4（analyze）には：

```txt
verifyPatientBelongsToStaffClinic : patient_id が staffContext.clinicId 配下か検証、不一致は 404
```

新規 helper は追加せず、E-2-2 〜 E-2-4 で導入した既存 helper を流用。

---

## 5. 重要な設計判断

### 5.1 /api/audio/upload

```txt
X-Clinic-Id ヘッダは信用しない（無視）
staffContext.clinicId を強制使用
X-Patient-Id ヘッダを verifyPatientBelongsToStaffClinic で検証、不一致は 404
filePath は `${ctx.clinicId}/${patient_id}/${phase}_${timestamp}.${ext}` で統一
```

### 5.2 /api/analyze

```txt
body.clinic_id は信用しない（無視）
staffContext.clinicId を強制使用
body.patient_id を必須化、なければ 400
body.patient_id を verifyPatientBelongsToStaffClinic で検証、不一致は 404
getOrCreateDemoClinicAndPatient による demo fallback を撤去
visit INSERT 時の clinic_id / patient_id は検証済み値を使用
body.staff_name は既存 UX 互換のため維持
```

### 5.3 /api/transcribe / /api/summarize / /api/correlate

```txt
patient 紐付けはなし
requireStaffAuth + requireStaffOrOwnerRole の最小防御
既存の rate limit / OpenAI Whisper / Claude 呼び出しロジックは変更なし
```

### 5.4 UI 修正（client/src/pages/clinic.tsx）

```txt
import { supabase } from "@/lib/supabase" を追加
callTranscribe : supabase.auth.getSession() で token 取得、Authorization Bearer 付与
                 session なしは throw（UI エラー表示）
audio/upload  : 同様に Authorization Bearer 付与
                X-Clinic-Id ヘッダを削除（サーバーで無視されるが念のため明示削除）
```

---

## 6. 検証結果

### 6.1 build / typecheck

```txt
npm run build : 成功
                client bundle 変化なし
                server bundle 958.7 → 959.0 KB（+0.3 KB）
npm run check : 既知 9 件のまま、新規 0 件
```

### 6.2 未ログイン 5 本 smoke（curl）

```txt
/api/audio/upload   http_code=401 body={"error":"unauthorized"}
/api/transcribe     http_code=401 body={"error":"unauthorized"}
/api/summarize      http_code=401 body={"error":"unauthorized"}
/api/analyze        http_code=401 body={"error":"unauthorized"}
/api/correlate      http_code=401 body={"error":"unauthorized"}
```

判定：5 本すべて 401 PASS。

### 6.3 patient JWT 5 本 smoke（ブラウザ DevTools Console、patient.test01）

```txt
/api/audio/upload   status=403 pass=true error="not a staff"
/api/transcribe     status=403 pass=true error="not a staff"
/api/summarize      status=403 pass=true error="not a staff"
/api/analyze        status=403 pass=true error="not a staff"
/api/correlate      status=403 pass=true error="not a staff"
```

判定：5 本すべて 403 PASS。`requireStaffAuth` が patient JWT を staffs テーブル未登録として正しく拒否。

### 6.4 既存 11 本 regression

```txt
/api/staff/me        http_code=401
/api/admin/clinic    http_code=401
/api/staffs          http_code=401
/api/patients        http_code=401
/api/visits          http_code=401
/api/patient/me      http_code=401
（他、E-2-3 / E-2-4 で hardening 済みの全 endpoint）
```

判定：regression なし。E-1 / E-2-2 / E-2-3 / E-2-4 で防御済み全 endpoint が引き続き 401。

### 6.5 AI / OpenAI / Claude API コスト

```txt
コスト発生：0 円
理由：minimal body で validation 段階で 400 になるため、外部 API は呼び出されていない
本物の analyze 1 回（Claude Haiku + Sonnet 呼び出し）は deferred
```

### 6.6 DB 影響

```txt
新規 visit 作成：0 行
新規 patients / clinics / staffs / health_data 変更：0 行
検証は minimal body smoke のみで完結
```

---

## 7. 制約遵守

```txt
✅ DB schema / RLS / Supabase Dashboard 操作なし
✅ service_role / Auth Admin API 使用なし
✅ auth.users 直接 SQL 更新なし
✅ .env.local 中身表示なし
✅ secret / token / password / access_token / refresh_token 表示なし
✅ git add . 不使用（明示指定 2 ファイル）
✅ unrelated cleanup なし
✅ 新規 helper 追加なし（既存 requireStaffAuth / requireStaffOrOwnerRole / verifyPatientBelongsToStaffClinic を流用）
✅ 通常 push（--force / --force-with-lease 未使用）
✅ stage safety check PASS（2 ファイルのみ）
✅ remote safety check PASS（origin/main = c69ad6b で fast-forward）
```

---

## 8. 残課題

### 8.1 deferred（本フェーズで意図的に保留）

```txt
staff JWT positive runtime check（5 endpoint で非 401 確認）
  → staff password の取得手段確立後に実施（C-2 再構築 or yamada/sato/tanaka password 確定後）

本物の analyze 1 回（Claude Haiku + Sonnet 実呼び出し）
  → AI コスト発生のため deferred、Phase 2 βテスト前の最終疎通確認時に実施
```

### 8.2 別 PR で対応予定

```txt
audio-recordings bucket の signed URL 化（現状 getPublicUrl()、bucket は public:false なので即時漏洩リスクは限定的）
audio retention policy（過去音声の保存期間 / 自動削除）
staff 単位 rate limit（現状 IP 単位 10/min、staff_id 単位へ）
getDemoPatientId 残存整理（/api/dev/seed、/api/health-data/sync 等の demo fallback 撤去）
coupons 500 graceful return（coupons テーブル不在を空配列で返す）
getUserFromToken err logging を err?.message に絞る
buildAuthHeaders simplification
残り PHI 系 API hardening（PATCH /api/patients/:id、DELETE /api/patients/:id、POST /api/patients/invite、POST /api/visits、health-data 系）
```

### 8.3 Phase 2 候補

```txt
phase2_rls_apply.sql の適用（DB 層 RLS 本格化）
audio-recordings bucket の lifecycle / retention 設計
multi-tenant 拡張（20 院規模）
日本 SMS provider 接続 + Supabase Send SMS Hook
```

---

## 9. 完了判定

```txt
Phase 1.5-E-2-5 AI / 音声 API hardening = PASS
（staff JWT positive runtime check と本物 analyze は意図的に deferred、別タスクで対応）
```

これにより、Phase 1.5-E の最大の残セキュリティ穴であった「外部 Claude / OpenAI API への PHI 無認証送信路」が閉じられた。CLAUDE.md「Claude API への PHI 混入を防ぐ」「音声データの適切な管理」最優先原則への直接対応が完了。

---

## 10. 関連 reference

```txt
docs/phase-1-5-e-2-5-ai-audio-api-audit.md                          E-2-5 audit（cb1e3b6）
docs/phase-1-5-e-completion-record.md                               Phase 1.5-E 統合完了記録（c69ad6b）
docs/phase-1-5-e-5-owner-real-jwt-verification.md                   E-5 owner JWT verification
docs/phase-1-5-e-2-4-patient-visits-api-hardening-complete.md       E-2-4 patient/visits API hardening
docs/phase-1-5-e-2-3-staff-clinic-api-hardening-complete.md         E-2-3 staff/clinic admin API hardening
docs/phase-1-5-e-2-2-staff-login-clinic-protect-complete.md         E-2-2 staff login + StaffProtected
docs/phase-1-5-c-complete.md                                        Service Role 集約（service_role 禁止方針の根拠）
server/middleware/requireStaffAuth.ts                               staff 認証 middleware（E-2-2 で導入）
server/routes.ts                                                    requireStaffOrOwnerRole / verifyPatientBelongsToStaffClinic（E-2-4 で導入）
```
