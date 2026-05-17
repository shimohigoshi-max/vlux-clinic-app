/**
 * server/lib/supabaseService.ts
 *
 * VLUX Phase 1.5：Service Role Key 集約ファイル
 *
 * ⚠⚠⚠ 重要 ⚠⚠⚠
 * このファイルは Service Role Key（RLSをバイパスする最強権限キー）を
 * 使う処理を**唯一**集約する場所です。
 *
 * ルール：
 *   1. SUPABASE_SERVICE_ROLE_KEY の参照は、このファイル以外では禁止
 *   2. 通常の API ルートから serviceClient を import するのは原則禁止
 *   3. 例外的に Service Role を使ってよいのは以下のみ：
 *      - Twilio Webhook ハンドラ（※Phase 1.5以降は日本SMSサービスに変更予定）
 *      - cron / 定期実行バッチ
 *      - 管理者専用エンドポイント（要監査ログ）
 *
 * これ以外の用途で本ファイルを import している箇所が見つかったら、
 * CI / lint で失敗させる（grep ベースの簡易チェックで十分）。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// 環境変数の読み込み
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('[supabaseService] SUPABASE_URL が未設定です');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[supabaseService] SUPABASE_SERVICE_ROLE_KEY が未設定です。' +
    'Replit Secrets に sb_secret_-... 形式のキーを登録してください'
  );
}

// =============================================================================
// Service Role 専用クライアント
// =============================================================================

/**
 * Service Role クライアント。
 * RLS を完全にバイパスする。利用は本ファイル内 or ホワイトリスト経由のみ。
 */
const serviceClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// =============================================================================
// JWT 検証ヘルパー
// =============================================================================

/**
 * Authorization ヘッダから JWT を取り出して検証し、user 情報を返す。
 *
 * ⚠ 重要：JWT の payload を独自 decode で信用するのは禁止。
 *          必ず supabase.auth.getUser(token) で検証する。
 *
 * @param authHeader - "Bearer xxxxx..." 形式の Authorization ヘッダ値
 * @returns 認証成功時は user オブジェクト、失敗時は null
 */
export async function getUserFromToken(
  authHeader: string | undefined
): Promise<{
  id: string;
  phone: string | null;
  email: string | null;
  raw: any;
} | null> {
  if (!authHeader) {
    return null;
  }

  // "Bearer " プレフィックスを除去
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : authHeader.trim();

  if (!token) {
    return null;
  }

  try {
    // Supabase Auth サーバーに検証を任せる（独自 decode は使わない）
    const { data, error } = await serviceClient.auth.getUser(token);

    if (error || !data?.user) {
      console.warn('[getUserFromToken] 検証失敗:', error?.message);
      return null;
    }

    return {
      id: data.user.id,
      phone: data.user.phone ?? null,
      email: data.user.email ?? null,
      raw: data.user,
    };
  } catch (err) {
    console.error('[getUserFromToken] 例外:', err);
    return null;
  }
}

// =============================================================================
// 公開エクスポート
// =============================================================================

/**
 * Service Role クライアントの限定公開。
 *
 * ⚠ このシンボルを import している箇所は CI / lint で監視する。
 *    許可リスト：
 *      - server/webhooks/*.ts（SMS送信プロバイダー連携等）
 *      - server/cron/*.ts
 *      - server/admin/*.ts（admin 認証済みルートのみ）
 *
 * 通常の API ルートからは、auth middleware 経由で作成される
 * authenticated client（別ファイルで実装予定）を使うこと。
 */
export { serviceClient };

// =============================================================================
// 開発用デバッグ関数（本番では呼ばないこと）
// =============================================================================

/**
 * 現在の DB 接続が正しく Service Role で動いているか確認する。
 * Phase 1.5-A の動作確認用。
 *
 * 注意：auth.users を直接 .from() で叩くと PostgREST 経由ではアクセス制限が
 * あるため、Auth Admin API（auth.admin.listUsers）で確認する。
 */
export async function debugCheckServiceRole(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      return { ok: false, message: `エラー: ${error.message}` };
    }

    return {
      ok: true,
      message: `Service Role OK（auth.admin.listUsers 成功、取得件数: ${data.users.length}）`,
    };
  } catch (err: any) {
    return { ok: false, message: `例外: ${err.message}` };
  }
}
