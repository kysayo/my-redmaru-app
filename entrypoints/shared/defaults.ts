export const DEFAULT_REDMINE_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。後半は更新時のコメントです。400文字程度に要約してください。誰が何をしたかの主語がわかるようにしてください。わからない時は詳細不明でもよいです。結論としてどうなったか、どういう状態にあるかを優先して記載してください。';

export const DEFAULT_TEAMS_TEMPLATE =
  'これはTeamsチャットの{日数}日間の履歴です。トピックごとに段落を作り経緯と今の状態を整理して全体が600文字程度に要約してください。誰が何をしたかわかるようにしてください。わからない時は詳細不明でもよいです。段落で改行してください。';

export const DEFAULT_ISOU_FIELD_MAPPING =
  '案件名:txtAnkenName:input\n対応作業:txtTaiouSagyo:textarea\n移送事由詳細:txtIsoJiyu:textarea\n対象プログラム:txtProgram:textarea\n検証方法:txtKenshoHouhou:textarea\n移送番号:txtIsoEtc:input\n本番適用日:txtIsoDate:input';

export const DEFAULT_AI_ANSWER_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。あなたの回答はそのままRedmineのカスタムフィールドに保存されるため、前置き・挨拶・Markdown装飾（見出しや箇条書き記号など）を使わず、結論から簡潔な地の文で400文字程度に要約してください。誰が何をしたかの主語がわかるようにしてください。わからない時は詳細不明でもよいです。結論としてどうなったか、どういう状態にあるかを優先して記載してください。';

// クローズ扱いのステータスのチケットに対して使う定型文（対応が確定している前提のまとめ方）
export const DEFAULT_AI_ANSWER_CLOSED_TEMPLATE =
  'これは対応完了したRedmineチケットの本文と変更履歴のテキストです。あなたの回答はそのままRedmineのカスタムフィールドに保存されるため、前置き・挨拶・Markdown装飾（見出しや箇条書き記号など）を使わず、以下の項目を使って内容をまとめてください。項目は【】で囲った個所です。まとめと次の項目の間には改行を挟んでください。括弧（）で囲んだ箇所が、あなたにまとめてほしい内容です。チケットはQA/BUG/Change Request/Enhanceと種類が分かれるため、該当する情報がない場合もあります。その場合は情報の無い項目は記載しないでください。\n\n【問い合わせ概要】\n（全体を短くまとめる。項目「App ID/PGM ID」に値がある場合はPGM IDとアプリの名前も書く）\n\n【事象】\n（起票の元になった出来事をBUGの場合は項目「Incident Details」と「description」を元に記載する。具体的な事象、再現条件、画面や機能単位の情報をまとめる。CRの場合は変えたい挙動を書く）\n\n【原因】\n（BUGの場合は項目「Cause」から記載する。技術的・業務的な原因や背景。コード上の問題、設定不備、仕様の認識違いなどをまとめる。）\n\n【影響範囲】\n（BUGの場合は項目「Scope of Impact」「Business Impact」から記載する。どの機能・画面・ユーザ・環境に影響したか、影響の有無と範囲をまとめる。）\n\n【対応内容】\n（実施した修正内容、設定変更、リリース作業など、技術的・運用的な対応の詳細をまとめる。）\n\n【ユーザ対応】\n（ユーザー側で行ったアクションをまとめる。）\n\n【結果】\n（QAの場合はユーザー側への回答をまとめる。BUG,CR,ENの場合はプログラム、業務がどのように変わったかまとめる）';

// AI回答更新の書き戻し成功時、Redmineタブを自動でアクティブにするかどうかのデフォルト値
// バッチ実行中は他の作業を並行して行うことが多いため、設定でオフにできるようにしている
export const DEFAULT_AUTO_ANSWER_FOCUS_TAB_ON_SUCCESS = true;

// AI回答の生成完了を待つタイムアウト秒数のデフォルト値（waitForAnswerCompleteに渡す）
export const DEFAULT_AI_ANSWER_TIMEOUT_SECONDS = 90;

// AIチャットタブを非アクティブ（バックグラウンド）で開くかどうかのデフォルト値
// 既存の挙動（アクティブで開く）に影響させないため既定はオフ
export const DEFAULT_OPEN_AI_CHAT_TAB_IN_BACKGROUND = false;

// 送信対象から除外するカスタムフィールド（cf_XXXX形式、改行区切り）のデフォルト値。
// cf_4589・cf_4720はいずれもRedmine側でAIまとめ用途に使われているカスタムフィールドであり、
// これらを含めて再度AIに要約させるとAI自身の過去の回答が入力に混ざってしまうため既定で除外する。
export const DEFAULT_EXCLUDED_CUSTOM_FIELDS = 'cf_4589\ncf_4720';

export const DEFAULT_REDMINE_FOR_TR_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。ここから移送の申請項目を以下のフォーマットで抽出してください。【】で囲んだ箇所があなたに出力してほしい項目名です。『』で囲んだ箇所が、チケットを元にあなたにまとめてほしい内容です。\n\n【案件名】\n『申請日yyyymmdd形式_移送_#チケット番号_チケットの件名』\n【対応作業】\n『「以下チケット対応のため移送承認をお願いします」という文言で改行して、対象チケットのURL』\n【移送事由詳細】\n『チケットのプロジェクト名』\n【対象プログラム】\n『「以下チケット参考」という文言で改行して、対象チケットのURL』\n【検証方法】\n『「以下チケット参考」という文言で改行して、対象チケットのURL』\n【移送番号】\n『Redmine項目名「Transfer Number」の文字』\n【本番適用日】\n『Redmine項目名「Scheduled Transfer Date」の日時のyyyy/mm/dd形式』\n【移送概要】\n『プログラム移送,データの移送,ジョブ変更,システム設定変更,その他　の中から該当するものを選択して。複数の場合はカンマ区切り。』';
