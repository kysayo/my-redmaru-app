export const DEFAULT_REDMINE_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。後半は更新時のコメントです。400文字程度に要約してください。誰が何をしたかの主語がわかるようにしてください。わからない時は詳細不明でもよいです。結論としてどうなったか、どういう状態にあるかを優先して記載してください。';

export const DEFAULT_TEAMS_TEMPLATE =
  'これはTeamsチャットの{日数}日間の履歴です。トピックごとに段落を作り経緯と今の状態を整理して全体が600文字程度に要約してください。誰が何をしたかわかるようにしてください。わからない時は詳細不明でもよいです。段落で改行してください。';

export const DEFAULT_ISOU_FIELD_MAPPING =
  '案件名:txtAnkenName:input\n対応作業:txtTaiouSagyo:textarea\n移送事由詳細:txtIsoJiyu:textarea\n対象プログラム:txtProgram:textarea\n移送番号:txtIsoEtc:input\n本番適用日:txtIsoDate:input';

export const DEFAULT_AI_ANSWER_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。あなたの回答はそのままRedmineのカスタムフィールドに保存されるため、前置き・挨拶・Markdown装飾（見出しや箇条書き記号など）を使わず、結論から簡潔な地の文で400文字程度に要約してください。誰が何をしたかの主語がわかるようにしてください。わからない時は詳細不明でもよいです。結論としてどうなったか、どういう状態にあるかを優先して記載してください。';

export const DEFAULT_REDMINE_FOR_TR_TEMPLATE =
  'これはRedmineチケットの本文と変更履歴のテキストです。ここから移送の申請項目を以下のフォーマットで抽出してください。【】で囲んだ箇所があなたに出力してほしい項目名です。『』で囲んだ箇所が、チケットを元にあなたにまとめてほしい内容です。\n\n【案件名】\n『申請日yyyymmdd形式_移送_#チケット番号_チケットの件名』\n【対応作業】\n『内容と変更履歴から対応した内容の要約。８００文字以内。』\n【移送事由】\n『新規,条件変更（仕様変更）,プログラム改善,条件ミス（開発時）,条件ミス（メンテ時）,プログラムミス（開発時）,プログラムミス（メンテ時）,その他　の中の一つをチケットの内容から判断して選択する』\n【移送事由詳細】\n『移送事由に補足したい場合に短くコメントを書く』\n【対象プログラム】\n『Redmine項目名「App ID/PGM ID」の文字』\n【移送番号】\n『Redmine項目名「Transfer Number」の文字』\n【本番適用日】\n『Redmine項目名「Scheduled Transfer Date」の日時のyyyy/mm/dd形式』\n【移送概要】\n『プログラム移送,データの移送,ジョブ変更,システム設定変更,その他　の中から該当するものを選択して。複数の場合はカンマ区切り。』';
