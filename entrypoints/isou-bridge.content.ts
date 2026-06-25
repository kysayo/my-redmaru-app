/**
 * 移送申請フォーム Bridge Content Script（MAIN world）
 * Isolated World から受け取ったカスタムイベントで ASP.NET の __doPostBack を呼ぶ。
 * Content Script は Isolated World で動作するため window.__doPostBack に直接アクセスできない。
 * world: 'MAIN' のスクリプトはメインコンテキストで実行されるためアクセスできる。
 */

export default defineContentScript({
  matches: ['https://isouext.marubeni.co.jp/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    document.addEventListener('redmaru:isou-postback', () => {
      const drp = document.getElementById('drpIsoType') as HTMLSelectElement | null;
      if (!drp) return;
      drp.value = '14';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__doPostBack('drpIsoType', '');
    });
  },
});
