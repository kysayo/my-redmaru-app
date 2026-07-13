# Send2MaruCha 仕様書

## 概要

Redmine のチケット情報、および Microsoft Teams のチャット履歴を社内 AI チャット（MaruCha）に送信する Chrome 拡張機能。

## 対象 URL

| ロール | URL パターン |
|--------|-------------|
| Redmine（送信側） | `https://misol-dev.cloud.redmine.jp/issues/*` |
| Teams（送信側） | `https://teams.microsoft.com/*` |
| AI チャット（受信側・ボタン注入） | `https://www.marubeni-chatbot.com/*` |
| 移送申請フォーム（転記先） | `https://isouext.marubeni.co.jp/TAS/contents/transaction/T011.aspx` |

---

## 機能

### Redmine 側（送信）

- チケットページに「to MaruCha」「for TR」「AI回答更新」の3ボタンを注入する（横並び）
  - 「AI回答更新」は `cf_4589`（AIまとめ）欄の直下に挿入する。このカスタムフィールドはトラッカーごとにRedmine側で表示/非表示が制御されているため、欄がない（`.cf_4589.attribute` が存在しない）トラッカーではボタン自体を表示しない
- 「to MaruCha」「for TR」ボタンクリック時、チケット情報の先頭にプロンプト（定型文）を付加して MaruCha に送信する（送信・回答待ち・書き戻しは行わない。人間が手動で送信・確認する）
  - 「to MaruCha」のプロンプトは設定ページの「Redmine」タブで変更可能（ストレージキー: `template`）
  - 「for TR」のプロンプトは設定ページの「Redmine for TR」タブで変更可能（ストレージキー: `redmineForTrTemplate`）
- 「AI回答更新」ボタンクリック時は、送信・回答待ち・Redmineへの書き戻しまで自動で完結する（詳細は「AI回答自動更新（送信・待機・書き戻し）」参照）
- ボタンクリックで以下の情報を Redmine API（`/issues/{id}.json?include=journals`）で取得する
  - チケット ID・件名・トラッカー・ステータス・優先度・担当者・作成者
  - 説明文
  - カスタムフィールド（値が空のものは除外）
  - コメント（journals のうち notes が空でないもの）
- Redmine API の認証キーは `ViewCustomize.context.user.apiKey` から取得する（MAIN World ブリッジ経由）

### Teams 側（送信）

- チャット画面のヘッダーツールバー（「今すぐ会議」ボタンの左隣）に「to MaruCha」ボタンを注入する
- ボタンクリックで設定した収集期間（デフォルト: 14日）のメッセージを収集する
- 各メッセージから送信者名・日時・本文を抽出し、以下の形式にフォーマットする

  ```
  [2026/03/01 10:30] 田中 太郎
  メッセージ本文

  [2026/03/01 10:35] 鈴木 花子
  メッセージ本文
  ```

- いいね！等のリアクション文字列は除外する

#### Teams 仮想スクロール対応

Teams は仮想スクロールのため、画面外のメッセージを DOM から削除する。以下のアルゴリズムで全メッセージを取りこぼさず収集する。

1. 現在のスクロール位置を保存
2. 最下部にスクロールして最新メッセージを DOM に載せる
3. 現在表示中のメッセージを `Map<isoDate, TeamsMessage>` に収集（isoDate をキーに重複排除）
4. 500px ずつ上方向にスクロールしながら各位置で収集を繰り返す
5. `cutoffDate` より古いメッセージが見えたら停止（または上端に達したら停止）
6. 収集したメッセージを isoDate でソートしてテキスト化
7. スクロール位置を元に戻す

#### Teams DOM セレクタ（実機確認済み）

| 対象 | セレクタ |
|------|---------|
| ボタン注入位置（最優先） | `[data-tid="audio-drop-in-now-button"]`（「今すぐ会議」ボタン）の直前 |
| ボタン注入位置（FB1） | `[data-tid="chat-calling-meeting-buttons"]` の先頭 |
| ボタン注入位置（FB2） | `[data-tid="entity-header-toolbar"]` の先頭 |
| スクロールコンテナ | `[data-tid="message-pane-list-viewport"]` |
| メッセージアイテム | `[data-tid="chat-pane-item"]` |
| 送信者名 | `[data-tid="message-author-name"]` |
| タイムスタンプ | `time[datetime]`（datetime 属性に ISO 8601 形式の日時） |
| 本文 | `[data-tid="chat-pane-message"]`（リアクション要素を除去して取得） |

#### Teams SPA ナビゲーション対応

Teams は SPA のため、チャット切り替え時にページリロードが発生しない。
`history.pushState` のラップと MutationObserver の組み合わせでナビゲーションを検出し、ボタンを再注入する。

### AI チャット側（受信・ボタン注入）

- Background Service Worker から `INSERT_TEXT` メッセージを受信する
- SPA のレンダリング完了まで最大 15 秒ポーリングし、入力欄（`textarea` または `contenteditable`）が現れるのを待つ
- React / Vue 等のフレームワーク対応のため `nativeInputValueSetter` 経由でテキストを挿入し、`input` / `change` イベントを発火する
- テキスト挿入後、カーソルを先頭に移動し、入力欄のスクロール位置も先頭（`scrollTop = 0`）にリセットする
- 送信ボタンはユーザーが手動で押す（拡張は自動送信しない）

### AI回答自動更新（送信・待機・書き戻し）

Redmineチケットページの「AI回答更新」ボタンをクリックすると、AIチャットへの送信・回答完了待ち・Redmineへの書き戻しまでを自動で行う。人間による送信前後の確認ゲートは設けない。`cf_4589`（AIまとめ）欄が無いトラッカーではボタンごと非表示になる。

- プロンプトは設定ページの「AI回答」タブで変更可能（ストレージキー: `aiAnswerTemplate`）。AIの回答テキストはそのままRedmineのカスタムフィールドに保存されるため、前置き・挨拶・Markdown装飾を避けた地の文で出力させる専用の定型文を用いる。
- **ステートレス・リレー方式**: `background.ts` は状態を持たず、`requestId`（`crypto.randomUUID()`）と送信元タブID（`redmineTabId`）をメッセージペイロードに載せて運ぶことで、Service Workerが休止・再起動しても処理を継続できる設計にしている。回答生成待ち（最大90秒）はタブに紐づいて生存する `aichat.content.ts` 側で行う。
- **自動送信・完了検知・回答抽出**: `aichat.content.ts` が `entrypoints/shared/aichatDom.ts` の関数を使い、テキスト挿入後にメッセージを送信し、回答完了を検知する。タイムアウト時は書き込みを行わない（誤って古い/中途半端な回答を書き込む方が害が大きいため）。
  - **送信**: `submitMessage()` がまず入力欄に対して**Ctrl+Enterのキー操作**（`keydown`/`keypress`/`keyup`）をシミュレートする（実サイトの入力欄プレースホルダーが「Ctrl + Enterキーを押して送信」と明記しており、devtools実機確認でもこちらが確実に動作した）。送信後500ms待って入力欄が空になっていれば成功とみなす。空にならない場合のみ、送信ボタン（`svg[data-testid="SendIcon"]` を持つ `button[type="submit"]`、テキストを挿入した入力欄と同じ`<form>`内を優先して検索）のクリックにフォールバックする。
    - devtools実機確認で判明した注意点: 送信ボタンを`click()`するだけでは、サイト側フレームワークの内部状態更新が追いつかず「クリックはされるが実際には送信されない」ケースがあったため、キーボードショートカットを優先する設計にした。
  - **完了検知**: `waitForAnswerComplete()` は監視開始時点のアンケート個数・回答コンテナ個数を**ベースライン**として記録し、そこから**増加した**ときのみ完了と判定する（存在有無ではなく差分で見る）。また監視開始から最低5秒（`minWaitMs`）は判定を確定させない。
    - 判定の根拠は二段構え。第一に「この回答は役に立ちましたか？」フィードバックアンケートの出現数の増加（devtools実機確認済み。ただし該当spanは `class="hidden ..."` を持ち、**生成完了前からCSSで非表示のままDOMに存在している場合がある**ため、存在有無だけで判定すると送信直後に誤検知する。ベースライン差分方式はこの誤検知対策）。第二にフォールバックとして、回答コンテナ数の増加 + `MutationObserver` + デバウンス（既定1800ms）でDOM変化が止まったことを検知する方式を残す。タイムアウト上限は既定90000ms。
    - 「停止」ボタン（生成中インジケーター）は未確認だが、上記の完了検知方式で代替できているため必須ではない。
  - **メッセージリスナーの設計**: `aichat.content.ts` の `onMessage` リスナーはあえて非同期関数にしない（fire-and-forget）。async関数にして`AUTO_ANSWER_START`の処理（最大90秒かかりうる）を`await`すると、ブラウザは「非同期で応答する」とみなしてメッセージチャンネルを開いたままにするが、その間にMV3のService Workerが休止・再起動すると「メッセージチャンネルが応答前に閉じられた」というエラーが発生する（実害はないが不要なエラーログが出る）。応答を必要としないメッセージなので、リスナー自体は同期的に`undefined`を返し、処理は内部で投げっぱなしにする。
- **書き戻し**: `background.ts` が `fetch` で直接 `PUT /issues/{id}.json` を実行する（別タブでのDOM操作は不要）。書き戻しには `wxt.config.ts` の `host_permissions`（`https://misol-dev.cloud.redmine.jp/*`）が必要（Service Workerからのクロスオリジンfetchのため、content script内fetchとは異なりCORSバイパスに`host_permissions`の明示宣言が必須）。
  - `cf_4588`（AI更新日時、テキスト型）: フォーマットは `YYYY-MM-DD HH:mm:ss`（`entrypoints/shared/dateFormat.ts` の `formatDateTimeJst` で生成、ブラウザのローカルタイム=JST前提）。
  - `cf_4589`（AI回答、長いテキスト型）: AIの回答テキストそのもの。
  - **`cf_4588`と`cf_4589`は同一PUTリクエストで同時に書き込む**（別リポジトリ `view-customize` 側の鮮度判定ロジックが `updated_on` と `cf_4588` を比較するため、別々に書くと直後に誤って「古い」と判定されてしまう。詳細は `docs/handoff-ai-answer-automation.md` 参照）。
- **書き戻し後のRedmineページ反映**: カスタムフィールドの表示はサーバーレンダリングのため、ページを再読み込みしないと画面には反映されない。回答生成の待機中（最大90秒）にユーザーが同じタブでコメント入力等の未保存作業をしている可能性があるため、**自動リロードはしない**。書き戻し成功時はボタンラベルが「更新完了（クリックで再読込）」になり、ユーザーが任意のタイミングでクリックすると `location.reload()` される（`pendingReload` フラグで制御）。
- **AIチャットタブの扱い**: 書き戻し成功時は自動でタブを閉じる。失敗・タイムアウト時はデバッグしやすくするためタブを残す。
- **ボタンのフィードバック**: alert()は使わず、ボタンラベルの変化（`取得中...` → `AI回答待ち...` → `更新完了`/`タイムアウト`/`エラー`）で結果を伝える。多重クリックはモジュールスコープの `inFlightRequestId` で防止する。
- **Playwrightバッチとの関係**: このボタンのクリック起点フロー自体が、鮮度切れチケットを一括処理するPlaywrightバッチ（別リポジトリ [redmaru-batch](https://github.com/kysayo/redmaru-batch)、本リポジトリ外）からも再利用されている。拡張機能側にPlaywright専用のコードパスは作らない。バッチ側の完了検知は本機能の `AUTO_ANSWER_STATUS` 通知に依存せず、Redmine REST APIのポーリングで行う設計。バッチ側の仕様・設計判断の詳細は `redmaru-batch` リポジトリの `docs/spec.md` を参照。

### AI チャット側（移送申請ボタン）

- MaruCha 画面の右下に「拡大縮小」「末尾へ移動」と並んで「移送申請」ボタン（`bottom: 192px`）を注入する
- ボタンクリック時、画面内の最後のチャット回答（`.segment-based-content` の末尾要素）を取得し、設定ページのマッピングに従って各項目を抽出する
- 抽出した項目と固定処理が必要な移送事由・移送概要を `OPEN_ISOU_FORM` メッセージで Background に送信する

### 移送申請フォーム側（自動入力）

- Background が移送申請URL を新規タブで開き、フォームデータを `chrome.storage.local` に保存する
- Content Script（Isolated World）がページロード時に storage からデータを取得し、**2フェーズ**で処理する

#### Phase 1 — 申請区分の選択と Postback

1. `chrome.storage.local` からデータを取得（phase = 1）
2. storage の phase を 2 に更新してから `redmaru:isou-postback` カスタムイベントを dispatch
3. MAIN World で動作するブリッジ（`isou-bridge.content.ts`）がイベントを受信し、`drpIsoType.value = '14'`（H.運用起点）を設定後に `__doPostBack('drpIsoType', '')` を呼び出す
4. ASP.NET の Postback によりページが再ロードされ、他の入力項目が有効になる

> **なぜ MAIN World ブリッジが必要か**
> Content Script は Isolated World で動作するため、ページが持つ `window.__doPostBack`（ASP.NET が注入するグローバル関数）に直接アクセスできない。`world: 'MAIN'` で動作するブリッジ経由でのみ呼び出せる。

#### Phase 2 — フォームへの自動入力

1. Postback 後の再ロードで Content Script が再実行される
2. storage から phase = 2 のデータを取得
3. 設定ページのマッピング（`isouFieldMapping`）を `chrome.storage.sync` から読み取り、各フィールドに値を設定する
4. 移送事由（`drpIsoJiyu`）・移送概要チェックボックスは固定ロジックで処理する
5. 処理完了後、`chrome.storage.local` から `isouFormData` を削除する

#### 移送申請フォーム 固定処理の理由

以下の項目は設定ページのマッピング対象外とし、コードに固定実装している。

| 項目 | 理由 |
|------|------|
| 申請区分（`drpIsoType`） | MAIN World ブリッジ経由の Postback 処理が必要なため、単純な値設定とは切り離して固定実装。H.運用起点（value="14"）に固定。 |
| 移送事由（`drpIsoJiyu`） | チャット出力のテキスト（例：「プログラムミス（開発時）」）を select の value（例：`06`）に変換するマッピングが必要で、ユーザーが編集する意味がないため固定。 |
| 移送概要（`chkIsoGaiyo*`） | チャット出力のカンマ区切りテキストから複数チェックボックスを選択するロジックが必要で、テキスト→チェックボックスID の対応表は仕様固定のため固定。 |

### Background Service Worker（仲介）

- Redmine / Teams の Content Script から `OPEN_AI_CHAT` メッセージを受信する
- メッセージの `source` フィールドに応じて適切な定型文を取得する

  | source | 使用するストレージキー |
  |--------|----------------------|
  | `'redmine'` | `template` |
  | `'teams'` | `teamsTemplate` |
  | `'redmine-tr'` | `redmineForTrTemplate` |

- 定型文とコンテンツを結合する（定型文 + 改行 2 つ + コンテンツ）
- AI チャットを新しいタブで開き、タブのロード完了後に `INSERT_TEXT` メッセージを送信する

### 設定ページ（Options Page）

タブ UI で Redmine / Teams / Redmine for TR の設定を切り替えられる。

#### Redmine タブ

- 定型文をテキストエリアで編集・保存できる
- ストレージキー: `template`

#### Teams タブ

- 定型文をテキストエリアで編集・保存できる
- 収集期間（日数）を数値入力で設定できる（デフォルト: 14日、範囲: 1〜365）
- ストレージキー: `teamsTemplate`, `teamsPeriodDays`

#### Redmine for TR タブ

- 「for TR」ボタン用の定型文をテキストエリアで編集・保存できる
- ストレージキー: `redmineForTrTemplate`

#### 移送申請フォーム タブ

- MaruCha の「移送申請」ボタンが転記する項目と転記先フォーム要素の対応を設定できる
- 各行を `チャット項目名:フォームID:フォームタイプ` 形式で記述する
  - フォームタイプは `input` または `textarea`（省略時は `input`）
  - 例: `案件名:txtAnkenName:input`
- 「デフォルトに戻す」ボタンでデフォルト値をテキストエリアに復元できる（保存は手動）
- ストレージキー: `isouFieldMapping`
- **対象外の固定処理項目**: 移送事由・移送概要・申請区分は設定ページから変更不可（理由は「移送申請フォーム 固定処理の理由」参照）

#### AI回答 タブ

- 「AI回答更新」ボタン用の定型文をテキストエリアで編集・保存できる
- ストレージキー: `aiAnswerTemplate`

#### デフォルト値を変更する場合

`entrypoints/shared/defaults.ts` の各定数を編集する。このファイルが `background.ts`・`options/App.vue`・各 Content Script からインポートされているため、1箇所の変更で反映される。

| 定数 | 用途 |
|------|------|
| `DEFAULT_REDMINE_TEMPLATE` | Redmine 定型文 |
| `DEFAULT_TEAMS_TEMPLATE` | Teams 定型文 |
| `DEFAULT_REDMINE_FOR_TR_TEMPLATE` | Redmine for TR 定型文 |
| `DEFAULT_ISOU_FIELD_MAPPING` | 移送申請フォームマッピング |
| `DEFAULT_AI_ANSWER_TEMPLATE` | AI回答自動更新 定型文 |

---

## アーキテクチャ

### コンポーネント構成

| ファイル | 種別 | 説明 |
|---------|------|------|
| `entrypoints/redmine.content.ts` | Content Script（Isolated World） | ボタン注入・チケット情報取得・メッセージ送信 |
| `entrypoints/redmine-bridge.content.ts` | Content Script（MAIN World） | ViewCustomize から API キーを取得し Isolated World に渡す |
| `entrypoints/teams.content.ts` | Content Script（Isolated World） | ボタン注入・メッセージ収集・仮想スクロール対応 |
| `entrypoints/aichat.content.ts` | Content Script（Isolated World） | AI チャット入力欄へのテキスト挿入 |
| `entrypoints/maruchat-focus.content.ts` | Content Script（Isolated World） | AI チャット画面のボタン注入（拡大縮小・末尾移動・移送申請）・チャット回答解析 |
| `entrypoints/isou.content.ts` | Content Script（Isolated World） | 移送申請フォームへの自動入力（Phase 1/2 制御） |
| `entrypoints/isou-bridge.content.ts` | Content Script（MAIN World） | `__doPostBack` 呼び出しを Isolated World から受け取り実行する |
| `entrypoints/background.ts` | Background Service Worker | メッセージ仲介・タブ管理・定型文結合 |
| `entrypoints/options/` | Options Page（Vue 3） | Redmine / Teams / Redmine for TR / 移送申請フォーム 設定 UI（タブ切り替え） |
| `entrypoints/shared/defaults.ts` | 共有モジュール | デフォルト定型文・デフォルトフォームマッピングの定義を1箇所で管理 |
| `entrypoints/shared/isouMapping.ts` | 共有モジュール | フォームマッピング設定文字列のパース関数（`parseIsouMapping`） |
| `entrypoints/shared/aichatDom.ts` | 共有モジュール | AIチャットの送信ボタンクリック・生成完了検知（`waitForAnswerComplete`）・回答抽出（`getLatestAnswerText`）のDOM操作ヘルパー |
| `entrypoints/shared/dateFormat.ts` | 共有モジュール | `cf_4588` 用の `YYYY-MM-DD HH:mm:ss` 形式日時文字列を生成する `formatDateTimeJst` |

### メッセージプロトコル

#### コンテンツスクリプト → background.ts

```typescript
interface OpenAiChatMessage {
  type: 'OPEN_AI_CHAT';
  payload: {
    content: string;                              // 送信するテキスト本文
    source: 'redmine' | 'teams' | 'redmine-tr';  // テンプレート選択に使用
  };
}

interface OpenIsouFormMessage {
  type: 'OPEN_ISOU_FORM';
  payload: {
    fields: Record<string, string>;  // formId → value（設定ページのマッピング由来）
    isoJiyu: string;                 // 移送事由テキスト（固定ロジックで select に変換）
    isoGaiyo: string;                // 移送概要テキスト（カンマ区切り、固定ロジックでチェックボックスに変換）
  };
}

interface AutoAnswerRequestMessage {
  type: 'AUTO_ANSWER_REQUEST';
  payload: {
    requestId: string;   // crypto.randomUUID()
    issueId: string;
    apiKey: string;
    content: string;     // getTicketInfo() の戻り値
  };
}
```

#### background.ts → aichat.content.ts

```typescript
interface InsertTextMessage {
  type: 'INSERT_TEXT';
  payload: { text: string };
}

interface AutoAnswerStartMessage {
  type: 'AUTO_ANSWER_START';
  payload: {
    requestId: string;
    text: string;         // aiAnswerTemplate + '\n\n' + content
    issueId: string;
    apiKey: string;
    redmineTabId: number; // ステートレス中継のため運ぶ
  };
}
```

#### aichat.content.ts → background.ts

```typescript
type AutoAnswerResultMessage = {
  type: 'AUTO_ANSWER_RESULT';
  payload:
    | { requestId: string; redmineTabId: number; issueId: string; apiKey: string; status: 'success'; answerText: string }
    | { requestId: string; redmineTabId: number; status: 'timeout' }
    | { requestId: string; redmineTabId: number; status: 'error'; message: string };
};
```

#### background.ts → redmine.content.ts

```typescript
interface AutoAnswerStatusMessage {
  type: 'AUTO_ANSWER_STATUS';
  payload:
    | { requestId: string; status: 'done' }
    | { requestId: string; status: 'timeout' }
    | { requestId: string; status: 'error'; message: string };
}
```

#### Isolated World → MAIN World（移送申請 Postback）

カスタムイベント `redmaru:isou-postback` を `document.dispatchEvent` で発火し、
`isou-bridge.content.ts`（MAIN World）が受信して `__doPostBack` を呼ぶ。

### メッセージフロー

```
[Redmineページ]
  └─ ボタンクリック
      ├─ redmine-bridge.content.ts（MAIN World）に APIキーを要求
      │    カスタムイベント: redmaru:request-apikey → redmaru:apikey
      │
      └─ background.ts へ OPEN_AI_CHAT 送信 (source: 'redmine')
           └─ template を取得して結合
               └─ AIチャット新規タブ → INSERT_TEXT 送信

[Teamsページ]
  └─ ボタンクリック
      ├─ teamsPeriodDays を storage から取得
      ├─ 最下部スクロール → 上方向へ逐次収集 → スクロール復元
      └─ background.ts へ OPEN_AI_CHAT 送信 (source: 'teams')
           └─ teamsTemplate を取得して結合
               └─ AIチャット新規タブ → INSERT_TEXT 送信

[Redmineページ]（AI回答自動更新）
  └─「AI回答更新」ボタンクリック
      ├─ APIキー取得・チケット情報取得（既存フローと同じ）
      └─ background.ts へ AUTO_ANSWER_REQUEST 送信 (requestId, issueId, apiKey, content)
           ├─ aiAnswerTemplate を取得して結合
           └─ AIチャット新規タブ → AUTO_ANSWER_START 送信 (text, issueId, apiKey, redmineTabId)
                ├─ insertTextToChat（既存関数を流用）
                ├─ 送信ボタンをクリック
                ├─ waitForAnswerComplete（MutationObserver + debounce + 90秒timeout）
                └─ background.ts へ AUTO_ANSWER_RESULT 送信
                     ├─ success: PUT /issues/{id}.json で cf_4588・cf_4589 を同時書き込み
                     │    ├─ 成功: AIチャットタブを閉じる → 元タブへ AUTO_ANSWER_STATUS(done)
                     │    └─ 失敗: タブを残す → 元タブへ AUTO_ANSWER_STATUS(error)
                     └─ timeout/error: タブを残す → 元タブへ AUTO_ANSWER_STATUS(timeout/error)
                          └─ redmine.content.ts がボタンラベルを更新（alertは使わない）
```

### ストレージ構造

**chrome.storage.sync**（設定ページから変更可能）

| キー | 型 | 説明 | デフォルト |
|------|-----|------|-----------|
| `template` | string | Redmine 定型文 | `shared/defaults.ts` 参照 |
| `teamsTemplate` | string | Teams 定型文 | `shared/defaults.ts` 参照 |
| `teamsPeriodDays` | number | Teams 収集期間（日数） | 14 |
| `redmineForTrTemplate` | string | Redmine for TR 定型文 | `shared/defaults.ts` 参照 |
| `isouFieldMapping` | string | 移送申請フォームマッピング（行形式） | `shared/defaults.ts` 参照 |
| `aiAnswerTemplate` | string | AI回答自動更新 定型文 | `shared/defaults.ts` 参照 |

**chrome.storage.local**（処理中の一時データ）

| キー | 型 | 説明 |
|------|-----|------|
| `isouFormData` | object | 移送申請フォームへの転記データ（phase フラグ付き）。Phase 2 完了後に削除される。 |

### ViewCustomize APIキー取得の仕組み（Redmine）

Content Script は Isolated World で動作するため `window.ViewCustomize` に直接アクセスできない。
MAIN World で動作する `redmine-bridge.content.ts` をブリッジとして使い、カスタムイベントで API キーを受け渡す。

| イベント名 | 方向 | 内容 |
|-----------|------|------|
| `redmaru:request-apikey` | Isolated World → MAIN World | API キーの要求 |
| `redmaru:apikey` | MAIN World → Isolated World | API キーの返答（CustomEvent.detail に格納） |

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | WXT 0.20.18 |
| 言語 | TypeScript |
| UI | Vue 3（Options Page のみ） |
| ストレージ | chrome.storage.sync |
| 対象ブラウザ | Chrome（Manifest V3） |

---

## ビルド成果物の配布（別PCでの利用）

ビルド成果物（`.output/chrome-mv3`）は `.gitignore` で除外されており、Git では共有しない。
別PCで利用する場合は以下のいずれかの方法を取る。

### 推奨：別PCでビルド
`git clone` → `npm install` → `npm run build` で `.output/chrome-mv3` を再生成する。

### 配布したい場合：GitHub Releases に zip を添付
ビルド専用PCで作成した成果物を、別PCでは読み込むだけにしたい運用向け。
Git 履歴を汚さずに成果物を配布できる。

1. zip を作成する（WXT 標準コマンド）
   ```powershell
   npm run zip
   ```
   `.output/` に `my-redmaru-app-<version>-chrome.zip` が生成される
   （ファイル名のバージョンは `package.json` の `version` に追従するため、
   配布前に `version` を更新しておくとよい）

2. GitHub Releases に添付する（いずれか）
   - **Web UI**: `https://github.com/kysayo/my-redmaru-app/releases/new` で
     新しいタグを作成し、zip をドラッグ&ドロップして Publish
   - **gh CLI**（要 `winget install --id GitHub.cli` + `gh auth login`）:
     ```powershell
     gh release create v0.1.0 ".output/my-redmaru-app-0.1.0-chrome.zip" --title "v0.1.0" --notes "ビルド成果物"
     ```

3. 別PCでは Release ページから zip をDL・展開し、Chrome の
   「パッケージ化されていない拡張機能を読み込む」で展開先フォルダを指定する

---

## 将来仕様

- 定型文の複数登録・切り替え機能

---

## 設計メモ：社内チャット中継による他画面自動入力の汎用性

### 背景

本拡張機能では「Redmine チケット情報 → MaruCha（社内 AI チャット）→ 移送申請フォーム」という流れで、AI チャットを中継して別システムの画面に自動入力する機能を実装した。
社内環境では会社が承認したチャットツール以外が使えない制約がある中で、AI チャットを中継することで情報の構造化・要約・転記を自動化できるという有効なパターンとなっている。

### 汎用化できる部分

同様のパターン（チャット回答 → 別画面への自動入力）を今後実装する場合に再利用できる要素は以下の通り。

| 要素 | 本実装での場所 | 再利用可能な内容 |
|------|--------------|----------------|
| チャット回答の抽出 | `maruchat-focus.content.ts` | `extractItem(text, key)` で `【項目名】` 形式のテキストを解析するロジック |
| フォームマッピング設定 | `shared/isouMapping.ts` / `defaults.ts` / `App.vue` | `チャット項目名:フォームID:フォームタイプ` の行形式設定と `parseIsouMapping()` 関数 |
| Background 経由のタブ開設 | `background.ts` | 対象 URL を新規タブで開き、`chrome.storage.local` でデータを渡すパターン |
| Isolated World ↔ MAIN World 通信 | `isou-bridge.content.ts` | カスタムイベントでページの JS 関数（`window.xxx`）を呼ぶブリッジパターン（`redmine-bridge.content.ts` と同一） |

### 画面ごとのカスタム処理が必要なケース

汎用化が難しい要素も多い。以下のようなケースでは画面固有の実装が別途必要になる。

- **ページロードが複数回発生する画面**（ASP.NET の Postback など）: Phase 1/2 に相当するフェーズ管理が必要
- **ドロップダウンの値変換**（テキスト → `<option>` の value）: 画面ごとに選択肢が異なるため固定マッピングが必要
- **チェックボックス群**（カンマ区切りテキスト → 複数チェック）: ID 体系が画面ごとに異なる
- **Isolated World から呼べない JS 関数**（`window.xxx`）: MAIN World ブリッジが別途必要
- **SPA・仮想スクロール対応**: Teams のように特殊な DOM 管理をする画面では個別対応が必要

### 今後の拡張を検討するときのポイント

1. 転記先の画面の URL と HTML 構造（input/textarea/select の id・name）を事前に確認する
2. ページロードが1回で完了するか、Postback 等が発生するかを確認する
3. `window` 上のグローバル関数を呼ぶ必要があるかを確認し、必要なら MAIN World ブリッジを追加する
4. チャット出力のプロンプトに `【項目名】` 形式で出力を指示し、`extractItem` で抽出できるようにする
