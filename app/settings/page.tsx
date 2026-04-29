'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import { Save, Key, Building2, Globe, MapPin, Loader2, Phone, Mail, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsPage() {
  const { t, language } = useTranslation();
  const { admin } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState('informasi-umum');
  const [generalInfo, setGeneralInfo] = useState({
    business_name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    maps_link: '',
    description: '',
    extra_data: {} as Record<string, string>,
  });

  useEffect(() => {
    fetch('/api/general-info', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`Failed to fetch general-info: ${r.status} ${text.substring(0, 100)}`);
        }
        return r.json();
      })
      .then(data => {
        if (data && data.info) {
          let extraData = {};
          try { extraData = JSON.parse(data.info.extra_data || '{}'); } catch { }
          setGeneralInfo({ ...data.info, extra_data: extraData });
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sanitize URLs before saving
      const sanitized = {
        ...generalInfo,
        website: generalInfo.website?.trim() || '',
        maps_link: generalInfo.maps_link?.trim() || '',
        phone: generalInfo.phone?.trim() || '',
        email: generalInfo.email?.trim() || '',
        business_name: generalInfo.business_name?.trim() || '',
        city: generalInfo.city?.trim() || '',
      };
      // Auto-prepend https:// to website if missing
      if (sanitized.website && !sanitized.website.match(/^https?:\/\//i)) {
        sanitized.website = 'https://' + sanitized.website;
      }
      const res = await fetch('/api/general-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || t('settings.toasts.saveError'));
      }
      toast.success(t('settings.toasts.saveSuccess'));
    } catch (e: any) {
      toast.error(e.message || t('settings.toasts.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const setExtra = (key: string, value: string) => {
    setGeneralInfo(prev => ({
      ...prev,
      extra_data: { ...prev.extra_data, [key]: value },
    }));
  };

  const isEn = language === 'en';

  // Industry-specific extra fields
  const industryFields: Record<string, { key: string; label: string; placeholder: string }[]> = {
    Hotel: [
      { key: 'star_rating', label: isEn ? 'Star Rating' : 'Rating Bintang', placeholder: isEn ? 'E.g., 4 Stars' : 'Contoh: 4 Stars' },
      { key: 'total_rooms', label: isEn ? 'Total Rooms' : 'Jumlah Kamar', placeholder: isEn ? 'E.g., 120 rooms' : 'Contoh: 120 kamar' },
      { key: 'check_in_time', label: isEn ? 'Check-in Time' : 'Waktu Check-in', placeholder: isEn ? 'E.g., 14:00' : 'Contoh: 14:00' },
      { key: 'check_out_time', label: isEn ? 'Check-out Time' : 'Waktu Check-out', placeholder: isEn ? 'E.g., 12:00' : 'Contoh: 12:00' },
    ],
    Retail: [
      { key: 'store_type', label: isEn ? 'Store Type' : 'Tipe Toko', placeholder: isEn ? 'E.g., Electronics, Fashion, Grocery' : 'Contoh: Electronics, Fashion, Grocery' },
      { key: 'operating_hours', label: isEn ? 'Operating Hours' : 'Jam Operasional', placeholder: isEn ? 'E.g., 10:00-22:00 everyday' : 'Contoh: 10:00-22:00 setiap hari' },
      { key: 'payment', label: isEn ? 'Payment Methods' : 'Metode Pembayaran', placeholder: isEn ? 'E.g., Cash, Debit, Credit, QRIS' : 'Contoh: Cash, Debit, Kredit, QRIS, OVO, GoPay' },
    ],
    Restaurant: [
      { key: 'cuisine_type', label: isEn ? 'Cuisine Type' : 'Tipe Masakan', placeholder: isEn ? 'E.g., Indonesian, Japanese, Italian' : 'Contoh: Indonesian, Japanese, Italian' },
      { key: 'operating_hours', label: isEn ? 'Operating Hours' : 'Jam Operasional', placeholder: isEn ? 'E.g., 11:00-22:00' : 'Contoh: 11:00-22:00' },
      { key: 'halal_status', label: isEn ? 'Halal Status' : 'Status Halal', placeholder: isEn ? 'E.g., Halal Certified, Non-Halal, Mixed' : 'Contoh: Halal Certified, Non-Halal, Mixed' },
      { key: 'capacity', label: isEn ? 'Capacity' : 'Kapasitas', placeholder: isEn ? 'E.g., 80 seats indoor, 20 outdoor' : 'Contoh: 80 kursi indoor, 20 outdoor' },
    ],
    'Real Estate': [
      { key: 'property_types', label: isEn ? 'Property Types' : 'Tipe Properti', placeholder: isEn ? 'E.g., House, Apartment, Land' : 'Rumah, Apartemen, Ruko, Tanah' },
      { key: 'coverage_area', label: isEn ? 'Coverage Area' : 'Area Layanan', placeholder: isEn ? 'E.g., Jakarta, Bali, Surabaya' : 'Contoh: Jabodetabek, Bali, Surabaya' },
      { key: 'license', label: isEn ? 'License/Certification' : 'Lisensi/Sertifikasi', placeholder: isEn ? 'E.g., REI Member, AREBI Licensed' : 'Contoh: REI Member, AREBI Licensed' },
    ],
    General: [],
  };

  const extraFields = industryFields[admin?.industry || 'General'] || [];

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const handleScrapeMaps = async () => {
    if (!generalInfo.maps_link) {
      toast.error(t('settings.toasts.mapsEmpty'));
      return;
    }
    setScraping(true);
    const loadingToast = toast.loading(t('settings.toasts.extracting'));

    try {
      const res = await fetch('/api/scrape-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: generalInfo.maps_link })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || t('settings.toasts.extractError'));
      if (data.data) {
        setGeneralInfo(prev => ({
          ...prev,
          business_name: data.data.business_name || prev.business_name || '',
          address: data.data.address || prev.address || '',
          city: data.data.city || prev.city || '',
          extra_data: {
            ...prev.extra_data,
            lat: data.data.lat,
            lon: data.data.lon
          }
        }));
        const filled = [];
        if (data.data.business_name) filled.push('Nama Bisnis');
        if (data.data.address) filled.push('Alamat');
        if (data.data.city) filled.push(t('settings.business.city'));
        if (data.data.lat) filled.push('GPS');
        toast.success(t('settings.toasts.fillSuccess', { fields: filled.join(', ') }), { id: loadingToast });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t('settings.toasts.fillError'), { id: loadingToast });
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">{t('settings.title')}</h1>
        <p className="text-gray-500 mt-2">{t('settings.subtitle')}</p>
      </div>

      {/* General Business Info — THE KEY SECTION */}
      <Card className="rounded-2xl border-blue-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600" /> {t('settings.business.title')}</CardTitle>
          <p className="text-sm text-gray-500 mt-1">{t('settings.business.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {t('settings.business.name')}</label>
              <input type="text" maxLength={255} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.namePlaceholder')} value={generalInfo.business_name}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, business_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {t('settings.business.city')}</label>
              <input type="text" maxLength={255} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.cityPlaceholder')} value={generalInfo.city}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, city: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {t('settings.business.address')}</label>
            <textarea maxLength={1000} className="w-full h-20 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder={t('settings.business.addressPlaceholder')} value={generalInfo.address}
              onChange={(e) => setGeneralInfo(prev => ({ ...prev, address: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {t('settings.business.phone')}</label>
              <input type="tel" maxLength={20} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.phonePlaceholder')} value={generalInfo.phone}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {t('settings.business.email')}</label>
              <input type="email" maxLength={255} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.emailPlaceholder')} value={generalInfo.email}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, email: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" /> {t('settings.business.website')}</label>
              <input type="url" maxLength={2000} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.websitePlaceholder')} value={generalInfo.website}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, website: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {t('settings.business.mapsLink')}</span>
                {generalInfo.maps_link && (
                  <button
                    onClick={handleScrapeMaps}
                    disabled={scraping}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded border border-blue-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {scraping ? t('settings.business.extracting') : t('settings.business.autoFill')}
                  </button>
                )}
              </label>
              <input type="url" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder={t('settings.business.mapsPlaceholder')} value={generalInfo.maps_link}
                onChange={(e) => setGeneralInfo(prev => ({ ...prev, maps_link: e.target.value }))} />
              {generalInfo.extra_data?.lat && (
                <p className="text-xs text-green-600">{t('settings.business.gpsSaved')}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('settings.business.description')}</label>
            <textarea maxLength={2000} className="w-full h-24 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder={t('settings.business.descriptionPlaceholder')}
              value={generalInfo.description}
              onChange={(e) => setGeneralInfo(prev => ({ ...prev, description: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Industry-Specific Fields */}
      {extraFields.length > 0 && (
        <Card className="rounded-2xl border-indigo-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{admin?.industry || t('settings.industry.fallback')}</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{t('settings.industry.title')}</span>
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">{t('settings.industry.subtitle', { industry: admin?.industry || t('settings.industry.fallback') })}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {extraFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{field.label}</label>
                  <input type="text" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    placeholder={field.placeholder}
                    value={(generalInfo.extra_data as any)[field.key] || ''}
                    onChange={(e) => setExtra(field.key, e.target.value)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl px-8">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? t('settings.saving') : t('settings.saveBtn')}
        </Button>
      </div>
    </div>
  );
}
