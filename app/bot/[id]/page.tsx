'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { Bot, User, Loader2, MapPin, AlertTriangle, Search, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, AgentData } from './types';
import { industryColors, industryLabel, LANGUAGES, hasMap, extractQ, getLoadingText } from './constants';
import { botT } from './i18n-bot';
import { RichContent } from './components/ChatMessage';
import LanguageSwitcher from './components/LanguageSwitcher';
import RatingPopup from './components/RatingPopup';
import InteractiveMap from './components/InteractiveMap';
import ComplaintForm from './components/ComplaintForm';
import ChatInput from './components/ChatInput';
import QuickChips from './components/QuickChips';
import { useChat } from './hooks/useChat';

// Auto-detect browser language → map to our supported language names
function detectBrowserLang(): string {
  if (typeof navigator === 'undefined') return 'Indonesian';
  const bl = (navigator.language || '').toLowerCase();
  const map: Record<string, string> = {
    id: 'Indonesian', en: 'English', ko: 'Korean', ja: 'Japanese',
    zh: 'Mandarin', es: 'Spanish', ar: 'Arabic', fr: 'French',
    de: 'German', ru: 'Russian', pt: 'Portuguese',
  };
  for (const [code, name] of Object.entries(map)) {
    if (bl.startsWith(code)) return name;
  }
  return 'Indonesian';
}

export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [biz, setBiz] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [showComplaint, setShowComplaint] = useState(false);
  const [userLang, setUserLang] = useState<string>('Indonesian');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [chipContext, setChipContext] = useState<'initial' | 'info' | 'complaint' | 'booking'>('initial');
  const [loadingPhase, setLoadingPhase] = useState(0);
  const idleTimerRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const storageKey = `vero_chat_${id}`;

  // Chat hook
  const chat = useChat({ agentId: id, userLang, convId, setConvId, biz, setShowComplaint, setChipContext });

  // Fetch agent + restore history
  useEffect(() => {
    fetch(`/api/bot/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      setAgent(data.agent); setBiz(data.business);
      try {
        const s = localStorage.getItem(storageKey);
        if (s) {
          const p = JSON.parse(s);
          const lastTime = p.lastActivity ? new Date(p.lastActivity).getTime() : 0;
          if (Date.now() - lastTime < 3600000 && p.messages?.length > 0 && p.conversationId) {
            chat.setMessages(p.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            setConvId(p.conversationId); return;
          } else { localStorage.removeItem(storageKey); }
        }
      } catch { }
      // Auto-detect browser language or use agent default
      const detectedLang = detectBrowserLang();
      const agentLang = data.agent.language || 'Indonesian';
      const supportedLangs = LANGUAGES.map(l => l.name);
      const initialLang = supportedLangs.includes(detectedLang) ? detectedLang : agentLang;
      setUserLang(initialLang);

      chat.setMessages([{
        id: 'welcome', role: 'model',
        content: botT(initialLang, 'welcome', { name: data.agent.name, role: data.agent.role, business: data.business?.business_name || 'kami' }),
        timestamp: new Date(),
      }]);
    }).catch(() => setNotFound(true));
  }, [id]);

  // Save to localStorage
  useEffect(() => { if (chat.messages.length > 0 && agent) { try { localStorage.setItem(storageKey, JSON.stringify({ messages: chat.messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })), conversationId: convId, lastActivity: new Date().toISOString() })); } catch { } } }, [chat.messages, convId]);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.messages]);

  // Loading phases
  useEffect(() => {
    if (!chat.isLoading) { setLoadingPhase(0); return; }
    setLoadingPhase(1);
    const t1 = setTimeout(() => setLoadingPhase(2), 2000);
    const t2 = setTimeout(() => setLoadingPhase(3), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [chat.isLoading]);

  // Idle timer for rating popup
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (ratingSubmitted) return;
    idleTimerRef.current = setTimeout(() => { if (chat.messages.length > 3 && !ratingSubmitted) setShowRating(true); }, 180000);
  }, [chat.messages.length, ratingSubmitted]);
  useEffect(() => { resetIdleTimer(); return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }; }, [chat.messages, resetIdleTimer]);

  // Submit rating
  const submitRating = async () => {
    if (!ratingValue) return;
    try { await fetch('/api/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, conversationId: convId, rating: ratingValue }) }); } catch { }
    setRatingSubmitted(true); setShowRating(false);
  };

  const colors = industryColors[agent?.industry || 'General'] || industryColors.General;
  const isEn = userLang.toLowerCase() !== 'indonesian';
  const bizLabel = industryLabel[agent?.industry || 'General'] || '📍 Lokasi';

  if (notFound) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="text-center p-8"><Bot className="mx-auto h-16 w-16 text-gray-300 mb-4" /><h2 className="text-2xl font-bold">Agent Not Found</h2></div></div>;
  if (!agent) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-white shadow-2xl relative overflow-hidden lg:max-w-2xl xl:max-w-3xl lg:rounded-2xl lg:my-4 lg:h-[calc(100dvh-2rem)] lg:border lg:border-gray-200">
      {/* Header */}
      <div className={`flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-base sm:text-lg shrink-0">{agent.name.charAt(0)}</div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">{agent.name}</h1>
            <p className="text-[10px] sm:text-xs text-white/70 truncate">{agent.role} • {bizLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
          <LanguageSwitcher userLang={userLang} showLangMenu={showLangMenu} setShowLangMenu={setShowLangMenu}
            onLanguageChange={(langName, greeting, flag) => { setUserLang(langName); chat.addMessage({ id: Date.now().toString(), role: 'model', content: `${flag} ${greeting}`, timestamp: new Date() }); }} />
          <button onClick={() => setShowComplaint(true)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all" title="Keluhan"><AlertTriangle className="w-4 h-4" /></button>
          <button onClick={() => { chat.setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: botT(userLang, 'mapBtn'), timestamp: new Date() }, { id: (Date.now() + 1).toString(), role: 'model', content: botT(userLang, 'mapPrompt', { business: biz?.business_name || 'lokasi kami' }), timestamp: new Date(), showMap: true, mapQuery: 'nearby places' }]); }} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all" title="Peta"><MapPin className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Quick Chips */}
      <QuickChips chipContext={chipContext} setChipContext={setChipContext} setInput={chat.setInput} userLang={userLang} quickActions={agent.quick_actions} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50/50 to-white/30">
        {chat.messages.map(msg => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`flex gap-2 sm:gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : `bg-gradient-to-br ${colors.gradient} text-white`}`}>
              {msg.role === 'user' ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </div>
            <div className="max-w-[85%] sm:max-w-[82%] lg:max-w-[75%]">
              {msg.imageUrl && <div className="mb-2 rounded-xl overflow-hidden border border-gray-100 shadow-sm"><img src={msg.imageUrl} alt="Uploaded" className="max-w-full max-h-48 object-cover" /></div>}
              <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${msg.role === 'user' ? `bg-gradient-to-r ${colors.gradient} text-white rounded-tr-sm` : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'}`}>
                {msg.role === 'model' ? <RichContent content={msg.content} colors={colors} /> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                {msg.showWebsite && msg.websiteLink && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <a href={msg.websiteLink.startsWith('http') ? msg.websiteLink : `https://${msg.websiteLink}`} target="_blank" rel="noopener noreferrer" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
                      <Globe className="w-4 h-4" />{msg.websiteText}
                    </a>
                  </div>
                )}
                {msg.showWhatsApp && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <a href={`https://wa.me/${biz?.phone ? biz.phone.replace(/[^0-9]/g, '') : ''}`} target="_blank" rel="noopener noreferrer" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      {msg.whatsAppText}
                    </a>
                  </div>
                )}
              </div>
              {msg.showMap && msg.role === 'model' && <InteractiveMap query={msg.mapQuery || ''} agentIndustry={agent.industry} businessInfo={biz} isEn={isEn} />}
              {msg.suggestions && msg.suggestions.length > 0 && msg.role === 'model' && (
                <div className="mt-2.5 flex flex-col gap-1.5 px-0.5">
                  {msg.suggestions.map((s, idx) => (
                    <button key={idx} onClick={() => chat.handleSuggestionClick(s)} className="text-left flex items-start gap-2 px-3 py-2 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm transition-all active:scale-[0.98] group">
                      <div className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors"><Search className="w-2.5 h-2.5" /></div>
                      <span className="text-xs text-gray-700 font-medium group-hover:text-indigo-700 transition-colors leading-relaxed">{s}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className={`text-[10px] mt-1 px-1 ${msg.role === 'user' ? 'text-right' : ''} text-gray-400`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </motion.div>
        ))}
        {chat.isLoading && (
          <div className="flex gap-2 sm:gap-2.5">
            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br ${colors.gradient} text-white flex items-center justify-center shadow-sm`}><Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                </div>
                <motion.span key={loadingPhase} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-gray-400">
                  {getLoadingText(userLang, loadingPhase, agent.name)}
                </motion.span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Complaint Form */}
      <AnimatePresence>
        <ComplaintForm show={showComplaint} onClose={() => setShowComplaint(false)} onSubmit={(c) => { setShowComplaint(false); chat.submitComplaint(c); }} userLang={userLang} bizPhone={biz?.phone} />
      </AnimatePresence>

      {/* Rating Popup */}
      <RatingPopup show={showRating} submitted={ratingSubmitted} ratingValue={ratingValue} ratingHover={ratingHover}
        isEn={isEn} colors={colors} onClose={() => setShowRating(false)} onHover={setRatingHover} onRate={setRatingValue} onSubmit={submitRating} />

      {/* Input */}
      <ChatInput input={chat.input} setInput={chat.setInput} onSend={chat.sendMsg} onImageUpload={chat.handleImageUpload}
        isLoading={chat.isLoading} userLang={userLang} colors={colors} />
    </div>
  );
}
