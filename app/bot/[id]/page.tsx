'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { Send, Bot, User, Loader2, Phone, PhoneOff, MapPin, AlertTriangle, Mic, MicOff, X, Search, Shield, MapPinned, Volume2, VolumeX, Star, ImagePlus, Navigation, CornerDownRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Locate, Building2, Car, Bike, Footprints, ArrowUpDown, Bus, Route, CirclePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Message = {
  id: string; role: 'user' | 'model'; content: string; timestamp: Date;
  showMap?: boolean; mapQuery?: string; isVoice?: boolean; imageUrl?: string;
  showWhatsApp?: boolean; whatsAppText?: string; suggestions?: string[];
};
type AgentData = { id: string; name: string; role: string; tone: string; language: string; instructions: string; goal: string; industry: string; voice_type?: string; quick_actions?: string; };
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
  const parts: React.ReactNode[] = []; const r = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)|(https?:\/\/[^\s\)<>,\"]+))/ig; let last = 0, m;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] && m[5]) { parts.push(m[5].includes('maps') ? <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition"><MapPin className="w-3 h-3" />{m[4]}</a> : <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">{m[4]}</a>); }
    else if (m[6]) { parts.push(m[6].includes('maps') ? <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition"><MapPin className="w-3 h-3" />Map Link</a> : <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">{m[6]}</a>); }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

// ── Interactive Map ──
function InteractiveMap({ query, agentIndustry, businessInfo, isEn }: { query: string; agentIndustry: string; businessInfo: any; isEn?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null), mapInst = useRef<any>(null), markersRef = useRef<any[]>([]);
  const bizMarkerRef = useRef<any>(null); const userMarkerRef = useRef<any>(null);
  const routeControlRef = useRef<any>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]); const [loading, setLoading] = useState(true); const [si, setSi] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distance: string; destName: string; fromName: string; destLat: number; destLon: number; fromLat: number; fromLon: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activePlace, setActivePlace] = useState<number | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [fromCoords, setFromCoords] = useState<[number, number] | null>(null);
  
  // Business location — always prioritize this for search
  const bizCoordsRef = useRef<[number, number]>([0, 0]);
  const hasBizRef = useRef(false);
  
  // Priority 1: Use GPS coords from extra_data (saved via Settings > Auto-fill from Maps)
  if (businessInfo?.extra_data) {
    try {
      const extra = typeof businessInfo.extra_data === 'string' ? JSON.parse(businessInfo.extra_data) : businessInfo.extra_data;
      if (extra.lat && extra.lon) {
        bizCoordsRef.current = [parseFloat(extra.lat), parseFloat(extra.lon)];
        hasBizRef.current = true;
      }
    } catch { /* invalid JSON, skip */ }
  }
  
  // Priority 2: Parse maps_link if available (supports multiple formats)
  if (!hasBizRef.current && businessInfo?.maps_link) {
    const link = businessInfo.maps_link;
    // Format: @lat,lng or @lat,lng,zoom
    const atMatch = link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    // Format: ?q=lat,lng or ?ll=lat,lng
    const qMatch = link.match(/[?&](?:q|ll|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    // Format: /place/lat,lng or /dir/lat,lng
    const pathMatch = link.match(/\/(?:place|dir)\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    const m = atMatch || qMatch || pathMatch;
    if (m) { bizCoordsRef.current = [parseFloat(m[1]), parseFloat(m[2])]; hasBizRef.current = true; }
  }
  
  const dc = bizCoordsRef.current;
  const hasBiz = hasBizRef.current;
  const [center, setCenter] = useState<[number, number]>(dc);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  // Geocode business address as fallback if no maps_link coords
  const geocodeBusiness = async (): Promise<[number, number] | null> => {
    if (!businessInfo?.address && !businessInfo?.city) return null;
    try {
      const q = `${businessInfo.business_name || ''} ${businessInfo.address || ''} ${businessInfo.city || ''}`.trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, { headers: { 'User-Agent': 'VeroAI/1.0' } });
      const d = await res.json();
      if (d.length > 0) return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
    } catch { }
    return null;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) { const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); }
    if (!document.getElementById('lrm-css')) { const l = document.createElement('link'); l.id = 'lrm-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css'; document.head.appendChild(l); }
    const load = () => new Promise<void>(r => { if ((window as any).L) { r(); return; } const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => r(); document.head.appendChild(s); });
    const loadLRM = () => new Promise<void>(r => { if ((window as any).L?.Routing) { r(); return; } const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.min.js'; s.onload = () => r(); document.head.appendChild(s); });
    
    load().then(() => loadLRM()).then(async () => {
      // Step 1: Determine business center (always prioritized)
      let bizCenter = dc;
      if (!hasBiz) {
        const geo = await geocodeBusiness();
        if (geo) { bizCenter = geo; bizCoordsRef.current = geo; hasBizRef.current = true; }
      }
      
      // Step 2: Get user location (just for marker, NOT for search)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          p => {
            const uc: [number, number] = [p.coords.latitude, p.coords.longitude];
            setUserLoc(uc);
            // Always center on BUSINESS, not user
            initMap(bizCenter, uc);
            search(query || 'nearby places', bizCenter);
          },
          () => { initMap(bizCenter, null); search(query || 'nearby places', bizCenter); },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else { initMap(bizCenter, null); search(query || 'nearby places', bizCenter); }
    });
    return () => { if (routeControlRef.current && mapInst.current) { mapInst.current.removeControl(routeControlRef.current); routeControlRef.current = null; } if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; bizMarkerRef.current = null; userMarkerRef.current = null; } };
  }, []);

  const zoomIn = () => { mapInst.current?.zoomIn(1, { animate: true, duration: 0.3 }); };
  const zoomOut = () => { mapInst.current?.zoomOut(1, { animate: true, duration: 0.3 }); };
  const goToBiz = () => { mapInst.current?.flyTo(bizCoordsRef.current, 16, { duration: 0.8 }); setTimeout(() => bizMarkerRef.current?.openPopup(), 900); };
  const goToUser = () => { if (userLoc && mapInst.current) { mapInst.current.flyTo(userLoc, 16, { duration: 0.8 }); setTimeout(() => userMarkerRef.current?.openPopup(), 900); } };

  const initMap = (c: [number, number], uc: [number, number] | null) => {
    if (!mapRef.current || mapInst.current) return; const L = (window as any).L; if (!L) return;
    const map = L.map(mapRef.current, {
      center: c, zoom: 14, zoomControl: false,
      zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true,
      inertia: true, inertiaDeceleration: 2000, inertiaMaxSpeed: 1500,
      bounceAtZoomLimits: true,
      wheelPxPerZoomLevel: 120,
      zoomSnap: 0.5, zoomDelta: 0.5,
      touchZoom: true, dragging: true, tap: true,
      doubleClickZoom: true, scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map);
    // Business marker with route action in popup
    const bizPopup = `<div style="text-align:center;min-width:160px;padding:4px 0">
      <b style="font-size:13px">${businessInfo?.business_name || agentIndustry}</b><br>
      <span style="font-size:11px;color:#666">${industryLabel[agentIndustry] || '📍'}</span><br>
      <span style="font-size:10px;color:#999">${businessInfo?.address || ''}, ${businessInfo?.city || ''}</span><br>
      <div style="margin-top:6px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
        <button onclick="window.__veroRoute(${c[0]},${c[1]},'${(businessInfo?.business_name || agentIndustry).replace(/'/g, "\\'")}')"
          style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border-radius:8px;font-size:10px;font-weight:600;border:none;cursor:pointer">➤ ${isEn ? 'Route Here' : 'Rute Kesini'}</button>
        <a href="${businessInfo?.maps_link || `https://www.google.com/maps?q=${c[0]},${c[1]}`}" target="_blank" style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;background:#EEF2FF;color:#4F46E5;border-radius:8px;font-size:10px;font-weight:600;text-decoration:none;border:1px solid #C7D2FE">Google Maps ↗</a>
      </div>
    </div>`;
    bizMarkerRef.current = L.marker(c, { icon: L.divIcon({ html: `<div style="background:linear-gradient(135deg,#EF4444,#DC2626);width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 3px 14px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:16px">🏢</div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 18] }), zIndexOffset: 1000 }).addTo(map).bindPopup(bizPopup, { maxWidth: 240 });
    // User marker with pulsing ring
    if (uc) { userMarkerRef.current = L.marker(uc, { icon: L.divIcon({ html: `<div style="position:relative"><div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.15);animation:pulse 2s infinite"></div><div style="background:linear-gradient(135deg,#3B82F6,#2563EB);width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 3px 14px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;position:relative;z-index:1">📍</div></div>`, className: '', iconSize: [32, 32], iconAnchor: [16, 16] }), zIndexOffset: 900 }).addTo(map).bindPopup(`<div style="text-align:center;min-width:120px"><b style="font-size:12px">${isEn ? 'Your Location' : 'Lokasi Anda'}</b><br><span style="font-size:10px;color:#666">${isEn ? 'You are here' : 'Anda di sini'}</span></div>`); }
    // Add CSS animation for pulse
    if (!document.getElementById('vero-map-css')) { const st = document.createElement('style'); st.id = 'vero-map-css'; st.textContent = '@keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}'; document.head.appendChild(st); }
    mapInst.current = map; setLoading(false);
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
      setPlaces(r); addM(r, sc);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const addM = (ps: PlaceResult[], searchCenter: [number, number]) => {
    const L = (window as any).L, map = mapInst.current; if (!L || !map) return;
    markersRef.current.forEach(m => map.removeLayer(m)); markersRef.current = [];
    // Bounds only include business + search results, NOT user location
    const bounds = L.latLngBounds();
    bounds.extend(searchCenter);
    const em: Record<string, string> = { restaurant: '🍽️', cafe: '☕', hotel: '🏨', hospital: '🏥', pharmacy: '💊', bank: '🏦', atm: '💳', mosque: '🕌', church: '⛪' };
    ps.forEach((p) => {
      const popupHtml = `<div style="min-width:150px;padding:2px 0">
        <strong style="font-size:12px">${p.name}</strong><br>
        <span style="font-size:10px;color:#666">${p.address || p.type}</span>
        <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">
          <button onclick="window.__veroRoute(${p.lat},${p.lon},'${p.name.replace(/'/g, "\\'")}')"
            style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border-radius:8px;font-size:10px;font-weight:600;border:none;cursor:pointer">➤ ${isEn ? 'Route Here' : 'Rute Kesini'}</button>
          <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank"
            style="display:inline-flex;align-items:center;gap:3px;padding:4px 10px;background:#EEF2FF;color:#4F46E5;border-radius:8px;font-size:10px;font-weight:600;text-decoration:none;border:1px solid #C7D2FE">Maps ↗</a>
        </div>
      </div>`;
      const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ html: `<div style="background:linear-gradient(135deg,#10B981,#059669);width:28px;height:28px;border-radius:8px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:14px">${em[p.type] || '📍'}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map).bindPopup(popupHtml, { maxWidth: 220 });
      markersRef.current.push(mk); bounds.extend(mk.getLatLng());
    });
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
  };

  // Search always uses business center
  const doSearch = () => { if (si.trim()) { clearRoute(); search(si.trim(), bizCoordsRef.current); setSi(''); } };
  const em: Record<string, string> = { restaurant: '🍽️', cafe: '☕', hotel: '🏨', hospital: '🏥', pharmacy: '💊', bank: '🏦', atm: '💳', mosque: '🕌', church: '⛪' };

  const clearRoute = () => {
    if (routeControlRef.current && mapInst.current) { mapInst.current.removeControl(routeControlRef.current); routeControlRef.current = null; }
    setRouteInfo(null);
    setShowDirections(false);
    setFromInput('');
    setToInput('');
    setFromCoords(null);
  };

  // Geocode a location string to [lat, lon, displayName]
  const geocodeLocation = async (query: string): Promise<[number, number, string] | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`, { headers: { 'User-Agent': 'VeroAI/1.0' } });
      const d = await res.json();
      if (d.length > 0) return [parseFloat(d[0].lat), parseFloat(d[0].lon), d[0].display_name?.split(',').slice(0, 2).join(',') || query];
    } catch { }
    return null;
  };

  const showRoute = async (destLat: number, destLon: number, destName: string, customFrom?: [number, number], customFromName?: string) => {
    const L = (window as any).L, map = mapInst.current;
    if (!L || !map || !L.Routing) return;
    const from = customFrom || fromCoords || userLoc || bizCoordsRef.current;
    const fromName = customFromName || (fromCoords ? fromInput : (userLoc ? (isEn ? 'Your Location' : 'Lokasi Anda') : (businessInfo?.business_name || agentIndustry)));
    if (routeControlRef.current) { map.removeControl(routeControlRef.current); routeControlRef.current = null; }
    setRouteLoading(true);
    setShowDirections(true);
    setFromInput(fromName);
    setToInput(destName);
    const ctrl = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(destLat, destLon)],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      show: false,
      createMarker: () => null,
      lineOptions: { styles: [{ color: '#4285F4', weight: 5, opacity: 0.85 }, { color: '#4285F4', weight: 8, opacity: 0.25 }], extendToWaypoints: true, missingRouteTolerance: 0 },
      router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving' }),
    }).on('routesfound', (e: any) => {
      const r = e.routes[0];
      const km = (r.summary.totalDistance / 1000).toFixed(1);
      setRouteInfo({ distance: `${km} km`, destName, fromName, destLat, destLon, fromLat: from[0], fromLon: from[1] });
      setRouteLoading(false);
      const bounds = L.latLngBounds([L.latLng(from[0], from[1]), L.latLng(destLat, destLon)]);
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1.0 });
    }).on('routingerror', () => { setRouteLoading(false); }).addTo(map);
    routeControlRef.current = ctrl;
    const container = ctrl.getContainer();
    if (container) container.style.display = 'none';
  };

  // Handle geocode + route for edited from/to fields
  const handleFromSearch = async () => {
    if (!fromInput.trim() || !routeInfo) return;
    const result = await geocodeLocation(fromInput);
    if (result) {
      const [lat, lon, name] = result;
      setFromCoords([lat, lon]);
      setFromInput(name);
      showRoute(routeInfo.destLat, routeInfo.destLon, routeInfo.destName, [lat, lon], name);
    }
  };

  const handleToSearch = async () => {
    if (!toInput.trim()) return;
    const result = await geocodeLocation(toInput);
    if (result) {
      const [lat, lon, name] = result;
      setToInput(name);
      showRoute(lat, lon, name);
    }
  };

  // Expose route function globally for popup buttons
  useEffect(() => {
    (window as any).__veroRoute = (lat: number, lon: number, name: string) => showRoute(lat, lon, name);
    return () => { delete (window as any).__veroRoute; };
  });

  return (
    <div className={`rounded-2xl overflow-hidden border border-gray-200/80 shadow-xl my-2.5 transition-all duration-300 ${expanded ? 'fixed inset-2 z-[9999] rounded-2xl' : ''}`} style={expanded ? { margin: 0 } : {}}>
      {/* Search Bar — responsive */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-white border-b border-gray-100">
        <div className="flex-1 flex items-center gap-1.5 bg-gray-50 rounded-xl px-2.5 sm:px-3 py-2">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input type="text" placeholder={isEn ? "Search nearby places..." : "Cari tempat sekitar..."} value={si} onChange={e => setSi(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} className="bg-transparent text-xs w-full focus:outline-none text-gray-700 placeholder:text-gray-400" />
          {si && <button onClick={() => setSi('')} className="text-gray-300 hover:text-gray-500 transition-colors"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <button onClick={doSearch} className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs rounded-xl hover:from-indigo-600 hover:to-indigo-700 font-semibold shadow-sm shadow-indigo-200 active:scale-95 transition-all shrink-0">{isEn ? "Search" : "Cari"}</button>
      </div>

      {/* Toolbar — scrollable chips */}
      <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button onClick={goToBiz} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-semibold hover:bg-red-100 transition-all active:scale-95 border border-red-100">
          <Building2 className="w-3 h-3" /><span className="hidden sm:inline">{businessInfo?.business_name || agentIndustry}</span><span className="sm:hidden">{isEn ? 'Biz' : 'Bisnis'}</span>
        </button>
        <button onClick={goToUser} className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all active:scale-95 border ${userLoc ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'}`} disabled={!userLoc}>
          <Locate className="w-3 h-3" /><span className="hidden sm:inline">{isEn ? 'My Location' : 'Lokasi Saya'}</span><span className="sm:hidden">GPS</span>
        </button>
        <button onClick={() => showRoute(dc[0], dc[1], businessInfo?.business_name || agentIndustry)} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-semibold hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100">
          <Navigation className="w-3 h-3" /><span className="hidden sm:inline">{isEn ? 'Directions' : 'Petunjuk Arah'}</span><span className="sm:hidden">{isEn ? 'Route' : 'Rute'}</span>
        </button>
        {routeInfo && (
          <button onClick={clearRoute} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-500 text-[10px] font-semibold hover:bg-red-100 transition-all active:scale-95 border border-red-100">
            <X className="w-3 h-3" /><span className="hidden sm:inline">{isEn ? 'Clear Route' : 'Hapus Rute'}</span><span className="sm:hidden">✕</span>
          </button>
        )}
        <a href={businessInfo?.maps_link || `https://www.google.com/maps?q=${dc[0]},${dc[1]}`} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-[10px] font-semibold hover:bg-green-100 transition-all active:scale-95 border border-green-100 ml-auto">
          <MapPin className="w-3 h-3" />Google Maps ↗
        </a>
      </div>

      {/* Directions Panel */}
      <AnimatePresence>
        {showDirections && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white border-b border-gray-100">
              {/* From / To editable fields */}
              <div className="flex items-stretch px-3 py-3">
                {/* Dots column */}
                <div className="flex flex-col items-center justify-center w-7 shrink-0 py-2">
                  <div className="w-3 h-3 rounded-full border-[2.5px] border-blue-500 bg-white" />
                  <div className="w-0.5 flex-1 bg-gray-300 my-1" style={{ minHeight: '16px' }} />
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
                {/* Editable input fields */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <input
                    type="text"
                    value={fromInput}
                    onChange={e => setFromInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFromSearch()}
                    placeholder={isEn ? 'Your Location' : 'Lokasi Anda'}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-transparent focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <input
                    type="text"
                    value={toInput}
                    onChange={e => setToInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleToSearch()}
                    placeholder={isEn ? 'Choose destination...' : 'Pilih tujuan...'}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-800 font-medium border border-transparent focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                {/* Swap & Close buttons */}
                <div className="flex flex-col items-center justify-center gap-1 w-10 shrink-0">
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-90"
                    title={isEn ? 'Swap' : 'Tukar'}
                    onClick={() => {
                      if (routeInfo) {
                        const newFrom = fromInput;
                        const newTo = toInput;
                        setFromInput(newTo);
                        setToInput(newFrom);
                        showRoute(routeInfo.fromLat, routeInfo.fromLon, routeInfo.fromName, [routeInfo.destLat, routeInfo.destLon], routeInfo.destName);
                      }
                    }}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearRoute}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                    title={isEn ? 'Close' : 'Tutup'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Distance + Google Maps link bar */}
              {routeLoading ? (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 border-t border-gray-100 bg-gray-50">
                  <Loader2 className="w-4 h-4 animate-spin" />{isEn ? 'Calculating route...' : 'Menghitung rute...'}
                </div>
              ) : routeInfo && (
                <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-blue-50/50">
                  <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-blue-700">{routeInfo.distance}</span>
                  <a
                    href={`https://www.google.com/maps/dir/${routeInfo.fromLat},${routeInfo.fromLon}/${routeInfo.destLat},${routeInfo.destLon}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    <MapPin className="w-3 h-3" />{isEn ? 'Google Maps' : 'Google Maps'} ↗
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Container */}
      <div className="relative">
        <div ref={mapRef} className="w-full transition-all duration-300" style={{ height: expanded ? 'calc(100vh - 200px)' : '280px' }} />
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs text-gray-500 font-medium">{isEn ? 'Loading map...' : 'Memuat peta...'}</span>
          </div>
        )}

        {/* Floating Zoom & Control Buttons */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
          <button onClick={zoomIn} className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg shadow-black/10 flex items-center justify-center text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-90 transition-all border border-white/50" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={zoomOut} className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg shadow-black/10 flex items-center justify-center text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-90 transition-all border border-white/50" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-gray-200 mx-1" />
          <button onClick={() => setExpanded(!expanded)} className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg shadow-black/10 flex items-center justify-center text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-90 transition-all border border-white/50" title={expanded ? 'Minimize' : 'Expand'}>
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Places List */}
      {places.length > 0 && (
        <div className={`bg-white divide-y divide-gray-50 overflow-y-auto ${expanded ? 'max-h-[200px]' : 'max-h-[160px]'}`}>
          {places.slice(0, 8).map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2 sm:py-2.5 cursor-pointer transition-all active:bg-indigo-50 ${activePlace === i ? 'bg-indigo-50/80 border-l-2 border-indigo-500' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
              onClick={() => { setActivePlace(i); mapInst.current?.flyTo([p.lat, p.lon], 16, { duration: 0.6 }); setTimeout(() => markersRef.current[i]?.openPopup(), 700); }}
            >
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center text-base shrink-0 shadow-sm">
                {em[p.type] || '📍'}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{p.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{p.address || p.type}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); showRoute(p.lat, p.lon, p.name); }}
                  className="h-8 w-8 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 flex items-center justify-center shrink-0 text-white text-[10px] font-semibold transition-all shadow-sm shadow-indigo-200 gap-1 active:scale-90"
                  title={isEn ? 'Get Directions' : 'Petunjuk Arah'}
                >
                  <CornerDownRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">{isEn ? 'Route' : 'Rute'}</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="h-8 w-8 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5 rounded-lg bg-gray-50 hover:bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600 text-[10px] font-medium transition-all border border-gray-200 hover:border-indigo-200 active:scale-90"
                  title={isEn ? 'Open in Google Maps' : 'Buka di Google Maps'}
                >
                  <MapPin className="w-3.5 h-3.5 sm:hidden" />
                  <span className="hidden sm:inline">Maps ↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expand backdrop */}
      {expanded && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setExpanded(false)} />}
    </div>
  );
}

// ── Permission Prompt ──
function PermissionPrompt({ onGranted, isEn }: { onGranted: () => void; isEn?: boolean }) {
  const [loc, setLoc] = useState<'idle' | 'ok' | 'no'>('idle'); const [mic, setMic] = useState<'idle' | 'ok' | 'no'>('idle');
  const done = loc !== 'idle' && mic !== 'idle';
  // Proceed automatically if both are handled
  useEffect(() => { if (done) { const t = setTimeout(onGranted, 800); return () => clearTimeout(t); } }, [done, onGranted]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6"><div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-3"><Shield className="w-8 h-8 text-indigo-600" /></div><h2 className="text-lg font-bold text-gray-900">{isEn ? "Permissions Required" : "Izin Diperlukan"}</h2><p className="text-sm text-gray-500 mt-1">{isEn ? "For map & calling to work optimally" : "Agar peta & panggilan berjalan optimal"}</p></div>
        <div className="space-y-3">
          <button onClick={() => navigator.geolocation.getCurrentPosition(() => setLoc('ok'), () => setLoc('ok'), { enableHighAccuracy: true, timeout: 5000 })} disabled={loc !== 'idle'} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${loc === 'ok' ? 'border-green-300 bg-green-50' : loc === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <MapPinned className={`w-5 h-5 ${loc === 'ok' ? 'text-green-600' : loc === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} /><div className="text-left flex-1"><p className="text-sm font-semibold text-gray-800">{isEn ? "Location (GPS)" : "Lokasi (GPS)"}</p><p className="text-xs text-gray-500">{isEn ? "Your position on the map" : "Posisi Anda di peta"}</p></div>{loc === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}
          </button>
          <button onClick={async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setMic('ok'); } catch { setMic('no'); } }} disabled={mic !== 'idle'} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${mic === 'ok' ? 'border-green-300 bg-green-50' : mic === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <Mic className={`w-5 h-5 ${mic === 'ok' ? 'text-green-600' : mic === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} /><div className="text-left flex-1"><p className="text-sm font-semibold text-gray-800">{isEn ? "Microphone" : "Mikrofon"}</p><p className="text-xs text-gray-500">{isEn ? "Voice calling feature" : "Fitur panggilan suara"}</p></div>{mic === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}{mic === 'no' && <span className="text-amber-600 text-xs font-semibold">{isEn ? "Skipped" : "Lewati"}</span>}
          </button>
        </div>
        {done && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center"><p className="text-sm text-green-600 font-medium">{isEn ? "Ready to use! ✨" : "Siap digunakan! ✨"}</p></motion.div>}
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
  const [complaint, setComplaint] = useState({ name: '', phone: '', details: '', imageBase64: '' });
  const [showPerms, setShowPerms] = useState(false);

  // Rating
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const idleTimerRef = useRef<any>(null);

  // Contextual typing indicator
  const [loadingPhase, setLoadingPhase] = useState(0);

  // Dynamic chips context
  const [chipContext, setChipContext] = useState<'initial' | 'info' | 'complaint' | 'booking'>('initial');

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const isEng = data.agent.language?.toLowerCase() === 'english';
      setMessages([{ id: 'welcome', role: 'model', content: isEng ? `Hi! 👋 I am **${data.agent.name}**, ${data.agent.role} from **${data.business?.business_name || 'our company'}**.\n\nHow can I help you? You can ask about our services, places of interest, or use the interactive map! 🗺️` : `Halo! 👋 Saya **${data.agent.name}**, ${data.agent.role} dari **${data.business?.business_name || 'kami'}**.\n\nAda yang bisa saya bantu? Tanyakan tentang layanan, tempat menarik di sekitar, atau gunakan peta interaktif! 🗺️`, timestamp: new Date() }]);
      if (typeof navigator !== 'undefined') { (async () => { try { const l = await navigator.permissions.query({ name: 'geolocation' }); const m = await navigator.permissions.query({ name: 'microphone' as PermissionName }); if (l.state !== 'granted' || m.state !== 'granted') setShowPerms(true); } catch { setShowPerms(true); } })(); }
    }).catch(() => setNotFound(true));
  }, [id]);

  // Save to localStorage with lastActivity
  useEffect(() => { if (messages.length > 0 && agent) { try { localStorage.setItem(storageKey, JSON.stringify({ messages: messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })), conversationId: convId, lastActivity: new Date().toISOString() })); } catch { } } }, [messages, convId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (callActive) { setCallTime(0); timerRef.current = setInterval(() => setCallTime(d => d + 1), 1000); } else { if (timerRef.current) clearInterval(timerRef.current); } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [callActive]);

  // ── Idle timer for rating popup (3 min after last message) ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (ratingSubmitted) return;
    idleTimerRef.current = setTimeout(() => {
      if (messages.length > 3 && !ratingSubmitted) setShowRating(true);
    }, 3 * 60 * 1000); // 3 minutes
  }, [messages.length, ratingSubmitted]);

  useEffect(() => { resetIdleTimer(); return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }; }, [messages, resetIdleTimer]);

  // ── Contextual loading phases ──
  useEffect(() => {
    if (!isLoading) { setLoadingPhase(0); return; }
    setLoadingPhase(1);
    const t1 = setTimeout(() => setLoadingPhase(2), 2000);
    const t2 = setTimeout(() => setLoadingPhase(3), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isLoading]);

  // ── Submit rating ──
  const submitRating = async () => {
    if (!ratingValue) return;
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: id, conversationId: convId, rating: ratingValue }),
      });
    } catch { }
    setRatingSubmitted(true);
    setShowRating(false);
  };

  // ── Dynamic chip context ──
  const updateChipContext = (text: string) => {
    const l = text.toLowerCase();
    if (/keluhan|kecewa|masalah|komplain|complaint/.test(l)) setChipContext('complaint');
    else if (/harga|pesan|booking|reservasi|order|beli/.test(l)) setChipContext('booking');
    else if (/info|layanan|fasilitas|menu|promo/.test(l)) setChipContext('info');
  };

  // ── Image upload handler ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: `📷 [Foto: ${file.name}]`, timestamp: new Date(), imageUrl: dataUrl }]);
      setIsLoading(true);
      try {
        const res = await fetch('/api/chat', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ agentId: id, message: `Saya mengirim foto ${file.name}. Tolong lihat.`, imageBase64: dataUrl, conversationId: convId, sessionType: 'chat' }) 
        });
        const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Gagal');
        if (data.conversationId) setConvId(data.conversationId);
        const rt = data.response || 'Maaf, tidak ada respons.';
        setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'model', content: rt, timestamp: new Date() }]);
        if (data.isComplaint) { setShowComplaint(true); setChipContext('complaint'); }
      } catch (e: any) {
        setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: `Maaf, gagal memproses gambar: ${e.message}`, timestamp: new Date() }]);
      } finally { setIsLoading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Text chat ──
  const sendMsg = async () => {
    if (!input.trim() || !agent) return;
    const text = input; setInput('');
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }]);
    setIsLoading(true);
    updateChipContext(text);
    const wm = hasMap(text), mq = wm ? extractQ(text) : '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, message: text, conversationId: convId, sessionType: 'chat' }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Gagal');
      if (data.conversationId) setConvId(data.conversationId);
      const rt = data.response || 'Maaf, tidak ada respons.';
      const shouldMap = wm || rt.includes('google.com/maps');
      const lowerRt = rt.toLowerCase();
      const isCS = lowerRt.includes('customer service') || lowerRt.includes('admin') || lowerRt.includes('bantuan') || lowerRt.includes(' cs ') || lowerRt.includes('hubung') || lowerRt.includes('contact');
      const isEn = agent?.language?.toLowerCase() === 'english';
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'model', content: data.fromCache ? `⚡ ${rt}` : rt, timestamp: new Date(), showMap: shouldMap, mapQuery: shouldMap ? (mq || extractQ(rt)) : '', showWhatsApp: isCS, whatsAppText: isEn ? 'Chat via WhatsApp' : 'Chat via WhatsApp', suggestions: data.suggestions }]);
      if (data.isComplaint) { setShowComplaint(true); setChipContext('complaint'); }
    } catch (e: any) { setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: `Maaf, terjadi kesalahan: ${e.message}`, timestamp: new Date() }]); }
    finally { setIsLoading(false); }
  };

  const handleSuggestionClick = (suggestion: string) => {
      setInput(suggestion);
      // Wait for state to update, then send
      setTimeout(() => {
          const btn = document.getElementById('vero-send-btn');
          if (btn) btn.click();
      }, 50);
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
    const isEng = agent?.language?.toLowerCase() === 'english';
    setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: isEng ? '📞 Call ended. Thank you for contacting us!' : '📞 Panggilan diakhiri. Terima kasih telah menghubungi kami!', timestamp: new Date() }]);
  }, [stopSpeaking]);

  const selectVoice = (synth: SpeechSynthesis, vt: string) => {
    const isEng = agent?.language?.toLowerCase() === 'english';
    const langCode = isEng ? 'en' : 'id';
    const voices = synth.getVoices(), isF = vt === 'female';
    const lv = voices.filter(v => v.lang.toLowerCase().startsWith(langCode));
    if (lv.length > 0) { const g = lv.filter(v => isF ? /female|wanita|zira|damayanti|siti|samantha|victoria|karen|susan|google us english|google uk english female/i.test(v.name) : /male|pria|david|adam|alex|daniel|mark|google uk english male/i.test(v.name)); return g[0] || lv[0]; }
    return voices[0] || null;
  };

  const speak = (text: string, onDone?: () => void) => {
    if (!('speechSynthesis' in window)) { onDone?.(); return; }
    const synth = window.speechSynthesis; synth.cancel();
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/#{1,3}\s*/g, '');
    const u = new SpeechSynthesisUtterance(clean);
    const isEng = agent?.language?.toLowerCase() === 'english';
    u.lang = isEng ? 'en-US' : 'id-ID'; u.rate = 1.05;
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
    } catch { speak(agent?.language?.toLowerCase() === 'english' ? 'Sorry, an error occurred.' : 'Maaf terjadi kesalahan.', () => { if (callRef.current) startListen(); }); }
  };

  const startCall = async () => {
    if (!agent) return; setConnecting(true);
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isEng = agent?.language?.toLowerCase() === 'english';
    if (!SR) { alert(isEng ? 'Browser not supported. Use Chrome.' : 'Browser tidak mendukung. Gunakan Chrome.'); setConnecting(false); return; }
    if (window.speechSynthesis) { window.speechSynthesis.getVoices(); await new Promise(r => setTimeout(r, 300)); }
    try {
      const rec = new SR(); rec.lang = isEng ? 'en-US' : 'id-ID'; rec.continuous = false; rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e: any) => { setListening(false); onSpeech(e.results[e.resultIndex][0].transcript); };
      rec.onerror = (e: any) => { if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn(e.error); };
      rec.onend = () => { setTimeout(() => { if (callRef.current && !speakRef.current) { try { recRef.current?.start(); } catch { } } }, 300); };
      recRef.current = rec; callRef.current = true; setCallActive(true); setConnecting(false);
      const startMsg = isEng 
        ? `📞 Call started with **${agent.name}**. Please speak — I'm listening!\n\n*Click the 🔇 button to stop the AI voice at any time.*` 
        : `📞 Panggilan dimulai dengan **${agent.name}**. Silakan bicara — saya mendengarkan!\n\n*Klik tombol 🔇 untuk menghentikan suara AI kapan saja.*`;
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: startMsg, timestamp: new Date() }]);
      const greeting = isEng
        ? `Hello, I am ${agent.name} from ${biz?.business_name || 'us'}. How can I help you?`
        : `Halo, saya ${agent.name} dari ${biz?.business_name || 'kami'}. Ada yang bisa saya bantu?`;
      speak(greeting, () => { if (callRef.current) startListen(); });
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
      const isEn = agent?.language?.toLowerCase() === 'english';
      const whatsAppBtnText = isEn ? 'Chat via WhatsApp' : 'Chat via WhatsApp';
      const msgEn = `Thank you so much **${complaint.name}** for your feedback 🙏\n\nWe deeply apologize for the inconvenience you experienced. Your complaint has been **recorded in our system** and will be promptly reviewed by the **${bn}** admin team.\n\nHere is what we will do:\n1. **The admin team will review** your complaint shortly\n2. **We will contact you** at **${complaint.phone}** for follow-up\n3. **Improvements will be made** based on your feedback\n\n${cs ? `📞 If you need **immediate** assistance, please contact our Customer Service at **${cs}** — our team is ready to help 24/7.\n\n` : ''}Your satisfaction is our top priority. Thank you for helping us do better! ❤️`;
      const msgId = `Terima kasih banyak **${complaint.name}** atas masukan Anda 🙏\n\nKami sangat menyesal atas ketidaknyamanan yang Anda alami. Keluhan Anda sudah **tercatat dalam sistem kami** dan akan segera ditinjau oleh tim admin **${bn}**.\n\nBerikut yang akan kami lakukan:\n1. **Tim admin akan mereview** keluhan Anda dalam waktu dekat\n2. **Kami akan menghubungi Anda** di nomor **${complaint.phone}** untuk tindak lanjut\n3. **Perbaikan akan segera dilakukan** berdasarkan masukan Anda\n\n${cs ? `📞 Jika Anda membutuhkan bantuan **segera**, silakan hubungi Customer Service kami di **${cs}** — tim kami siap membantu Anda 24 jam.\n\n` : ''}Kepuasan Anda adalah prioritas utama kami. Terima kasih telah membantu kami menjadi lebih baik! ❤️`;
      
      setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: isEn ? msgEn : msgId, timestamp: new Date(), showWhatsApp: true, whatsAppText: whatsAppBtnText }]);
      setComplaint({ name: '', phone: '', details: '', imageBase64: '' });
    } catch (e) { console.error(e); setMessages(p => [...p, { id: Date.now().toString(), role: 'model', content: 'Maaf, gagal mengirim keluhan. Coba lagi.', timestamp: new Date() }]); }
  };

  const colors = industryColors[agent?.industry || 'General'] || industryColors.General;
  const isEn = agent?.language?.toLowerCase() === 'english';
  const bizLabel = industryLabel[agent?.industry || 'General'] || '📍 Lokasi';
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (notFound) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="text-center p-8"><Bot className="mx-auto h-16 w-16 text-gray-300 mb-4" /><h2 className="text-2xl font-bold">Agent Not Found</h2></div></div>;
  if (!agent) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-white shadow-2xl relative overflow-hidden lg:max-w-2xl xl:max-w-3xl lg:rounded-2xl lg:my-4 lg:h-[calc(100dvh-2rem)] lg:border lg:border-gray-200">
      <AnimatePresence>{showPerms && <PermissionPrompt onGranted={() => setShowPerms(false)} isEn={isEn} />}</AnimatePresence>

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
          <button onClick={() => setShowRating(true)} className="px-2 py-1.5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all text-[10px] sm:text-xs font-semibold mr-1" title={isEn ? "End Chat & Rate" : "Akhiri sesi dan beri rating"}>{isEn ? "End" : "Akhiri"}</button>
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
                  {speaking ? `${agent.name} ${isEn ? 'is speaking...' : 'sedang bicara...'}` : listening ? (isEn ? 'Listening...' : 'Mendengarkan Anda...') : (isEn ? 'Processing...' : 'Memproses...')}
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

      {/* Dynamic Quick Chips */}
      <div className="px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto bg-gray-50/80 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
        {(() => {
          if (chipContext === 'initial' && agent?.quick_actions) {
            try {
              const parsed = JSON.parse(agent.quick_actions);
              if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((c: any) => (<button key={c.label} onClick={() => setInput(c.action)} className="shrink-0 px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-[11px] sm:text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm active:scale-95">{c.label}</button>));
              }
            } catch { }
          }
          const chips = (chipContext === 'initial' ? (isEn ? [
            { label: '🗺️ Nearby Map', action: 'Can I see the map and interesting places around here?' },
            { label: '🍽️ Viral Food', action: 'What are some viral foods or nearby culinary recommendations?' },
            { label: '⭐ Places', action: 'Please recommend interesting tourist spots or destinations nearby' },
            { label: '💰 Price', action: 'How much are the prices and are there any promos right now?' },
            { label: '❓ FAQ', action: 'What are some frequently asked questions?' },
          ] : [
            { label: '🗺️ Peta Sekitar', action: 'Boleh lihat peta dan tempat menarik di sekitar sini?' },
            { label: '🍽️ Makanan Viral', action: 'Apa saja rekomendasi makanan viral atau kuliner terdekat dari sini?' },
            { label: '⭐ Tempat Viral', action: 'Tolong rekomendasikan tempat wisata atau destinasi menarik di sekitar sini dong' },
            { label: '💰 Harga', action: 'Berapa harga dan ada promo apa saja saat ini?' },
            { label: '❓ FAQ', action: 'Apa saja layanan atau pertanyaan yang sering ditanyakan?' },
          ]) : chipContext === 'info' ? (isEn ? [
            { label: '💰 Price & Promo', action: 'What are the prices and available promos?' },
            { label: '📅 Booking', action: 'How can I make a booking or reservation?' },
            { label: '📍 Location', action: 'Where is the exact location? And how to get there?' },
            { label: '🗺️ Map', action: 'Can I see the map and interesting places around here?' },
            { label: '📞 Contact Admin', action: 'I want to speak directly with an admin' },
          ] : [
            { label: '💰 Harga & Promo', action: 'Berapa harga dan promo yang tersedia?' },
            { label: '📅 Booking', action: 'Bagaimana cara melakukan booking atau reservasi?' },
            { label: '📍 Lokasi', action: 'Dimana lokasi lengkapnya? Dan bagaimana cara ke sana?' },
            { label: '🗺️ Peta', action: 'Boleh lihat peta dan tempat menarik di sekitar sini?' },
            { label: '📞 Hubungi Admin', action: 'Saya ingin berbicara langsung dengan admin' },
          ]) : chipContext === 'booking' ? (isEn ? [
            { label: '💳 Payment Info', action: 'What payment methods are accepted?' },
            { label: '📋 Terms', action: 'What are the terms and conditions?' },
            { label: '📞 Contact Admin', action: 'I want to speak directly with an admin to book' },
            { label: '🗺️ Location', action: 'Where is the exact location?' },
            { label: '⭐ Reviews', action: 'What do other customers say about this?' },
          ] : [
            { label: '💳 Cara Bayar', action: 'Metode pembayaran apa saja yang diterima?' },
            { label: '📋 Syarat & Ketentuan', action: 'Apa saja syarat dan ketentuannya?' },
            { label: '📞 Hubungi Admin', action: 'Saya ingin berbicara langsung dengan admin untuk booking' },
            { label: '🗺️ Lokasi', action: 'Dimana lokasi lengkapnya?' },
            { label: '⭐ Review', action: 'Apa kata pelanggan lain tentang layanan ini?' },
          ]) : (isEn ? [
            { label: '📝 Complaint Form', action: 'I want to fill out a formal complaint form' },
            { label: '📞 Call CS', action: 'I want to speak directly with customer service' },
            { label: '🔄 Other Issue', action: 'I have another issue I want to report' },
            { label: '⬅️ Main Menu', action: 'Return to main menu, I have another question' },
          ] : [
            { label: '📝 Form Keluhan', action: 'Saya ingin mengisi formulir keluhan resmi' },
            { label: '📞 Hubungi CS', action: 'Saya ingin bicara langsung dengan customer service' },
            { label: '🔄 Masalah Lain', action: 'Saya punya masalah lain yang ingin disampaikan' },
            { label: '⬅️ Menu Awal', action: 'Kembali ke menu awal, ada pertanyaan lain' },
          ]));
          return chips.map(c => (<button key={c.label} onClick={() => { setInput(c.action); if (c.label.includes('Menu Awal') || c.label.includes('Main Menu')) setChipContext('initial'); }} className="shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm active:scale-95">{c.label}</button>));
        })()}
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
              {msg.imageUrl && (
                <div className="mb-2 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <img src={msg.imageUrl} alt="Uploaded" className="max-w-full max-h-48 object-cover" />
                </div>
              )}
              <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${msg.role === 'user' ? `bg-gradient-to-r ${colors.gradient} text-white rounded-tr-sm` : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'}`}>
                {msg.isVoice && <div className="flex items-center gap-1 mb-1"><Mic className="w-3 h-3 opacity-50" /><span className="text-[10px] opacity-50">Voice</span></div>}
                {msg.role === 'model' ? <RichContent content={msg.content} colors={colors} /> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                
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
                    <button key={idx} onClick={() => handleSuggestionClick(s)} className="text-left flex items-start gap-2 px-3 py-2 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm transition-all active:scale-[0.98] group">
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
        {isLoading && (
          <div className="flex gap-2 sm:gap-2.5">
            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br ${colors.gradient} text-white flex items-center justify-center shadow-sm`}>
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
                </div>
                <motion.span 
                  key={loadingPhase} 
                  initial={{ opacity: 0, x: -5 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="text-xs text-gray-400"
                >
                  {loadingPhase <= 1 ? (isEn ? `${agent.name} is typing...` : `${agent.name} sedang mengetik...`) : loadingPhase === 2 ? (isEn ? '🔍 Finding the best information...' : '🔍 Mencari informasi terbaik...') : (isEn ? '✨ Formatting answer...' : '✨ Menyusun jawaban...')}
                </motion.span>
              </div>
            </div>
          </div>
        )}
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
                <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div><div><h3 className="font-semibold text-gray-900 text-sm">{isEn ? "Complaint Form" : "Formulir Keluhan"}</h3><p className="text-[10px] text-gray-400">{isEn ? "Will be reviewed by admin" : "Akan diperiksa admin"}</p></div></div>
                <button onClick={() => setShowComplaint(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
              </div>
              {biz?.phone && <div className="mb-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs text-blue-700">📞 {isEn ? "Need urgent help? Call CS:" : "Butuh segera? Hubungi CS:"} <strong>{biz.phone}</strong></p></div>}
              <div className="space-y-2.5">
                <input type="text" placeholder={isEn ? "Your Name" : "Nama Anda"} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.name} onChange={e => setComplaint({ ...complaint, name: e.target.value })} />
                <input type="tel" placeholder={isEn ? "Phone Number" : "Nomor HP"} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.phone} onChange={e => setComplaint({ ...complaint, phone: e.target.value })} />
                <textarea placeholder={isEn ? "Explain your issue..." : "Jelaskan keluhan..."} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm h-20 resize-none focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.details} onChange={e => setComplaint({ ...complaint, details: e.target.value })} />
                
                <div className="border border-gray-200 rounded-xl p-2.5">
                  <span className="block text-[11px] text-gray-500 font-medium mb-1.5">{isEn ? "Attach Photo Proof (Optional)" : "Lampirkan Bukti Foto (Opsional)"}</span>
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 shadow-sm border border-blue-100">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {complaint.imageBase64 ? (isEn ? "Replace Image" : "Ganti Foto") : (isEn ? "Select Image" : "Pilih Foto")}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const r = new FileReader();
                        r.onload = () => setComplaint(p => ({ ...p, imageBase64: r.result as string }));
                        r.readAsDataURL(f);
                      }
                    }} />
                  </label>
                  {complaint.imageBase64 && <div className="mt-2 text-[10px] text-green-600 font-medium flex items-center gap-1">✓ {isEn ? "Image attached" : "Foto berhasil dipilih"}</div>}
                </div>

                <button onClick={submitComplaint} disabled={!complaint.name || !complaint.phone || !complaint.details} className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-md transition-all">{isEn ? "Submit Complaint" : "Kirim Keluhan"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rating Popup */}
      <AnimatePresence>
        {showRating && !ratingSubmitted && (
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setShowRating(false)} />
            <motion.div initial={{ opacity: 0, y: 80, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 80 }}
              className="relative w-full sm:w-[380px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:mb-10 pointer-events-auto">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full sm:hidden" />
              <button onClick={() => setShowRating(false)} className="absolute top-4 right-4">
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                  <span className="text-2xl">⭐</span>
                </div>
                <h3 className="font-bold text-gray-900">{isEn ? "How was your conversation?" : "Bagaimana percakapan tadi?"}</h3>
                <p className="text-xs text-gray-500 mt-1">{isEn ? "Help us improve our service" : "Bantu kami meningkatkan layanan"}</p>
              </div>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    onClick={() => setRatingValue(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        star <= (ratingHover || ratingValue)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-200'
                      }`}
                    />
                  </motion.button>
                ))}
              </div>
              {ratingValue > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <p className="text-center text-sm text-gray-600 mb-3">
                    {ratingValue <= 2 ? (isEn ? '😔 Sorry, we will try to do better' : '😔 Maaf, kami akan berusaha lebih baik') : ratingValue <= 3 ? (isEn ? '🙂 Thank you for your feedback' : '🙂 Terima kasih atas masukannya') : ratingValue <= 4 ? (isEn ? '😊 Glad we could help!' : '😊 Senang bisa membantu!') : (isEn ? '🤩 Thank you so much!' : '🤩 Terima kasih banyak!')}
                  </p>
                  <button onClick={submitRating}
                    className={`w-full py-2.5 font-semibold rounded-xl text-white shadow-md transition-all bg-gradient-to-r ${colors.gradient}`}>
                    {isEn ? "Submit Rating" : "Kirim Rating"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-2.5 sm:p-3 bg-white border-t border-gray-100">
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
            title="Upload foto"
          >
            <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <input type="text" placeholder={callActive ? (isEn ? "Call active — speak or type..." : "Panggilan aktif — bicara atau ketik...") : (isEn ? "Type a message..." : "Ketik pesan...")} className="flex-1 rounded-full border border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} disabled={isLoading} />
          <button className={`rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-white transition-all shadow-lg active:scale-95 ${isLoading || !input.trim() ? 'bg-gray-300' : `bg-gradient-to-r ${colors.gradient} hover:shadow-xl`}`}
            onClick={sendMsg} disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
