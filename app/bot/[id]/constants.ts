import { Message, AgentData, IndustryColors } from './types';

export const industryColors: Record<string, IndustryColors> = {
  Hotel: { primary: '#0056D2', gradient: 'from-blue-600 to-indigo-700', bg: 'bg-blue-50', accent: '#6366F1' },
  Retail: { primary: '#059669', gradient: 'from-emerald-600 to-teal-700', bg: 'bg-emerald-50', accent: '#10B981' },
  Restaurant: { primary: '#EA580C', gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-50', accent: '#F59E0B' },
  'Real Estate': { primary: '#7C3AED', gradient: 'from-violet-600 to-purple-700', bg: 'bg-violet-50', accent: '#8B5CF6' },
  General: { primary: '#0056D2', gradient: 'from-slate-700 to-slate-900', bg: 'bg-slate-50', accent: '#64748B' },
};

export const industryLabel: Record<string, string> = {
  Hotel: '🏨 Hotel', Retail: '🛒 Toko', Restaurant: '🍽️ Restoran',
  'Real Estate': '🏠 Properti', General: '📍 Lokasi',
};

export const mapKw = ['map', 'maps', 'peta', 'lokasi', 'tempat sekitar', 'arah', 'jalan', 'dimana', 'terdekat', 'wisata', 'viral', 'kuliner', 'destinasi', 'tempat makan'];
export const facilityKw = ['fasilitas', 'kamar', 'kolam renang', 'wifi', 'sarapan', 'parkir', 'gym', 'spa', 'restoran hotel', 'harga kamar', 'check in', 'check out'];

export const LANGUAGES = [
  { name: 'Indonesian', label: 'ID', flag: '🇮🇩', greeting: 'Halo! Ada yang bisa saya bantu hari ini?' },
  { name: 'English', label: 'EN', flag: '🇬🇧', greeting: 'Hi there! How can I help you today?' },
  { name: 'Spanish', label: 'ES', flag: '🇪🇸', greeting: '¡Hola! ¿En qué puedo ayudarte hoy?' },
  { name: 'Japanese', label: 'JA', flag: '🇯🇵', greeting: 'こんにちは！今日はどのようなご用件でしょうか？' },
  { name: 'Korean', label: 'KO', flag: '🇰🇷', greeting: '안녕하세요! 오늘 어떤 도움이 필요하신가요?' },
  { name: 'Mandarin', label: 'ZH', flag: '🇨🇳', greeting: '你好！今天我能怎么帮助你？' },
  { name: 'Arabic', label: 'AR', flag: '🇸🇦', greeting: 'مرحباً! كيف يمكنني مساعدتك اليوم؟' },
  { name: 'French', label: 'FR', flag: '🇫🇷', greeting: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?' },
  { name: 'German', label: 'DE', flag: '🇩🇪', greeting: 'Hallo! Wie kann ich Ihnen heute helfen?' },
  { name: 'Russian', label: 'RU', flag: '🇷🇺', greeting: 'Здравствуйте! Чем я могу вам помочь сегодня?' },
  { name: 'Portuguese', label: 'PT', flag: '🇵🇹', greeting: 'Olá! Como posso ajudar você hoje?' },
];

export const loadingTexts: Record<string, [string, string, string]> = {
  Indonesian: ['{name} sedang mengetik...', '🔍 Mencari informasi terbaik...', '✨ Menyusun jawaban...'],
  English: ['{name} is typing...', '🔍 Finding the best information...', '✨ Formatting answer...'],
  Korean: ['{name} 입력 중...', '🔍 최적의 정보를 찾는 중...', '✨ 답변 작성 중...'],
  Japanese: ['{name} 入力中...', '🔍 最適な情報を検索中...', '✨ 回答を作成中...'],
  Mandarin: ['{name} 正在输入...', '🔍 正在查找最佳信息...', '✨ 正在整理答案...'],
  Spanish: ['{name} está escribiendo...', '🔍 Buscando la mejor información...', '✨ Formateando respuesta...'],
  Arabic: ['{name} يكتب...', '🔍 البحث عن أفضل المعلومات...', '✨ تنسيق الإجابة...'],
  French: ['{name} écrit...', '🔍 Recherche des meilleures informations...', '✨ Mise en forme de la réponse...'],
  German: ['{name} tippt...', '🔍 Beste Informationen werden gesucht...', '✨ Antwort wird formatiert...'],
  Russian: ['{name} печатает...', '🔍 Поиск лучшей информации...', '✨ Форматирование ответа...'],
  Portuguese: ['{name} está digitando...', '🔍 Buscando as melhores informações...', '✨ Formatando resposta...'],
};

export function hasMap(t: string) {
  const l = t.toLowerCase();
  if (facilityKw.some(k => l.includes(k))) return false;
  return mapKw.some(k => l.includes(k));
}

export function extractQ(t: string) {
  const l = t.toLowerCase();
  const m = l.match(/(?:cari|search|temukan|find)\s+(.+)/i);
  if (m) return m[1];
  return l.replace(/map[s]?|peta|dong|tolong|bisa|kasih|lihat|tampilkan|munculkan|saya|mau/g, '').trim() || 'nearby places';
}

export function getLoadingText(lang: string, phase: number, agentName: string): string {
  const texts = loadingTexts[lang] || loadingTexts.English;
  const idx = phase <= 1 ? 0 : phase === 2 ? 1 : 2;
  return texts[idx].replace('{name}', agentName);
}
