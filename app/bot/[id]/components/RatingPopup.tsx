'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Star, X } from 'lucide-react';
import { IndustryColors } from '../types';

interface RatingPopupProps {
  show: boolean;
  submitted: boolean;
  ratingValue: number;
  ratingHover: number;
  isEn: boolean;
  colors: IndustryColors;
  onClose: () => void;
  onHover: (star: number) => void;
  onRate: (star: number) => void;
  onSubmit: () => void;
}

export default function RatingPopup({ show, submitted, ratingValue, ratingHover, isEn, colors, onClose, onHover, onRate, onSubmit }: RatingPopupProps) {
  return (
    <AnimatePresence>
      {show && !submitted && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 80, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 80 }}
            className="relative w-full sm:w-[380px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:mb-10 pointer-events-auto">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full sm:hidden" />
            <button onClick={onClose} className="absolute top-4 right-4">
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
                  onMouseEnter={() => onHover(star)}
                  onMouseLeave={() => onHover(0)}
                  onClick={() => onRate(star)}
                  className="p-1"
                >
                  <Star className={`w-9 h-9 transition-colors ${star <= (ratingHover || ratingValue) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                </motion.button>
              ))}
            </div>
            {ratingValue > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <p className="text-center text-sm text-gray-600 mb-3">
                  {ratingValue <= 2 ? (isEn ? '😔 Sorry, we will try to do better' : '😔 Maaf, kami akan berusaha lebih baik')
                    : ratingValue <= 3 ? (isEn ? '🙂 Thank you for your feedback' : '🙂 Terima kasih atas masukannya')
                    : ratingValue <= 4 ? (isEn ? '😊 Glad we could help!' : '😊 Senang bisa membantu!')
                    : (isEn ? '🤩 Thank you so much!' : '🤩 Terima kasih banyak!')}
                </p>
                <button onClick={onSubmit}
                  className={`w-full py-2.5 font-semibold rounded-xl text-white shadow-md transition-all bg-gradient-to-r ${colors.gradient}`}>
                  {isEn ? "Submit Rating" : "Kirim Rating"}
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
