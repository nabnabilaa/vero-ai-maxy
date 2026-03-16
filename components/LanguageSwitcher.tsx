'use client';

import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';

export function LanguageSwitcher() {
  const { language, setLanguage } = useStore();
  const { t } = useTranslation(); // if needed down the line, although not strictly needed for just 'ID'/'EN' text

  return (
    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
      <button
        onClick={() => setLanguage('id')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
          language === 'id' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        ID
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
          language === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
    </div>
  );
}
