import { useState, useCallback } from 'react';
import { Message } from '../types';
import { hasMap, extractQ } from '../constants';
import { botT } from '../i18n-bot';

interface UseChatProps {
  agentId: string;
  userLang: string;
  convId: string | null;
  setConvId: (id: string) => void;
  biz: any;
  setShowComplaint: (v: boolean) => void;
  setChipContext: (c: 'initial' | 'info' | 'complaint' | 'booking') => void;
}

export function useChat({ agentId, userLang, convId, setConvId, biz, setShowComplaint, setChipContext }: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = useCallback((msg: Message) => {
    setMessages(p => [...p, msg]);
  }, []);

  const updateChipContext = (text: string) => {
    const l = text.toLowerCase();
    if (/keluhan|kecewa|masalah|komplain|complaint/.test(l)) setChipContext('complaint');
    else if (/harga|pesan|booking|reservasi|order|beli/.test(l)) setChipContext('booking');
    else if (/info|layanan|fasilitas|menu|promo/.test(l)) setChipContext('info');
  };

  /** Build response message with proper flags for website/whatsapp/map */
  const buildResponseMsg = useCallback((userText: string, rt: string, data: { fromCache?: boolean; isComplaint?: boolean; suggestions?: string[] }): Message => {
    const wm = hasMap(userText);
    const shouldMap = wm || rt.includes('google.com/maps');
    const lowerRt = rt.toLowerCase();
    const isWebsite = lowerRt.includes('website') || lowerRt.includes('situs web') || lowerRt.includes('selengkapnya') || lowerRt.includes('kunjungi');
    const isCS = lowerRt.includes('customer service') || lowerRt.includes('admin') || lowerRt.includes('bantuan') || lowerRt.includes(' cs ') || lowerRt.includes('hubung') || lowerRt.includes('contact');

    let showWebsite = false, websiteLink = '', websiteText = '', showWhatsApp = false, whatsAppText = '';

    if (isCS && biz?.phone) {
      showWhatsApp = true; whatsAppText = botT(userLang, 'contactAdmin');
    } else if (isWebsite && biz?.website) {
      showWebsite = true; websiteLink = biz.website; websiteText = botT(userLang, 'visitWebsite');
    } else if ((isWebsite || isCS) && !biz?.website && biz?.phone) {
      showWhatsApp = true; whatsAppText = botT(userLang, 'contactAdmin');
    }

    return {
      id: (Date.now() + 1).toString(), role: 'model',
      content: data.fromCache ? `⚡ ${rt}` : rt, timestamp: new Date(),
      showMap: shouldMap, mapQuery: shouldMap ? (extractQ(userText) || extractQ(rt)) : '',
      showWhatsApp, whatsAppText, showWebsite, websiteLink, websiteText,
      suggestions: data.suggestions,
    };
  }, [biz, userLang]);

  /**
   * Read SSE stream from /api/chat and update message content incrementally.
   * Falls back to JSON parsing for cached/Gemini responses.
   */
  const streamResponse = useCallback(async (res: Response, userText: string, placeholderId: string) => {
    const contentType = res.headers.get('content-type') || '';

    // ── Non-streaming JSON response (cached / Gemini / error) ──
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.conversationId) setConvId(data.conversationId);
      const rt = data.response || botT(userLang, 'noResponse');

      // Replace placeholder with final message
      setMessages(p => p.map(m => m.id === placeholderId ? buildResponseMsg(userText, rt, data) : m));

      if (data.isComplaint) { setShowComplaint(true); setChipContext('complaint'); }
      return;
    }

    // ── SSE streaming response ──
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream');
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let finalData: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));

          if (event.type === 'meta' && event.conversationId) {
            setConvId(event.conversationId);
          }

          if (event.type === 'chunk' && event.content) {
            fullText += event.content;
            // Update placeholder message content incrementally
            const currentText = fullText;
            setMessages(p => p.map(m =>
              m.id === placeholderId
                ? { ...m, content: currentText }
                : m
            ));
          }

          if (event.type === 'done') {
            finalData = event;
          }

          if (event.type === 'error') {
            throw new Error(event.message || 'Stream error');
          }
        } catch (e: any) {
          if (e.message === 'Stream error' || e.message?.includes('error')) throw e;
          /* skip malformed JSON lines */
        }
      }
    }

    // Finalize: replace placeholder with proper message including metadata
    if (finalData) {
      const finalText = finalData.responseText || fullText;
      setMessages(p => p.map(m =>
        m.id === placeholderId
          ? buildResponseMsg(userText, finalText, {
              fromCache: false,
              isComplaint: finalData.isComplaint,
              suggestions: finalData.suggestions,
            })
          : m
      ));
      if (finalData.isComplaint) { setShowComplaint(true); setChipContext('complaint'); }
    }
  }, [userLang, buildResponseMsg, setConvId, setShowComplaint, setChipContext]);

  const sendMsg = useCallback(async () => {
    if (!input.trim()) return;
    const text = input; setInput('');
    const placeholderId = `streaming-${Date.now()}`;

    // Add user message + streaming placeholder
    setMessages(p => [
      ...p,
      { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() },
      { id: placeholderId, role: 'model', content: '', timestamp: new Date() },
    ]);
    setIsLoading(true);
    updateChipContext(text);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, message: text, conversationId: convId, sessionType: 'chat', userLang }) });
      await streamResponse(res, text, placeholderId);
    } catch (e: any) {
      setMessages(p => p.map(m =>
        m.id === placeholderId
          ? { ...m, content: botT(userLang, 'errorGeneric', { error: e.message }) }
          : m
      ));
    }
    finally { setIsLoading(false); }
  }, [input, agentId, convId, userLang, streamResponse]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const placeholderId = `streaming-img-${Date.now()}`;
      setMessages(p => [
        ...p,
        { id: Date.now().toString(), role: 'user', content: botT(userLang, 'photoLabel', { name: file.name }), timestamp: new Date(), imageUrl: dataUrl },
        { id: placeholderId, role: 'model', content: '', timestamp: new Date() },
      ]);
      setIsLoading(true);
      try {
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, message: botT(userLang, 'photoPrompt', { name: file.name }), imageBase64: dataUrl, conversationId: convId, sessionType: 'chat', userLang }) });
        await streamResponse(res, botT(userLang, 'photoPrompt', { name: file.name }), placeholderId);
      } catch (e: any) {
        setMessages(p => p.map(m =>
          m.id === placeholderId
            ? { ...m, content: botT(userLang, 'errorImage', { error: e.message }) }
            : m
        ));
      }
      finally { setIsLoading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [agentId, convId, userLang, streamResponse]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => { document.getElementById('vero-send-btn')?.click(); }, 50);
  }, []);

  const submitComplaint = useCallback(async (complaint: { name: string; phone: string; details: string; imageBase64: string }) => {
    try {
      let cId = convId;
      if (!cId) {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, message: `[Keluhan] ${complaint.details}`, sessionType: 'chat', userLang }) });
        const d = await r.json(); if (d.conversationId) { cId = d.conversationId; setConvId(cId!); }
      }
      const res = await fetch('/api/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: cId, agentId, userName: complaint.name, userPhone: complaint.phone, summary: 'Keluhan pelanggan via chatbot', details: complaint.details }) });
      if (!res.ok) throw new Error('Failed');
      const bn = biz?.business_name || 'kami', cs = biz?.phone;
      const csLine = cs ? botT(userLang, 'complaintCS', { phone: cs }) : '';
      const msg = botT(userLang, 'complaintMsg', { userName: complaint.name, business: bn, phone: complaint.phone, csLine });
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: msg, timestamp: new Date(), showWhatsApp: true, whatsAppText: 'Chat via WhatsApp' }]);
    } catch (e) {
      console.error(e);
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: botT(userLang, 'errorComplaint'), timestamp: new Date() }]);
    }
  }, [agentId, convId, biz, userLang, setConvId]);

  return {
    messages, setMessages, input, setInput, isLoading,
    addMessage, sendMsg, handleImageUpload, handleSuggestionClick, submitComplaint,
    buildResponseMsg,
  };
}
