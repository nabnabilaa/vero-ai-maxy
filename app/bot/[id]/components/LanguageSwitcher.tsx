'use client';

import { motion, AnimatePresence } from 'motion/react';
import { LANGUAGES } from '../constants';

interface LanguageSwitcherProps {
  userLang: string;
  showLangMenu: boolean;
  setShowLangMenu: (show: boolean) => void;
  onLanguageChange: (langName: string, greeting: string, flag: string) => void;
}

export default function LanguageSwitcher({ userLang, showLangMenu, setShowLangMenu, onLanguageChange }: LanguageSwitcherProps) {
  return (
    <div className="relative">
      <button
        onClick={() => setShowLangMenu(!showLangMenu)}
        className="h-8 sm:h-9 px-2 sm:px-3 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all text-xs sm:text-sm font-medium mr-1"
        title="Ganti Bahasa / Change Language"
      >
        {LANGUAGES.find(l => l.name === userLang)?.flag || '🌐'}
        <span className="ml-1.5">{LANGUAGES.find(l => l.name === userLang)?.label || 'ID'}</span>
      </button>
      <AnimatePresence>
        {showLangMenu && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowLangMenu(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[110] overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.name}
                    onClick={() => {
                      onLanguageChange(lang.name, lang.greeting, lang.flag);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${userLang === lang.name ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className="text-lg">{lang.flag}</span> {lang.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
