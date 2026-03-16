import { useStore } from '@/lib/store';
import en from '@/locales/en.json';
import id from '@/locales/id.json';

const dictionaries = {
  en,
  id,
};

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<typeof id>;

export function useTranslation() {
  const language = useStore((state) => state.language) || 'id';

  const t = (key: TranslationKey | string, variables?: Record<string, string | number>) => {
    const keys = key.split('.');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = dictionaries[language];

    // Traverse the JSON object safely
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Fallback to raw path if not found
      }
    }

    if (typeof value === 'string') {
      if (variables) {
        let text = value;
        for (const [varKey, varVal] of Object.entries(variables)) {
          text = text.replace(new RegExp(`{${varKey}}`, 'g'), String(varVal));
        }
        return text;
      }
      return value;
    }

    return key;
  };

  return { t, language };
}
