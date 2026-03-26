/**
 * Marubeni Chatbot フォーカスモード Content Script
 *
 * 画面右下のボタンでフォーカスモードをON/OFF切り替え。
 * - ON: 左サイドバー・ヘッダー・入力エリアを非表示にして回答エリアを拡大
 * - OFF: 元のレイアウトに戻す
 *
 * ---- セレクタ調整ガイド ----
 * class名がCSS-in-JSで生成されている場合はセレクタが一致しないことがあります。
 * DevToolsで要素を確認し、下記 SELECTORS 定数を修正してください。
 * コンソールで "[redmaru-focus]" プレフィックスのログを確認すると
 * どの要素が見つかっているか/いないかが分かります。
 */
export default defineContentScript({
  matches: ['https://www.marubeni-chatbot.com/*'],
  main() {
    // DOM構築を待って注入
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectFocusButton();
        injectScrollButton();
        observeButtonRemoval();
        setupSpaNavigation();
      });
    } else {
      injectFocusButton();
      injectScrollButton();
      observeButtonRemoval();
      setupSpaNavigation();
    }
  },
});

// ---- セレクタ定数（DOM構造に合わせて調整してください） ----
const SELECTORS = {
  header: [
    'header',
    '[id="header"]',
    '[class*="TopBar"]',
    '[class*="topBar"]',
  ],
  // パンくずナビゲーション（aria-label で確実に特定）
  breadcrumb: [
    'nav[aria-label="Breadcrumb"]',
    'nav[aria-label*="breadcrumb"]',
    'nav[aria-label*="Breadcrumb"]',
  ],
  // チャットタイトルバー（GPT-5.1 + ファイル一覧 が表示される行）
  chatTitleBar: [
    // Tailwind任意値クラスで特定（bg-[#f5f5f5] と text-[1.2rem] の組み合わせはタイトルバー固有）
    'div.bg-\\[\\#f5f5f5\\].text-\\[1\\.2rem\\]',
    'div.text-\\[1\\.2rem\\].px-14.py-2',
    '[class*="chatTitle"]',
    '[class*="ChatHeader"]',
    '[class*="chatHeader"]',
    '[class*="ConversationHeader"]',
  ],
  sidebar: [
    // shadcn/ui SidebarProvider の場合: sidebar-wrapper（ラッパー）ではなく sidebar 本体
    '[data-slot="sidebar"]',
    'aside[data-slot="sidebar"]',
    'aside',
    '[class*="LeftPanel"]',
    '[class*="leftPanel"]',
    '[class*="left-panel"]',
    '[class*="SidePanel"]',
  ],
  inputArea: [
    '[class*="inputArea"]',
    '[class*="InputArea"]',
    '[class*="input-area"]',
    '[class*="chatInput"]',
    '[class*="ChatInput"]',
    '[class*="chatFooter"]',
    '[class*="ChatFooter"]',
    '[class*="footer"]',
    '[class*="Footer"]',
  ],
  mainContent: [
    '[class*="messageContainer"]',
    '[class*="mainContent"]',
    '[class*="main-content"]',
    '[class*="MainContent"]',
    'main',
  ],
};

const BUTTON_ID = 'redmaru-focus-btn';
const SCROLL_BUTTON_ID = 'redmaru-scroll-btn';

// ボタンの共通スタイルを生成する
function makeButtonStyle(bottom: number): string {
  return [
    'position: fixed',
    `bottom: ${bottom}px`,
    'right: 20px',
    'z-index: 9999',
    'width: 44px',
    'height: 44px',
    'border-radius: 50%',
    'background-color: #2196F3',
    'color: white',
    'border: none',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'opacity: 0.7',
    'transition: opacity 0.2s, box-shadow 0.2s',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.3)',
    'padding: 0',
  ].join(';');
}

let isFocused = false;

interface SavedStyle {
  el: HTMLElement;
  originalDisplay: string;
}

let savedStyles: SavedStyle[] = [];
let savedMainEl: HTMLElement | null = null;
let savedMainCssText = '';

// ---- 要素検索 ----

function findElement(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      console.log(`[redmaru-focus] 発見: ${sel}`, el);
      return el;
    }
  }
  console.warn(`[redmaru-focus] 未発見: ${selectors.join(', ')}`);
  return null;
}

/**
 * textarea から指定段数上の祖先要素を返す。
 * 入力エリアのコンテナを SELECTORS で見つけられなかった場合のフォールバック。
 */
function findInputAreaByTextarea(levels = 3): HTMLElement | null {
  const textarea = document.querySelector<HTMLElement>('textarea');
  if (!textarea) return null;
  let el: HTMLElement | null = textarea;
  for (let i = 0; i < levels; i++) {
    el = el?.parentElement ?? null;
  }
  if (el) {
    console.log('[redmaru-focus] 入力エリア: textarea の祖先要素から検出', el);
  }
  return el;
}

// ---- フォーカスモード切り替え ----

function toggleFocusMode() {
  if (isFocused) {
    exitFocusMode();
  } else {
    enterFocusMode();
  }
  updateButtonAppearance();
}

function findChatTitleBar(): HTMLElement | null {
  return findElement(SELECTORS.chatTitleBar);
}

function enterFocusMode() {
  const header = findElement(SELECTORS.header);
  const breadcrumb = findElement(SELECTORS.breadcrumb);
  const chatTitleBar = findChatTitleBar();
  const sidebar = findElement(SELECTORS.sidebar);
  let inputArea = findElement(SELECTORS.inputArea);
  if (!inputArea) {
    inputArea = findInputAreaByTextarea(3);
  }

  [header, breadcrumb, chatTitleBar, sidebar, inputArea].forEach((el) => {
    if (el) {
      savedStyles.push({ el, originalDisplay: el.style.display });
      el.style.display = 'none';
    }
  });

  const mainEl = findElement(SELECTORS.mainContent);
  if (mainEl) {
    savedMainEl = mainEl;
    savedMainCssText = mainEl.style.cssText;
    mainEl.style.maxWidth = '100%';
    mainEl.style.width = '100%';
    mainEl.style.flex = '1';
  }

  isFocused = true;
}

function exitFocusMode() {
  savedStyles.forEach(({ el, originalDisplay }) => {
    el.style.display = originalDisplay;
  });
  savedStyles = [];

  if (savedMainEl) {
    savedMainEl.style.cssText = savedMainCssText;
    savedMainEl = null;
    savedMainCssText = '';
  }

  isFocused = false;
}

function resetState() {
  // フォーカス中に状態をリセットする（SPA遷移時など）
  if (isFocused) {
    exitFocusMode();
  }
  savedStyles = [];
  savedMainEl = null;
  savedMainCssText = '';
  isFocused = false;
}

// ---- ボタン ----

function updateButtonAppearance() {
  const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (!btn) return;
  btn.title = isFocused ? 'フォーカスモードを解除' : 'フォーカスモード（回答エリアを拡大）';
  btn.innerHTML = isFocused ? getCollapseIcon() : getExpandIcon();
  btn.style.opacity = isFocused ? '1' : '0.7';
}

function getExpandIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="9 21 3 21 3 15"></polyline>
    <line x1="21" y1="3" x2="14" y2="10"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
  </svg>`;
}

function getCollapseIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 14 10 14 10 20"></polyline>
    <polyline points="20 10 14 10 14 4"></polyline>
    <line x1="10" y1="14" x2="3" y2="21"></line>
    <line x1="21" y1="3" x2="14" y2="10"></line>
  </svg>`;
}

function attachHoverEffect(btn: HTMLButtonElement, getOpacity: () => string) {
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = getOpacity();
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  });
}

function injectFocusButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.title = 'フォーカスモード（回答エリアを拡大）';
  btn.innerHTML = getExpandIcon();
  // スクロールボタンの上: 80 + 44(高さ) + 12(間隔) = 136px
  btn.style.cssText = makeButtonStyle(136);

  attachHoverEffect(btn, () => (isFocused ? '1' : '0.7'));
  btn.addEventListener('click', toggleFocusMode);

  document.body.appendChild(btn);
}

function injectScrollButton() {
  if (document.getElementById(SCROLL_BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = SCROLL_BUTTON_ID;
  btn.title = '最下部へスクロール';
  btn.innerHTML = getScrollDownIcon();
  btn.style.cssText = makeButtonStyle(80);

  attachHoverEffect(btn, () => '0.7');
  btn.addEventListener('click', scrollToBottom);

  document.body.appendChild(btn);
}

function scrollToBottom() {
  // スクロール量が最も多い overflow-y-auto 要素を対象にする
  const candidates = document.querySelectorAll<HTMLElement>('div, main');
  let maxScrollable = 0;
  let target: HTMLElement | null = null;
  candidates.forEach((el) => {
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable > maxScrollable) {
      maxScrollable = scrollable;
      target = el;
    }
  });
  if (target) {
    (target as HTMLElement).scrollTop = (target as HTMLElement).scrollHeight;
  }
}

function getScrollDownIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>`;
}

function observeButtonRemoval() {
  const observer = new MutationObserver(() => {
    const focusMissing = !document.getElementById(BUTTON_ID);
    const scrollMissing = !document.getElementById(SCROLL_BUTTON_ID);
    if (focusMissing || scrollMissing) {
      observer.disconnect();
      if (focusMissing) resetState();
      setTimeout(() => {
        injectFocusButton();
        injectScrollButton();
        observeButtonRemoval();
      }, 500);
    }
  });
  observer.observe(document.body, { childList: true });
}

// ---- SPA ナビゲーション対応 ----

function setupSpaNavigation() {
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    window.dispatchEvent(new Event('redmaru-focus:urlchange'));
  };

  window.addEventListener('redmaru-focus:urlchange', () => {
    resetState();
    setTimeout(() => {
      injectFocusButton();
      injectScrollButton();
      observeButtonRemoval();
    }, 500);
  });
}
