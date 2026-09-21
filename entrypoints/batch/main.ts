/**
 * redmaru-batch（Playwright）から操作されるバッチ専用ページ。
 *
 * 従来のバッチはRedmineのチケット詳細ページを開いて「AI回答更新」ボタンをクリックしていたが、
 * Playwrightの click() は実マウスイベントを送るためChromiumが対象ページを前面化してしまい、
 * 実行中に他の作業ができなかった。このページはクリックを必要とせず、page.evaluate() から
 * window.redmaruBatch を呼ぶだけで同じ処理（background.ts への AUTO_ANSWER_REQUEST）を
 * 起動できるため、ブラウザがフォーカスを奪わない。
 *
 * 書き戻しは従来どおり background.ts が行う（単発ボタンと同じコードパスを通す）。
 */

import {
  AI_ANSWER_CUSTOM_FIELDS,
  fetchChildIssues,
  fetchIssue,
  formatTicketInfo,
  getCustomFieldValue,
  getExcludedCustomFieldIds,
  isClosedIssue,
} from '../shared/redmineIssue';
import {
  DEFAULT_BATCH_USE_AI_ANSWER_SETTINGS,
  DEFAULT_BATCH_WRITEBACK,
  type BatchWriteback,
} from '../shared/defaults';

type BatchResult = { status: 'done' } | { status: 'timeout' } | { status: 'error'; message: string };

// requestId -> 結果。Playwright側は run() が返した requestId を getResult() に渡して完了を待つ
const results = new Map<string, BatchResult>();

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isAutoAnswerStatusMessage(message)) return;
  const { requestId, status } = message.payload;
  console.log('[redmaru-batch] AUTO_ANSWER_STATUS受信', requestId, status);
  results.set(
    requestId,
    status === 'error' ? { status, message: message.payload.message } : { status },
  );
});

async function run(issueId: string, apiKey: string, redmineBaseUrl: string): Promise<string> {
  const { batchUseAiAnswerSettings, batchWriteback } = await browser.storage.sync.get({
    batchUseAiAnswerSettings: DEFAULT_BATCH_USE_AI_ANSWER_SETTINGS,
    batchWriteback: DEFAULT_BATCH_WRITEBACK,
  });

  // 「AIまとめと同じ設定を使う」がオンなら、単発ボタンと同じ 'full'（日英まとめ）で処理する
  const job: BatchWriteback = batchUseAiAnswerSettings
    ? 'full'
    : (batchWriteback as BatchWriteback);

  const issue = await fetchIssue(redmineBaseUrl, issueId, apiKey);

  let content: string;
  let isClosed = false;

  if (job === 'translate-en') {
    // 英訳はチケット全文ではなく既存の日本語まとめ（cf_4589）だけをAIに渡す。
    // 日本語版と内容が必ず一致し、入力も短くて済む。
    content = getCustomFieldValue(issue, AI_ANSWER_CUSTOM_FIELDS.answer);
    if (!content) {
      throw new Error(`#${issueId}: cf_4589（AI回答）が空のため英訳できません`);
    }
  } else {
    const excludedCustomFieldIds = await getExcludedCustomFieldIds();
    const childIssues = await fetchChildIssues(redmineBaseUrl, issueId, apiKey);
    content = formatTicketInfo(issue, { baseUrl: redmineBaseUrl, excludedCustomFieldIds, childIssues });
    // クローズ済みチケットは別の定型文（完了報告向け）でまとめさせる
    isClosed = await isClosedIssue(redmineBaseUrl, issue, apiKey);
  }

  const requestId = crypto.randomUUID();
  console.log('[redmaru-batch] AUTO_ANSWER_REQUEST送信', { requestId, issueId, job, isClosed });
  await browser.runtime.sendMessage({
    type: 'AUTO_ANSWER_REQUEST',
    payload: { requestId, issueId, apiKey, content, isClosed, source: 'batch', job },
  });
  return requestId;
}

function getResult(requestId: string): BatchResult | null {
  return results.get(requestId) ?? null;
}

interface AutoAnswerStatusMessage {
  type: 'AUTO_ANSWER_STATUS';
  payload:
    | { requestId: string; status: 'done' }
    | { requestId: string; status: 'timeout' }
    | { requestId: string; status: 'error'; message: string };
}

function isAutoAnswerStatusMessage(msg: unknown): msg is AutoAnswerStatusMessage {
  const m = msg as AutoAnswerStatusMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'AUTO_ANSWER_STATUS' &&
    typeof m.payload?.requestId === 'string' &&
    (m.payload?.status === 'done' || m.payload?.status === 'timeout' || m.payload?.status === 'error')
  );
}

declare global {
  interface Window {
    redmaruBatch: {
      run(issueId: string, apiKey: string, redmineBaseUrl: string): Promise<string>;
      getResult(requestId: string): BatchResult | null;
    };
  }
}

window.redmaruBatch = { run, getResult };
console.log('[redmaru-batch] バッチ実行用ページの準備完了');
