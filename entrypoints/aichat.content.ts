/**
 * AIチャット用 Content Script
 * Redmine側からのメッセージを受信し、チャット入力欄にテキストを挿入する
 *
 * TODO: matches の URL パターンを実際のAIチャットのドメインに変更すること
 * 例: '*://aichat.example.com/*'
 */
import { submitMessage, waitForAnswerComplete } from './shared/aichatDom';

export default defineContentScript({
  matches: ['https://www.marubeni-chatbot.com/*'],
  main() {
    console.log('[redmaru] aichat.content.ts ロード完了', location.href);
    browser.runtime.onMessage.addListener(handleMessage);
  },
});

// あえて非同期関数にしない: どちらのメッセージも応答を必要としないfire-and-forgetのため。
// async関数（Promiseを返すリスナー）にすると、ブラウザ側は「非同期で応答する」とみなして
// メッセージチャンネルを開いたままにする。AUTO_ANSWER_STARTの処理は最大90秒かかりうるため、
// その間にMV3のService Workerが休止・再起動すると「メッセージチャンネルが応答前に閉じられた」
// というエラーが発生する（実害はないが、送信元で不要なエラーログが出る）。
// 応答を返す気がないのでリスナー自体は同期的にundefinedを返し、処理は内部で投げっぱなしにする。
function handleMessage(message: unknown): void {
  if (isAutoAnswerStartMessage(message)) {
    handleAutoAnswerStart(message.payload);
    return;
  }

  if (isInsertTextMessage(message)) {
    insertTextToChat(message.payload.text).catch((err) => {
      console.error('[redmaru] テキスト挿入エラー:', err);
    });
  }
}

async function handleAutoAnswerStart(payload: AutoAnswerStartMessage['payload']) {
  const { requestId, text, issueId, apiKey, redmineTabId } = payload;
  console.log('[redmaru] AUTO_ANSWER_START受信', { requestId, issueId, url: location.href });

  try {
    const inputEl = await insertTextToChat(text);
    if (!inputEl) {
      throw new Error('チャット入力欄が見つかりませんでした');
    }
    console.log('[redmaru] 入力欄に挿入完了:', inputEl.tagName, inputEl.outerHTML.slice(0, 200));

    const submitted = await submitMessage(inputEl);
    console.log('[redmaru] 送信結果:', submitted);
    if (!submitted) {
      throw new Error('メッセージの送信に失敗しました（Ctrl+Enter・送信ボタンいずれでも送信を確認できませんでした）');
    }

    console.log('[redmaru] 回答完了待ち開始');
    const result = await waitForAnswerComplete({ debounceMs: 1800, timeoutMs: 90000 });
    console.log('[redmaru] 回答完了待ち結果:', result.status, result.status === 'success' ? result.text.slice(0, 100) : '');

    if (result.status === 'timeout') {
      await browser.runtime.sendMessage({
        type: 'AUTO_ANSWER_RESULT',
        payload: { requestId, redmineTabId, status: 'timeout' },
      });
      return;
    }

    await browser.runtime.sendMessage({
      type: 'AUTO_ANSWER_RESULT',
      payload: { requestId, redmineTabId, issueId, apiKey, status: 'success', answerText: result.text },
    });
  } catch (err) {
    console.error('[redmaru] AI回答自動化エラー:', err);
    await browser.runtime.sendMessage({
      type: 'AUTO_ANSWER_RESULT',
      payload: {
        requestId,
        redmineTabId,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// SPAのレンダリング完了を待つため、textareaが現れるまでポーリングする
async function waitForInputEl(timeout = 15000): Promise<HTMLTextAreaElement | HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el =
      document.querySelector<HTMLTextAreaElement>('textarea') ??
      document.querySelector<HTMLElement>('[contenteditable="true"]');
    if (el) return el;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function insertTextToChat(text: string): Promise<HTMLTextAreaElement | HTMLElement | null> {
  const inputEl = await waitForInputEl();

  if (!inputEl) {
    console.warn('[redmaru] チャット入力欄が見つかりませんでした');
    return null;
  }

  if (inputEl instanceof HTMLTextAreaElement) {
    // React/Vue 等のフレームワーク製フォームにも対応するため
    // nativeInputValueSetter 経由でイベントを発火させる
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(inputEl, text);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable 要素の場合
    inputEl.textContent = text;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  inputEl.focus();
  if (inputEl instanceof HTMLTextAreaElement) {
    inputEl.setSelectionRange(0, 0);
  } else {
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(inputEl, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  inputEl.scrollTop = 0;

  return inputEl;
}

// 型ガード
interface InsertTextMessage {
  type: 'INSERT_TEXT';
  payload: { text: string };
}

function isInsertTextMessage(msg: unknown): msg is InsertTextMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as InsertTextMessage).type === 'INSERT_TEXT' &&
    typeof (msg as InsertTextMessage).payload?.text === 'string'
  );
}

interface AutoAnswerStartMessage {
  type: 'AUTO_ANSWER_START';
  payload: {
    requestId: string;
    text: string;
    issueId: string;
    apiKey: string;
    redmineTabId: number;
  };
}

function isAutoAnswerStartMessage(msg: unknown): msg is AutoAnswerStartMessage {
  const m = msg as AutoAnswerStartMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'AUTO_ANSWER_START' &&
    typeof m.payload?.requestId === 'string' &&
    typeof m.payload?.text === 'string' &&
    typeof m.payload?.issueId === 'string' &&
    typeof m.payload?.apiKey === 'string' &&
    typeof m.payload?.redmineTabId === 'number'
  );
}
