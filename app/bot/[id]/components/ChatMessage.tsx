'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { IndustryColors } from '../types';

export function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const r = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)|(https?:\/\/[^\s\)<>,\"]+))/ig;
  let last = 0, m;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] && m[5]) {
      parts.push(m[5].includes('maps')
        ? <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition"><MapPin className="w-3 h-3" />{m[4]}</a>
        : <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">{m[4]}</a>
      );
    }
    else if (m[6]) {
      parts.push(m[6].includes('maps')
        ? <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition"><MapPin className="w-3 h-3" />Map Link</a>
        : <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">{m[6]}</a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

export function RichContent({ content, colors }: { content: string; colors: IndustryColors }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, li) => {
        const t = line.trim();
        if (!t) return <div key={li} className="h-1" />;
        const num = t.match(/^(\d+)\.\s+(.*)/);
        if (num) return (
          <div key={li} className="flex gap-2 items-start py-0.5">
            <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: colors.accent + '20', color: colors.accent }}>{num[1]}</span>
            <span className="text-sm leading-relaxed">{renderInline(num[2])}</span>
          </div>
        );
        if (t.startsWith('- ') || t.startsWith('• ')) return (
          <div key={li} className="flex gap-2 items-start py-0.5 pl-1">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: colors.accent }} />
            <span className="text-sm leading-relaxed">{renderInline(t.slice(2))}</span>
          </div>
        );
        return <p key={li} className="text-sm leading-relaxed">{renderInline(t)}</p>;
      })}
    </div>
  );
}
