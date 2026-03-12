'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { Send, Bot, User, Loader2, Phone, PhoneOff, MapPin, AlertTriangle, Mic, MicOff, X, Search, Shield, MapPinned, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Message = {
  id: string; role: 'user' | 'model'; content: string; timestamp: Date;
  showMap?: boolean; mapQuery?: string; isVoice?: boolean;
};
type AgentData = { id: string; name: string; role: string; tone: string; language: string; instructions: string; goal: string; industry: string; voice_type?: string; };
type PlaceResult = { name: string; lat: number; lon: number; type: string; address?: string; };

const industryColors: Record<string, { primary: string; gradient: string; bg: string; accent: string }> = {
  Hotel: { primary: '#0056D2', gradient: 'from-blue-600 to-indigo-700', bg: 'bg-blue-50', accent: '#6366F1' },
  Retail: { primary: '#059669', gradient: 'from-emerald-600 to-teal-700', bg: 'bg-emerald-50', accent: '#10B981' },
  Restaurant: { primary: '#EA580C', gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-50', accent: '#F59E0B' },
  'Real Estate': { primary: '#7C3AED', gradient: 'from-violet-600 to-purple-700', bg: 'bg-violet-50', accent: '#8B5CF6' },
  General: { primary: '#0056D2', gradient: 'from-slate-700 to-slate-900', bg: 'bg-slate-50', accent: '#64748B' },
};
const industryLabel: Record<string, string> = { Hotel: '🏨 Hotel', Retail: '🛒 Toko', Restaurant: '🍽️ Restoran', 'Real Estate': '🏠 Properti', General: '📍 Lokasi' };
const mapKw = ['map', 'maps', 'peta', 'lokasi', 'tempat sekitar', 'arah', 'jalan', 'dimana', 'terdekat', 'wisata', 'viral', 'kuliner', 'destinasi', 'tempat makan'];
const facilityKw = ['fasilitas', 'kamar', 'kolam renang', 'wifi', 'sarapan', 'parkir', 'gym', 'spa', 'restoran hotel', 'harga kamar', 'check in', 'check out'];
function hasMap(t: string) {
  const l = t.toLowerCase();
  // If asking about facilities, don't show map even if "di mana" or "lokasi" is mentioned
  if (facilityKw.some(k => l.includes(k))) return false;
  return mapKw.some(k => l.includes(k));
}
function extractQ(t: string) { const l = t.toLowerCase(); const m = l.match(/(?:cari|search|temukan|find)\s+(.+)/i); if (m) return m[1]; return l.replace(/map[s]?|peta|dong|tolong|bisa|kasih|lihat|tampilkan|munculkan|saya|mau/g, '').trim() || 'nearby places'; }

// ── Rich Markdown Renderer ──
function RichContent({ content, colors }: { content: string; colors: any }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, li) => {
        const t = line.trim();
        if (!t) return <div key={li} className="h-1" />;
        const num = t.match(/^(\d+)\.\s+(.*)/);
        if (num) return (<div key={li} className="flex gap-2 items-start py-0.5"><span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: colors.accent + '20', color: colors.accent }}>{num[1]}</span><span className="text-sm leading-relaxed">{renderInline(num[2])}</span></div>);
        if (t.startsWith('- ') || t.startsWith('• ')) return (<div key={li} className="flex gap-2 items-start py-0.5 pl-1"><span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: colors.accent }} /><span className="text-sm leading-relaxed">{renderInline(t.slice(2))}</span></div>);
        return <p key={li} className="text-sm leading-relaxed">{renderInline(t)}</p>;
      })}
    </div>
  );
}
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []; const r = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g; let last = 0, m;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] && m[5]) { parts.push(m[5].includes('maps') ? <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition"><MapPin className="w-3 h-3" />{m[4]}</a> : <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">{m[4]}</a>); }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

// ── Interactive Map ──
function InteractiveMap({ query, agentIndustry, businessInfo }: { query: string; agentIndustry: string; businessInfo: any }) {
  const mapRef = useRef<HTMLDivElement>(null), mapInst = useRef<any>(null), markersRef = useRef<any[]>([]);
  const bizMarkerRef = useRef<any>(null); const userMarkerRef = useRef<any>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]); const [loading, setLoading] = useState(true); const [si, setSi] = useState('');
  let dc: [number, number] = [-5.4295, 105.2618]; let hasBiz = false;
  if (businessInfo?.maps_link?.includes('@')) { const m = businessInfo.maps_link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/); if (m) { dc = [parseFloat(m[1]), parseFloat(m[2])]; hasBiz = true; } }
  const [center, setCenter] = useState<[number, number]>(dc);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) { const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
    const load = () => new Promise<void>(r => { if ((window as any).L) { r(); return; } const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => r(); document.head.appendChild(s); });
    load().then(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => { const c: [number, number] = [p.coords.latitude, p.coords.longitude]; setUserLoc(c); if (!hasBiz) setCenter(c); initMap(hasBiz ? dc : c, c); search(query || 'nearby places', hasBiz ? dc : c); },
          () => { initMap(dc, null); search(query || 'nearby places', dc); }, { enableHighAccuracy: true, timeout: 5000 });
      } else { initMap(dc, null); search(query || 'nearby places', dc); }
    });
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; bizMarkerRef.current = null; userMarkerRef.current = null; } };
  }, []);

  const initMap = (c: [number, number], uc: [number, number] | null) => {
    if (!mapRef.current || mapInst.current) return; const L = (window as any).L; if (!L) return;
    const map = L.map(mapRef.current, { center: c, zoom: 14, zoomControl: false }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map); L.control.zoom({ position: 'bottomright' }).addTo(map);
    const bounds = L.latLngBounds();
    if (hasBiz) { bizMarkerRef.current = L.marker(dc, { icon: L.divIcon({ html: `<div style="background:linear-gradient(135deg,#EF4444,#DC2626);width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:15px">🏢</div>`, className: '', iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000 }).addTo(map).bindPopup(`<div style="text-align:center;min-width:140px"><b>${businessInfo?.business_name || agentIndustry}</b><br><span style="font-size:11px;color:#666">${industryLabel[agentIndustry] || '📍'}</span><br><span style="font-size:10px;color:#999">${businessInfo?.address || ''}, ${businessInfo?.city || ''}</span></div>`); bounds.extend(dc); }
    if (uc) { userMarkerRef.current = L.marker(uc, { icon: L.divIcon({ html: `<div style="background:linear-gradient(135deg,#3B82F6,#2563EB);width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:13px">📱</div>`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 900 }).addTo(map).bindPopup(`<b>Lokasi Anda</b>`); bounds.extend(uc); }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); mapInst.current = map; setLoading(false);
  };

  const search = async (q: string, sc: [number, number]) => {
    setLoading(true); try {
      const s = 0.045, vb = `${sc[1] - s},${sc[0] + s},${sc[1] + s},${sc[0] - s}`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1&viewbox=${vb}&bounded=1`, { headers: { 'User-Agent': 'VeroAI/1.0' } });
      const d = await res.json(); let r: PlaceResult[] = [];
      if (d.length > 0) { r = d.map((i: any) => ({ name: i.display_name?.split(',')[0] || '?', lat: parseFloat(i.lat), lon: parseFloat(i.lon), type: i.type || 'place', address: i.display_name })); }
      else {
        const oq = `[out:json][timeout:10];(node["amenity"~"restaurant|cafe|hotel|hospital|pharmacy|bank|atm|mosque|church"](around:2000,${sc[0]},${sc[1]}););out body 10;`;
        const or = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: `data=${encodeURIComponent(oq)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        try {
          const od = await or.json();
          if (od.elements?.length) r = od.elements.map((e: any) => ({ name: e.tags?.name || e.tags?.amenity || '?', lat: e.lat, lon: e.lon, type: e.tags?.amenity || 'place', address: `${e.tags?.['addr:street'] || ''} ${e.tags?.['addr:city'] || ''}`.trim() }));
        } catch { /* Overpass might return XML error on overload */ }
      }
      setPlaces(r); addM(r);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const addM = (ps: PlaceResult[]) => {
    const L = (window as any).L, map = mapInst.current; if (!L || !map) return;
    markersRef.current.forEach(m => map.removeLayer(m)); markersRef.current = [];
    const bounds = L.latLngBounds(); if (hasBiz) bounds.extend(dc); if (userLoc) bounds.extend(userLoc);
    const em: Record<string, string> = { restaurant: '🍽️', cafe: '☕', hotel: '🏨', hospital: '🏥', pharmacy: '💊', bank: '🏦', atm: '💳', mosque: '🕌', church: '⛪' };
    ps.forEach((p) => { const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ html: `<div style="background:linear-gradient(135deg,#10B981,#059669);width:28px;height:28px;border-radius:8px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:14px">${em[p.type] || '📍'}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map).bindPopup(`<strong>${p.name}</strong><br><span style="font-size:11px;color:#666">${p.type}</span>`); markersRef.current.push(mk); bounds.extend(mk.getLatLng()); });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  };

  const doSearch = () => { if (si.trim()) { search(si.trim(), hasBiz ? dc : (userLoc || center)); setSi(''); } };
  const em: Record<string, string> = { restaurant: '🍽️', cafe: '☕', hotel: '🏨', hospital: '🏥', pharmacy: '💊', bank: '🏦', atm: '💳', mosque: '🕌', church: '⛪' };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg my-2">
      <div className="flex items-center gap-2 p-2.5 bg-white border-b border-gray-100">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"><Search className="w-3.5 h-3.5 text-gray-400" /><input type="text" placeholder="Cari cafe, restoran dekat hotel..." value={si} onChange={e => setSi(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} className="bg-transparent text-xs w-full focus:outline-none text-gray-700" /></div>
        <button onClick={doSearch} className="px-3 py-2 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 font-semibold">Cari</button>
      </div>
      <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 text-[10px] text-gray-600 border-b border-gray-100 font-medium overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => { if (hasBiz && mapInst.current) { mapInst.current.setView(dc, 16); setTimeout(() => bizMarkerRef.current?.openPopup(), 300); } }} className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center shrink-0">🏢 {businessInfo?.business_name || agentIndustry}</button>
        <button onClick={() => { if (userLoc && mapInst.current) { mapInst.current.setView(userLoc, 16); setTimeout(() => userMarkerRef.current?.openPopup(), 300); } }} className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center shrink-0">📱 Lokasi Anda</button>
        <span className="flex items-center shrink-0">📍 Pencarian</span>
      </div>
      <div className="relative"><div ref={mapRef} style={{ height: '260px', width: '100%' }} />{loading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-500" /><span className="text-sm text-gray-500 ml-2">Memuat...</span></div>}</div>
      {places.length > 0 && (<div className="p-2 bg-white space-y-1 max-h-[180px] overflow-y-auto">{places.slice(0, 6).map((p, i) => (<div key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-indigo-50 cursor-pointer border border-transparent hover:border-indigo-100 transition-colors" onClick={() => { mapInst.current?.setView([p.lat, p.lon], 16); markersRef.current[i]?.openPopup(); }}><div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-base shrink-0">{em[p.type] || '📍'}</div><div className="overflow-hidden flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p><p className="text-[10px] text-gray-400 truncate">{p.type}</p></div></div>))}</div>)}
    </div>
  );
}

// ── Permission Prompt ──
function PermissionPrompt({ onGranted }: { onGranted: () => void }) {
  const [loc, setLoc] = useState<'idle' | 'ok' | 'no'>('idle'); const [mic, setMic] = useState<'idle' | 'ok' | 'no'>('idle');
  const done = loc !== 'idle' && mic !== 'idle';
  useEffect(() => { if (done) { const t = setTimeout(onGranted, 800); return () => clearTimeout(t); } }, [done, onGranted]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6"><div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-3"><Shield className="w-8 h-8 text-indigo-600" /></div><h2 className="text-lg font-bold text-gray-900">Izin Diperlukan</h2><p className="text-sm text-gray-500 mt-1">Agar peta & panggilan berjalan optimal</p></div>
        <div className="space-y-3">
          <button onClick={() => navigator.geolocation.getCurrentPosition(() => setLoc('ok'), () => setLoc('no'), { enableHighAccuracy: true, timeout: 5000 })} disabled={loc !== 'idle'} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${loc === 'ok' ? 'border-green-300 bg-green-50' : loc === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <MapPinned className={`w-5 h-5 ${loc === 'ok' ? 'text-green-600' : loc === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} /><div className="text-left flex-1"><p className="text-sm font-semibold text-gray-800">Lokasi (GPS)</p><p className="text-xs text-gray-500">Posisi Anda di peta</p></div>{loc === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}{loc === 'no' && <span className="text-amber-600 text-xs font-semibold">Ditolak</span>}
          </button>
          <button onClick={async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setMic('ok'); } catch { setMic('no'); } }} disabled={mic !== 'idle'} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${mic === 'ok' ? 'border-green-300 bg-green-50' : mic === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <Mic className={`w-5 h-5 ${mic === 'ok' ? 'text-green-600' : mic === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} /><div className="text-left flex-1"><p className="text-sm font-semibold text-gray-800">Mikrofon</p><p className="text-xs text-gray-500">Fitur panggilan suara</p></div>{mic === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}{mic === 'no' && <span className="text-amber-600 text-xs font-semibold">Ditolak</span>}
          </button>
        </div>
        {done && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center"><p className="text-sm text-green-600 font-medium">Siap digunakan! ✨</p></motion.div>}
      </div>
    </motion.div>
  );
}

// ── Main Bot Page ──
export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [biz, setBiz] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaint, setComplaint] = useState({ name: '', phone: '', details: '' });
  const [showPerms, setShowPerms] = useState(false);

  // Voice — inline in chat (no overlay)
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [callTime, setCallTime] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const callRef = useRef(false);
  const speakRef = useRef(false);
  const timerRef = useRef<any>(null);

  const storageKey = `vero_chat_${id}`;

  // ── Fetch agent + restore history (auto-clear after 1hr inactive) ──
  useEffect(() => {
    fetch(`/api/bot/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      setAgent(data.agent); setBiz(data.business);
      try {
        const s = localStorage.getItem(storageKey);
        if (s) {
          const p = JSON.parse(s);
          const lastTime = p.lastActivity ? new Date(p.lastActivity).getTime() : 0;
          const oneHour = 60 * 60 * 1000;
          if (Date.now() - lastTime < oneHour && p.messages?.length > 0 && p.conversationId) {
            setMessages(p.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            setConvId(p.conversationId); return;
          } else { localStorage.removeItem(storageKey); }
        }
      } catch { }
      setMessages([{ id: 'welcome', role: 'model', content: `Halo! 👋 Saya **${data.agent.name}**, ${data.agent.role} dari **${data.business?.business_name || 'kami'}**.\n\nAda yang bisa saya bantu? Tanyakan tentang layanan, tempat menarik di sekitar, atau gunakan peta interaktif! 🗺️`, timestamp: new Date() }]);
      if (typeof navigator !== 'undefined') { (async () => { try { const l = await navigator.permissions.query({ name: 'geolocation' }); const m = await navigator.permissions.query({ name: 'microphone' as PermissionName }); if (l.state !== 'granted' || m.state !== 'granted') setShowPerms(true); } catch { setShowPerms(true); } })(); }
    }).catch(() => setNotFound(true));
  }, [id]);

  // Save to localStorage with lastActivity
  useEffect(() => { if (messages.length > 0 && agent) { try { localStorage.setItem(storageKey, JSON.stringify({ messages: messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })), conversationId: convId, lastActivity: new Date().toISOString() })); } catch { } } }, [messages, convId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (callActive) { setCallTime(0); timerRef.current = setInterval(() => setCallTime(d => d + 1), 1000); } else { if (timerRef.current) clearInterval(timerRef.current); } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [callActive]);

  // ── Text chat ──
  const sendMsg = async () => {
    if (!input.trim() || !agent) return;
    const text = input; setInput('');
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }]);
    setIsLoading(true);
    const wm = hasMap(text), mq = wm ? extractQ(text) : '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, message: text, conversationId: convId, sessionType: 'chat' }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Gagal');
      if (data.conversationId) setConvId(data.conversationId);
      const rt = data.response || 'Maaf, tidak ada respons.';
      const shouldMap = wm || rt.includes('google.com/maps');
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'model', content: rt, timestamp: new Date(), showMap: shouldMap, mapQuery: shouldMap ? (mq || extractQ(rt)) : '' }]);
      if (data.isComplaint) setShowComplaint(true);
    } catch (e: any) { setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: `Maaf, terjadi kesalahan: ${e.message}`, timestamp: new Date() }]); }
    finally { setIsLoading(false); }
  };

  // ── Voice (inline) ──
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) { window.speechSynthesis.cancel(); }
    speakRef.current = false; setSpeaking(false);
  }, []);

  const endCall = useCallback(() => {
    callRef.current = false; setCallActive(false); setSpeaking(false); setListening(false); setConnecting(false);
    stopSpeaking();
    if (recRef.current) { try { recRef.current.abort(); } catch { } recRef.current = null; }
    setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: '📞 Panggilan diakhiri. Terima kasih telah menghubungi kami!', timestamp: new Date() }]);
  }, [stopSpeaking]);

  const selectVoice = (synth: SpeechSynthesis, vt: string) => {
    const voices = synth.getVoices(), isF = vt === 'female';
    const lv = voices.filter(v => v.lang.startsWith('id'));
    if (lv.length > 0) { const g = lv.filter(v => isF ? /female|wanita|zira|damayanti|siti/i.test(v.name) : /male|pria|david|adam/i.test(v.name)); return g[0] || lv[0]; }
    return voices[0] || null;
  };

  const speak = (text: string, onDone?: () => void) => {
    if (!('speechSynthesis' in window)) { onDone?.(); return; }
    const synth = window.speechSynthesis; synth.cancel();
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/#{1,3}\s*/g, '');
    const u = new SpeechSynthesisUtterance(clean); u.lang = 'id-ID'; u.rate = 1.05;
    const v = selectVoice(synth, agent?.voice_type || 'female'); if (v) u.voice = v;
    speakRef.current = true; setSpeaking(true); setListening(false);
    u.onend = () => { speakRef.current = false; setSpeaking(false); onDone?.(); };
    u.onerror = () => { speakRef.current = false; setSpeaking(false); onDone?.(); };
    synth.speak(u);
  };

  const startListen = () => { if (!callRef.current || !recRef.current) return; setListening(true); try { recRef.current.start(); } catch { } };

  const onSpeech = async (tr: string) => {
    if (!tr.trim() || !callRef.current) return;
    // Show user's voice message in chat
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: tr, timestamp: new Date(), isVoice: true }]);
    const wm = hasMap(tr);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, message: tr, conversationId: convId, sessionType: 'voice' }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      if (data.conversationId) setConvId(data.conversationId);
      const rt = data.response || 'Maaf, terjadi kesalahan.';
      const shouldMap = wm || rt.includes('google.com/maps');
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'model', content: rt, timestamp: new Date(), showMap: shouldMap, mapQuery: shouldMap ? (extractQ(tr) || extractQ(rt)) : '', isVoice: true }]);
      if (data.isComplaint) setShowComplaint(true);
      speak(rt, () => { if (callRef.current) startListen(); });
    } catch { speak('Maaf terjadi kesalahan.', () => { if (callRef.current) startListen(); }); }
  };

  const startCall = async () => {
    if (!agent) return; setConnecting(true);
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Browser tidak mendukung. Gunakan Chrome.'); setConnecting(false); return; }
    if (window.speechSynthesis) { window.speechSynthesis.getVoices(); await new Promise(r => setTimeout(r, 300)); }
    try {
      const rec = new SR(); rec.lang = 'id-ID'; rec.continuous = false; rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e: any) => { setListening(false); onSpeech(e.results[e.resultIndex][0].transcript); };
      rec.onerror = (e: any) => { if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn(e.error); };
      rec.onend = () => { setTimeout(() => { if (callRef.current && !speakRef.current) { try { recRef.current?.start(); } catch { } } }, 300); };
      recRef.current = rec; callRef.current = true; setCallActive(true); setConnecting(false);
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: `📞 Panggilan dimulai dengan **${agent.name}**. Silakan bicara — saya mendengarkan!\n\n*Klik tombol 🔇 untuk menghentikan suara AI kapan saja.*`, timestamp: new Date() }]);
      speak(`Halo, saya ${agent.name} dari ${biz?.business_name || 'kami'}. Ada yang bisa saya bantu?`, () => { if (callRef.current) startListen(); });
    } catch { endCall(); }
  };

  useEffect(() => () => { callRef.current = false; if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); if (recRef.current) { try { recRef.current.abort(); } catch { } } }, []);

  const submitComplaint = async () => {
    try {
      let cId = convId;
      if (!cId) { const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, message: `[Keluhan] ${complaint.details}`, sessionType: 'chat' }) }); const d = await r.json(); if (d.conversationId) { cId = d.conversationId; setConvId(cId); } }
      const res = await fetch('/api/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: cId, agentId: id, userName: complaint.name, userPhone: complaint.phone, summary: 'Keluhan pelanggan via chatbot', details: complaint.details }) });
      if (!res.ok) throw new Error('Gagal');
      setShowComplaint(false);
      const bn = biz?.business_name || 'kami', cs = biz?.phone;
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: `Terima kasih banyak **${complaint.name}** atas masukan Anda 🙏\n\nKami sangat menyesal atas ketidaknyamanan yang Anda alami. Keluhan Anda sudah **tercatat dalam sistem kami** dan akan segera ditinjau oleh tim admin **${bn}**.\n\nBerikut yang akan kami lakukan:\n1. **Tim admin akan mereview** keluhan Anda dalam waktu dekat\n2. **Kami akan menghubungi Anda** di nomor **${complaint.phone}** untuk tindak lanjut\n3. **Perbaikan akan segera dilakukan** berdasarkan masukan Anda\n\n${cs ? `📞 Jika Anda membutuhkan bantuan **segera**, silakan hubungi Customer Service kami di **${cs}** — tim kami siap membantu Anda 24 jam.\n\n` : ''}Kepuasan Anda adalah prioritas utama kami. Terima kasih telah membantu kami menjadi lebih baik! ❤️`, timestamp: new Date() }]);
      setComplaint({ name: '', phone: '', details: '' });
    } catch (e) { console.error(e); setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: 'Maaf, gagal mengirim keluhan. Coba lagi.', timestamp: new Date() }]); }
  };

  const colors = industryColors[agent?.industry || 'General'] || industryColors.General;
  const bizLabel = industryLabel[agent?.industry || 'General'] || '📍 Lokasi';
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (notFound) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="text-center p-8"><Bot className="mx-auto h-16 w-16 text-gray-300 mb-4" /><h2 className="text-2xl font-bold">Agent Not Found</h2></div></div>;
  if (!agent) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-white shadow-2xl relative overflow-hidden lg:max-w-2xl xl:max-w-3xl lg:rounded-2xl lg:my-4 lg:h-[calc(100dvh-2rem)] lg:border lg:border-gray-200">
      <AnimatePresence>{showPerms && <PermissionPrompt onGranted={() => setShowPerms(false)} />}</AnimatePresence>

      {/* Header */}
      <div className={`flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-base sm:text-lg shrink-0">{agent.name.charAt(0)}</div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">{agent.name}</h1>
            <p className="text-[10px] sm:text-xs text-white/70 truncate">{agent.role} • {bizLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button onClick={() => setShowComplaint(true)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all" title="Keluhan"><AlertTriangle className="w-4 h-4" /></button>
          <button onClick={() => { setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: '📍 Peta sekitar', timestamp: new Date() }, { id: (Date.now() + 1).toString(), role: 'model', content: `Berikut peta di sekitar **${biz?.business_name || 'lokasi kami'}**! 🗺️\n\nCari tempat viral, cafe, restoran via kolom pencarian!`, timestamp: new Date(), showMap: true, mapQuery: 'nearby places' }]); }} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all" title="Peta"><MapPin className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          <button onClick={callActive ? endCall : startCall} disabled={connecting}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${connecting ? 'bg-white/20' : callActive ? 'bg-red-500 hover:bg-red-600 shadow-lg' : 'bg-white/20 hover:bg-white/30'}`}>
            {connecting ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : callActive ? <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Phone className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {/* Inline Call Banner */}
      <AnimatePresence>
        {callActive && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`bg-gradient-to-r ${colors.gradient} text-white overflow-hidden`}>
            <div className="flex items-center justify-between px-3 sm:px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium">
                  {speaking ? `${agent.name} sedang bicara...` : listening ? 'Mendengarkan Anda...' : 'Memproses...'}
                </span>
                <span className="text-[10px] text-white/60 ml-1 font-mono">{fmt(callTime)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Stop speaking button — always accessible */}
                {speaking && (
                  <button onClick={stopSpeaking} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all" title="Hentikan bicara AI">
                    <VolumeX className="w-3.5 h-3.5" />
                  </button>
                )}
                {speaking && (
                  <div className="flex gap-0.5 ml-1">
                    {[...Array(4)].map((_, i) => <motion.div key={i} animate={{ scaleY: [1, 2.5, 1] }} transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.08 }} className="w-0.5 h-3 bg-white/50 rounded-full" />)}
                  </div>
                )}
                {listening && <Mic className="w-3.5 h-3.5 animate-pulse text-green-300" />}
                <button onClick={endCall} className="ml-1 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-all" title="Akhiri"><PhoneOff className="w-3 h-3" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Chips */}
      <div className="px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto bg-gray-50/80 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
        {[
          { label: '🗺️ Peta Sekitar', action: 'Boleh lihat peta dan tempat menarik di sekitar sini?' },
          { label: '🍽️ Makanan Viral', action: 'Apa saja rekomendasi makanan viral atau kuliner terdekat dari sini?' },
          { label: '⭐ Tempat Viral', action: 'Tolong rekomendasikan tempat wisata atau destinasi menarik di sekitar sini dong' },
          { label: '📞 Admin', action: 'Saya ingin berbicara dengan admin' },
          { label: '💬 Keluhan', action: 'Saya ingin menyampaikan keluhan' },
          { label: '❓ FAQ', action: 'Apa saja layanan atau pertanyaan yang sering ditanyakan?' },
        ].map(c => (<button key={c.label} onClick={() => setInput(c.action)} className="shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm active:scale-95">{c.label}</button>))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50/50 to-white/30">
        {messages.map(msg => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`flex gap-2 sm:gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : `bg-gradient-to-br ${colors.gradient} text-white`}`}>
              {msg.role === 'user' ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </div>
            <div className="max-w-[85%] sm:max-w-[82%] lg:max-w-[75%]">
              <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${msg.role === 'user' ? `bg-gradient-to-r ${colors.gradient} text-white rounded-tr-sm` : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'}`}>
                {msg.isVoice && <div className="flex items-center gap-1 mb-1"><Mic className="w-3 h-3 opacity-50" /><span className="text-[10px] opacity-50">Voice</span></div>}
                {msg.role === 'model' ? <RichContent content={msg.content} colors={colors} /> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
              </div>
              {msg.showMap && msg.role === 'model' && <InteractiveMap query={msg.mapQuery || ''} agentIndustry={agent.industry} businessInfo={biz} />}
              <p className={`text-[10px] mt-1 px-1 ${msg.role === 'user' ? 'text-right' : ''} text-gray-400`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </motion.div>
        ))}
        {isLoading && (<div className="flex gap-2 sm:gap-2.5"><div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br ${colors.gradient} text-white flex items-center justify-center shadow-sm`}><Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></div><div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1.5"><motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-2 h-2 bg-gray-400 rounded-full" /><motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 bg-gray-400 rounded-full" /><motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 bg-gray-400 rounded-full" /></div></div></div>)}
        <div ref={endRef} />
      </div>

      {/* Complaint Form Modal */}
      <AnimatePresence>
        {showComplaint && (
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setShowComplaint(false)} />

            {/* Modal Body */}
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="relative w-full sm:w-[450px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 sm:mb-10 pointer-events-auto">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full sm:hidden" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div><div><h3 className="font-semibold text-gray-900 text-sm">Formulir Keluhan</h3><p className="text-[10px] text-gray-400">Akan diperiksa admin</p></div></div>
                <button onClick={() => setShowComplaint(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
              </div>
              {biz?.phone && <div className="mb-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs text-blue-700">📞 Butuh segera? Hubungi CS: <strong>{biz.phone}</strong></p></div>}
              <div className="space-y-2.5">
                <input type="text" placeholder="Nama Anda" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.name} onChange={e => setComplaint({ ...complaint, name: e.target.value })} />
                <input type="tel" placeholder="Nomor HP" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.phone} onChange={e => setComplaint({ ...complaint, phone: e.target.value })} />
                <textarea placeholder="Jelaskan keluhan..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm h-20 resize-none focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.details} onChange={e => setComplaint({ ...complaint, details: e.target.value })} />
                <button onClick={submitComplaint} disabled={!complaint.name || !complaint.phone} className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-md">Kirim Keluhan</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-2.5 sm:p-3 bg-white border-t border-gray-100">
        <div className="flex gap-2">
          <input type="text" placeholder={callActive ? "Panggilan aktif — bicara atau ketik..." : "Ketik pesan..."} className="flex-1 rounded-full border border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} disabled={isLoading} />
          <button className={`rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-white transition-all shadow-lg active:scale-95 ${isLoading || !input.trim() ? 'bg-gray-300' : `bg-gradient-to-r ${colors.gradient} hover:shadow-xl`}`}
            onClick={sendMsg} disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
