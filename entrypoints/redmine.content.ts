/**
 * Redmine用 Content Script
 * チケットページにボタンを注入し、チケット情報をAIチャットに送信する
 */

export default defineContentScript({
  matches: ['https://misol-dev.cloud.redmine.jp/issues/*'],
  main() {
    injectButton();
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
  },
});

const BUTTON_STYLE = [
  'margin-left: 8px',
  'padding: 4px 12px',
  'background-color: #2196F3',
  'color: white',
  'border: none',
  'border-radius: 4px',
  'cursor: pointer',
  'font-size: 14px',
  'display: inline-flex',
  'align-items: center',
  'gap: 6px',
].join(';');

const BUTTON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16" role="img" aria-label="Send to AI chat" style="flex-shrink:0">
  <rect x="0.75" y="0.75" width="24.5" height="14.5" rx="4" ry="4" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
  <path d="M3.2 8H9.0" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M9.0 8L7.1 6.4M9.0 8L7.1 9.6" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="16.0" cy="7.6" r="4.7" fill="none" stroke="#e11d2e" stroke-width="2.4"/>
  <path d="M19.2 10.9L21.5 13.2" fill="none" stroke="#e11d2e" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

const AI_ANSWER_DEFAULT_LABEL = 'AI回答更新';

function injectButton() {
  // すでにボタンが注入済みの場合はスキップ
  if (document.getElementById('redmaru-send-btn')) return;

  const button = document.createElement('button');
  button.id = 'redmaru-send-btn';
  button.innerHTML = `${BUTTON_ICON_SVG}to MaruCha`;
  button.style.cssText = BUTTON_STYLE;
  button.addEventListener('click', () => handleButtonClick('redmine'));

  const trButton = document.createElement('button');
  trButton.id = 'redmaru-send-tr-btn';
  trButton.innerHTML = `${BUTTON_ICON_SVG}for TR`;
  trButton.style.cssText = BUTTON_STYLE;
  trButton.addEventListener('click', () => handleButtonClick('redmine-tr'));

  const aiAnswerButton = document.createElement('button');
  aiAnswerButton.id = 'redmaru-ai-answer-btn';
  aiAnswerButton.innerHTML = `${BUTTON_ICON_SVG}${AI_ANSWER_DEFAULT_LABEL}`;
  aiAnswerButton.style.cssText = BUTTON_STYLE;
  aiAnswerButton.addEventListener('click', () => handleAiAnswerButtonClick());

  // to MaruCha / for TR は #content内のeditアイコン（ペンマーク）の直前（左）に挿入する
  const editIcon = document.querySelector<HTMLElement>('#content .contextual a.icon-edit');
  if (editIcon) {
    editIcon.insertAdjacentElement('beforebegin', trButton);
    trButton.insertAdjacentElement('beforebegin', button);
  } else {
    // フォールバック: #content直下h2の後
    const h2 = document.querySelector('#content h2');
    h2?.insertAdjacentElement('afterend', trButton);
    h2?.insertAdjacentElement('afterend', button);
  }

  // AI回答更新ボタンはcf_4589（AIまとめ）欄のすぐ下に挿入し、回答を記入する項目の近くで操作できるようにする
  const aiAnswerField = document.querySelector<HTMLElement>('.cf_4589.attribute');
  if (aiAnswerField) {
    aiAnswerField.insertAdjacentElement('afterend', aiAnswerButton);
  } else if (editIcon) {
    // フォールバック: cf_4589欄が無いチケット（未回答でカスタムフィールド自体が非表示等）ではeditアイコンの左
    editIcon.insertAdjacentElement('beforebegin', aiAnswerButton);
  } else {
    const h2 = document.querySelector('#content h2');
    h2?.insertAdjacentElement('afterend', aiAnswerButton);
  }
}

// Content ScriptはIsolated Worldで動作するためwindow.ViewCustomizeに直接アクセスできない。
// world:'MAIN'のredmine-bridge.content.tsにカスタムイベントでAPIキーを要求する。
async function requestApiKey(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('ViewCustomize.context.user.apiKey の取得がタイムアウトしました')),
      3000,
    );
    document.addEventListener(
      'redmaru:apikey',
      (e) => {
        clearTimeout(timer);
        const key = (e as CustomEvent<string>).detail;
        if (key) resolve(key);
        else reject(new Error('ViewCustomize.context.user.apiKey が取得できませんでした'));
      },
      { once: true },
    );
    document.dispatchEvent(new Event('redmaru:request-apikey'));
  });
}

function getIssueIdFromUrl(): string {
  const issueId = location.pathname.match(/\/issues\/(\d+)/)?.[1];
  if (!issueId) throw new Error('チケットIDを取得できませんでした');
  return issueId;
}

async function getTicketInfo(apiKey: string): Promise<string> {
  const issueId = getIssueIdFromUrl();

  const res = await fetch(`/issues/${issueId}.json?include=journals`, {
    headers: { 'X-Redmine-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

  const { issue } = await res.json();

  const lines: string[] = [
    `チケット #${issue.id}: ${issue.subject}`,
    `トラッカー: ${issue.tracker?.name ?? ''}`,
    `ステータス: ${issue.status?.name ?? ''}`,
    `優先度: ${issue.priority?.name ?? ''}`,
  ];
  if (issue.assigned_to) lines.push(`担当者: ${issue.assigned_to.name}`);
  if (issue.author) lines.push(`作成者: ${issue.author.name}`);

  if (issue.description) {
    lines.push('', '説明:', issue.description);
  }

  const nonEmptyCf = (issue.custom_fields ?? []).filter(
    (cf: { value: unknown }) => cf.value !== '' && cf.value !== null && cf.value !== undefined
  );
  if (nonEmptyCf.length > 0) {
    lines.push('', 'カスタムフィールド:');
    for (const cf of nonEmptyCf) {
      lines.push(`  ${cf.name}: ${Array.isArray(cf.value) ? cf.value.join(', ') : cf.value}`);
    }
  }

  const notes = (issue.journals ?? []).filter((j: { notes: string }) => j.notes?.trim());
  if (notes.length > 0) {
    lines.push('', 'コメント:');
    for (const j of notes) {
      lines.push(`  ${j.user?.name ?? '不明'}: ${j.notes}`);
    }
  }

  return lines.join('\n');
}

async function handleButtonClick(source: 'redmine' | 'redmine-tr') {
  try {
    const apiKey = await requestApiKey();
    const ticketInfo = await getTicketInfo(apiKey);

    await browser.runtime.sendMessage({
      type: 'OPEN_AI_CHAT',
      payload: { content: ticketInfo, source },
    });
  } catch (err) {
    console.error('[redmaru] エラー:', err);
    alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// AI回答自動更新ボタンの多重クリック防止用
let inFlightRequestId: string | null = null;
// 書き戻し完了後、次のクリックでページ再読み込みを行うかどうか（未保存の入力を消さないよう自動リロードはしない）
let pendingReload = false;

function setAiAnswerButtonState(state: 'idle' | 'sending' | 'waiting' | 'done' | 'timeout' | 'error', detail?: string) {
  const btn = document.getElementById('redmaru-ai-answer-btn') as HTMLButtonElement | null;
  if (!btn) return;

  const labels: Record<typeof state, string> = {
    idle: AI_ANSWER_DEFAULT_LABEL,
    sending: '取得中...',
    waiting: 'AI回答待ち...',
    done: '更新完了（クリックで再読込）',
    timeout: 'タイムアウト',
    error: 'エラー',
  };

  btn.innerHTML = `${BUTTON_ICON_SVG}${labels[state]}`;
  btn.disabled = state === 'sending' || state === 'waiting';
  btn.title = state === 'error' && detail ? detail : '';
}

async function handleAiAnswerButtonClick() {
  if (pendingReload) {
    location.reload();
    return;
  }
  if (inFlightRequestId) return;

  try {
    setAiAnswerButtonState('sending');
    const issueId = getIssueIdFromUrl();
    const apiKey = await requestApiKey();
    const content = await getTicketInfo(apiKey);

    const requestId = crypto.randomUUID();
    inFlightRequestId = requestId;
    setAiAnswerButtonState('waiting');

    await browser.runtime.sendMessage({
      type: 'AUTO_ANSWER_REQUEST',
      payload: { requestId, issueId, apiKey, content },
    });
  } catch (err) {
    console.error('[redmaru] AI回答更新エラー:', err);
    inFlightRequestId = null;
    setAiAnswerButtonState('error', err instanceof Error ? err.message : String(err));
    setTimeout(() => setAiAnswerButtonState('idle'), 4000);
  }
}

function handleRuntimeMessage(message: unknown) {
  if (!isAutoAnswerStatusMessage(message)) return;
  if (message.payload.requestId !== inFlightRequestId) return;

  inFlightRequestId = null;

  if (message.payload.status === 'done') {
    // Redmineへの書き戻しは完了したが、ページ上の表示（カスタムフィールドの値）は
    // サーバーレンダリングのため再読み込みしないと反映されない。90秒待つ間に
    // ユーザーが同じタブでコメント入力等をしている可能性があるため自動リロードはせず、
    // 次のクリックで再読み込みするボタンとして待機する。
    pendingReload = true;
    setAiAnswerButtonState('done');
    return;
  }

  if (message.payload.status === 'timeout') {
    setAiAnswerButtonState('timeout');
  } else {
    setAiAnswerButtonState('error', message.payload.message);
  }
  setTimeout(() => setAiAnswerButtonState('idle'), 4000);
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
