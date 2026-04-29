'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MapPin, X, Search, Navigation, CornerDownRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Locate, Building2, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlaceResult } from '../types';
import { industryLabel } from '../constants';

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

export default InteractiveMap;
