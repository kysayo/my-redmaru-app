/**
 * Background Service Worker
 * Redmine Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

// デフォルトの定型文
const DEFAULT_TEMPLATE =
  'xxxxxxx（社内で決まっているURL）にチケット一覧がissue.csvで格納されています。' +
  'サブフォルダに各チケットのコメント一覧が格納されています。' +
  '今回の事象と似た事象があれば事象の名前と資料のフォルダを教えて';

// TODO: 実際のAIチャットの新規チャットURLに変更すること
const AI_CHAT_URL = 'https://aichat.example.com/new';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown, sender: chrome.runtime.MessageSender) {
  if (!isOpenAiChatMessage(message)) return;

  const { ticketInfo } = message.payload;

  // 保存された定型文を取得（なければデフォルト）
  const result = await browser.storage.sync.get({ template: DEFAULT_TEMPLATE });
  const template: string = result.template;

  const fullText = `${ticketInfo}\n\n${template}`;

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
