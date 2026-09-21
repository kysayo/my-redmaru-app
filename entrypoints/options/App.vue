<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_REDMINE_TEMPLATE_EN, DEFAULT_REDMINE_TEMPLATE_LANGUAGE, DEFAULT_TEAMS_TEMPLATE, DEFAULT_REDMINE_FOR_TR_TEMPLATE, DEFAULT_ISOU_FIELD_MAPPING, DEFAULT_AI_ANSWER_TEMPLATE, DEFAULT_AI_ANSWER_CLOSED_TEMPLATE, DEFAULT_AUTO_ANSWER_FOCUS_TAB_ON_SUCCESS, DEFAULT_AI_ANSWER_TIMEOUT_SECONDS, DEFAULT_OPEN_AI_CHAT_TAB_IN_BACKGROUND, DEFAULT_EXCLUDED_CUSTOM_FIELDS, DEFAULT_BATCH_USE_AI_ANSWER_SETTINGS, DEFAULT_BATCH_WRITEBACK, DEFAULT_BATCH_TEMPLATE, type BatchWriteback } from '../shared/defaults';

type TabKey = 'redmine' | 'teams' | 'redmine-tr' | 'isou-tr' | 'ai-answer' | 'batch';

const activeTab = ref<TabKey>('redmine');

// Redmineタブの状態
const redmineTemplate = ref('');
const redmineTemplateEn = ref('');
const templateLanguage = ref<'ja' | 'en'>('ja');
const excludedCustomFields = ref('');
const redmineSaved = ref(false);

// Teamsタブの状態
const teamsTemplate = ref('');
const teamsPeriodDays = ref(14);
const teamsSaved = ref(false);

// Redmine for TRタブの状態
const redmineForTrTemplate = ref('');
const redmineForTrSaved = ref(false);

// 移送申請タブの状態
const isouFieldMapping = ref('');
const isouSaved = ref(false);

// AI回答タブの状態
const aiAnswerTemplate = ref('');
const aiAnswerClosedTemplate = ref('');
const autoAnswerFocusTabOnSuccess = ref(true);
const aiAnswerTimeoutSeconds = ref(90);
const openAiChatTabInBackground = ref(false);
const aiAnswerSaved = ref(false);

// バッチタブの状態
const batchUseAiAnswerSettings = ref(true);
const batchWriteback = ref<BatchWriteback>('translate-en');
const batchTemplate = ref('');
const batchSaved = ref(false);

onMounted(async () => {
  const result = await browser.storage.sync.get({
    template: DEFAULT_REDMINE_TEMPLATE,
    templateEn: DEFAULT_REDMINE_TEMPLATE_EN,
    templateLanguage: DEFAULT_REDMINE_TEMPLATE_LANGUAGE,
    excludedCustomFields: DEFAULT_EXCLUDED_CUSTOM_FIELDS,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
    redmineForTrTemplate: DEFAULT_REDMINE_FOR_TR_TEMPLATE,
    isouFieldMapping: DEFAULT_ISOU_FIELD_MAPPING,
    aiAnswerTemplate: DEFAULT_AI_ANSWER_TEMPLATE,
    aiAnswerClosedTemplate: DEFAULT_AI_ANSWER_CLOSED_TEMPLATE,
    autoAnswerFocusTabOnSuccess: DEFAULT_AUTO_ANSWER_FOCUS_TAB_ON_SUCCESS,
    aiAnswerTimeoutSeconds: DEFAULT_AI_ANSWER_TIMEOUT_SECONDS,
    openAiChatTabInBackground: DEFAULT_OPEN_AI_CHAT_TAB_IN_BACKGROUND,
    batchUseAiAnswerSettings: DEFAULT_BATCH_USE_AI_ANSWER_SETTINGS,
    batchWriteback: DEFAULT_BATCH_WRITEBACK,
    batchTemplate: DEFAULT_BATCH_TEMPLATE,
  });
  redmineTemplate.value = result.template as string;
  redmineTemplateEn.value = result.templateEn as string;
  templateLanguage.value = result.templateLanguage as 'ja' | 'en';
  excludedCustomFields.value = result.excludedCustomFields as string;
  teamsTemplate.value = result.teamsTemplate as string;
  teamsPeriodDays.value = result.teamsPeriodDays as number;
  redmineForTrTemplate.value = result.redmineForTrTemplate as string;
  isouFieldMapping.value = result.isouFieldMapping as string;
  aiAnswerTemplate.value = result.aiAnswerTemplate as string;
  aiAnswerClosedTemplate.value = result.aiAnswerClosedTemplate as string;
  autoAnswerFocusTabOnSuccess.value = result.autoAnswerFocusTabOnSuccess as boolean;
  openAiChatTabInBackground.value = result.openAiChatTabInBackground as boolean;
  aiAnswerTimeoutSeconds.value = result.aiAnswerTimeoutSeconds as number;
  batchUseAiAnswerSettings.value = result.batchUseAiAnswerSettings as boolean;
  batchWriteback.value = result.batchWriteback as BatchWriteback;
  batchTemplate.value = result.batchTemplate as string;
});

async function saveRedmine() {
  await browser.storage.sync.set({
    template: redmineTemplate.value,
    templateEn: redmineTemplateEn.value,
    templateLanguage: templateLanguage.value,
    excludedCustomFields: excludedCustomFields.value,
  });
  redmineSaved.value = true;
  setTimeout(() => { redmineSaved.value = false; }, 2000);
}

function resetExcludedCustomFields() {
  excludedCustomFields.value = DEFAULT_EXCLUDED_CUSTOM_FIELDS;
}

async function saveTeams() {
  await browser.storage.sync.set({
    teamsTemplate: teamsTemplate.value,
    teamsPeriodDays: teamsPeriodDays.value,
  });
  teamsSaved.value = true;
  setTimeout(() => { teamsSaved.value = false; }, 2000);
}

async function saveRedmineForTr() {
  await browser.storage.sync.set({ redmineForTrTemplate: redmineForTrTemplate.value });
  redmineForTrSaved.value = true;
  setTimeout(() => { redmineForTrSaved.value = false; }, 2000);
}

async function saveIsou() {
  await browser.storage.sync.set({ isouFieldMapping: isouFieldMapping.value });
  isouSaved.value = true;
  setTimeout(() => { isouSaved.value = false; }, 2000);
}

function resetIsouMapping() {
  isouFieldMapping.value = DEFAULT_ISOU_FIELD_MAPPING;
}

async function saveAiAnswer() {
  await browser.storage.sync.set({
    aiAnswerTemplate: aiAnswerTemplate.value,
    aiAnswerClosedTemplate: aiAnswerClosedTemplate.value,
    autoAnswerFocusTabOnSuccess: autoAnswerFocusTabOnSuccess.value,
    aiAnswerTimeoutSeconds: aiAnswerTimeoutSeconds.value,
    openAiChatTabInBackground: openAiChatTabInBackground.value,
  });
  aiAnswerSaved.value = true;
  setTimeout(() => { aiAnswerSaved.value = false; }, 2000);
}

function resetAiAnswerTemplate() {
  aiAnswerTemplate.value = DEFAULT_AI_ANSWER_TEMPLATE;
}

function resetAiAnswerClosedTemplate() {
  aiAnswerClosedTemplate.value = DEFAULT_AI_ANSWER_CLOSED_TEMPLATE;
}

async function saveBatch() {
  await browser.storage.sync.set({
    batchUseAiAnswerSettings: batchUseAiAnswerSettings.value,
    batchWriteback: batchWriteback.value,
    batchTemplate: batchTemplate.value,
  });
  batchSaved.value = true;
  setTimeout(() => { batchSaved.value = false; }, 2000);
}

function resetBatchTemplate() {
  batchTemplate.value = DEFAULT_BATCH_TEMPLATE;
}
</script>

<template>
  <h1>Send2MaruCha 設定 / Settings</h1>

  <nav class="tab-nav">
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'redmine' }"
      @click="activeTab = 'redmine'"
    >
      Redmine
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'teams' }"
      @click="activeTab = 'teams'"
    >
      Teams
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'redmine-tr' }"
      @click="activeTab = 'redmine-tr'"
    >
      Redmine for TR
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'isou-tr' }"
      @click="activeTab = 'isou-tr'"
    >
      移送申請フォーム
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'ai-answer' }"
      @click="activeTab = 'ai-answer'"
    >
      AI回答
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'batch' }"
      @click="activeTab = 'batch'"
    >
      バッチ
    </button>
  </nav>

  <section v-if="activeTab === 'redmine'">
    <label>使用する定型文 / Template to use</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      「to MaruCha」ボタンで実際に使う定型文を選びます。英語話者向けにAIへ英語で回答させたい場合はEnglishを選んでください。<br>
      Choose which template "to MaruCha" actually uses. Select English if you want the AI to reply in English for English-speaking users.
    </p>
    <div style="display: flex; gap: 16px; margin-bottom: 16px;">
      <label style="display: flex; align-items: center; gap: 6px; font-weight: normal;">
        <input type="radio" value="ja" v-model="templateLanguage">
        日本語 / Japanese
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-weight: normal;">
        <input type="radio" value="en" v-model="templateLanguage">
        English
      </label>
    </div>

    <label for="redmine-template">定型文（日本語）/ Template (Japanese)</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      AIチャットに送信する際にチケット情報の前に追加される文章です。<br>
      Text added before the ticket content when sending to AI chat.
    </p>
    <textarea
      id="redmine-template"
      v-model="redmineTemplate"
      rows="6"
    />

    <label for="redmine-template-en" style="margin-top: 16px;">定型文（English）/ Template (English)</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      上の言語選択でEnglishを選んだときに使われる定型文です。<br>
      Used when English is selected above.
    </p>
    <textarea
      id="redmine-template-en"
      v-model="redmineTemplateEn"
      rows="6"
    />

    <label for="excluded-custom-fields" style="margin-top: 16px;">
      除外するカスタムフィールド / Excluded custom fields
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      「to MaruCha」「for TR」「AI回答更新」いずれのボタンでも、AIチャットに送信するチケット情報からここに書いたカスタムフィールドを除外します。<br>
      1行に1つ、<code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">cf_4589</code> のような形式で記入してください。<br>
      AIまとめ欄（cf_4589等）を除外対象に含めておくと、AI自身が過去に書いた回答を再度読み込ませて要約させてしまう事故を防げます。<br>
      Custom fields listed here (one per line, e.g. <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">cf_4589</code>) are excluded from the ticket content sent to the AI chat, for all three buttons.
    </p>
    <textarea
      id="excluded-custom-fields"
      v-model="excludedCustomFields"
      rows="4"
      style="font-family: monospace;"
    />
    <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
      <button @click="saveRedmine">保存 / Save</button>
      <button @click="resetExcludedCustomFields" style="background: #757575;">デフォルトに戻す</button>
    </div>
    <p v-if="redmineSaved" class="saved-msg">保存しました / Saved</p>
  </section>

  <section v-if="activeTab === 'teams'">
    <label for="teams-template">定型文 / Template</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      AIチャットに送信する際にメッセージ履歴の前に追加される文章です。<br>
      Text added before the Teams messages when sending to AI chat.<br>
      <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">{日数}</code> と書くと、下の収集期間（日数）の設定値に自動的に置き換わります。
    </p>
    <textarea
      id="teams-template"
      v-model="teamsTemplate"
      rows="6"
    />

    <label for="teams-period" style="margin-top: 16px;">
      収集期間（日数）/ Collection period (days)
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      何日前までのメッセージを収集するか指定します（デフォルト: 14日）。<br>
      Specify how many days of messages to collect (default: 14 days).
    </p>
    <input
      id="teams-period"
      v-model.number="teamsPeriodDays"
      type="number"
      min="1"
      max="365"
      class="period-input"
    />

    <br>
    <button @click="saveTeams">保存 / Save</button>
    <p v-if="teamsSaved" class="saved-msg">保存しました / Saved</p>
  </section>

  <section v-if="activeTab === 'redmine-tr'">
    <label for="redmine-tr-template">定型文 / Template</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      「for TR」ボタンでAIチャットに送信する際にチケット情報の前に追加される文章です。<br>
      Text added before the ticket content when sending via the "for TR" button.
    </p>
    <textarea
      id="redmine-tr-template"
      v-model="redmineForTrTemplate"
      rows="10"
    />
    <button @click="saveRedmineForTr">保存 / Save</button>
    <p v-if="redmineForTrSaved" class="saved-msg">保存しました / Saved</p>
  </section>

  <section v-if="activeTab === 'isou-tr'">
    <label for="isou-mapping">フォーム項目マッピング</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      「移送申請」ボタンでチャット回答から移送申請フォームへ転記する項目を設定します。<br>
      各行を <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">チャット項目名:フォームID:フォームタイプ</code> の形式で記入してください。<br>
      フォームタイプは <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">input</code> または
      <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">textarea</code>（省略時は input）。<br>
      <strong>移送事由・移送概要・申請区分は専用ロジック</strong>のため、ここに記入しても反映されません。
    </p>
    <textarea
      id="isou-mapping"
      v-model="isouFieldMapping"
      rows="10"
      style="font-family: monospace;"
    />
    <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
      <button @click="saveIsou">保存 / Save</button>
      <button @click="resetIsouMapping" style="background: #757575;">デフォルトに戻す</button>
    </div>
    <p v-if="isouSaved" class="saved-msg">保存しました / Saved</p>
  </section>

  <section v-if="activeTab === 'ai-answer'">
    <p style="font-size: 13px; color: #666; margin: 4px 0 16px;">
      「AI回答更新」ボタンでAIチャットに送信する際にチケット情報の前に追加される文章です。<br>
      AIの回答テキストは「■■English■■」を区切りに日本語部分・英語部分に分割され、そのままRedmineのカスタムフィールド（cf_4589・cf_4720）に保存されるため、<br>
      前置き・挨拶・Markdown装飾を避けた地の文で出力させ、「■■English■■」区切りで日本語→英語の順に回答させる指示にしてください。<br>
      チケットのステータスが<strong>クローズ扱い</strong>（Redmineのステータス設定の「終了」フラグ）かどうかで、下の2つの定型文を自動的に使い分けます。<br>
      Text added before the ticket content when sending via the "AI回答更新" button. The AI's raw response is stored directly into a Redmine custom field.
    </p>

    <label for="ai-answer-template">定型文（オープン中のチケット）/ Template (open)</label>
    <textarea
      id="ai-answer-template"
      v-model="aiAnswerTemplate"
      rows="6"
    />
    <div style="margin-top: 4px;">
      <button @click="resetAiAnswerTemplate" style="background: #757575;">デフォルトに戻す</button>
    </div>

    <label for="ai-answer-closed-template" style="margin-top: 16px;">
      定型文（クローズ済みのチケット）/ Template (closed)
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      対応が完了している前提のまとめ方（段落構成の指定など）を指示できます。
    </p>
    <textarea
      id="ai-answer-closed-template"
      v-model="aiAnswerClosedTemplate"
      rows="10"
    />
    <div style="margin-top: 4px;">
      <button @click="resetAiAnswerClosedTemplate" style="background: #757575;">デフォルトに戻す</button>
    </div>

    <label style="margin-top: 16px; display: flex; align-items: center; gap: 6px;">
      <input type="checkbox" v-model="autoAnswerFocusTabOnSuccess">
      書き戻し成功時にRedmineタブを自動でアクティブにする / Focus the Redmine tab on success
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      バッチ実行中に別の作業を並行して行いたい場合は、このチェックを外すとRedmineタブが前面に出てこなくなります。<br>
      ボタンラベルの変化（取得中... → AI回答待ち... → 更新完了）はこの設定に関わらず更新されます。<br>
      チェックを外すとAIチャットタブを閉じる代わりに空白ページへ遷移させて残すようになります（タブを閉じる操作自体もウィンドウの前面化を招くことがあるため）。<br>
      Uncheck this if you run the batch and want to keep working in another tab/window; the button label still updates regardless of this setting. When unchecked, the AI chat tab is navigated to a blank page instead of being closed, since closing it can itself bring the window to the front.
    </p>

    <label for="ai-answer-timeout" style="margin-top: 16px;">
      回答待ちタイムアウト（秒）/ Answer wait timeout (seconds)
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      AIの回答生成が完了するまで待つ最大秒数です(デフォルト: 90秒)。この秒数を超えるとタイムアウト扱いになり、Redmineへの書き戻しは行われません。<br>
      Maximum seconds to wait for the AI to finish generating an answer (default: 90s). Exceeding this is treated as a timeout and nothing is written back to Redmine.
    </p>
    <input
      id="ai-answer-timeout"
      v-model.number="aiAnswerTimeoutSeconds"
      type="number"
      min="1"
      max="600"
      class="period-input"
    />

    <label style="margin-top: 16px; display: flex; align-items: center; gap: 6px;">
      <input type="checkbox" v-model="openAiChatTabInBackground">
      AIチャットタブをバックグラウンドで開く / Open the AI chat tab in the background
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      バッチ実行中に他のアプリを操作していても、AIチャットタブを開閉する処理でブラウザが前面に出てこないようにしたい場合にオンにしてください（既定はオフ、既存の動作のまま）。<br>
      Enable this if you don't want the browser window to steal focus when the AI chat tab is opened/closed while running the batch and working in another app (default: off, unchanged behavior).
    </p>

    <button @click="saveAiAnswer">保存 / Save</button>
    <p v-if="aiAnswerSaved" class="saved-msg">保存しました / Saved</p>
  </section>

  <section v-if="activeTab === 'batch'">
    <p style="font-size: 13px; color: #666; margin: 4px 0 16px;">
      <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">redmaru-batch</code>
      から複数チケットをまとめて処理するときの設定です。Redmineのチケット画面を開かずに処理するため、実行中もブラウザが前面に出てきません。<br>
      <strong>どのチケットを対象にするかはredmaru-batch側のコマンドで指定します</strong>（鮮度切れのみ／AI回答(英語)が空のもの、など）。ここではAIへの頼み方と書き戻し先だけを設定します。<br>
      Settings for batch runs driven by redmaru-batch. Which tickets are targeted is specified on the redmaru-batch side.
    </p>

    <label style="display: flex; align-items: center; gap: 6px;">
      <input type="checkbox" v-model="batchUseAiAnswerSettings">
      AIまとめと同じ設定を使う / Use the same settings as "AI回答"
    </label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      オンにすると「AI回答」タブの定型文をそのまま使い、単発の「AI回答更新」ボタンと同じ処理（日本語・英語のまとめを生成してcf_4588・cf_4589・cf_4720を同時更新）を行います。<br>
      通常運用はこちらです。オフにすると下の設定を使います。
    </p>

    <template v-if="!batchUseAiAnswerSettings">
      <label style="margin-top: 16px;">書き戻し先 / Write-back target</label>
      <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
        <code style="background:#f0f0f0; padding: 1px 4px; border-radius: 3px;">cf_4720のみ</code>
        は、AI回答(英語)が未設定のチケットに後から英訳だけを入れるための設定です。日本語まとめ（cf_4589）は書き換えません。<br>
        どちらを選んでもAI更新日時（cf_4588）は同時に更新されます（更新しないとチケットの更新日時だけが進んで「鮮度切れ」と誤判定されるため）。
      </p>
      <label style="display: flex; align-items: center; gap: 6px; font-weight: normal;">
        <input type="radio" value="translate-en" v-model="batchWriteback">
        cf_4720（AI回答(英語)）のみ更新する
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-weight: normal;">
        <input type="radio" value="full" v-model="batchWriteback">
        cf_4589・cf_4720 を「■■English■■」で分割して更新する（AIまとめと同じ書き戻し）
      </label>

      <label for="batch-template" style="margin-top: 16px;">定型文 / Template</label>
      <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
        「cf_4720のみ」を選んだ場合、AIにはチケット全文ではなく<strong>既存の日本語まとめ（cf_4589）だけ</strong>が渡されます。日本語版と内容がずれず、入力も短くて済むためです。<br>
        回答はそのままカスタムフィールドに保存されるので、前置き・挨拶・Markdown装飾を出力させない指示にしてください。
      </p>
      <textarea
        id="batch-template"
        v-model="batchTemplate"
        rows="8"
      />
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
        <button @click="saveBatch">保存 / Save</button>
        <button @click="resetBatchTemplate" style="background: #757575;">定型文をデフォルトに戻す</button>
      </div>
      <p v-if="batchSaved" class="saved-msg">保存しました / Saved</p>
    </template>

    <template v-else>
      <button @click="saveBatch" style="margin-top: 16px;">保存 / Save</button>
      <p v-if="batchSaved" class="saved-msg">保存しました / Saved</p>
    </template>
  </section>
</template>
