/**
 * Redmine用 Content Script
 * チケットページにボタンを注入し、チケット情報をAIチャットに送信する
 */

export default defineContentScript({
  matches: ['https://misol-dev.cloud.redmine.jp/issues/*'],
  main() {
    injectButton();
  },
});

function injectButton() {
  // すでにボタンが注入済みの場合はスキップ
  if (document.getElementById('redmaru-send-btn')) return;

  const button = document.createElement('button');
  button.id = 'redmaru-send-btn';
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16" role="img" aria-label="Send to AI chat" style="flex-shrink:0">
  <rect x="0.75" y="0.75" width="24.5" height="14.5" rx="4" ry="4" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
  <path d="M3.2 8H9.0" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M9.0 8L7.1 6.4M9.0 8L7.1 9.6" fill="none" stroke="#6b7280" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="16.0" cy="7.6" r="4.7" fill="none" stroke="#e11d2e" stroke-width="2.4"/>
  <path d="M19.2 10.9L21.5 13.2" fill="none" stroke="#e11d2e" stroke-width="2.4" stroke-linecap="round"/>
</svg>Send To MaruCha`;
  button.style.cssText = [
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

  button.addEventListener('click', handleButtonClick);

  // #content内のeditアイコン（ペンマーク）の直前（左）に挿入する
  const editIcon = document.querySelector<HTMLElement>('#content .contextual a.icon-edit');
  if (editIcon) {
    editIcon.insertAdjacentElement('beforebegin', button);
  } else {
    // フォールバック: #content直下h2の後
    document.querySelector('#content h2')?.insertAdjacentElement('afterend', button);
  }
}

async function getTicketInfo(): Promise<string> {
  const issueId = location.pathname.match(/\/issues\/(\d+)/)?.[1];
  if (!issueId) throw new Error('チケットIDを取得できませんでした');

  // Content ScriptはIsolated Worldで動作するためwindow.ViewCustomizeに直接アクセスできない。
  // world:'MAIN'のredmine-bridge.content.tsにカスタムイベントでAPIキーを要求する。
  const apiKey = await new Promise<string>((resolve, reject) => {
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

async function handleButtonClick() {
  try {
    const ticketInfo = await getTicketInfo();

    await browser.runtime.sendMessage({
      type: 'OPEN_AI_CHAT',
      payload: { ticketInfo },
    });
  } catch (err) {
    console.error('[redmaru] エラー:', err);
    alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  }
}
