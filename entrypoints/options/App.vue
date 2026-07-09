<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_TEAMS_TEMPLATE, DEFAULT_REDMINE_FOR_TR_TEMPLATE, DEFAULT_ISOU_FIELD_MAPPING, DEFAULT_AI_ANSWER_TEMPLATE } from '../shared/defaults';

type TabKey = 'redmine' | 'teams' | 'redmine-tr' | 'isou-tr' | 'ai-answer';

const activeTab = ref<TabKey>('redmine');

// Redmineタブの状態
const redmineTemplate = ref('');
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
const aiAnswerSaved = ref(false);

onMounted(async () => {
  const result = await browser.storage.sync.get({
    template: DEFAULT_REDMINE_TEMPLATE,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
    redmineForTrTemplate: DEFAULT_REDMINE_FOR_TR_TEMPLATE,
    isouFieldMapping: DEFAULT_ISOU_FIELD_MAPPING,
    aiAnswerTemplate: DEFAULT_AI_ANSWER_TEMPLATE,
  });
  redmineTemplate.value = result.template as string;
  teamsTemplate.value = result.teamsTemplate as string;
  teamsPeriodDays.value = result.teamsPeriodDays as number;
  redmineForTrTemplate.value = result.redmineForTrTemplate as string;
  isouFieldMapping.value = result.isouFieldMapping as string;
  aiAnswerTemplate.value = result.aiAnswerTemplate as string;
});

async function saveRedmine() {
  await browser.storage.sync.set({ template: redmineTemplate.value });
  redmineSaved.value = true;
  setTimeout(() => { redmineSaved.value = false; }, 2000);
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
  await browser.storage.sync.set({ aiAnswerTemplate: aiAnswerTemplate.value });
  aiAnswerSaved.value = true;
  setTimeout(() => { aiAnswerSaved.value = false; }, 2000);
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
  </nav>

  <section v-if="activeTab === 'redmine'">
    <label for="redmine-template">定型文 / Template</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      AIチャットに送信する際にチケット情報の前に追加される文章です。<br>
      Text added before the ticket content when sending to AI chat.
    </p>
    <textarea
      id="redmine-template"
      v-model="redmineTemplate"
      rows="6"
    />
    <button @click="saveRedmine">保存 / Save</button>
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
    <label for="ai-answer-template">定型文 / Template</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      「AI回答更新」ボタンでAIチャットに送信する際にチケット情報の前に追加される文章です。<br>
      AIの回答テキストはそのままRedmineのカスタムフィールド（cf_4589）に保存されるため、<br>
      前置き・挨拶・Markdown装飾を避けた地の文で出力させる指示にしてください。<br>
      Text added before the ticket content when sending via the "AI回答更新" button. The AI's raw response is stored directly into a Redmine custom field.
    </p>
    <textarea
      id="ai-answer-template"
      v-model="aiAnswerTemplate"
      rows="6"
    />
    <button @click="saveAiAnswer">保存 / Save</button>
    <p v-if="aiAnswerSaved" class="saved-msg">保存しました / Saved</p>
  </section>
</template>
