# VLUX Phase 1.5-E-2 Staff Auth / Clinic Protect Design Audit

作成日：2026-05-28
対象：Phase 1.5-E-2 staff login / clinic protect / iPad route protection
判定：**read-only audit 完了・実装着手前**

---

## 0. 前提

- 開始 HEAD：`42502e5`（local main = origin/main、Phase 1.5-E-1 hardening pass docs commit）
- working tree：clean
- 実施内容：read-only audit のみ。コード変更・SQL・Dashboard 操作・npm 実行は一切なし。

---

## 1. staff login UI は未存在

| ファイル | 状態 |
|---------|------|
| `client/src/pages/login-staff.tsx` | ❌ **存在しない** |
| `client/src/pages/login-patient.tsx` | ✅ 存在（Phase 1.5-E-1 で作成済み） |

→ Phase 1.5-E-2 で `login-staff.tsx` を新規作成する必要がある。`login-patient.tsx` を雛形にできる。

---

## 2. ルート構成

`client/src/App.tsx` の現状：

```tsx
<Switch>
  <Route path="/"              component={Home} />
  <Route path="/clinic"        component={ClinicApp} />        {/* ★ 保護なし */}
  <Route path="/patient/login" component={LoginPatient} />
  <Route path="/patient">
    <PatientProtected>
      <PatientApp />
    </PatientProtected>
  </Route>
  <Route component={NotFound} />
</Switch>
```

| 観点 | 状態 |
|------|------|
| `/patient` | ✅ `PatientProtected` 済み（Phase 1.5-E-1） |
| `/clinic` | ❌ **保護なし**（ノーガード） |
| `/clinic/login` | ❌ 未定義 |
| `StaffProtected` | ❌ 未定義 |

→ Phase 1.5-E-2 で **`/clinic/login` 新設**および **`<StaffProtected>` ラッパ**を追加する。

---

## 3. AuthProvider / useAuth

| 場所 | 使用状況 |
|------|---------|
| `client/src/App.tsx` | ✅ `AuthProvider` で全体ラップ、`PatientProtected` で `useAuth` |
| `client/src/pages/login-patient.tsx` | ✅ `useAuth` で `signInWithPassword` / redirect |
| `client/src/pages/clinic.tsx` | ❌ **未使用** |
| `client/src/components/ipad-view.tsx` | ❌ **未使用** |

→ staff 側にも `useAuth`（既存）または `useStaff`（新規予定）を導入する必要がある。staff context 解決のために新規 hook を追加する方が責務分離は明確。

---

## 4. API 認証境界

### 4-a. 現状の認証適用状況

| 状態 | 件数 | 内訳 |
|------|------|------|
| ✅ 認証あり | 4 | `/api/patient/me` `/profile` `/visits` `/health-data`（Phase 1.5-E-1）|
| ❌ 認証なし（要対応） | **25 本以上** | staff / clinic / patients / visits / admin / audio-upload 等 |
| 別フロー | 4 | Google OAuth（session ベース、独立） |

### 4-b. 認証なし 25 本以上の優先度別内訳

| 優先度 | エンドポイント | 件数 |
|--------|---------------|------|
| **最優先**（PHI / admin 書き込み / 破壊操作） | `PATCH /api/admin/clinic`, `GET /api/admin/clinic`, `GET /api/staffs`, `GET /api/patients`, `POST /api/patients`, `PATCH /api/patients/:id`, `DELETE /api/patients/:id`, `GET /api/visits`, `PATCH /api/visits/:id`, `DELETE /api/visits/:id`, `POST /api/audio/upload` | 11 |
| 高 | `POST /api/staffs`, `DELETE /api/staffs/:id`, `POST /api/visits`, `POST /api/patients/invite`, `POST /api/summarize / analyze / correlate`, `POST/DELETE /api/clinics`, `DELETE /api/clinics/:id` | 9 |
| 中 | `GET /api/clinics`, `GET/POST/DELETE /api/health-data*`, `POST /api/health-data/sync`, `GET /api/coupons`, `POST /api/coupons/issue` | 7 |
| 低 | `POST /api/dev/seed`（production で 403 自動） | 1 |

### 4-c. 段階的な適用方針

**全 API を一度に修正しない**。最優先 11 本から始め、検証後に高→中→低の順に拡張する。

---

## 5. staffs / clinics 基盤

| 項目 | 状態 |
|------|------|
| `staffs.role` enum | `"owner" / "staff" / "reception"`（`server/routes.ts:713` の `staffInsertSchema`）✅ |
| `staffs.user_id` バックフィル | Phase 1.5-A 完了（山田 / 佐藤 / 田中、3 名分が `auth.users` と紐付け済み）✅ |
| `clinics.owner_id` バックフィル | 堺整骨院（テスト）= 山田の `auth.users.id`、VLUXデモクリニックは意図的に NULL ✅ |

→ staff scope を実装するための **DB 基盤データは既に整っている**。サーバー側で `staffs.user_id = req.authUser.id` 照合をすれば clinic_id / role が得られる。

---

## 6. requireStaffAuth の必要性

### 既存 `server/middleware/requireAuth.ts`（26 行）

```typescript
req.authUser = { id: user.id, email: user.email };  // user_id のみ
```

→ user_id しか持たない。staff API には **追加情報** が必要。

### 設計：新規 `server/middleware/requireStaffAuth.ts` を作る

```typescript
// 概念図（実装はまだ）
req.staffContext = {
  userId: user.id,
  staffId: staffRow.id,
  clinicId: staffRow.clinic_id,
  role: staffRow.role,  // "owner" | "staff" | "reception"
};
```

### 401 と 403 の区別

| ステータス | 条件 |
|----------|------|
| 401 | Authorization 欠如 / JWT 無効（既存 `requireAuth` と同じ） |
| 403 | JWT は有効だが、`staffs.user_id` に該当 staff レコードがない（患者がスタッフ画面にアクセスしようとした等）|

→ patient と staff の二系統 Auth を同じ Supabase Auth で動かしつつ、staff API 側でのみ「staff か否か」を後段で判定する設計。

---

## 7. role-based tab control の問題（既存実装の脆弱性）

### 既存：`client/src/components/ipad-view.tsx:472-487`

```typescript
const currentStaff = staffs.find(s => s.name === staffName) ?? null;
const currentRole: "owner" | "staff" | "reception" = currentStaff?.role ?? "owner";
```

### 検出された問題

| # | 問題 | 影響 |
|---|------|------|
| 1 | フォールバックが `"owner"` | 該当 staff 見つからない時に**最強権限**を付与 → **権限上昇リスク** |
| 2 | `staffName` 由来（`clinic.tsx:184: useState<string>("院長 山田")`）| **JWT セッションと連動していない** |
| 3 | `staffs.find(s => s.name === staffName)` で同名 staff の先頭ヒット | **同名 staff の動作不定** |
| 4 | API は role 制限を見ない | UI で隠しても **curl で直接叩ける** |

### 修正方針

- 第一手：`currentRole ?? "owner"` を **`null` 既定 + tab 非表示 + 403 リダイレクト**に変更
- 第二手：`staffName` 由来を撤廃、JWT `staffContext.role` を React に流す
- 第三手：API 側でも `staffContext.role` を見て制限（reception は visits 削除不可など）

---

## 8. 推奨実装順

| 段階 | 内容 | 規模 |
|------|------|------|
| **E-2-0** | この設計 audit を docs 化 → commit + push（本タスク） | 1 ファイル新規 |
| **E-2-1** | `currentRole ?? "owner"` フォールバックを **null / deny 側**に寄せる（最小 PR、即時の権限上昇リスク解消） | ipad-view.tsx 数行 |
| **E-2-2** | `/clinic/login` 新規 + `<StaffProtected>` 追加 | login-staff.tsx 新規、App.tsx +20 行 |
| **E-2-3** | `requireStaffAuth.ts` 新規 + `/api/staff/me` エンドポイント追加（patient/me と対称、staff context の存在確認用）| middleware 新規、routes.ts +20 行 |
| **E-2-4** | 最優先 11 本 API に `requireStaffAuth` 適用 + clinic_id スコープ | routes.ts +50〜100 行 |
| **E-2-5** | role-based API 制御（reception 制限、ec-sales = owner 限定等） | routes.ts +30 行 |
| **E-2-6** | 残り API（高・中優先度）の hardening | 別 PR で分割実施 |

各段階を**独立した PR / commit**として分けることで、ロールバック容易性と検証容易性を確保する。

---

## 9. 今回（および本フェーズで）触らないもの

| 領域 | 理由 |
|------|------|
| `/api/patient/*` ファミリー | Phase 1.5-E-1 hardening 完了済み、ロジック保持 |
| `server/lib/supabaseService.ts` | Phase 1.5-C 集約済み、再触禁止 |
| `phase2_rls_apply.sql` | 未適用、Phase 1.5-E-2 でも適用しない |
| Twilio 関連 | 不採用方針継続 |
| chat 永続化 | 別タスク |
| coupons API 500 | 別タスク（`coupons` テーブル不在対応） |
| 既知 9 件 TS エラー | Phase 1.5-E-2 対象外 |
| Google OAuth セッション | 別フロー、独立に動作中 |
| `server/storage.ts`（passport-local boilerplate） | dead だが削除リスクあり、触らない |
| VLUXデモクリニック `owner_id` NULL | Phase 1.5-A で意図的に NULL 保持、staff 認証後の挙動を別途判断 |

---

## 10. 認識リスクと対策（再掲）

| リスク | 対策案 |
|--------|-------|
| VLUXデモクリニックに紐づく staff がいない | デモクリニックは staff 認証で到達不可とする運用、または demo 用 staff 追加（要判断） |
| `currentRole ?? "owner"` の暫定挙動 | **E-2-1 で先行修正**して権限上昇リスクを早期に解消 |
| 1 user_id に staff 複数行リスク | `single()` 失敗ハンドリング、または DB UNIQUE 制約検討 |
| `<select>` staffName 手動切替の UX | JWT 由来は「自動的に決まる」前提に変更、UX 互換維持は別議論 |
| `req.staffContext` の TS 型拡張 | 既存 `authUser` と別ファイルで `declare global namespace Express` 拡張、衝突しない |

---

## 11. 制約遵守（本ドキュメント作成時点）

- ✅ コード変更なし（read-only audit のみ）
- ✅ git add `.` 不使用（特定ファイル指定のみ）
- ✅ `.env.local` 中身表示なし
- ✅ secret / key / token 値の表示なし
- ✅ access_token / refresh_token 表示なし
- ✅ SQL / Supabase Dashboard 操作なし
- ✅ npm install / dev 未実行

---

## 12. 関連 reference

- `docs/phase-1-5-a-complete.md` — staff Auth 接続確認（バックフィル済みデータの根拠）
- `docs/phase-1-5-b-patient-decision.md` — 患者既存 6 件の取り扱い
- `docs/phase-1-5-c-complete.md` — Service Role Key 集約
- `docs/phase-1-5-e-1-patient-auth-minimum-complete.md` — Patient Auth 最小実装
- `docs/phase-1-5-e-1-runtime-verification-complete.md` — Runtime Verification PASS
- `docs/phase-1-5-e-1-followup-ui-binding-audit.md` — UI バインド監査（hardening のトリガー）
- `docs/phase-1-5-e-1-patient-api-hardening-complete.md` — Patient API hardening 完了
- `server/middleware/requireAuth.ts` — 既存 middleware（Phase 1.5-E-2 で参考実装）
- `server/lib/supabaseService.ts` — JWT 検証ヘルパー（流用予定）
- `client/src/pages/login-patient.tsx` — login UI 雛形（login-staff.tsx の参考）
- `client/src/components/ipad-view.tsx:472-487` — `currentRole` フォールバック問題箇所
- `server/routes.ts:710-716` — `staffInsertSchema`（role enum 定義）
