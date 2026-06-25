/**
 * Background Service Worker
 * Redmine / Teams Content Script と AIチャット Content Script のメッセージを仲介する
 *
 * TODO: AI_CHAT_URL を実際のAIチャットの新規チャットURLに変更すること
 */

import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_TEAMS_TEMPLATE, DEFAULT_REDMINE_FOR_TR_TEMPLATE } from './shared/defaults';

const AI_CHAT_URL = 'https://www.marubeni-chatbot.com/bot/smart/smart-bot';
const ISOU_FORM_URL = 'https://isouext.marubeni.co.jp/TAS/contents/transaction/T011.aspx';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessage);
});

async function handleMessage(message: unknown) {
  if (isOpenIsouFormMessage(message)) {
    await browser.storage.local.set({ isouFormData: { fields: message.payload.fields, isoJiyu: message.payload.isoJiyu, isoGaiyo: message.payload.isoGaiyo, phase: 1 } });
    await browser.tabs.create({ url: ISOU_FORM_URL });
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
