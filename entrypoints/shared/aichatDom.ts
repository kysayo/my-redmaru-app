/**
 * AIチャット（marubeni-chatbot.com）のDOM操作共通ヘルパー。
 * 「送信」「生成完了検知」「回答抽出」をまとめ、aichat.content.ts の自動送信フローから利用する。
 *
 * devtools実機調査で確認済み（2026-07-03時点）:
 * - 送信ボタン: <button type="submit"> の内部に <svg data-testid="SendIcon"> を持つ唯一のボタン。
 * - 完了シグナル: 回答生成が完了すると「この回答は役に立ちましたか？」というフィードバックアンケートが
 *   出現する（1往復のみの新規タブという前提のフローでは、これが生成完了の強いシグナルになる）。
 *   ただし将来サイト側の文言・UIが変わる可能性があるため、旧来のDOM変化debounce方式もフォールバックとして残す。
 *
 * TODO(devtools実機調査): 「停止」ボタンの有無・実セレクタは未確認。見つからなくても動作に支障はない
 * （debounceフォールバックとisGenerating内の送信ボタンdisabled判定でカバーされる）。
 */

const COMPLETION_SURVEY_TEXT = 'この回答は役に立ちましたか';

export const SELECTORS = {
  // 生成中に出現するかもしれない「停止」ボタン候補（未確認・任意）。
  stopButton: ['button[aria-label*="停止"]', 'button[aria-label*="Stop"]'],
  // 回答コンテナ。maruchat-focus.content.ts の openIsouForm と同じ実績あるセレクタを流用。
  answerContainer: ['.segment-based-content'],
} as const;

function findFirst<T extends Element>(selectors: readonly string[]): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * 送信ボタンを取得する。SendIconのsvgから遡るのが第一候補、見つからなければtype="submit"にフォールバック。
 * ページ内に複数の入力欄・送信ボタン（サイドバーの簡易質問欄など）が存在する可能性があるため、
 * near（テキストを挿入した入力欄）が渡された場合はその祖先の<form>内に絞って検索する。
 * 絞り込みで見つからない場合はdocument全体にフォールバックする。
 */
function findSubmitButton(near?: Element | null): HTMLButtonElement | null {
  const scope: ParentNode = near?.closest('form') ?? document;

  const icon = scope.querySelector('svg[data-testid="SendIcon"]');
  const viaIcon = icon?.closest<HTMLButtonElement>('button[type="submit"]');
  if (viaIcon) return viaIcon;

  const viaScope = scope.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (viaScope) return viaScope;

  if (scope !== document) {
    // フォームスコープで見つからなければdocument全体にフォールバック
    const iconGlobal = document.querySelector('svg[data-testid="SendIcon"]');
    const viaIconGlobal = iconGlobal?.closest<HTMLButtonElement>('button[type="submit"]');
    if (viaIconGlobal) return viaIconGlobal;
    return document.querySelector<HTMLButtonElement>('button[type="submit"]');
  }

  return null;
}

/**
 * 「この回答は役に立ちましたか？」フィードバックアンケートの個数を返す。
 * 実機のアンケートspanは class="hidden ... sm:inline" を持ち、生成完了前からDOMに
 * 存在している可能性があるため、存在有無ではなく「送信前からの個数の増加」で判定に使う。
 */
function countCompletionSurveys(): number {
  let count = 0;
  const spans = document.querySelectorAll('span');
  for (const span of spans) {
    // 子を持たない末端のspanのみ数える（祖先spanのtextContentにも含まれ重複計上されるのを防ぐ）
    if (span.childElementCount === 0 && span.textContent?.includes(COMPLETION_SURVEY_TEXT)) count++;
  }
  return count;
}

/** 回答コンテナの個数を返す */
function countAnswerContainers(): number {
  for (const sel of SELECTORS.answerContainer) {
    const nodes = document.querySelectorAll(sel);
    if (nodes.length > 0) return nodes.length;
  }
  return 0;
}

/** 生成中（停止ボタン表示中、または送信ボタンがdisabled）かどうかを判定する */
export function isGenerating(): boolean {
  if (findFirst(SELECTORS.stopButton)) return true;
  const submit = findSubmitButton();
  if (submit && submit.disabled) return true;
  return false;
}

/** 回答コンテナの末尾要素（最新の回答）のテキストを返す */
export function getLatestAnswerText(): string | null {
  for (const sel of SELECTORS.answerContainer) {
    const nodes = document.querySelectorAll<HTMLElement>(sel);
    if (nodes.length > 0) {
      return nodes[nodes.length - 1].textContent ?? '';
    }
  }
  return null;
}

/**
 * 送信ボタンが押せる状態になるまでポーリングしてクリックする。
 * near にテキストを挿入した入力欄を渡すと、その入力欄と同じ<form>内の送信ボタンを優先して探す
 * （ページ内に他の入力欄・送信ボタンがある場合の誤クリックを防ぐ）。
 * ボタンが見つからない場合はfalseを返す（呼び出し元でEnterキー等のフォールバックを検討する）。
 */
export async function clickSubmitButtonWhenReady(
  near?: Element | null,
  timeoutMs = 5000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const submit = findSubmitButton(near);
    if (submit && !submit.disabled) {
      submit.click();
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function isInputCleared(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return el.value.trim() === '';
  return (el.textContent ?? '').trim() === '';
}

/** input要素に対してCtrl+Enterのキー操作をシミュレートする */
function dispatchCtrlEnter(el: HTMLElement) {
  const base: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', base));
  el.dispatchEvent(new KeyboardEvent('keypress', base));
  el.dispatchEvent(new KeyboardEvent('keyup', base));
}

/**
 * 送信ボタンが押せる状態（disabled解除）になるまで待つ。フレームワーク側が
 * テキスト挿入イベントを処理し終えた目安として使う（disabled連動がないサイトへの保険は
 * 呼び出し元の追加待機で対応する）。
 */
async function waitUntilReady(near: Element | null, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const submit = findSubmitButton(near);
    if (submit && !submit.disabled) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * メッセージを送信する。
 * 実サイトの入力欄プレースホルダーが「Ctrl + Enterキーを押して送信」と明記しているため、
 * まずCtrl+Enterのキー操作をシミュレートする（実機確認の結果、送信ボタンをclick()するだけでは
 * フレームワーク側の内部状態更新が追いつかず送信されないケースがあったため、こちらを優先する）。
 *
 * 実機確認の結果、テキスト挿入直後にすぐCtrl+Enterを発火すると、フレームワーク側の内部状態
 * （バリデーション等）の更新が間に合わず「メッセージの送信に失敗しました」というエラーになる
 * ケースがあった。そのため送信ボタンのdisabled解除を待ち、さらに最低限の猶予（既定300ms）を
 * 置いてからキー操作を発火する。
 *
 * キー操作後も入力欄にテキストが残っている場合は、送信ボタンのクリックにフォールバックする。
 * どちらの方法でも入力欄が空にならなければfalseを返す。
 */
export async function submitMessage(inputEl: HTMLElement | null, timeoutMs = 5000): Promise<boolean> {
  if (inputEl) {
    await waitUntilReady(inputEl, timeoutMs);
    await new Promise((r) => setTimeout(r, 300));

    dispatchCtrlEnter(inputEl);
    await new Promise((r) => setTimeout(r, 800));
    if (isInputCleared(inputEl)) return true;
  }

  const clicked = await clickSubmitButtonWhenReady(inputEl, timeoutMs);
  if (!clicked) return false;

  await new Promise((r) => setTimeout(r, 500));
  return inputEl ? isInputCleared(inputEl) : true;
}

export interface WaitForAnswerOptions {
  /** DOM変化が止まってから完了とみなすまでの猶予時間（フォールバック判定用） */
  debounceMs?: number;
  /** 完了アンケート出現後、テキスト確定を待つ猶予時間 */
  surveyGraceMs?: number;
  /** 監視開始からこの時間が経過するまでは絶対に完了と判定しない（送信直後の誤検知防止） */
  minWaitMs?: number;
  /** これを超えたらタイムアウトとして諦める上限時間 */
  timeoutMs?: number;
}

export type WaitForAnswerResult =
  | { status: 'success'; text: string }
  | { status: 'timeout' };

/**
 * 回答完了を検知する。**送信直後（この関数の呼び出し前）の誤検知を防ぐため、監視開始時点の
 * 状態をベースラインとして記録し、そこからの「増加」でのみ完了と判定する。**
 *
 * 第一の判定方法: 「この回答は役に立ちましたか？」アンケートの個数がベースラインより増えたこと
 * （アンケートspanはCSSで隠れた状態でDOMに事前存在しうるため、存在有無ではなく個数差分を使う）。
 * フォールバック: 回答コンテナの個数がベースラインより増え、DOM変化がdebounceMsだけ止まり、
 * かつ生成中インジケーターが無ければ完了とみなす。
 * いずれの場合もminWaitMs（既定5000ms）が経過するまでは確定しない。
 * timeoutMs を超えた場合はタイムアウトとして結果を返す（成功扱いにはしない）。
 */
export function waitForAnswerComplete(opts: WaitForAnswerOptions = {}): Promise<WaitForAnswerResult> {
  const debounceMs = opts.debounceMs ?? 1800;
  const surveyGraceMs = opts.surveyGraceMs ?? 500;
  const minWaitMs = opts.minWaitMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 90000;

  const baselineSurveyCount = countCompletionSurveys();
  const baselineAnswerCount = countAnswerContainers();
  const startTime = Date.now();
  console.log('[redmaru] 完了検知ベースライン:', { baselineSurveyCount, baselineAnswerCount });

  return new Promise((resolve) => {
    let settled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let surveyTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: WaitForAnswerResult) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(debounceTimer);
      clearTimeout(surveyTimer);
      clearTimeout(hardTimeout);
      resolve(result);
    };

    const hardTimeout = setTimeout(() => finish({ status: 'timeout' }), timeoutMs);

    const minWaitElapsed = () => Date.now() - startTime >= minWaitMs;

    const checkSurvey = () => {
      if (!minWaitElapsed()) return;
      if (countCompletionSurveys() <= baselineSurveyCount) return;
      clearTimeout(surveyTimer);
      surveyTimer = setTimeout(() => {
        const text = getLatestAnswerText();
        if (text) {
          console.log('[redmaru] アンケート出現により完了と判定');
          finish({ status: 'success', text });
        }
      }, surveyGraceMs);
    };

    const observer = new MutationObserver(() => {
      checkSurvey();

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // アンケートが出ないサイト変更等への保険。
        // 新しい回答コンテナが増えており、生成中インジケーターが無ければ完了とみなす。
        if (!minWaitElapsed()) return;
        if (isGenerating()) return;
        if (countAnswerContainers() <= baselineAnswerCount) return;
        const text = getLatestAnswerText();
        if (text) {
          console.log('[redmaru] DOM変化の静止により完了と判定（フォールバック）');
          finish({ status: 'success', text });
        }
      }, debounceMs);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}
