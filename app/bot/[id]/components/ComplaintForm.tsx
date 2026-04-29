'use client';

import { useState } from 'react';
import { AlertTriangle, X, ImagePlus } from 'lucide-react';
import { motion } from 'motion/react';
import { botT } from '../i18n-bot';

interface ComplaintFormProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (complaint: { name: string; phone: string; details: string; imageBase64: string }) => void;
  userLang: string;
  bizPhone?: string;
}

export default function ComplaintForm({ show, onClose, onSubmit, userLang, bizPhone }: ComplaintFormProps) {
  const [complaint, setComplaint] = useState({ name: '', phone: '', details: '', imageBase64: '' });

  if (!show) return null;

  const handleSubmit = () => {
    onSubmit(complaint);
    setComplaint({ name: '', phone: '', details: '', imageBase64: '' });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
        className="relative w-full sm:w-[450px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 sm:mb-10 pointer-events-auto">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full sm:hidden" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div><div><h3 className="font-semibold text-gray-900 text-sm">{botT(userLang, 'complaintTitle')}</h3><p className="text-[10px] text-gray-400">{botT(userLang, 'complaintSubtitle')}</p></div></div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        {bizPhone && <div className="mb-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs text-blue-700">📞 {botT(userLang, 'complaintUrgent')} <strong>{bizPhone}</strong></p></div>}
        <div className="space-y-2.5">
          <input type="text" placeholder={botT(userLang, 'complaintName')} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.name} onChange={e => setComplaint({ ...complaint, name: e.target.value })} maxLength={255} />
          <input type="tel" placeholder={botT(userLang, 'complaintPhone')} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.phone} onChange={e => setComplaint({ ...complaint, phone: e.target.value })} maxLength={20} />
          <textarea placeholder={botT(userLang, 'complaintDetails')} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm h-20 resize-none focus:ring-2 focus:ring-blue-400/50 focus:outline-none" value={complaint.details} onChange={e => setComplaint({ ...complaint, details: e.target.value })} maxLength={2000} />
          <div className="border border-gray-200 rounded-xl p-2.5">
            <span className="block text-[11px] text-gray-500 font-medium mb-1.5">{botT(userLang, 'complaintAttach')}</span>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 shadow-sm border border-blue-100">
              <ImagePlus className="h-3.5 w-3.5" />
              {complaint.imageBase64 ? botT(userLang, 'complaintReplaceImage') : botT(userLang, 'complaintSelectImage')}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { const r = new FileReader(); r.onload = () => setComplaint(p => ({ ...p, imageBase64: r.result as string })); r.readAsDataURL(f); }
              }} />
            </label>
            {complaint.imageBase64 && <div className="mt-2 text-[10px] text-green-600 font-medium flex items-center gap-1">✓ {botT(userLang, 'complaintImageAttached')}</div>}
          </div>
          <button onClick={handleSubmit} disabled={!complaint.name || !complaint.phone || !complaint.details} className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-md transition-all">{botT(userLang, 'complaintSubmit')}</button>
        </div>
      </motion.div>
    </div>
  );
}
