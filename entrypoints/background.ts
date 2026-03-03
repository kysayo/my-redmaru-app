/**
 * Background Service Worker
 * Redmine Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

// デフォルトの定型文
const DEFAULT_TEMPLATE =
  'このRedmineチケットを要約してください。後半は更新時のコメントです。コメントからも重要な推移があれば要約に含めてください。';

const AI_CHAT_URL = 'https://www.marubeni-chatbot.com/bot/smart/smart-bot';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown) {
  if (!isOpenAiChatMessage(message)) return;

  const { ticketInfo } = message.payload;

  // 保存された定型文を取得（なければデフォルト）
  const result = await browser.storage.sync.get({ template: DEFAULT_TEMPLATE });
  const template = typeof result.template === 'string' ? result.template : DEFAULT_TEMPLATE;

  const fullText = template ? `${template}\n\n${ticketInfo}` : ticketInfo;

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

// 型ガード
interface OpenAiChatMessage {
  type: 'OPEN_AI_CHAT';
  payload: { ticketInfo: string };
}

function isOpenAiChatMessage(msg: unknown): msg is OpenAiChatMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as OpenAiChatMessage).type === 'OPEN_AI_CHAT' &&
    typeof (msg as OpenAiChatMessage).payload?.ticketInfo === 'string'
  );
}
