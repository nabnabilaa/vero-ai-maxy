'use client';

import { botT } from '../i18n-bot';

interface QuickChipsProps {
  chipContext: 'initial' | 'info' | 'complaint' | 'booking';
  setChipContext: (c: 'initial' | 'info' | 'complaint' | 'booking') => void;
  setInput: (v: string) => void;
  userLang: string;
  quickActions?: string;
}

export default function QuickChips({ chipContext, setChipContext, setInput, userLang, quickActions }: QuickChipsProps) {
  // Try agent-specific quick actions first
  if (chipContext === 'initial' && quickActions) {
    try {
      const parsed = JSON.parse(quickActions);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return (
          <div className="px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto bg-gray-50/80 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
            {parsed.map((c: any) => (
              <button key={c.label} onClick={() => setInput(c.action)} className="shrink-0 px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-[11px] sm:text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm active:scale-95">{c.label}</button>
            ))}
          </div>
        );
      }
    } catch { }
  }

  const chipSets: Record<string, { label: string; actionKey: string }[]> = {
    initial: [
      { label: botT(userLang, 'chipMap'), actionKey: 'chipMapAction' },
      { label: botT(userLang, 'chipFood'), actionKey: 'chipFoodAction' },
      { label: botT(userLang, 'chipPlaces'), actionKey: 'chipPlacesAction' },
      { label: botT(userLang, 'chipPrice'), actionKey: 'chipPriceAction' },
      { label: botT(userLang, 'chipFAQ'), actionKey: 'chipFAQAction' },
    ],
    info: [
      { label: botT(userLang, 'chipPricePromo'), actionKey: 'chipPricePromoAction' },
      { label: botT(userLang, 'chipBooking'), actionKey: 'chipBookingAction' },
      { label: botT(userLang, 'chipLocation'), actionKey: 'chipLocationAction' },
      { label: botT(userLang, 'chipMap'), actionKey: 'chipMapAction' },
      { label: botT(userLang, 'chipContactAdmin'), actionKey: 'chipContactAdminAction' },
    ],
    booking: [
      { label: botT(userLang, 'chipPayment'), actionKey: 'chipPaymentAction' },
      { label: botT(userLang, 'chipTerms'), actionKey: 'chipTermsAction' },
      { label: botT(userLang, 'chipContactAdmin'), actionKey: 'chipContactAdminBookAction' },
      { label: botT(userLang, 'chipLocation'), actionKey: 'chipLocationShortAction' },
      { label: botT(userLang, 'chipReview'), actionKey: 'chipReviewAction' },
    ],
    complaint: [
      { label: botT(userLang, 'chipComplaintForm'), actionKey: 'chipComplaintFormAction' },
      { label: botT(userLang, 'chipCallCS'), actionKey: 'chipCallCSAction' },
      { label: botT(userLang, 'chipOtherIssue'), actionKey: 'chipOtherIssueAction' },
      { label: botT(userLang, 'chipMainMenu'), actionKey: 'chipMainMenuAction' },
    ],
  };

  const chips = chipSets[chipContext] || chipSets.initial;

  return (
    <div className="px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto bg-gray-50/80 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
      {chips.map(c => (
        <button key={c.label} onClick={() => {
          setInput(botT(userLang, c.actionKey));
          if (c.actionKey === 'chipMainMenuAction') setChipContext('initial');
        }} className="shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm active:scale-95">{c.label}</button>
      ))}
    </div>
  );
}
