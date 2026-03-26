/**
 * Background Service Worker
 * Redmine / Teams Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

// デフォルトの定型文
const DEFAULT_REDMINE_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。後半は更新時のコメントです。400文字程度に要約してください。誰が何をしたかの主語がわかるようにしてください。わからない時は詳細不明でもよいです。結論としてどうなったか、どういう状態にあるかを優先して記載してください。';

const DEFAULT_TEAMS_TEMPLATE =
  'これはTeamsチャットの{日数}日間の履歴です。トピックごとに経緯と今の状態を600文字程度に要約してください。誰が何をしたかわかるようにしてください。わからない時は詳細不明でもよいです。';

const AI_CHAT_URL = 'https://www.marubeni-chatbot.com/bot/smart/smart-bot';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown) {
  if (!isOpenAiChatMessage(message)) return;

  const { content, source } = message.payload;

  // source に応じて適切なテンプレートを取得
  const result = await browser.storage.sync.get({
    template: DEFAULT_REDMINE_TEMPLATE,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
  });

  let template =
    source === 'teams'
      ? typeof result.teamsTemplate === 'string'
        ? result.teamsTemplate
        : DEFAULT_TEAMS_TEMPLATE
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

// 型ガード
interface OpenAiChatMessage {
  type: 'OPEN_AI_CHAT';
  payload: {
    content: string;
    source: 'redmine' | 'teams';
  };
}

function isOpenAiChatMessage(msg: unknown): msg is OpenAiChatMessage {
  const m = msg as OpenAiChatMessage;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === 'OPEN_AI_CHAT' &&
    typeof m.payload?.content === 'string' &&
    (m.payload?.source === 'redmine' || m.payload?.source === 'teams')
  );
}
