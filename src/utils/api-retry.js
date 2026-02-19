/**
 * エラーがリトライ可能かどうかを判定
 */
function isRetryableError(error) {
  // Anthropic SDK エラー: 429 (rate_limit) or 529 (overloaded)
  if (error.status === 429 || error.status === 529) return true;
  if (error.type === 'rate_limit_error' || error.type === 'overloaded_error') return true;

  // Axios レスポンスエラー: 429 or 503
  if (error.response?.status === 429 || error.response?.status === 503) return true;

  // ネットワーク接続エラー
  const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];
  if (error.code && networkCodes.includes(error.code)) return true;

  return false;
}

/**
 * 指数バックオフ付きリトライ
 * attempt 0: 即実行
 * attempt 1: 1秒後
 * attempt 2: 2秒後
 * attempt 3: 4秒後
 */
async function withRetry(fn, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * モデルフォールバックチェーン（ダウングレード）
 * フォールバック先のHandlerクラスを返す。nullは最下位（フォールバック不可）。
 * 循環依存を避けるため、require は遅延評価する。
 */
const FALLBACK_CHAIN = {
  'claude-opus': (apiKey) => {
    const ClaudeSonnetHandler = require('../models/claude-sonnet');
    return new ClaudeSonnetHandler(apiKey);
  },
  'claude-sonnet': (apiKey) => {
    const GLMHandler = require('../models/glm-handler');
    return new GLMHandler(apiKey);
  },
  'glm': (apiKey) => {
    const DeepSeekHandler = require('../models/deepseek-handler');
    return new DeepSeekHandler(apiKey);
  },
  'deepseek': null,
};

module.exports = { isRetryableError, withRetry, FALLBACK_CHAIN };
