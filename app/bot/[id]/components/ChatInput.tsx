'use client';

import { useRef } from 'react';
import { Send, ImagePlus } from 'lucide-react';
import { botT } from '../i18n-bot';

interface ChatInputProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;

  userLang: string;
  colors: { gradient: string };
}

export default function ChatInput({ input, setInput, onSend, onImageUpload, isLoading, userLang, colors }: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-2.5 sm:p-3 bg-white border-t border-gray-100">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={onImageUpload} />
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
          title="Upload foto"
        >
          <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <input type="text" placeholder={botT(userLang, 'inputPlaceholder')} className="flex-1 rounded-full border border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSend()} disabled={isLoading} />
        <button id="vero-send-btn" className={`rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-white transition-all shadow-lg active:scale-95 ${isLoading || !input.trim() ? 'bg-gray-300' : `bg-gradient-to-r ${colors.gradient} hover:shadow-xl`}`}
          onClick={onSend} disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
