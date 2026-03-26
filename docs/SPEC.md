# Send2MaruCha 仕様書

## 概要

Redmine のチケット情報、および Microsoft Teams のチャット履歴を社内 AI チャット（MaruCha）に送信する Chrome 拡張機能。

## 対象 URL

| ロール | URL パターン |
|--------|-------------|
| Redmine（送信側） | `https://misol-dev.cloud.redmine.jp/issues/*` |
| Teams（送信側） | `https://teams.microsoft.com/*` |
| AI チャット（受信側） | `https://www.marubeni-chatbot.com/*` |

---

## 機能

### Redmine 側（送信）

- チケットページに「to MaruCha」ボタンを注入する
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

### AI チャット側（受信）

- Background Service Worker から `INSERT_TEXT` メッセージを受信する
- SPA のレンダリング完了まで最大 15 秒ポーリングし、入力欄（`textarea` または `contenteditable`）が現れるのを待つ
- React / Vue 等のフレームワーク対応のため `nativeInputValueSetter` 経由でテキストを挿入し、`input` / `change` イベントを発火する
- テキスト挿入後、カーソルを先頭に移動し、入力欄のスクロール位置も先頭（`scrollTop = 0`）にリセットする
- 送信ボタンはユーザーが手動で押す（拡張は自動送信しない）

### Background Service Worker（仲介）

- Redmine / Teams の Content Script から `OPEN_AI_CHAT` メッセージを受信する
- メッセージの `source` フィールドに応じて適切な定型文を取得する

  | source | 使用するストレージキー |
  |--------|----------------------|
  | `'redmine'` | `template` |
  | `'teams'` | `teamsTemplate` |

- 定型文とコンテンツを結合する（定型文 + 改行 2 つ + コンテンツ）
- AI チャットを新しいタブで開き、タブのロード完了後に `INSERT_TEXT` メッセージを送信する

### 設定ページ（Options Page）

タブ UI で Redmine / Teams の設定を切り替えられる。

#### Redmine タブ

- 定型文をテキストエリアで編集・保存できる
- ストレージキー: `template`

#### Teams タブ

- 定型文をテキストエリアで編集・保存できる
- 収集期間（日数）を数値入力で設定できる（デフォルト: 14日、範囲: 1〜365）
- ストレージキー: `teamsTemplate`, `teamsPeriodDays`

#### デフォルト定型文を変更する場合

`entrypoints/shared/defaults.ts` の `DEFAULT_REDMINE_TEMPLATE` / `DEFAULT_TEAMS_TEMPLATE` を編集する。このファイルが `background.ts` と `options/App.vue` の両方からインポートされているため、1箇所の変更で反映される。

---

## アーキテクチャ

### コンポーネント構成

| ファイル | 種別 | 説明 |
|---------|------|------|
| `entrypoints/redmine.content.ts` | Content Script（Isolated World） | ボタン注入・チケット情報取得・メッセージ送信 |
| `entrypoints/redmine-bridge.content.ts` | Content Script（MAIN World） | ViewCustomize から API キーを取得し Isolated World に渡す |
| `entrypoints/teams.content.ts` | Content Script（Isolated World） | ボタン注入・メッセージ収集・仮想スクロール対応 |
| `entrypoints/aichat.content.ts` | Content Script（Isolated World） | AI チャット入力欄へのテキスト挿入 |
| `entrypoints/background.ts` | Background Service Worker | メッセージ仲介・タブ管理・定型文結合 |
| `entrypoints/options/` | Options Page（Vue 3） | Redmine / Teams 設定 UI（タブ切り替え） |
| `entrypoints/shared/defaults.ts` | 共有モジュール | デフォルト定型文の定義（1箇所で管理） |

### メッセージプロトコル

#### コンテンツスクリプト → background.ts

```typescript
interface OpenAiChatMessage {
  type: 'OPEN_AI_CHAT';
  payload: {
    content: string;               // 送信するテキスト本文
    source: 'redmine' | 'teams';  // テンプレート選択に使用
  };
}
```

#### background.ts → aichat.content.ts

```typescript
interface InsertTextMessage {
  type: 'INSERT_TEXT';
  payload: { text: string };
}
```

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
```

### ストレージ構造

| キー | 型 | 説明 | デフォルト |
|------|-----|------|-----------|
| `template` | string | Redmine 定型文 | （コード内参照） |
| `teamsTemplate` | string | Teams 定型文 | （コード内参照） |
| `teamsPeriodDays` | number | Teams 収集期間（日数） | 14 |

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

## 将来仕様

- 定型文の複数登録・切り替え機能
