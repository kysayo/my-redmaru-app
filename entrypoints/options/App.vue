<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DEFAULT_REDMINE_TEMPLATE, DEFAULT_TEAMS_TEMPLATE } from '../shared/defaults';

type TabKey = 'redmine' | 'teams';

const activeTab = ref<TabKey>('redmine');

// Redmineタブの状態
const redmineTemplate = ref('');
const redmineSaved = ref(false);

// Teamsタブの状態
const teamsTemplate = ref('');
const teamsPeriodDays = ref(14);
const teamsSaved = ref(false);

onMounted(async () => {
  const result = await browser.storage.sync.get({
    template: DEFAULT_REDMINE_TEMPLATE,
    teamsTemplate: DEFAULT_TEAMS_TEMPLATE,
    teamsPeriodDays: 14,
  });
  redmineTemplate.value = result.template as string;
  teamsTemplate.value = result.teamsTemplate as string;
  teamsPeriodDays.value = result.teamsPeriodDays as number;
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
</template>
