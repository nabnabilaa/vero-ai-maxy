'use client';

import { motion } from 'motion/react';
import { Shield, MapPinned, Mic } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PermissionPromptProps {
  onGranted: () => void;
  isEn?: boolean;
}

export default function PermissionPrompt({ onGranted, isEn }: PermissionPromptProps) {
  const [loc, setLoc] = useState<'idle' | 'ok' | 'no'>('idle');
  const [mic, setMic] = useState<'idle' | 'ok' | 'no'>('idle');
  const done = loc !== 'idle' && mic !== 'idle';

  useEffect(() => {
    if (done) { const t = setTimeout(onGranted, 800); return () => clearTimeout(t); }
  }, [done, onGranted]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-3"><Shield className="w-8 h-8 text-indigo-600" /></div>
          <h2 className="text-lg font-bold text-gray-900">{isEn ? "Permissions Required" : "Izin Diperlukan"}</h2>
          <p className="text-sm text-gray-500 mt-1">{isEn ? "For map & calling to work optimally" : "Agar peta & panggilan berjalan optimal"}</p>
        </div>
        <div className="space-y-3">
          <button onClick={() => navigator.geolocation.getCurrentPosition(() => setLoc('ok'), () => setLoc('ok'), { enableHighAccuracy: true, timeout: 5000 })} disabled={loc !== 'idle'}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${loc === 'ok' ? 'border-green-300 bg-green-50' : loc === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <MapPinned className={`w-5 h-5 ${loc === 'ok' ? 'text-green-600' : loc === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} />
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-gray-800">{isEn ? "Location (GPS)" : "Lokasi (GPS)"}</p>
              <p className="text-xs text-gray-500">{isEn ? "Your position on the map" : "Posisi Anda di peta"}</p>
            </div>
            {loc === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}
          </button>
          <button onClick={async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setMic('ok'); } catch { setMic('no'); } }} disabled={mic !== 'idle'}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${mic === 'ok' ? 'border-green-300 bg-green-50' : mic === 'no' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
            <Mic className={`w-5 h-5 ${mic === 'ok' ? 'text-green-600' : mic === 'no' ? 'text-amber-600' : 'text-indigo-600'}`} />
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-gray-800">{isEn ? "Microphone" : "Mikrofon"}</p>
              <p className="text-xs text-gray-500">{isEn ? "Voice calling feature" : "Fitur panggilan suara"}</p>
            </div>
            {mic === 'ok' && <span className="text-green-600 text-xs font-semibold">✓</span>}
            {mic === 'no' && <span className="text-amber-600 text-xs font-semibold">{isEn ? "Skipped" : "Lewati"}</span>}
          </button>
        </div>
        {done && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center"><p className="text-sm text-green-600 font-medium">{isEn ? "Ready to use! ✨" : "Siap digunakan! ✨"}</p></motion.div>}
      </div>
    </motion.div>
  );
}
