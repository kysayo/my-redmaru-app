# RedmaruApp 仕様書

## 概要

Redmine のチケット情報を社内 AI チャット（MaruCha）に送信する Chrome 拡張機能。

## 対象 URL

| ロール | URL パターン |
|--------|-------------|
| Redmine（送信側） | `https://misol-dev.cloud.redmine.jp/issues/*` |
| AI チャット（受信側） | `https://www.marubeni-chatbot.com/*` |

---

## 機能

### Redmine 側（送信）

- チケットページに「Send To MaruCha」ボタンを注入する
- ボタンクリックで以下の情報を Redmine API（`/issues/{id}.json?include=journals`）で取得する
  - チケット ID・件名・トラッカー・ステータス・優先度・担当者・作成者
  - 説明文
  - カスタムフィールド（値が空のものは除外）
  - コメント（journals のうち notes が空でないもの）
- Redmine API の認証キーは `ViewCustomize.context.user.apiKey` から取得する

### AI チャット側（受信）

- Background Service Worker から `INSERT_TEXT` メッセージを受信する
- SPA のレンダリング完了まで最大 15 秒ポーリングし、入力欄（`textarea` または `contenteditable`）が現れるのを待つ
- React / Vue 等のフレームワーク対応のため `nativeInputValueSetter` 経由でテキストを挿入し、`input` / `change` イベントを発火する
- 送信ボタンはユーザーが手動で押す（拡張は自動送信しない）

### Background Service Worker（仲介）

- Redmine Content Script から `OPEN_AI_CHAT` メッセージを受信する
- `chrome.storage.sync` から定型文を取得し、チケット情報と結合する（定型文 + 改行 2 つ + チケット情報）
- AI チャットを新しいタブで開き、タブのロード完了後に `INSERT_TEXT` メッセージを送信する

### 設定ページ（Options Page）

- 定型文をテキストエリアで編集・保存できる
- `chrome.storage.sync` に保存される（Chrome アカウント同期が有効になる）
- デフォルトの定型文：
  > このRedmineチケットを要約してください。後半は更新時のコメントです。コメントからも重要な推移があれば要約に含めてください。

---

## アーキテクチャ

### コンポーネント構成

| ファイル | 種別 | 説明 |
|---------|------|------|
| `entrypoints/redmine.content.ts` | Content Script（Isolated World） | ボタン注入・チケット情報取得・メッセージ送信 |
| `entrypoints/redmine-bridge.content.ts` | Content Script（MAIN World） | ViewCustomize から API キーを取得し Isolated World に渡す |
| `entrypoints/aichat.content.ts` | Content Script（Isolated World） | AI チャット入力欄へのテキスト挿入 |
| `entrypoints/background.ts` | Background Service Worker | メッセージ仲介・タブ管理・定型文結合 |
| `entrypoints/options/` | Options Page（Vue 3） | 定型文設定 UI |

### メッセージフロー

```
[Redmineページ]
  └─ ボタンクリック
      ├─ redmine-bridge.content.ts（MAIN World）に APIキーを要求
      │    カスタムイベント: redmaru:request-apikey → redmaru:apikey
      │
      └─ background.ts へ OPEN_AI_CHAT メッセージ送信
           └─ AIチャットを新規タブで開く
               └─ タブのロード完了後 aichat.content.ts へ INSERT_TEXT 送信
                    └─ 入力欄にテキストを挿入
```

### ViewCustomize APIキー取得の仕組み

Content Script は Isolated World で動作するため `window.ViewCustomize` に直接アクセスできない。
そのため MAIN World で動作する `redmine-bridge.content.ts` をブリッジとして使い、カスタムイベントで API キーを受け渡す。

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
