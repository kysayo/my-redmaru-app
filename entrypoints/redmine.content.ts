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
  button.textContent = 'AIチャットに送る';
  button.style.cssText = [
    'margin-left: 8px',
    'padding: 4px 12px',
    'background-color: #2196F3',
    'color: white',
    'border: none',
    'border-radius: 4px',
    'cursor: pointer',
    'font-size: 14px',
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

function getTicketInfo(): string {
  // TODO: 実際の Redmine のDOM構造に合わせてセレクタを調整すること
  const subject =
    document.querySelector('.subject h3')?.textContent?.trim() ??
    document.querySelector('.issue h3')?.textContent?.trim() ??
    document.title;

  const description =
    document.querySelector('.description .wiki')?.textContent?.trim() ?? '';

  const issueId =
    document.querySelector('.issue > .attributes .id')?.textContent?.trim() ??
    location.pathname.match(/\/issues\/(\d+)/)?.[1] ?? '';

  return [
    `チケット #${issueId}: ${subject}`,
    description ? `\ndescription:\n${description}` : '',
  ]
    .join('')
    .trim();
}

function handleButtonClick() {
  const ticketInfo = getTicketInfo();

  // --- デバッグ用: 動作確認後にコメントアウトする ---
  console.log('[redmaru] ticketInfo:', ticketInfo);
  alert(ticketInfo);
  // --- デバッグ用ここまで ---
}
