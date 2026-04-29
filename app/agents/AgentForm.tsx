'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// AI generation now handled via /api/ai/generate server endpoint (Groq)
import { Sparkles, Save, Loader2, ArrowLeft, Lightbulb, Wand2, ChevronDown, MapPin, BookOpen, Plus, X, CheckCircle, Upload, FileText, Search, Map, ExternalLink, Trash2, Globe, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/hooks/useTranslation';

type TopicField = { key: string; label: string; placeholder: string; type: 'text' | 'textarea' | 'url'; mapCategory?: string };

// ============================================================
// Topic templates per industry — defines what knowledge to collect
// ============================================================
const TOPIC_TEMPLATES: Record<string, { label: string; icon: string; topics: { value: string; label: string; description: string; fields: { key: string; label: string; placeholder: string; type: 'text' | 'textarea' | 'url'; mapCategory?: string }[] }[] }> = {
  Hotel: {
    label: 'Hotel', icon: '🏨',
    topics: [
      {
        value: 'nearby_food', label: 'Rekomendasi Makanan Sekitar', description: 'AI akan merekomendasikan tempat makan di sekitar hotel',
        fields: [
          { key: 'restaurant_list', label: 'Daftar Restoran/Warung Terdekat', placeholder: 'Contoh:\n1. Warung Nasi Padang Sari Bundo — 200m, Halal, Rp15.000-30.000\n2. Restoran Korea Kimchi House — 500m, Non-Halal, Rp50.000-100.000\n3. Kedai Kopi Lokal — 100m, Rp10.000-25.000', type: 'textarea', mapCategory: 'food' },
          { key: 'hotel_restaurant', label: 'Restaurant di Hotel', placeholder: 'Contoh: Sky Lounge Rooftop — Buka 07:00-22:00, Menu buffet Rp150.000/orang', type: 'textarea' },
        ]
      },
      {
        value: 'nearby_attractions', label: 'Tempat Wisata Sekitar', description: 'AI akan merekomendasikan objek wisata dan hiburan sekitar',
        fields: [
          { key: 'attractions', label: 'Daftar Tempat Wisata', placeholder: 'Contoh:\n1. Pantai Kuta — 2km, tiket gratis, buka 24 jam\n2. Museum Seni — 500m, tiket Rp25.000, buka 09:00-17:00', type: 'textarea', mapCategory: 'attraction' },
          { key: 'transport', label: 'Transportasi yang Tersedia', placeholder: 'Contoh: Grab/Gojek, shuttle hotel gratis ke mall, rental motor Rp75.000/hari', type: 'textarea' },
        ]
      },
      {
        value: 'room_service', label: 'Room Service & Fasilitas', description: 'AI akan menjawab pertanyaan tentang kamar dan fasilitas hotel',
        fields: [
          { key: 'room_types', label: 'Tipe Kamar & Harga', placeholder: 'Contoh:\n- Standard Room: Rp500.000/malam, 1 King Bed, WiFi, AC\n- Deluxe: Rp800.000/malam, 1 King Bed, Balcony, Minibar\n- Suite: Rp1.500.000/malam, Living Room, Jacuzzi', type: 'textarea' },
          { key: 'facilities', label: 'Fasilitas Hotel', placeholder: 'Contoh: Swimming Pool (07:00-21:00), Gym (24 jam), Spa (10:00-20:00), Laundry', type: 'textarea' },
          { key: 'checkin', label: 'Waktu Check-in/Check-out', placeholder: 'Check-in: 14:00, Check-out: 12:00, Early check-in tersedia dengan biaya tambahan', type: 'text' },
        ]
      },
      {
        value: 'concierge', label: 'Concierge Umum', description: 'AI menjawab segala pertanyaan tamu tentang hotel',
        fields: [
          { key: 'faq', label: 'FAQ / Pertanyaan Umum', placeholder: 'Contoh:\nQ: Apakah ada WiFi gratis?\nA: Ya, WiFi gratis tersedia di seluruh area hotel. Password: WELCOME2024\n\nQ: Bagaimana cara ke airport?\nA: Hotel menyediakan shuttle airport (Rp100.000/orang), pesan 4 jam sebelumnya', type: 'textarea' },
          { key: 'policies', label: 'Kebijakan Hotel', placeholder: 'Contoh: No smoking policy, Pet friendly (Rp200.000 extra), Pembatalan gratis H-1', type: 'textarea' },
        ]
      },
      {
        value: 'custom', label: 'Topik Kustom', description: 'Buat topik agent sesuai kebutuhan Anda',
        fields: [
          { key: 'custom_knowledge', label: 'Knowledge Data', placeholder: 'Masukkan informasi yang relevan dengan topik agen ini...', type: 'textarea' },
        ]
      }
    ]
  },
  Retail: {
    label: 'Retail', icon: '🛒',
    topics: [
      {
        value: 'product_catalog', label: 'Katalog Produk', description: 'AI menjawab pertanyaan tentang produk yang tersedia',
        fields: [
          { key: 'products', label: 'Daftar Produk', placeholder: 'Contoh:\n1. iPhone 15 Pro Max — Rp22.999.000, Unit Apple, Garansi 1 tahun\n2. Samsung S24 Ultra — Rp19.999.000, Garansi resmi', type: 'textarea' },
          { key: 'categories', label: 'Kategori Produk', placeholder: 'Contoh: Smartphone, Laptop, Aksesoris, Smartwatch', type: 'text' },
          { key: 'promos', label: 'Promo & Diskon Aktif', placeholder: 'Contoh: Diskon 20% untuk semua aksesoris, Cicilan 0% 12 bulan via BCA', type: 'textarea' },
        ]
      },
      {
        value: 'store_info', label: 'Info Toko & Pengiriman', description: 'AI menjawab tentang lokasi toko, jam buka, dan pengiriman',
        fields: [
          { key: 'branches', label: 'Cabang / Lokasi Toko', placeholder: 'Contoh:\n1. Cabang Sudirman — Jl. Sudirman No.12, buka 10:00-22:00\n2. Cabang Mall Grand — Lt.2 Unit 201, buka 10:00-21:30', type: 'textarea' },
          { key: 'shipping', label: 'Info Pengiriman', placeholder: 'Contoh: JNE, J&T, SiCepat, Same-day delivery via GoSend', type: 'text' },
          { key: 'return_policy', label: 'Kebijakan Pengembalian', placeholder: 'Contoh: Pengembalian dalam 7 hari, produk belum dibuka, sertakan nota', type: 'textarea' },
        ]
      },
      {
        value: 'custom', label: 'Topik Kustom', description: 'Buat topik agent sesuai kebutuhan',
        fields: [
          { key: 'custom_knowledge', label: 'Knowledge Data', placeholder: 'Masukkan informasi yang relevan...', type: 'textarea' },
        ]
      }
    ]
  },
  Restaurant: {
    label: 'Restaurant', icon: '🍽️',
    topics: [
      {
        value: 'menu', label: 'Menu & Rekomendasi', description: 'AI membantu pelanggan memilih menu',
        fields: [
          { key: 'menu_items', label: 'Daftar Menu', placeholder: 'Contoh:\nAPPETIZER:\n- Sate Lilit Bali — Rp35.000, Pedas ringan\n- Salad Caesar — Rp28.000, Vegetarian\n\nMAIN COURSE:\n- Nasi Goreng Seafood — Rp55.000\n- Steak Wagyu 200gr — Rp250.000', type: 'textarea' },
          { key: 'specialties', label: 'Menu Andalan / Chef Recommendation', placeholder: 'Contoh: Bebek Goreng Bumbu Bali (best seller), Paket Rijsttafel untuk 4 orang', type: 'textarea' },
          { key: 'dietary', label: 'Opsi Diet / Alergi', placeholder: 'Tersedia: Vegetarian, Vegan, Gluten-free, Halal certified', type: 'text' },
        ]
      },
      {
        value: 'reservation', label: 'Reservasi & Info', description: 'AI membantu reservasi dan info restoran',
        fields: [
          { key: 'booking_info', label: 'Info Reservasi', placeholder: 'Contoh: Reservasi via WhatsApp 081234567890, minimal 2 jam sebelumnya, deposit Rp100.000 untuk grup >6 orang', type: 'textarea' },
          { key: 'operating_hours', label: 'Jam Operasional', placeholder: 'Contoh: Senin-Kamis 11:00-22:00, Jumat-Minggu 11:00-23:00, Happy Hour 15:00-18:00', type: 'text' },
          { key: 'capacity', label: 'Kapasitas & Area', placeholder: 'Contoh: Indoor 50 pax, Outdoor Garden 30 pax, Private Room 12 pax', type: 'text' },
        ]
      },
      {
        value: 'custom', label: 'Topik Kustom', description: 'Buat topik sesuai kebutuhan',
        fields: [
          { key: 'custom_knowledge', label: 'Knowledge Data', placeholder: 'Masukkan informasi yang relevan...', type: 'textarea' },
        ]
      }
    ]
  },
  'Real Estate': {
    label: 'Real Estate', icon: '🏠',
    topics: [
      {
        value: 'property_listing', label: 'Listing Properti', description: 'AI membantu calon pembeli/penyewa menemukan properti',
        fields: [
          { key: 'properties', label: 'Daftar Properti', placeholder: 'Contoh:\n1. Rumah Bintaro Sektor 9 — Rp2.5M, 3KT/2KM, LT150/LB120, SHM\n2. Apartemen Sudirman Park — Rp8jt/bulan, Studio 28m², Full Furnished', type: 'textarea' },
          { key: 'facilities_area', label: 'Fasilitas Area / Lingkungan', placeholder: 'Contoh: Dekat sekolah internasional, RS Pondok Indah 2km, akses tol langsung', type: 'textarea' },
        ]
      },
      {
        value: 'consultation', label: 'Konsultasi Properti', description: 'AI membantu konsultasi KPR, investasi, dll',
        fields: [
          { key: 'kpr_info', label: 'Info KPR & Pembayaran', placeholder: 'Contoh: Kerjasama KPR dengan BCA, Mandiri, BTN. DP mulai 10%, tenor 20 tahun', type: 'textarea' },
          { key: 'faq', label: 'FAQ Properti', placeholder: 'Q: Dokumen apa saja yang diperlukan?\nA: KTP, NPWP, Slip gaji 3 bulan terakhir, Rekening koran', type: 'textarea' },
        ]
      },
      {
        value: 'custom', label: 'Topik Kustom', description: 'Buat topik sesuai kebutuhan',
        fields: [
          { key: 'custom_knowledge', label: 'Knowledge Data', placeholder: 'Masukkan informasi yang relevan...', type: 'textarea' },
        ]
      }
    ]
  },
  General: {
    label: 'General', icon: '⚡',
    topics: [
      {
        value: 'customer_service', label: 'Customer Service', description: 'AI menjawab pertanyaan umum pelanggan',
        fields: [
          { key: 'faq', label: 'FAQ / Pertanyaan Umum', placeholder: 'Masukkan pertanyaan dan jawaban yang sering ditanyakan...', type: 'textarea' },
          { key: 'contact_info', label: 'Info Kontak', placeholder: 'Contoh: WhatsApp 081234567890, Email support@company.com', type: 'text' },
        ]
      },
      {
        value: 'custom', label: 'Topik Kustom', description: 'Buat agent kustom sesuai kebutuhan',
        fields: [
          { key: 'custom_knowledge', label: 'Knowledge Data', placeholder: 'Masukkan informasi yang relevan dengan kebutuhan agen...', type: 'textarea' },
        ]
      }
    ]
  }
};

const LANGUAGES = [
  { code: 'Indonesian', label: '🇮🇩 Bahasa Indonesia' },
  { code: 'English', label: '🇺🇸 English' },
  { code: 'Malay', label: '🇲🇾 Bahasa Melayu' },
  { code: 'Thai', label: '🇹🇭 ภาษาไทย' },
  { code: 'Vietnamese', label: '🇻🇳 Tiếng Việt' },
  { code: 'Japanese', label: '🇯🇵 日本語' },
  { code: 'Korean', label: '🇰🇷 한국어' },
  { code: 'Chinese', label: '🇨🇳 中文' },
  { code: 'Spanish', label: '🇪🇸 Español' },
  { code: 'French', label: '🇫🇷 Français' },
  { code: 'German', label: '🇩🇪 Deutsch' },
  { code: 'Arabic', label: '🇸🇦 العربية' },
  { code: 'Hindi', label: '🇮🇳 हिन्दी' },
  { code: 'Portuguese', label: '🇧🇷 Português' },
];

type PlaceResult = {
  name: string;
  type: string;
  cuisine: string;
  address: string;
  phone: string;
  website: string;
  opening_hours: string;
  lat: number;
  lon: number;
  distance_km: number;
  maps_url: string;
};

export default function AgentForm({ editId, onBack }: { editId?: string | null; onBack: () => void }) {
  const { admin } = useStore();
  const { t, language } = useTranslation();
  const industry = admin?.industry || 'General';

  const [agentConfig, setAgentConfig] = useState({
    id: '',
    name: '',
    role: 'Assistant',
    tone: 'Professional',
    language: 'Indonesian',
    voice_type: 'female',
    instructions: '',
    goal: '',
    industry: industry,
    topic: '',
    is_active: 1,
  });

  const [knowledgeData, setKnowledgeData] = useState<Record<string, string>>({});
  const [topicFiles, setTopicFiles] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editId);
  const [step, setStep] = useState<1 | 2 | 3>(editId ? 3 : 1); // Start at 3 for edit mode

  // AI dynamic topic state
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [aiGeneratedFields, setAiGeneratedFields] = useState<TopicField[]>([]);
  const [isGeneratingFields, setIsGeneratingFields] = useState(false);
  const [customTopicLabel, setCustomTopicLabel] = useState('');
  const [generalInfo, setGeneralInfo] = useState<any>(null);
  const [generalKnowledgeCount, setGeneralKnowledgeCount] = useState(0);

  // Maps state
  const [mapPlaces, setMapPlaces] = useState<PlaceResult[]>([]);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showMap, setShowMap] = useState<string | null>(null); // field key that has map open

  // Multi-source knowledge input state (Step 2)
  const [topicSources, setTopicSources] = useState<any[]>([]);
  const [knowledgeTab, setKnowledgeTab] = useState<'text' | 'files' | 'urls'>('text');
  const [topicTextName, setTopicTextName] = useState('');
  const [topicTextContent, setTopicTextContent] = useState('');
  const [topicUrlInput, setTopicUrlInput] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  // Dropzone for topic knowledge files
  const onDropTopicFile = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = btoa(new Uint8Array(reader.result as ArrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), ''));
        setTopicFiles(prev => [...prev, { name: file.name, content: base64, mimeType: file.type }]);
        toast.success(t('agents.form.itemAdded', { name: file.name }));
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const { getRootProps: getTopicDropProps, getInputProps: getTopicInputProps, isDragActive: isTopicDragActive } = useDropzone({ onDrop: onDropTopicFile });

  const templateIndustry = TOPIC_TEMPLATES[industry] ? industry : 'General';
  const templates = TOPIC_TEMPLATES[templateIndustry];
  const presetTopic = templates.topics.find(t => t.value === agentConfig.topic);
  
  // Re-map preset topic with translations
  const selectedTopic = presetTopic ? {
    ...presetTopic,
    label: t(`agents.templates.${templateIndustry}.${agentConfig.topic}.label` as any),
    description: t(`agents.templates.${templateIndustry}.${agentConfig.topic}.description` as any),
    fields: presetTopic.fields.map(f => ({
      ...f,
      label: t(`agents.templates.${templateIndustry}.${agentConfig.topic}.fields.${f.key}.label` as any),
      placeholder: t(`agents.templates.${templateIndustry}.${agentConfig.topic}.fields.${f.key}.placeholder` as any)
    }))
  } : (agentConfig.topic === '__ai_custom__' && aiGeneratedFields.length > 0 ? { value: '__ai_custom__', label: customTopicLabel, description: t('agents.form.profileDesc'), fields: aiGeneratedFields } : null);
  const selectedTopicFields: TopicField[] = selectedTopic?.fields || [];

  // Load general info + general knowledge count
  useEffect(() => {
    fetch('/api/general-info', { cache: 'no-store' }).then(r => r.json()).then(data => {
      // Handle NextResponse JSON wrapper if data.info exists
      const parsedInfo = typeof data.info === 'string' ? JSON.parse(data.info) : data.info;
      setGeneralInfo(parsedInfo || {});
    }).catch(e => console.error(e));

    fetch('/api/general-knowledge', { cache: 'no-store' }).then(r => r.json()).then(data => {
      setGeneralKnowledgeCount(data.sources?.length || 0);
    }).catch(e => console.error(e));
  }, []);

  // Load existing agent data
  useEffect(() => {
    if (editId) {
      fetch('/api/agents').then(r => r.json()).then(data => {
        const agent = data.agents?.find((a: any) => a.id === editId);
        if (agent) {
          setAgentConfig(agent);
          fetch(`/api/knowledge?agentId=${editId}`).then(r => r.json()).then(kData => {
            const existingData: Record<string, string> = {};
            const existingSources: any[] = [];
            (kData.sources || []).forEach((s: any) => {
              // Field-based text knowledge → goes into knowledgeData form fields
              if (s.type === 'text' && !s.name.startsWith('__manual__')) {
                existingData[s.name] = s.content;
              }
              // File, URL, or manual text sources → goes into topicSources list
              if (s.type === 'file' || s.type === 'url' || s.name.startsWith('__manual__')) {
                existingSources.push(s);
              }
            });
            setKnowledgeData(existingData);
            setTopicSources(existingSources);

            // Rehydrate custom AI fields if we are editing an AI topic
            if (agent.topic === '__ai_custom__') {
              setCustomTopicLabel(agent.name || 'Topik Kustom AI');
              const customKeys = Object.keys(existingData).filter(k => k !== 'general_info' && k !== 'topic_files');
              const reconstructedFields = customKeys.map(k => ({
                key: k,
                label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                placeholder: '...',
                type: 'textarea' as 'textarea' | 'text' | 'url'
              }));
              setAiGeneratedFields(reconstructedFields);
            }
          });
        }
        setIsLoading(false);
      });
    }
  }, [editId]);

  // Search nearby places via Overpass API
  const handleSearchPlaces = async (fieldKey: string, category: string) => {
    if (!generalInfo?.address && !generalInfo?.city) {
      toast.error(t('agents.form.addressNotSet'));
      return;
    }

    setIsSearchingPlaces(true);
    setShowMap(fieldKey);

    try {
      const businessName = generalInfo.business_name || '';
      const address = generalInfo.address || '';
      const city = generalInfo.city || '';
      const lat = generalInfo.extra_data?.lat;
      const lon = generalInfo.extra_data?.lon;

      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName, address, city, category, radius: 1500, lat, lon }),
      });
      const data = await res.json();

      if (data.places && data.places.length > 0) {
        setMapPlaces(data.places);
        setMapCoords(data.coords);

        // Auto-populate field with scraped data
        const placesText = data.places.map((p: PlaceResult, i: number) => {
          let line = `${i + 1}. ${p.name}`;
          if (p.distance_km) line += ` — ${p.distance_km < 1 ? `${Math.round(p.distance_km * 1000)}m` : `${p.distance_km}km`}`;
          if (p.cuisine) line += `, ${p.cuisine}`;
          if (p.opening_hours) line += `, Buka: ${p.opening_hours}`;
          if (p.phone) line += `, Tel: ${p.phone}`;
          line += `\n   📍 ${p.maps_url}`;
          return line;
        }).join('\n');

        setKnowledgeData(prev => ({ ...prev, [fieldKey]: placesText }));
        toast.success(t('agents.form.mapSearchSuccess', { count: data.places.length }));
      } else {
        toast.error(t('agents.form.mapSearchError'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('agents.form.mapSearchError'));
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // AI generate knowledge fields from custom topic (via Groq server endpoint)
  const handleGenerateTopicFields = async () => {
    if (!customTopicInput.trim()) { toast.error(t('agents.form.customTopicPlaceholder')); return; }
    setIsGeneratingFields(true);
    try {
      const prompt = `You are helping set up an AI chatbot agent for a ${industry} business.
The admin wants to create an agent about: "${customTopicInput}"
Business: ${generalInfo?.business_name || 'N/A'}, ${generalInfo?.city || 'N/A'}

Generate 2-5 relevant knowledge data fields that the admin should fill in for this topic.
Each field should have:
- key: snake_case unique identifier
- label: Human readable label in Indonesian
- placeholder: Example content in Indonesian showing what to fill (multiline for textarea)
- type: "text" for short data, "textarea" for long data
- topicLabel: a clean label for this overall topic in Indonesian

Return JSON: {"topicLabel": "string", "fields": [{"key": "string", "label": "string", "placeholder": "string", "type": "string"}]}`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const result = JSON.parse(data.text || '{}');
      if (result.fields && result.fields.length > 0) {
        setAiGeneratedFields(result.fields.map((f: any) => ({ ...f, type: f.type === 'textarea' ? 'textarea' : 'text' })));
        setCustomTopicLabel(result.topicLabel || customTopicInput);
        setAgentConfig(prev => ({ ...prev, topic: '__ai_custom__' }));
        setKnowledgeData({});
        toast.success(t('agents.form.generateSuccess', { count: result.fields.length }));
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('agents.form.generateError'));
    } finally {
      setIsGeneratingFields(false);
    }
  };

  // AI generate instructions + knowledge suggestions (via Groq server endpoint)
  const handleAIGenerate = async () => {
    if (!selectedTopic) return;

    setIsGenerating(true);

    try {
      let prompt = `You are helping set up an AI chatbot agent for a ${industry} business.\n`;
      prompt += `Business Name: ${generalInfo?.business_name || 'N/A'}\n`;
      prompt += `Address: ${generalInfo?.address || 'N/A'}, ${generalInfo?.city || 'N/A'}\n`;
      prompt += `Topic: ${selectedTopic.label}\n`;
      prompt += `Description: ${selectedTopic.description}\n\n`;
      const currentLang = language === 'id' ? 'Indonesian' : 'English';

      prompt += `Based on the topic and business info, generate:\n`;
      prompt += `1. A perfect "name" for this agent (e.g., "Rina" for food guide, "Budi" for concierge)\n`;
      prompt += `2. A fitting "role" description. YOU MUST PICK EXACTLY ONE FROM THIS LIST: ["Customer Service", "Assistant", "Sales", "Consultant", "Receptionist", "Concierge", "Expert", "Teacher", "Friend", "Other"]\n`;
      prompt += `3. An appropriate "tone". YOU MUST PICK EXACTLY ONE FROM THIS LIST: ["Professional", "Friendly", "Formal", "Casual", "Enthusiastic", "Empathetic", "Humorous", "Persuasive"]\n`;
      prompt += `4. A clear "goal" for the agent. Write in ${currentLang}.\n`;
      prompt += `5. Detailed "instructions" (system prompt) telling the AI exactly how to behave, what to answer, and what NOT to do. Write in ${currentLang}.\n`;

      const filledFields = Object.entries(knowledgeData).filter(([, v]) => v.trim());
      if (filledFields.length > 0) {
        prompt += `\nThe admin has filled in the following knowledge data:\n`;
        for (const [key, value] of filledFields) {
          prompt += `${key}: ${value}\n`;
        }
        prompt += `\nIncorporate this knowledge into the instructions.\n`;
      }

      prompt += `\nReturn JSON: {"name": "string", "role": "string", "tone": "string", "goal": "string", "instructions": "string"}`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const result = JSON.parse(data.text || '{}');
      if (result.name) {
        setAgentConfig(prev => ({ ...prev, ...result }));
        toast.success(t('agents.form.aiGenerateSuccess'));
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('quota') || err.message?.includes('429')) {
        toast.error(t('agents.form.aiQuotaError'), { duration: 5000 });
      } else {
        toast.error(t('agents.form.aiError', { message: err.message || t('common.error') }));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!agentConfig.name) { toast.error('Nama agent harus diisi'); return; }
    setIsSaving(true);

    try {
      let agentId = editId;

      if (editId) {
        const res = await fetch('/api/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...agentConfig, id: editId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update agent');
        }
      } else {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentConfig),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create agent');
        }
        const data = await res.json();
        agentId = data.agent?.id;
      }

      // Save knowledge data as text sources
      if (agentId) {
        // Delete old FIELD-BASED text sources (not manual ones) to refresh
        const existing = await fetch(`/api/knowledge?agentId=${agentId}`).then(r => r.json());
        for (const source of (existing.sources || []).filter((s: any) => s.type === 'text' && !s.name.startsWith('__manual__'))) {
          await fetch(`/api/knowledge?id=${source.id}`, { method: 'DELETE' });
        }

        // Save each field as a knowledge source
        for (const [key, value] of Object.entries(knowledgeData)) {
          if (value.trim()) {
            await fetch('/api/knowledge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentId, type: 'text', name: key, content: value }),
            });
          }
        }

        // For new agents: save pending topic files that haven't been saved yet
        for (const file of topicFiles) {
          await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, type: 'file', name: file.name, content: file.content, mimeType: file.mimeType }),
          });
        }

        // For new agents: save pending additional sources (text/url added via tabs)
        for (const source of topicSources.filter(s => !s.id)) {
          await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, type: source.type, name: source.name, content: source.content, mimeType: source.mime_type || 'text/plain' }),
          });
        }
      }

      toast.success(t('agents.form.saveSuccess'));
      onBack();
    } catch (e) {
      toast.error(t('agents.form.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
              {editId ? t('agents.form.editTitle') : t('agents.form.createTitle')}
            </h1>
            <p className="text-gray-500 mt-1">
              {step === 1 && t('agents.form.step1')}
              {step === 2 && t('agents.form.step2')}
              {step === 3 && t('agents.form.step3')}
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      {!editId && (
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: t('agents.form.step1') },
            { n: 2, label: t('agents.form.step2') },
            { n: 3, label: t('agents.form.step3') },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <button
                onClick={() => { if (s.n < step || (s.n === 2 && agentConfig.topic)) setStep(s.n as 1 | 2 | 3); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${step === s.n ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : step > s.n ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                  }`}
              >
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">{s.n}</span>}
                {s.label}
              </button>
              {i < 2 && <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />}
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: Choose Topic */}
      {/* ============================================================ */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="rounded-2xl border-blue-100 bg-blue-50/50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm">{t('agents.form.topicHintTitle')}</p>
                  <p className="text-sm text-blue-700 mt-1">{t('agents.form.topicHintDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.topics.map((topic) => (
              <button
                key={topic.value}
                onClick={() => {
                  setAiGeneratedFields([]);
                  setAgentConfig(prev => ({ ...prev, topic: topic.value, name: '', instructions: '', goal: '' }));
                  setKnowledgeData({});
                  setStep(2);
                }}
                className={`rounded-2xl border-2 p-6 text-left transition-all hover:shadow-lg hover:border-blue-300 hover:scale-[1.02] ${agentConfig.topic === topic.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'
                  }`}
              >
                <h3 className="font-semibold text-gray-900 mb-1">{t(`agents.templates.${templateIndustry}.${topic.value}.label` as any)}</h3>
                <p className="text-sm text-gray-500">{t(`agents.templates.${templateIndustry}.${topic.value}.description` as any)}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <BookOpen className="w-3 h-3" />
                  {t('agents.form.itemAdded', { name: topic.fields.length.toString() })} {/* Using itemAdded as a general count indicator or similar */}
                </div>
              </button>
            ))}
          </div>

          {/* Custom AI Topic */}
          <Card className="rounded-2xl border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-purple-900 text-sm">{t('agents.form.customTopicTitle')}</p>
                  <p className="text-sm text-purple-700 mt-0.5">{t('agents.form.customTopicDesc')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-purple-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 bg-white"
                  placeholder={t('agents.form.customTopicPlaceholder')}
                  value={customTopicInput}
                  onChange={(e) => setCustomTopicInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateTopicFields(); }}
                />
                <Button
                  onClick={handleGenerateTopicFields}
                  disabled={isGeneratingFields || !customTopicInput.trim()}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl shrink-0"
                >
                  {isGeneratingFields ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isGeneratingFields ? t('agents.form.generating') : t('agents.form.generateFieldsBtn')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Fill Knowledge Data (Guided) + Upload + Maps */}
      {/* ============================================================ */}
      {step === 2 && selectedTopicFields.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* General Knowledge Banner */}
          <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">{t('agents.form.generalKnowledgeTitle')}</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {t('agents.form.generalKnowledgeDesc', { count: generalKnowledgeCount.toString() })}
                    {generalInfo?.business_name && (
                      <span className="flex items-center gap-1 mt-1 text-emerald-600">
                        <MapPin className="w-3 h-3" /> {generalInfo.business_name} — {generalInfo.address}, {generalInfo.city}
                      </span>
                    )}
                  </p>
                  <Link href="/knowledge" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2 inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {t('agents.form.manageGeneralKnowledge')}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Multi-Source Knowledge Input (Text / File / URL) ── */}
          <Card className="rounded-2xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="w-5 h-5 text-indigo-600" />
                {t('agents.form.addSourceTitle')}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">{t('agents.form.addSourceDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 rounded-xl p-1">
                {([
                  { key: 'text' as const, label: `📝 ${t('agents.form.tabText')}` },
                  { key: 'files' as const, label: `📁 ${t('agents.form.tabFile')}` },
                  { key: 'urls' as const, label: `🔗 ${t('agents.form.tabUrl')}` },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setKnowledgeTab(tab.key)}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${knowledgeTab === tab.key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Paste Text */}
              {knowledgeTab === 'text' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('agents.form.manualTextLabel')}</label>
                    <input type="text" placeholder={t('agents.form.manualTextPlaceholder')}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      value={topicTextName} onChange={(e) => setTopicTextName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('agents.form.manualContentLabel')}</label>
                    <textarea placeholder={t('agents.form.manualContentPlaceholder')}
                      className="w-full h-40 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      value={topicTextContent} onChange={(e) => setTopicTextContent(e.target.value)} />
                  </div>
                  <Button onClick={() => {
                    if (!topicTextContent.trim()) return;
                    const name = topicTextName.trim() || `__manual__Catatan ${new Date().toLocaleDateString('id-ID')}`;
                    const prefixedName = name.startsWith('__manual__') ? name : `__manual__${name}`;
                    if (editId) {
                      // Save directly via API for existing agents
                      fetch('/api/knowledge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agentId: editId, type: 'text', name: prefixedName, content: topicTextContent }),
                      }).then(r => r.json()).then(data => {
                        if (data.success) {
                          setTopicSources(prev => [...prev, { id: data.id, type: 'text', name: prefixedName, content: topicTextContent }]);
                          toast.success(t('agents.form.sourceAdded'));
                        }
                      });
                    } else {
                      // Queue for save later (new agent)
                      setTopicSources(prev => [...prev, { type: 'text', name: prefixedName, content: topicTextContent }]);
                      toast.success(t('agents.form.sourceAdded'));
                    }
                    setTopicTextName('');
                    setTopicTextContent('');
                  }} disabled={!topicTextContent.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> {t('agents.form.addTextBtn')}
                  </Button>
                </motion.div>
              )}

              {/* Tab: File Upload */}
              {knowledgeTab === 'files' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div {...getTopicDropProps()} className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isTopicDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input {...getTopicInputProps()} />
                    <Upload className="mx-auto h-8 w-8 text-indigo-500 mb-3" />
                    <p className="text-sm font-medium text-gray-900">{t('agents.form.uploadTitle')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('agents.form.uploadLimit')}</p>
                  </div>
                  {topicFiles.length > 0 && (
                    <div className="space-y-2">
                      {topicFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-medium text-gray-700">{file.name}</span>
                          </div>
                          <button onClick={() => setTopicFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Tab: URL Scraping */}
              {knowledgeTab === 'urls' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-sm text-gray-500">{t('agents.form.urlScrapeDesc')}</p>
                  <div className="flex gap-2">
                    <input type="url" placeholder={t('agents.form.urlPlaceholder')}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      value={topicUrlInput} onChange={(e) => setTopicUrlInput(e.target.value)} />
                    <Button onClick={async () => {
                      if (!topicUrlInput.trim()) return;
                      setIsAddingUrl(true);
                      const loadingToast = toast.loading(t('agents.form.urlScraping'));
                      try {
                        if (editId) {
                          // Save directly via API for existing agents
                          const res = await fetch('/api/knowledge', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ agentId: editId, type: 'url', name: topicUrlInput, content: topicUrlInput }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setTopicSources(prev => [...prev, { id: data.id, type: 'url', name: data.name || topicUrlInput, content: topicUrlInput }]);
                            toast.success(t('agents.form.urlScraped'), { id: loadingToast });
                          } else {
                            toast.error(data.error || t('agents.form.urlScrapeError'), { id: loadingToast });
                          }
                        } else {
                          // For new agents, scrape via general-knowledge to get content, then queue
                          toast.info(t('agents.form.urlQueued'), { id: loadingToast });
                          setTopicSources(prev => [...prev, { type: 'url', name: topicUrlInput, content: topicUrlInput }]);
                        }
                      } catch (err: any) {
                        toast.error(err.message || t('agents.form.urlScrapeError'), { id: loadingToast });
                      } finally {
                        setIsAddingUrl(false);
                        setTopicUrlInput('');
                      }
                    }} disabled={!topicUrlInput.trim() || isAddingUrl}
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl">
                      {isAddingUrl ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      {isAddingUrl ? t('agents.form.urlProcessing') : t('agents.form.addUrlBtn')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* ── Saved Sources List ── */}
          {topicSources.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                    {t('agents.form.savedSourcesTitle')}
                  </span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {topicSources.length} {t('agents.form.savedSourcesCount')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topicSources.map((source, i) => (
                    <div key={source.id || i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {source.type === 'url' ? <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          : source.type === 'file' ? <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          : <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                        <div className="overflow-hidden">
                          <span className="text-sm font-medium text-gray-700 truncate block">
                            {source.name?.replace(/^__manual__/, '')}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase">
                            {source.type} {source.content?.length ? `• ${source.content.length.toLocaleString()} chars` : ''}
                          </span>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if (source.id) {
                          await fetch(`/api/knowledge?id=${source.id}`, { method: 'DELETE' });
                        }
                        setTopicSources(prev => prev.filter((_, idx) => idx !== i));
                        toast.success(t('agents.form.sourceDeleted'));
                      }} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 justify-end">
            {editId ? (
              <Button variant="outline" onClick={() => toast.error(t('agents.form.topicNoChange'))} className="rounded-xl opacity-50 cursor-not-allowed">← {t('agents.form.backToTopicSelection')}</Button>
            ) : (
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">← {t('agents.form.backToTopicSelection')}</Button>
            )}
            <Button onClick={() => setStep(3)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl">
              {t('agents.form.nextToConfig')} →
            </Button>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: Agent Configuration */}
      {/* ============================================================ */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* AI Generate Button */}
          <Card className="rounded-2xl border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Wand2 className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-purple-900 text-sm">{t('agents.form.aiAutoGenerateTitle')}</p>
                    <p className="text-sm text-purple-700 mt-0.5">{t('agents.form.aiAutoGenerateDesc')}</p>
                  </div>
                </div>
                <Button onClick={handleAIGenerate} disabled={isGenerating}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl shrink-0">
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isGenerating ? t('agents.form.generating') : t('agents.form.aiAutoGenerateBtn')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Core Identity */}
              <Card className="rounded-2xl">
                <CardHeader><CardTitle>{t('agents.form.identityTitle')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('agents.form.agentName')}</label>
                      <input type="text" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                        value={agentConfig.name} onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('agents.form.agentNamePlaceholder')} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('agents.form.agentRole')}</label>
                      <select className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white"
                        value={agentConfig.role} onChange={(e) => setAgentConfig(prev => ({ ...prev, role: e.target.value }))}
                      >
                        <option value="Customer Service">{t('agents.form.roles.Customer Service') !== 'agents.form.roles.Customer Service' ? t('agents.form.roles.Customer Service') : 'Customer Service'}</option>
                        <option value="Assistant">{t('agents.form.roles.Assistant') !== 'agents.form.roles.Assistant' ? t('agents.form.roles.Assistant') : 'Assistant / Asisten'}</option>
                        <option value="Sales">{t('agents.form.roles.Sales') !== 'agents.form.roles.Sales' ? t('agents.form.roles.Sales') : 'Sales / Marketing'}</option>
                        <option value="Consultant">{t('agents.form.roles.Consultant') !== 'agents.form.roles.Consultant' ? t('agents.form.roles.Consultant') : 'Consultant / Konsultan'}</option>
                        <option value="Receptionist">{t('agents.form.roles.Receptionist') !== 'agents.form.roles.Receptionist' ? t('agents.form.roles.Receptionist') : 'Receptionist / Resepsionis'}</option>
                        <option value="Concierge">{t('agents.form.roles.Concierge') !== 'agents.form.roles.Concierge' ? t('agents.form.roles.Concierge') : 'Concierge'}</option>
                        <option value="Expert">{t('agents.form.roles.Expert') !== 'agents.form.roles.Expert' ? t('agents.form.roles.Expert') : 'Expert / Ahli'}</option>
                        <option value="Teacher">{t('agents.form.roles.Teacher') !== 'agents.form.roles.Teacher' ? t('agents.form.roles.Teacher') : 'Teacher / Guru'}</option>
                        <option value="Friend">{t('agents.form.roles.Friend') !== 'agents.form.roles.Friend' ? t('agents.form.roles.Friend') : 'Friend / Teman'}</option>
                        <option value="Other">{t('agents.form.roles.Other') !== 'agents.form.roles.Other' ? t('agents.form.roles.Other') : 'Other / Lainnya'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('agents.form.agentTone')}</label>
                      <select className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white"
                        value={agentConfig.tone} onChange={(e) => setAgentConfig(prev => ({ ...prev, tone: e.target.value }))}
                      >
                        <option value="Professional">{t('agents.form.tones.Professional') !== 'agents.form.tones.Professional' ? t('agents.form.tones.Professional') : 'Professional / Profesional'}</option>
                        <option value="Friendly">{t('agents.form.tones.Friendly') !== 'agents.form.tones.Friendly' ? t('agents.form.tones.Friendly') : 'Friendly / Ramah'}</option>
                        <option value="Formal">{t('agents.form.tones.Formal') !== 'agents.form.tones.Formal' ? t('agents.form.tones.Formal') : 'Formal / Resmi'}</option>
                        <option value="Casual">{t('agents.form.tones.Casual') !== 'agents.form.tones.Casual' ? t('agents.form.tones.Casual') : 'Casual / Santai'}</option>
                        <option value="Enthusiastic">{t('agents.form.tones.Enthusiastic') !== 'agents.form.tones.Enthusiastic' ? t('agents.form.tones.Enthusiastic') : 'Enthusiastic / Antusias'}</option>
                        <option value="Empathetic">{t('agents.form.tones.Empathetic') !== 'agents.form.tones.Empathetic' ? t('agents.form.tones.Empathetic') : 'Empathetic / Penuh Empati'}</option>
                        <option value="Humorous">{t('agents.form.tones.Humorous') !== 'agents.form.tones.Humorous' ? t('agents.form.tones.Humorous') : 'Humorous / Humoris'}</option>
                        <option value="Persuasive">{t('agents.form.tones.Persuasive') !== 'agents.form.tones.Persuasive' ? t('agents.form.tones.Persuasive') : 'Persuasive / Persuasif'}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('agents.form.agentLanguage')}</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white"
                        value={agentConfig.language}
                        onChange={(e) => setAgentConfig(prev => ({ ...prev, language: e.target.value }))}
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('agents.form.agentGoal')}</label>
                    <input type="text" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      value={agentConfig.goal} onChange={(e) => setAgentConfig(prev => ({ ...prev, goal: e.target.value }))}
                      placeholder={t('agents.form.agentGoalPlaceholder')} />
                  </div>
                </CardContent>
              </Card>

              {/* System Instructions */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t('agents.form.systemInstructions')}
                    <span className="text-xs font-normal text-gray-500">{t('agents.form.instructionNote')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea className="w-full h-56 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 font-mono"
                    value={agentConfig.instructions} onChange={(e) => setAgentConfig(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder={t('agents.form.instructionPlaceholder')} />
                  <p className="text-xs text-gray-500 mt-2">{t('agents.form.instructionDesc')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0">
                <CardHeader><CardTitle className="text-white">{t('agents.form.previewPersona')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                      {(agentConfig.name || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{agentConfig.name || t('agents.form.unnamedAgent')}</p>
                      <p className="text-sm text-blue-100">{t(`agents.form.roles.${agentConfig.role}`) !== `agents.form.roles.${agentConfig.role}` ? t(`agents.form.roles.${agentConfig.role}`) : agentConfig.role}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5 pt-3 border-t border-white/20 text-sm">
                    {[
                      [t('agents.form.previewTopic'), selectedTopic?.label || agentConfig.topic || '-'],
                      [t('agents.form.previewIndustry'), agentConfig.industry],
                      [t('agents.form.previewTone'), t(`agents.form.tones.${agentConfig.tone}`) !== `agents.form.tones.${agentConfig.tone}` ? t(`agents.form.tones.${agentConfig.tone}`) : agentConfig.tone],
                      [t('agents.form.previewLanguage'), LANGUAGES.find(l => l.code === agentConfig.language)?.label || agentConfig.language],
                      [t('agents.form.previewGoal'), agentConfig.goal || '-'],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <span className="text-[10px] text-blue-200 uppercase tracking-wider">{label}</span>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Knowledge summary */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" /> Data Knowledge
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* General knowledge count */}
                  <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-700">{t('agents.form.generalKnowledgeSummary', { count: generalKnowledgeCount.toString() })}</span>
                  </div>

                  {/* Topic knowledge fields */}
                  {selectedTopicFields.length > 0 ? selectedTopicFields.map(f => (
                    <div key={f.key} className="flex items-center gap-2 text-sm">
                      {knowledgeData[f.key]?.trim() ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                      <span className={knowledgeData[f.key]?.trim() ? 'text-gray-900' : 'text-gray-400'}>{f.label}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">{t('agents.form.step1')}</p>
                  )}

                  {/* Files count */}
                  {topicFiles.length > 0 && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-indigo-700">{t('agents.form.additionalFileSummary', { count: topicFiles.length.toString() })}</span>
                    </div>
                  )}

                  {step === 3 && (
                    <button onClick={() => setStep(2)} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 flex items-center gap-1">
                      ← {t('agents.form.editKnowledge')}
                    </button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">← {t('common.back')}</Button>
            <Button onClick={handleSave} disabled={isSaving}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl px-8">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('agents.form.saveBtn')}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
