/**
 * AIチャット用 Content Script
 * Redmine側からのメッセージを受信し、チャット入力欄にテキストを挿入する
 *
 * TODO: matches の URL パターンを実際のAIチャットのドメインに変更すること
 * 例: '*://aichat.example.com/*'
 */
export default defineContentScript({
  matches: ['https://www.marubeni-chatbot.com/*'],
  main() {
    browser.runtime.onMessage.addListener(handleMessage);
  },
});

async function handleMessage(message: unknown) {
  if (!isInsertTextMessage(message)) return;

  const { text } = message.payload;
  await insertTextToChat(text);
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

async function insertTextToChat(text: string) {
  const inputEl = await waitForInputEl();

  if (!inputEl) {
    console.warn('[redmaru] チャット入力欄が見つかりませんでした');
    return;
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
