/**
 * Background Service Worker
 * Redmine / Teams Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_REDMINE_TEMPLATE_EN, DEFAULT_REDMINE_TEMPLATE_LANGUAGE, DEFAULT_TEAMS_TEMPLATE, DEFAULT_REDMINE_FOR_TR_TEMPLATE, DEFAULT_AI_ANSWER_TEMPLATE, DEFAULT_AI_ANSWER_CLOSED_TEMPLATE, DEFAULT_AUTO_ANSWER_FOCUS_TAB_ON_SUCCESS, DEFAULT_AI_ANSWER_TIMEOUT_SECONDS, DEFAULT_OPEN_AI_CHAT_TAB_IN_BACKGROUND, DEFAULT_BATCH_TEMPLATE } from './shared/defaults';
import { formatDateTimeJst } from './shared/dateFormat';
import { splitBilingualAnswer } from './shared/splitBilingualAnswer';
import { AI_ANSWER_CUSTOM_FIELDS } from './shared/redmineIssue';

const AI_CHAT_URL = 'https://www.marubeni-chatbot.com/bot/smart/smart-bot';
const ISOU_FORM_URL = 'https://mrint.marubeni.co.jp/TAS/contents/transaction/T011.aspx';
const REDMINE_BASE_URL = 'https://misol-dev.cloud.redmine.jp';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown, sender: Browser.runtime.MessageSender) {
  if (isOpenIsouFormMessage(message)) {
    await browser.storage.local.set({ isouFormData: { fields: message.payload.fields, isoGaiyo: message.payload.isoGaiyo, phase: 1 } });
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
    templateEn: DEFAULT_REDMINE_TEMPLATE_EN,
    templateLanguage: DEFAULT_REDMINE_TEMPLATE_LANGUAGE,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
    redmineForTrTemplate: DEFAULT_REDMINE_FOR_TR_TEMPLATE,
  });

  // 「to MaruCha」は日本語話者向け・英語話者向けの2種類の定型文を切り替えて使う
  const redmineTemplate =
    result.templateLanguage === 'en'
      ? typeof result.templateEn === 'string'
        ? result.templateEn
        : DEFAULT_REDMINE_TEMPLATE_EN
      : typeof result.template === 'string'
        ? result.template
        : DEFAULT_REDMINE_TEMPLATE;

  let template =
    source === 'teams'
      ? typeof result.teamsTemplate === 'string'
        ? result.teamsTemplate
        : DEFAULT_TEAMS_TEMPLATE
      : source === 'redmine-tr'
        ? typeof result.redmineForTrTemplate === 'string'
          ? result.redmineForTrTemplate
          : DEFAULT_REDMINE_FOR_TR_TEMPLATE
        : redmineTemplate;

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
  const { requestId, issueId, apiKey, content, isClosed } = payload;
  // source='batch' は redmaru-batch がバッチ専用ページ（entrypoints/batch）から実行した場合。
  // Redmineのタブを開かないため、完了通知の宛先タブも存在しない（ブロードキャストで返す）。
  const source = payload.source ?? 'redmine';
  const job = payload.job ?? 'full';
  const redmineTabId = sender.tab?.id;
  console.log('[redmaru] AUTO_ANSWER_REQUEST受信', { redmineTabId, issueId, isClosed, source, job });
  if (source === 'redmine' && redmineTabId === undefined) {
    console.error('[redmaru] 送信元のRedmineタブIDを取得できませんでした');
    return;
  }

  // クローズ扱いのステータスかどうかで定型文を切り替える（判定はredmine.content.ts側で行う）
  const result = await browser.storage.sync.get({
    aiAnswerTemplate: DEFAULT_AI_ANSWER_TEMPLATE,
    aiAnswerClosedTemplate: DEFAULT_AI_ANSWER_CLOSED_TEMPLATE,
    batchTemplate: DEFAULT_BATCH_TEMPLATE,
    aiAnswerTimeoutSeconds: DEFAULT_AI_ANSWER_TIMEOUT_SECONDS,
    openAiChatTabInBackground: DEFAULT_OPEN_AI_CHAT_TAB_IN_BACKGROUND,
  });
  // job='translate-en' はcf_4589の英訳だけを依頼するため「バッチ」タブ専用の定型文を使う。
  // 'full' は従来どおりクローズ扱いかどうかで2つの定型文を切り替える。
  const stored =
    job === 'translate-en'
      ? result.batchTemplate
      : isClosed
        ? result.aiAnswerClosedTemplate
        : result.aiAnswerTemplate;
  const fallback =
    job === 'translate-en'
      ? DEFAULT_BATCH_TEMPLATE
      : isClosed
        ? DEFAULT_AI_ANSWER_CLOSED_TEMPLATE
        : DEFAULT_AI_ANSWER_TEMPLATE;
  const timeoutSeconds =
    typeof result.aiAnswerTimeoutSeconds === 'number' && result.aiAnswerTimeoutSeconds > 0
      ? result.aiAnswerTimeoutSeconds
      : DEFAULT_AI_ANSWER_TIMEOUT_SECONDS;
  const template = typeof stored === 'string' ? stored : fallback;
  console.log(
    '[redmaru] 使用する定型文:',
    job === 'translate-en'
      ? 'batchTemplate（英訳）'
      : isClosed
        ? 'aiAnswerClosedTemplate（クローズ済み）'
        : 'aiAnswerTemplate（オープン）',
  );
  const fullText = template ? `${template}\n\n${content}` : content;

  const openInBackground = result.openAiChatTabInBackground === true;
  // バッチ経路はブラウザが前面に出てくると作業の妨げになるため、設定に関わらず非アクティブで開く
  const activateTab = source === 'batch' ? false : !openInBackground;
  const tab = await browser.tabs.create({ url: AI_CHAT_URL, active: activateTab });
  console.log('[redmaru] AIチャットタブを作成', tab.id, { openInBackground, source });
  if (!tab.id) return;

  browser.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== 'complete') return;
    browser.tabs.onUpdated.removeListener(listener);
    console.log('[redmaru] AIチャットタブのロード完了。AUTO_ANSWER_STARTを送信', tab.id);

    browser.tabs
      .sendMessage(tab.id!, {
        type: 'AUTO_ANSWER_START',
        payload: { requestId, text: fullText, issueId, apiKey, redmineTabId, timeoutMs: timeoutSeconds * 1000, source, job },
      })
      .catch((err) => {
        console.error('[redmaru] AUTO_ANSWER_STARTの送信に失敗しました（content scriptが未注入の可能性）:', err);
      });
  });
}

async function handleAutoAnswerResult(payload: AutoAnswerResultMessage['payload'], sender: Browser.runtime.MessageSender) {
  const { requestId, redmineTabId } = payload;
  const source = payload.source ?? 'redmine';
  const job = payload.job ?? 'full';
  const aichatTabId = sender.tab?.id;
  console.log('[redmaru] AUTO_ANSWER_RESULT受信', payload.status, { requestId, aichatTabId, source, job });

  if (payload.status === 'success') {
    const { issueId, apiKey, answerText } = payload;
    try {
      const now = formatDateTimeJst(new Date());
      // job='translate-en' はcf_4589（日本語まとめ）を触らず、英訳をcf_4720にだけ入れる。
      // その場合もcf_4588を同一PUTで更新する。更新しないとこのPUTでupdated_onだけが進み、
      // cf_4588との差が開いて鮮度切れと誤判定されてしまうため。
      const customFields =
        job === 'translate-en'
          ? [
              { id: AI_ANSWER_CUSTOM_FIELDS.updatedAt, value: now },
              { id: AI_ANSWER_CUSTOM_FIELDS.answerEn, value: answerText.trim() },
            ]
          : (() => {
              const { ja, en } = splitBilingualAnswer(answerText);
              return [
                { id: AI_ANSWER_CUSTOM_FIELDS.updatedAt, value: now },
                { id: AI_ANSWER_CUSTOM_FIELDS.answer, value: ja },
                { id: AI_ANSWER_CUSTOM_FIELDS.answerEn, value: en },
              ];
            })();
      const res = await fetch(`${REDMINE_BASE_URL}/issues/${issueId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey },
        body: JSON.stringify({ issue: { custom_fields: customFields } }),
      });
      if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

      const { autoAnswerFocusTabOnSuccess } = await browser.storage.sync.get({
        autoAnswerFocusTabOnSuccess: DEFAULT_AUTO_ANSWER_FOCUS_TAB_ON_SUCCESS,
      });
      if (aichatTabId) {
        // タブを閉じる（chrome.tabs.remove）操作自体が、アクティブタブの切り替えに伴って
        // ウィンドウをOSレベルで前面化させることがある。フォーカスさせたくない設定では
        // 閉じずにabout:blankへ遷移させるだけにとどめ、フォーカス奪取の経路を断つ。
        // ただしバッチ経路のAIチャットタブは常に非アクティブで開いており、非アクティブな
        // タブを閉じてもアクティブタブは変わらないため前面化しない。閉じないと処理件数分
        // タブが残り続けるので、こちらは明示的に閉じる。
        if (source === 'batch' || autoAnswerFocusTabOnSuccess) {
          await browser.tabs.remove(aichatTabId).catch(() => {});
        } else {
          await browser.tabs.update(aichatTabId, { url: 'about:blank' }).catch(() => {});
        }
      }
      if (source !== 'batch' && autoAnswerFocusTabOnSuccess && redmineTabId !== undefined) {
        await focusTab(redmineTabId);
      }
      await notifyRequester(source, redmineTabId, { requestId, status: 'done' });
    } catch (err) {
      // タブは残す（デバッグ用）
      await notifyRequester(source, redmineTabId, {
        requestId,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // 'timeout' | 'error'（aichat.content.ts側で発生。タブは残す）
  await notifyRequester(source, redmineTabId, payload);
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

// 完了通知の返し先を振り分ける。Redmine経由はボタンのラベルを更新するため元タブへ送るが、
// バッチ経由は拡張機能ページ（entrypoints/batch）へ runtime.sendMessage でブロードキャストする。
// 拡張機能ページからのメッセージでは sender.tab が取れない環境があるため、宛先タブIDに
// 依存しない経路にしてある。受け手は requestId で自分宛かどうかを判定する。
async function notifyRequester(
  source: AutoAnswerSource,
  tabId: number | undefined,
  payload: AutoAnswerStatusMessage['payload'],
) {
  if (source === 'batch') {
    try {
      await browser.runtime.sendMessage({ type: 'AUTO_ANSWER_STATUS', payload });
    } catch {
      // 受け手のページが閉じている場合等は無視
    }
    return;
  }
  if (tabId === undefined) return;
  await notifyRedmineTab(tabId, payload);
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

// 実行元。'batch' は redmaru-batch がバッチ専用ページから流した場合で、
// Redmineのタブを開かない・タブを前面化しないという点が 'redmine' と異なる。
type AutoAnswerSource = 'redmine' | 'batch';

// 書き戻しの種類。
// 'full'         … 回答を■■English■■で分割し cf_4588・cf_4589・cf_4720 を同時更新
// 'translate-en' … 回答全文を cf_4720 に入れ cf_4588 も同時更新（cf_4589 は触らない）
type AutoAnswerJob = 'full' | 'translate-en';

interface AutoAnswerRequestMessage {
  type: 'AUTO_ANSWER_REQUEST';
  payload: {
    requestId: string;
    issueId: string;
    apiKey: string;
    content: string;
    // クローズ扱いのステータスかどうか。古いcontent scriptが残っている場合に備えて省略可能
    isClosed?: boolean;
    // 以下も省略可能。未指定なら従来どおり 'redmine' / 'full' として扱う
    source?: AutoAnswerSource;
    job?: AutoAnswerJob;
  };
}

// MV3のService Workerは休止するためrequestIdごとの状態を保持できない。
// source/job は AUTO_ANSWER_START → AUTO_ANSWER_RESULT とpayloadに載せてリレーする。
// redmineTabId はバッチ経路では存在しないため省略可能。
type AutoAnswerResultMessage = {
  type: 'AUTO_ANSWER_RESULT';
  payload: { redmineTabId?: number; source?: AutoAnswerSource; job?: AutoAnswerJob } & (
    | { requestId: string; issueId: string; apiKey: string; status: 'success'; answerText: string }
    | { requestId: string; status: 'timeout' }
    | { requestId: string; status: 'error'; message: string }
  );
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
    (m.payload?.status === 'success' || m.payload?.status === 'timeout' || m.payload?.status === 'error')
  );
}
