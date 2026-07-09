/**
 * Background Service Worker
 * Redmine / Teams Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_TEAMS_TEMPLATE, DEFAULT_REDMINE_FOR_TR_TEMPLATE, DEFAULT_AI_ANSWER_TEMPLATE } from './shared/defaults';
import { formatDateTimeJst } from './shared/dateFormat';

const AI_CHAT_URL = 'https://www.marubeni-chatbot.com/bot/smart/smart-bot';
const ISOU_FORM_URL = 'https://isouext.marubeni.co.jp/TAS/contents/transaction/T011.aspx';
const REDMINE_BASE_URL = 'https://misol-dev.cloud.redmine.jp';
const AI_ANSWER_CUSTOM_FIELDS = { updatedAt: 4588, answer: 4589 };

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown, sender: Browser.runtime.MessageSender) {
  if (isOpenIsouFormMessage(message)) {
    await browser.storage.local.set({ isouFormData: { fields: message.payload.fields, isoJiyu: message.payload.isoJiyu, isoGaiyo: message.payload.isoGaiyo, phase: 1 } });
    await browser.tabs.create({ url: ISOU_FORM_URL });
    return;
  }

  if (isAutoAnswerRequestMessage(message)) {
    await handleAutoAnswerRequest(message.payload, sender);
    return;
  }

  if (isAutoAnswerResultMessage(message)) {
    await handleAutoAnswerResult(message.payload, sender);
    return;
  }

  if (!isOpenAiChatMessage(message)) return;

  const { content, source } = message.payload;

  // source に応じて適切なテンプレートを取得
  const result = await browser.storage.sync.get({
    template: DEFAULT_REDMINE_TEMPLATE,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
    redmineForTrTemplate: DEFAULT_REDMINE_FOR_TR_TEMPLATE,
  });

  let template =
    source === 'teams'
      ? typeof result.teamsTemplate === 'string'
        ? result.teamsTemplate
        : DEFAULT_TEAMS_TEMPLATE
      : source === 'redmine-tr'
        ? typeof result.redmineForTrTemplate === 'string'
          ? result.redmineForTrTemplate
          : DEFAULT_REDMINE_FOR_TR_TEMPLATE
        : typeof result.template === 'string'
          ? result.template
          : DEFAULT_REDMINE_TEMPLATE;

  // {日数} を実際の収集日数に置換（Teamsテンプレートのみ有効）
  if (source === 'teams') {
    const days = typeof result.teamsPeriodDays === 'number' ? result.teamsPeriodDays : 14;
    template = template.replaceAll('{日数}', String(days));
  }

  const fullText = template ? `${template}\n\n${content}` : content;

  // AIチャットを新しいタブで開く
  const tab = await browser.tabs.create({ url: AI_CHAT_URL });

  if (!tab.id) return;

  // タブのロード完了を待ってからメッセージを送信
  browser.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== 'complete') return;
    browser.tabs.onUpdated.removeListener(listener);

    browser.tabs.sendMessage(tab.id!, {
      type: 'INSERT_TEXT',
      payload: { text: fullText },
    });
  });
}

async function handleAutoAnswerRequest(payload: AutoAnswerRequestMessage['payload'], sender: Browser.runtime.MessageSender) {
  const redmineTabId = sender.tab?.id;
  console.log('[redmaru] AUTO_ANSWER_REQUEST受信', { redmineTabId, issueId: payload.issueId });
  if (!redmineTabId) {
    console.error('[redmaru] 送信元のRedmineタブIDを取得できませんでした');
    return;
  }

  const { requestId, issueId, apiKey, content } = payload;

  const result = await browser.storage.sync.get({ aiAnswerTemplate: DEFAULT_AI_ANSWER_TEMPLATE });
  const template = typeof result.aiAnswerTemplate === 'string' ? result.aiAnswerTemplate : DEFAULT_AI_ANSWER_TEMPLATE;
  const fullText = template ? `${template}\n\n${content}` : content;

  const tab = await browser.tabs.create({ url: AI_CHAT_URL });
  console.log('[redmaru] AIチャットタブを作成', tab.id);
  if (!tab.id) return;

  browser.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== 'complete') return;
    browser.tabs.onUpdated.removeListener(listener);
    console.log('[redmaru] AIチャットタブのロード完了。AUTO_ANSWER_STARTを送信', tab.id);

    browser.tabs
      .sendMessage(tab.id!, {
        type: 'AUTO_ANSWER_START',
        payload: { requestId, text: fullText, issueId, apiKey, redmineTabId },
      })
      .catch((err) => {
        console.error('[redmaru] AUTO_ANSWER_STARTの送信に失敗しました（content scriptが未注入の可能性）:', err);
      });
  });
}

async function handleAutoAnswerResult(payload: AutoAnswerResultMessage['payload'], sender: Browser.runtime.MessageSender) {
  const { requestId, redmineTabId } = payload;
  const aichatTabId = sender.tab?.id;
  console.log('[redmaru] AUTO_ANSWER_RESULT受信', payload.status, { requestId, aichatTabId });

  if (payload.status === 'success') {
    const { issueId, apiKey, answerText } = payload;
    try {
      const now = formatDateTimeJst(new Date());
      const res = await fetch(`${REDMINE_BASE_URL}/issues/${issueId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey },
        body: JSON.stringify({
          issue: {
            custom_fields: [
              { id: AI_ANSWER_CUSTOM_FIELDS.updatedAt, value: now },
              { id: AI_ANSWER_CUSTOM_FIELDS.answer, value: answerText },
            ],
          },
        }),
      });
      if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

      if (aichatTabId) await browser.tabs.remove(aichatTabId).catch(() => {});
      await focusTab(redmineTabId);
      await notifyRedmineTab(redmineTabId, { requestId, status: 'done' });
    } catch (err) {
      // タブは残す（デバッグ用）
      await notifyRedmineTab(redmineTabId, {
        requestId,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // 'timeout' | 'error'（aichat.content.ts側で発生。タブは残す）
  await notifyRedmineTab(redmineTabId, payload);
}

// AI回答更新の書き戻し成功時、複数のRedmineタブが開いていてもボタンを押した元タブが
// 前面に来るようにする（Chromeはタブを閉じると既定でどこか別のタブにフォーカスが移る）。
async function focusTab(tabId: number) {
  try {
    const tab = await browser.tabs.update(tabId, { active: true });
    if (tab?.windowId !== undefined) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
  } catch {
    // 元タブが閉じている場合等は無視
  }
}

async function notifyRedmineTab(tabId: number, payload: AutoAnswerStatusMessage['payload']) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'AUTO_ANSWER_STATUS', payload });
  } catch {
    // 元タブが閉じている場合等は無視
  }
}

// 型ガード
interface OpenAiChatMessage {
  type: 'OPEN_AI_CHAT';
  payload: {
    content: string;
    source: 'redmine' | 'teams' | 'redmine-tr';
  };
}

interface OpenIsouFormMessage {
  type: 'OPEN_ISOU_FORM';
  payload: {
    fields: Record<string, string>;
    isoJiyu: string;
    isoGaiyo: string;
  };
}

function isOpenIsouFormMessage(msg: unknown): msg is OpenIsouFormMessage {
  const m = msg as OpenIsouFormMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'OPEN_ISOU_FORM' &&
    typeof m.payload?.fields === 'object'
  );
}

function isOpenAiChatMessage(msg: unknown): msg is OpenAiChatMessage {
  const m = msg as OpenAiChatMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'OPEN_AI_CHAT' &&
    typeof m.payload?.content === 'string' &&
    (m.payload?.source === 'redmine' || m.payload?.source === 'teams' || m.payload?.source === 'redmine-tr')
  );
}

interface AutoAnswerRequestMessage {
  type: 'AUTO_ANSWER_REQUEST';
  payload: {
    requestId: string;
    issueId: string;
    apiKey: string;
    content: string;
  };
}

type AutoAnswerResultMessage = {
  type: 'AUTO_ANSWER_RESULT';
  payload:
    | { requestId: string; redmineTabId: number; issueId: string; apiKey: string; status: 'success'; answerText: string }
    | { requestId: string; redmineTabId: number; status: 'timeout' }
    | { requestId: string; redmineTabId: number; status: 'error'; message: string };
};

interface AutoAnswerStatusMessage {
  type: 'AUTO_ANSWER_STATUS';
  payload:
    | { requestId: string; status: 'done' }
    | { requestId: string; status: 'timeout' }
    | { requestId: string; status: 'error'; message: string };
}

function isAutoAnswerRequestMessage(msg: unknown): msg is AutoAnswerRequestMessage {
  const m = msg as AutoAnswerRequestMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'AUTO_ANSWER_REQUEST' &&
    typeof m.payload?.requestId === 'string' &&
    typeof m.payload?.issueId === 'string' &&
    typeof m.payload?.apiKey === 'string' &&
    typeof m.payload?.content === 'string'
  );
}

function isAutoAnswerResultMessage(msg: unknown): msg is AutoAnswerResultMessage {
  const m = msg as AutoAnswerResultMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'AUTO_ANSWER_RESULT' &&
    typeof m.payload?.requestId === 'string' &&
    typeof m.payload?.redmineTabId === 'number' &&
    (m.payload?.status === 'success' || m.payload?.status === 'timeout' || m.payload?.status === 'error')
  );
}
