import { parseIsouMapping } from './shared/isouMapping';
import { DEFAULT_ISOU_FIELD_MAPPING } from './shared/defaults';

export default defineContentScript({
  matches: ['https://isouext.marubeni.co.jp/*'],
  async main() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initIsouForm);
    } else {
      initIsouForm();
    }
  },
});

interface IsouFormData {
  fields: Record<string, string>;
  isoJiyu: string;
  isoGaiyo: string;
  phase: 1 | 2;
}

const ISO_JIYU_MAP: Record<string, string> = {
  '新規': '01',
  '条件変更（仕様変更）': '02',
  'プログラム改善': '03',
  '条件ミス（開発時）': '04',
  '条件ミス（メンテ時）': '05',
  'プログラムミス（開発時）': '06',
  'プログラムミス（メンテ時）': '07',
  'その他': '08',
};

const ISO_GAIYO_MAP: Record<string, string> = {
  'プログラム移送': 'chkIsoGaiyo1',
  'データの移送': 'chkIsoGaiyo2',
  'ジョブ変更': 'chkIsoGaiyo3',
  'システム設定変更': 'chkIsoGaiyo4',
  'その他': 'chkIsoGaiyoEtc',
};

async function initIsouForm() {
  const result = await browser.storage.local.get('isouFormData');
  const formData = result.isouFormData as IsouFormData | undefined;
  if (!formData) return;

  if (formData.phase === 1) {
    await runPhase1(formData);
  } else if (formData.phase === 2) {
    await runPhase2(formData);
  }
}

async function runPhase1(formData: IsouFormData) {
  await browser.storage.local.set({ isouFormData: { ...formData, phase: 2 } });
  document.dispatchEvent(new CustomEvent('redmaru:isou-postback'));
}

async function runPhase2(formData: IsouFormData) {
  const result = await browser.storage.sync.get({ isouFieldMapping: DEFAULT_ISOU_FIELD_MAPPING });
  const mappingText = typeof result.isouFieldMapping === 'string' ? result.isouFieldMapping : DEFAULT_ISOU_FIELD_MAPPING;
  const mapping = parseIsouMapping(mappingText);

  for (const { formId, formType } of mapping) {
    const value = formData.fields[formId];
    if (!value) continue;
    if (formType === 'textarea') {
      setTextareaValue(formId, value);
    } else {
      setInputValue(formId, value);
    }
  }

  setSelectValue('drpIsoJiyu', ISO_JIYU_MAP[formData.isoJiyu] ?? '');
  setCheckboxes(formData.isoGaiyo);

  await browser.storage.local.remove('isouFormData');
}

function setInputValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el && value) el.value = value;
}

function setTextareaValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  if (el && value) el.value = value;
}

function setSelectValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el && value) el.value = value;
}

function setCheckboxes(isoGaiyo: string) {
  if (!isoGaiyo) return;
  const items = isoGaiyo.split(',').map((s) => s.trim());
  for (const item of items) {
    const checkboxId = ISO_GAIYO_MAP[item];
    if (!checkboxId) continue;
    const cb = document.getElementById(checkboxId) as HTMLInputElement | null;
    if (cb) cb.checked = true;
  }
}
