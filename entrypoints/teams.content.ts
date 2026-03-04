/**
 * Teams用 Content Script
 * Teams Webのチャット画面にボタンを注入し、指定期間のメッセージをAIチャットに送信する
 *
 * ⚠️ Teams DOM セレクタは実際のブラウザDevToolsで確認してから修正すること。
 *    以下の TODO コメント箇所を重点的に確認する。
 */

export default defineContentScript({
  matches: ['https://teams.microsoft.com/*'],
  runAt: 'document_idle',
  main() {
    observeNavigation();
    scheduleButtonInjection(2000);
  },
});

// ──────────────────────────────────────────────
// ボタン注入
// ──────────────────────────────────────────────

let injectionTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleButtonInjection(delayMs = 1500) {
  if (injectionTimer) clearTimeout(injectionTimer);
  injectionTimer = setTimeout(() => {
    injectButton();
  }, delayMs);
}

function injectButton(): void {
  if (document.getElementById('redmaru-teams-btn')) return;

  // ヘッダー最優先: 「今すぐ会議」ボタンの左に挿入
  const meetNowBtn = document.querySelector<HTMLElement>('[data-tid="audio-drop-in-now-button"]');
  if (meetNowBtn) {
    meetNowBtn.insertAdjacentElement('beforebegin', createSendButton());
    return;
  }

  // フォールバック1: 会議ボタンエリアの先頭
  const callingArea = document.querySelector<HTMLElement>('[data-tid="chat-calling-meeting-buttons"]');
  if (callingArea) {
    callingArea.insertAdjacentElement('afterbegin', createSendButton());
    return;
  }

  // フォールバック2: ヘッダーツールバーの先頭
  const headerToolbar = document.querySelector<HTMLElement>('[data-tid="entity-header-toolbar"]');
  if (headerToolbar) {
    headerToolbar.insertAdjacentElement('afterbegin', createSendButton());
    return;
  }

  // DOMがまだ準備できていない場合は再試行
  scheduleButtonInjection(1500);
}

function createSendButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'redmaru-teams-btn';
  button.title = 'Send to MaruCha';
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16" role="img" aria-label="Send to AI chat" style="flex-shrink:0">
  <rect x="0.75" y="0.75" width="24.5" height="14.5" rx="4" ry="4" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
  <path d="M3.2 8H9.0" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M9.0 8L7.1 6.4M9.0 8L7.1 9.6" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="16.0" cy="7.6" r="4.7" fill="none" stroke="#e11d2e" stroke-width="2.4"/>
  <path d="M19.2 10.9L21.5 13.2" fill="none" stroke="#e11d2e" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
  button.style.cssText = [
    'margin: 0 4px',
    'padding: 4px 12px',
    'background-color: #2196F3',
    'color: white',
    'border: none',
    'border-radius: 4px',
    'cursor: pointer',
    'font-size: 13px',
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'z-index: 100',
  ].join(';');

  button.addEventListener('click', handleButtonClick);
  return button;
}

function removeButton(): void {
  document.getElementById('redmaru-teams-btn')?.remove();
}

// ──────────────────────────────────────────────
// Teams SPA ナビゲーション対応
// ──────────────────────────────────────────────

function observeNavigation(): void {
  // history.pushState をラップしてカスタムイベントを発行
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    window.dispatchEvent(new Event('redmaru:urlchange'));
  };

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('redmaru:urlchange'));
  });

  window.addEventListener('redmaru:urlchange', () => {
    removeButton();
    scheduleButtonInjection(2000);
  });

  // MutationObserver でツールバーの出現も監視（フォールバック）
  const observer = new MutationObserver(() => {
    const canInject =
      document.querySelector('[data-tid="audio-drop-in-now-button"]') ??
      document.querySelector('[data-tid="chat-calling-meeting-buttons"]') ??
      document.querySelector('[data-tid="entity-header-toolbar"]');
    if (!document.getElementById('redmaru-teams-btn') && canInject) {
      observer.disconnect();
      injectButton();
      // 監視を再開（次のナビゲーションに備える）
      setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ──────────────────────────────────────────────
// ボタンクリックハンドラ
// ──────────────────────────────────────────────

async function handleButtonClick(): Promise<void> {
  const button = document.getElementById('redmaru-teams-btn') as HTMLButtonElement | null;
  if (!button) return;

  button.disabled = true;
  button.textContent = '収集中...';

  try {
    const result = await browser.storage.sync.get({ teamsPeriodDays: 14 });
    const periodDays =
      typeof result.teamsPeriodDays === 'number' ? result.teamsPeriodDays : 14;

    const content = await collectMessages(periodDays);

    await browser.runtime.sendMessage({
      type: 'OPEN_AI_CHAT',
      payload: { content, source: 'teams' },
    });
  } catch (err) {
    console.error('[redmaru:teams] エラー:', err);
    alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    button.disabled = false;
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16" role="img" aria-label="Send to AI chat" style="flex-shrink:0">
  <rect x="0.75" y="0.75" width="24.5" height="14.5" rx="4" ry="4" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
  <path d="M3.2 8H9.0" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M9.0 8L7.1 6.4M9.0 8L7.1 9.6" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="16.0" cy="7.6" r="4.7" fill="none" stroke="#e11d2e" stroke-width="2.4"/>
  <path d="M19.2 10.9L21.5 13.2" fill="none" stroke="#e11d2e" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
  }
}

// ──────────────────────────────────────────────
// メッセージ収集
// ──────────────────────────────────────────────

interface TeamsMessage {
  isoDate: string;    // 重複排除・ソート用キー（ISO形式）
  sender: string;
  timestamp: string;
  body: string;
}

/**
 * 仮想スクロール対応のメッセージ収集
 *
 * Teams は仮想スクロールのため、画面外のメッセージを DOM から削除する。
 * 最下部から上方向にスクロールしながら、各位置で逐次収集する。
 * Map<isoDate> で重複排除し、最後にタイムスタンプ順にソートする。
 */
async function collectMessages(periodDays: number): Promise<string> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  cutoffDate.setHours(0, 0, 0, 0);

  const container =
    document.querySelector<HTMLElement>('[data-tid="message-pane-list-viewport"]') ??
    document.querySelector<HTMLElement>('[data-tid="message-pane-body"]') ??
    null;

  if (!container) {
    throw new Error('Teamsのメッセージ一覧が見つかりませんでした。チャット画面を開いているか確認してください。');
  }

  const savedScrollTop = container.scrollTop;

  // 最下部へスクロールして最新メッセージを DOM に載せる
  container.scrollTop = container.scrollHeight;
  await wait(500);

  const messageMap = new Map<string, TeamsMessage>();

  // 現在表示分を収集してから、上方向へスクロールしながら逐次収集
  collectVisibleMessages(cutoffDate, messageMap);

  let prevScrollTop = -1;
  let iterations = 0;

  while (iterations < 200) {
    const oldest = getOldestVisibleTimestamp();
    if (oldest !== null && oldest < cutoffDate) break; // 期間より前が見えた

    if (container.scrollTop === prevScrollTop) break; // 上端に達した

    prevScrollTop = container.scrollTop;
    container.scrollTop = Math.max(0, container.scrollTop - 500);

    await wait(300);

    collectVisibleMessages(cutoffDate, messageMap);
    iterations++;
  }

  // スクロール位置を復元
  container.scrollTop = savedScrollTop;

  const sorted = [...messageMap.values()].sort((a, b) =>
    a.isoDate.localeCompare(b.isoDate),
  );

  if (sorted.length === 0) {
    throw new Error('収集期間内にメッセージが見つかりませんでした。');
  }

  return formatMessages(sorted);
}

/** 現在 DOM に表示されているメッセージを messageMap に追加する（重複は isoDate で排除） */
function collectVisibleMessages(
  cutoffDate: Date,
  messageMap: Map<string, TeamsMessage>,
): void {
  const items = document.querySelectorAll<HTMLElement>('[data-tid="chat-pane-item"]');

  for (const item of items) {
    const senderEl = item.querySelector<HTMLElement>('[data-tid="message-author-name"]');
    const timeEl = item.querySelector<HTMLElement>('time[datetime]');
    const bodyEl = item.querySelector<HTMLElement>('[data-tid="chat-pane-message"]');

    if (!senderEl || !timeEl || !bodyEl) continue;

    const isoDate = timeEl.getAttribute('datetime') ?? '';
    if (!isoDate) continue;

    const messageDate = new Date(isoDate);
    if (isNaN(messageDate.getTime())) continue;
    if (messageDate < cutoffDate) continue;

    // 重複チェック（同じタイムスタンプはスキップ）
    if (messageMap.has(isoDate)) continue;

    const sender = senderEl.textContent?.trim() ?? '不明';
    const timestamp = messageDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // リアクション（いいね！等）部分を除外して本文のみ取得
    const bodyClone = bodyEl.cloneNode(true) as HTMLElement;
    bodyClone.querySelector('[data-tid="diverse-reaction-summary"]')?.remove();
    bodyClone.querySelector('[data-tid="diverse-reaction-pill-button"]')?.remove();
    const body = bodyClone.textContent?.trim() ?? '';

    if (!body) continue;

    messageMap.set(isoDate, { isoDate, sender, timestamp, body });
  }
}

function getOldestVisibleTimestamp(): Date | null {
  const timestamps = document.querySelectorAll<HTMLElement>('time[datetime]');
  if (timestamps.length === 0) return null;

  const datetimeAttr = timestamps[0].getAttribute('datetime') ?? '';
  const parsed = new Date(datetimeAttr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatMessages(messages: TeamsMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    lines.push(`[${msg.timestamp}] ${msg.sender}`);
    lines.push(msg.body);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
