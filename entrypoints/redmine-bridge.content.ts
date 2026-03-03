/**
 * Redmine Bridge Content Script（MAIN world）
 * メインJSコンテキストで動作し、ViewCustomize.context.user.apiKey を
 * カスタムイベント経由で Isolated World の redmine.content.ts に渡す。
 *
 * Content Script は Isolated World で動作するため window.ViewCustomize に直接
 * アクセスできない。world: 'MAIN' のスクリプトはメインコンテキストで実行されるため
 * ViewCustomize にアクセスできる。
 */

export default defineContentScript({
  matches: ['https://misol-dev.cloud.redmine.jp/issues/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    document.addEventListener('redmaru:request-apikey', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiKey = (window as any).ViewCustomize?.context?.user?.apiKey ?? '';
      document.dispatchEvent(new CustomEvent('redmaru:apikey', { detail: apiKey }));
    });
  },
});
