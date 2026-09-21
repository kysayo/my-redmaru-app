/**
 * Redmineチケットの取得・AIへ渡すテキストの整形。
 *
 * 元々は redmine.content.ts に閉じていたが、バッチ専用ページ（entrypoints/batch）からも
 * 同じ組み立てを行う必要があるため共有モジュールに切り出した。content script は
 * Redmineと同一オリジンで動くため相対パスで済むが、拡張機能ページ（chrome-extension://）
 * からは絶対URLでないと叩けないため、baseUrl を引数で受ける形にしている。
 */

import { DEFAULT_EXCLUDED_CUSTOM_FIELDS } from './defaults';
import { parseExcludedCustomFieldIds } from './customFieldFilter';

// AI回答自動更新の書き戻し先。updatedAt=AI更新日時、answer=AI回答(JA)、answerEn=AI回答(EN)
export const AI_ANSWER_CUSTOM_FIELDS = { updatedAt: 4588, answer: 4589, answerEn: 4720 };

// チケットJSONのうち参照する部分だけを型として持つ
export interface RedmineIssue {
  id: number;
  subject: string;
  status?: { id: number; name: string; is_closed?: boolean };
  project?: { name: string };
  tracker?: { name: string };
  priority?: { name: string };
  assigned_to?: { name: string };
  author?: { name: string };
  description?: string;
  custom_fields?: { id: number; name: string; value: unknown }[];
  journals?: { notes: string; user?: { name: string } }[];
}

export interface ChildIssue {
  id: number;
  subject: string;
}

export async function fetchIssue(baseUrl: string, issueId: string, apiKey: string): Promise<RedmineIssue> {
  // cache: 'no-store' を明示しないと、同じURLに繰り返しアクセスする環境（Playwrightの
  // 永続プロファイル等）でブラウザのHTTPキャッシュから古いstatusが返り、クローズ判定を
  // 誤る事故があったため必須にしている。
  const res = await fetch(`${baseUrl}/issues/${issueId}.json?include=journals`, {
    headers: { 'X-Redmine-API-Key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

  const { issue } = await res.json();
  return issue;
}

// 表示中のチケットの子チケット（番号・題名のみ）を取得する。
// 子チケットの説明やカスタムフィールドまで含めるとAIに渡す情報量が増えすぎて
// 要約の精度がかえって落ちるため、番号と題名だけに絞る。
// status_id=* を付けないと /issues.json はデフォルトで未完了のもの（open）しか
// 返さないため、クローズ済みの子チケットも一覧に含まれるよう明示的に指定する。
export async function fetchChildIssues(baseUrl: string, issueId: string, apiKey: string): Promise<ChildIssue[]> {
  try {
    // no-storeの理由はfetchIssue()のコメントを参照
    const res = await fetch(`${baseUrl}/issues.json?parent_id=${issueId}&status_id=*&limit=100`, {
      headers: { 'X-Redmine-API-Key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

    const { issues } = await res.json();
    return (issues ?? []).map((i: { id: number; subject: string }) => ({ id: i.id, subject: i.subject }));
  } catch (err) {
    console.warn('[redmaru] 子チケットの取得に失敗しました:', err);
    return [];
  }
}

// チケットがクローズ扱いのステータスかどうかを判定する。
// issue.status.is_closed はRedmineのバージョンによっては返らないため、
// 返らない場合は /issue_statuses.json からクローズ扱いのステータスIDを引く
// （view-customize リポジトリの script_01.txt / script_06.txt と同じ判定方法）。
// 判定に失敗した場合は未クローズ扱いで続行する（AI回答の生成自体は成立するため、
// バッチ実行が1件のAPIエラーで止まらないことを優先する）。
export async function isClosedIssue(baseUrl: string, issue: RedmineIssue, apiKey: string): Promise<boolean> {
  if (typeof issue.status?.is_closed === 'boolean') {
    console.log('[redmaru] クローズ判定: issue.status.is_closedを使用', {
      statusName: issue.status?.name,
      isClosed: issue.status.is_closed,
    });
    return issue.status.is_closed;
  }

  const statusId = issue.status?.id;
  if (statusId === undefined) {
    console.warn('[redmaru] チケットのステータスIDが取得できないため未クローズ扱いにします');
    return false;
  }

  try {
    // no-storeの理由はfetchIssue()のコメントを参照
    const res = await fetch(`${baseUrl}/issue_statuses.json`, {
      headers: { 'X-Redmine-API-Key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Redmine API エラー: ${res.status}`);

    const { issue_statuses } = await res.json();
    const isClosed = (issue_statuses ?? []).some(
      (s: { id: number; is_closed?: boolean }) => s.id === statusId && s.is_closed,
    );
    console.log('[redmaru] クローズ判定: /issue_statuses.jsonを使用', {
      statusName: issue.status?.name,
      statusId,
      isClosed,
    });
    return isClosed;
  } catch (err) {
    console.warn('[redmaru] クローズ判定に失敗したため未クローズ扱いにします:', err);
    return false;
  }
}

// AI回答の書き戻し先であるcf_4589等はAI自身の過去の回答であり、これを含めて再度AIに
// 要約させると出力が過去回答に引きずられてしまうため、設定ページで指定された
// カスタムフィールドを送信対象から除外する。
export async function getExcludedCustomFieldIds(): Promise<Set<number>> {
  const { excludedCustomFields } = await browser.storage.sync.get({
    excludedCustomFields: DEFAULT_EXCLUDED_CUSTOM_FIELDS,
  });
  return parseExcludedCustomFieldIds(excludedCustomFields as string);
}

export function formatTicketInfo(
  issue: RedmineIssue,
  options: {
    baseUrl?: string;
    includeUrl?: boolean;
    excludedCustomFieldIds?: Set<number>;
    childIssues?: ChildIssue[];
  } = {},
): string {
  const lines: string[] = [`チケット #${issue.id}: ${issue.subject}`];

  // 「for TR」の定型文は移送申請の各項目でチケットURLを出力させるため、URLを明示的に渡す。
  // AIは社内RedmineのURLを知らないので、渡さないと出力できないか架空のURLを作ってしまう。
  // AI回答（cf_4589）の要約にURLが紛れ込むのは避けたいため、それ以外のボタンでは含めない。
  if (options.includeUrl) lines.push(`URL: ${options.baseUrl ?? ''}/issues/${issue.id}`);

  lines.push(
    `プロジェクト: ${issue.project?.name ?? ''}`,
    `トラッカー: ${issue.tracker?.name ?? ''}`,
    `ステータス: ${issue.status?.name ?? ''}`,
    `優先度: ${issue.priority?.name ?? ''}`,
  );
  if (issue.assigned_to) lines.push(`担当者: ${issue.assigned_to.name}`);
  if (issue.author) lines.push(`作成者: ${issue.author.name}`);

  if (issue.description) {
    lines.push('', '説明:', issue.description);
  }

  const nonEmptyCf = (issue.custom_fields ?? []).filter(
    (cf) =>
      cf.value !== '' &&
      cf.value !== null &&
      cf.value !== undefined &&
      !options.excludedCustomFieldIds?.has(cf.id)
  );
  if (nonEmptyCf.length > 0) {
    lines.push('', 'カスタムフィールド:');
    for (const cf of nonEmptyCf) {
      lines.push(`  ${cf.name}: ${Array.isArray(cf.value) ? cf.value.join(', ') : cf.value}`);
    }
  }

  if (options.childIssues && options.childIssues.length > 0) {
    lines.push('', '子チケット:');
    for (const child of options.childIssues) {
      lines.push(`  #${child.id}: ${child.subject}`);
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

export function getCustomFieldValue(issue: RedmineIssue, fieldId: number): string {
  const cf = issue.custom_fields?.find((f) => f.id === fieldId);
  return typeof cf?.value === 'string' ? cf.value.trim() : '';
}
