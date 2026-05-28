# VLUX Phase 1.5-E-2-5 AI / Audio API Hardening Audit

作成日：2026-05-28  
対象：Phase 1.5-E-2-5 AI / audio / SOAP API hardening read-only audit  
判定：read-only audit 完了・実装着手前  
現在HEAD：8fabdf6

---

## 1. 背景

Phase 1.5-E-2-4 までで、staff用 patient / visits API の最優先5本は `requireStaffAuth` と `staffContext.clinicId` により保護された。

次の対象は、PHIが外部AI API・音声処理・SOAP生成に流れる可能性がある AI / 音声系API である。

E-2-5では、実装前にread-only auditを実施し、認証境界、patient / clinic scope、外部AI送信、課金リスクを確認した。

---

## 2. 監査結果サマリ

AI / 音声系APIは5本検出された。

```txt
POST /api/audio/upload
POST /api/transcribe
POST /api/summarize
POST /api/analyze
POST /api/correlate
```

5本すべてが無認証だった。

特に `/api/transcribe` は OpenAI Whisper、`/api/summarize` / `/api/analyze` / `/api/correlate` は Anthropic Claude にPHIを送信し得る。

---

## 3. 対象API一覧

| API | 現状Auth | 外部API | PHIレベル |
|---|---:|---|---|
| POST /api/audio/upload | なし | Supabase Storage | 最大：音声PHI |
| POST /api/transcribe | なし | OpenAI Whisper | 高：音声外部送信 |
| POST /api/summarize | なし | Claude | 高：会話テキスト |
| POST /api/analyze | なし | Claude 2段 | 高：PHI + visit作成 |
| POST /api/correlate | なし | Claude | 高：履歴 + 当日データ |

---

## 4. クライアント由来値を信用している箇所

確認された危険な入力元：

```txt
X-Clinic-Id header
X-Patient-Id header
body.clinic_id
body.patient_id
body.staff_name
```

特に `/api/audio/upload` は `X-Clinic-Id` / `X-Patient-Id` を信用しており、音声ファイルの患者紐付けを改ざんできる可能性がある。

`/api/analyze` は `body.patient_id` / `body.clinic_id` / `body.staff_name` を信用しており、他院patient_idへのvisit作成や誤ったSOAP紐付けのリスクがある。

---

## 5. 外部AI APIへのPHI流路

### 5.1 /api/transcribe

```txt
audio binary
  ↓
OpenAI Whisper
  ↓
transcription text
```

音声データは声紋・会話内容を含むため、PHIとして最大レベルの注意が必要。

### 5.2 /api/summarize

```txt
conversation text
  ↓
Claude
  ↓
SOAP JSON
```

整骨院での会話テキストがAnthropicに送信され得る。

### 5.3 /api/analyze

```txt
transcription + structured_transcripts
  ↓
Claude Haiku
  ↓
Claude Sonnet
  ↓
visits table insert
```

2段のClaude呼び出しにより、PHI送信と課金リスクが大きい。

### 5.4 /api/correlate

```txt
historyText + todayData
  ↓
Claude
  ↓
correlation JSON
```

過去履歴と当日情報をまとめて外部AIに送信し得る。

---

## 6. クリティカルリスク

```txt
無認証Claude API課金消費
無認証OpenAI Whisper API課金消費
PHIを含む音声/会話の外部送信
X-Patient-Id による音声ファイル紐付け改ざん
body.patient_id による他院visit作成
getDemoPatientId / demo fallback による誤った患者帰属
```

---

## 7. audio-recordings bucket

`audio-recordings` bucket は `public:false` で作成されているため、直接の公開漏洩リスクは限定的。

ただし、現在 `getPublicUrl()` が使われているため、非公開bucketに対して実アクセス不能なURLを返す可能性がある。

今後の改善候補：

```txt
getPublicUrl() ではなく createSignedUrl() を使う
署名URLの有効期限を短くする
音声ファイル取得APIにも staff/patient scope を入れる
```

---

## 8. E-2-5 最小hardening対象

E-2-5では、以下5本をまとめて守る方針が妥当。

```txt
POST /api/audio/upload
POST /api/transcribe
POST /api/summarize
POST /api/analyze
POST /api/correlate
```

理由：

```txt
すべてPHIまたは音声を扱う
すべて外部API課金またはStorageコストに関係する
すべてstaff iPad UI由来
patient PWAでは使わない
```

---

## 9. role方針

E-2-5対象APIは、治療・音声入力・AIカルテ生成に関係するため、以下とする。

```txt
owner / staff = 許可
reception = 403
```

既存の `requireStaffOrOwnerRole` を流用する。

---

## 10. clinic / patient scope方針

### 10.1 /api/audio/upload

```txt
clinic_id:
  修正前 = X-Clinic-Id header
  修正後 = req.staffContext.clinicId

patient_id:
  修正前 = X-Patient-Id header
  修正後 = X-Patient-Id または body patient_id を受けても、必ず verifyPatientBelongsToStaffClinic で検証
```

### 10.2 /api/analyze

```txt
clinic_id:
  修正前 = body.clinic_id
  修正後 = req.staffContext.clinicId

patient_id:
  修正前 = body.patient_id または demo fallback
  修正後 = body.patient_id を verifyPatientBelongsToStaffClinic で検証
```

### 10.3 /api/transcribe / summarize / correlate

```txt
まず requireStaffAuth + owner/staff role を適用
patient紐付けがないものは認証・role制御を最小防御とする
```

---

## 11. 既存UIへの影響

staff iPad UIは以下を呼び出している。

```txt
POST /api/audio/upload
POST /api/transcribe
POST /api/summarize
POST /api/analyze
POST /api/correlate
```

既存UIが送っている `X-Clinic-Id` は、後続実装でサーバー側が無視する。

`X-Patient-Id` は互換維持しつつ、サーバー側で `staffContext.clinicId` 配下かを検証する。

---

## 12. スコープ外

E-2-5の範囲外：

```txt
audio-recordings bucket の getPublicUrl → createSignedUrl 化
staff単位 rate limit
getOrCreateDemoClinicAndPatient 全体撤去
/ api / coupons
patient PWA API
staff positive runtime check
```

---

## 13. 完了判定

```txt
Phase 1.5-E-2-5 AI / audio API hardening read-only audit = 完了
```

次の推奨：

```txt
E-2-5 implementation:
W1 POST /api/audio/upload
W2 POST /api/transcribe
W3 POST /api/summarize
W4 POST /api/analyze
W5 POST /api/correlate
```
