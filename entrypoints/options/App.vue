<script setup lang="ts">
import { ref, onMounted } from 'vue';

const DEFAULT_TEMPLATE =
  'このRedmineチケットを要約してください。後半は更新時のコメントです。コメントからも重要な推移があれば要約に含めてください。';

const template = ref('');
const saved = ref(false);

onMounted(async () => {
  const result = await browser.storage.sync.get({ template: DEFAULT_TEMPLATE });
  template.value = result.template;
});

async function save() {
  await browser.storage.sync.set({ template: template.value });
  saved.value = true;
  setTimeout(() => { saved.value = false; }, 2000);
}
</script>

<template>
  <h1>RedmaruApp 設定</h1>

  <section>
    <label for="template">定型文</label>
    <p style="font-size: 13px; color: #666; margin: 4px 0 8px;">
      AIチャットに送信する際にチケット情報の前に追加される文章です。
    </p>
    <textarea
      id="template"
      v-model="template"
      rows="6"
    />
    <button @click="save">保存</button>
    <p v-if="saved" class="saved-msg">保存しました</p>
  </section>
</template>
