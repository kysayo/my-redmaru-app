export interface IsouFieldMapping {
  chatKey: string;
  formId: string;
  formType: 'input' | 'textarea';
}

export function parseIsouMapping(text: string): IsouFieldMapping[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const parts = line.split(':');
      if (parts.length < 2) return [];
      const chatKey = parts[0].trim();
      const formId = parts[1].trim();
      const formType: 'input' | 'textarea' = parts[2]?.trim() === 'textarea' ? 'textarea' : 'input';
      if (!chatKey || !formId) return [];
      return [{ chatKey, formId, formType }];
    });
}
