'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, ChevronRight, Plus, CheckCircle, Clock, Trash2, ArrowLeft, Loader2, BookOpen, Link as LinkIcon, Settings, Target, EyeOff, LayoutTemplate, Copy, MonitorSmartphone, Smartphone, Shield, Sparkles, Globe, Eye, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/hooks/useTranslation';

export default function GeneralKnowledgePage() {
  const { admin } = useStore();
  const { t } = useTranslation();
  const [sources, setSources] = useState<any[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [textName, setTextName] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'urls' | 'text'>('text');
  const [loading, setLoading] = useState(true);

  // View/Edit modal state
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchSources = () => {
    fetch('/api/general-knowledge')
      .then(async (r) => {
        if (r.status === 401) {
          useStore.getState().logout();
          window.location.href = '/';
          return;
        }
        const data = await r.json();
        if (data.sources) setSources(data.sources);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchSources(); }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = btoa(new Uint8Array(reader.result as ArrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), ''));

        const res = await fetch('/api/general-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'file', name: file.name, content: base64, mimeType: file.type }),
        });
        if (res.ok) {
          toast.success(t('knowledge.uploadSuccess', { name: file.name }));
          fetchSources();
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleAddUrl = async () => {
    if (!urlInput) return;

    // Check if this URL was already scraped
    const existing = sources.find((s: any) => s.name === urlInput || s.name?.includes(urlInput));
    if (existing) {
      const confirmRescrape = window.confirm(t('knowledge.scrapedConfirm'));
      if (!confirmRescrape) return;
    }

    toast.warning(t('knowledge.urlScrapeWarning'), { duration: 5000 });

    const { scrapeUrl } = useStore.getState();
    scrapeUrl(urlInput);
    toast.info(t('knowledge.crawlStarted'), { duration: 6000 });
    setUrlInput('');
  };

  const handleAddText = async () => {
    if (!textInput) return;
    const res = await fetch('/api/general-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', name: textName || `Catatan ${new Date().toLocaleDateString('id-ID')}`, content: textInput }),
    });
    if (res.ok) {
      toast.success(t('knowledge.textSuccess'));
      setTextInput('');
      setTextName('');
      fetchSources();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/general-knowledge?id=${id}`, { method: 'DELETE' });
    setSources(prev => prev.filter(s => s.id !== id));
    toast.success(t('knowledge.deleteSuccess'));
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">📚 {t('knowledge.title')}</h1>
        <p className="text-gray-500 mt-2">{t('knowledge.subtitle')}</p>
      </motion.div>

      {/* Info Banner */}
      <Card className="rounded-2xl border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 text-sm">{t('knowledge.bannerTitle')}</p>
              <p className="text-sm text-blue-700 mt-1">{t('knowledge.bannerDesc')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {t('knowledge.uploadFile')}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {t('knowledge.addUrl')}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {t('knowledge.pasteText')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> {t('knowledge.addKnowledgeTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div className="flex space-x-1 mb-6 bg-gray-100 rounded-xl p-1">
                {([
                  { key: 'text' as const, label: `📝 ${t('knowledge.tabs.text')}`, icon: FileText },
                  { key: 'files' as const, label: `📁 ${t('knowledge.tabs.files')}`, icon: Upload },
                  { key: 'urls' as const, label: `🔗 ${t('knowledge.tabs.urls')}`, icon: LinkIcon },
                ]).map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === tab.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Text Input */}
              {activeTab === 'text' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('knowledge.textLabel')}</label>
                    <input type="text" placeholder={t('knowledge.textPlaceholder')}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      value={textName} onChange={(e) => setTextName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('knowledge.textContentLabel')}</label>
                    <textarea placeholder={t('knowledge.textContentPlaceholder')}
                      className="w-full h-52 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      value={textInput} onChange={(e) => setTextInput(e.target.value)} />
                  </div>
                  <Button onClick={handleAddText} disabled={!textInput.trim()}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> {t('knowledge.saveTextBtn')}
                  </Button>
                </motion.div>
              )}

              {/* File Upload */}
              {activeTab === 'files' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-8 w-8 text-blue-500 mb-3" />
                    <p className="text-sm font-medium text-gray-900">{t('knowledge.uploadTitle')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('knowledge.uploadLimit')}</p>
                  </div>
                </motion.div>
              )}

              {/* URL Input */}
              {activeTab === 'urls' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <p className="text-sm text-gray-500">{t('knowledge.urlDesc')}</p>
                  <div className="flex gap-2">
                    <input type="url" placeholder={t('knowledge.urlPlaceholder')}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
                    <Button onClick={handleAddUrl} disabled={!urlInput.trim() || isAddingUrl}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl">
                      {isAddingUrl ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      {isAddingUrl ? t('knowledge.urlProcessing') : t('knowledge.addBtn')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sources List */}
        <div className="lg:col-span-1">
          <Card className="h-full rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('knowledge.savedData')}</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{t('knowledge.savedCount', { count: sources.length.toString() })}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
                  <p className="text-sm text-gray-500">{t('knowledge.noData')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('knowledge.startAdding')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {sources.map((source) => (
                      <motion.div
                        key={source.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => { setSelectedSource(source); setIsEditing(false); setEditName(source.name); setEditContent(source.content); }}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {source.type === 'url' ? <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            : source.type === 'text' ? <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              : <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />}
                          <div className="overflow-hidden">
                            <span className="text-sm font-medium text-gray-700 truncate block">{source.name}</span>
                            <span className="text-[10px] text-gray-400 uppercase">{source.type} • {source.content?.length || 0} {t('knowledge.chars')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(source.id); }}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View/Edit Modal */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedSource(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {selectedSource.type === 'url' ? <LinkIcon className="h-5 w-5 text-blue-500" />
                    : <FileText className="h-5 w-5 text-emerald-500" />}
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-lg font-semibold text-gray-900 border-b-2 border-blue-400 focus:outline-none bg-transparent px-1"
                    />
                  ) : (
                    <h2 className="text-lg font-semibold text-gray-900 truncate max-w-md">{selectedSource.name}</h2>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t('knowledge.modal.edit')}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const res = await fetch('/api/general-knowledge', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selectedSource.id, name: editName, content: editContent }),
                          });
                          if (res.ok) {
                            toast.success(t('knowledge.modal.updated'));
                            setSelectedSource(null);
                            setIsEditing(false);
                            fetchSources();
                          } else {
                            toast.error(t('knowledge.modal.saveError'));
                          }
                        } catch { toast.error(t('common.error')); }
                        finally { setIsSaving(false); }
                      }}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg transition-all disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {t('knowledge.modal.save')}
                    </button>
                  )}
                  <button onClick={() => { setSelectedSource(null); setIsEditing(false); }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Meta */}
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                <span className="uppercase font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{selectedSource.type}</span>
                <span>{selectedSource.content?.length?.toLocaleString() || 0} {t('knowledge.chars')}</span>
                {selectedSource.date_added && <span>{t('knowledge.modal.added')} {new Date(selectedSource.date_added).toLocaleDateString(t('common.localeCode') === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[400px] text-sm font-mono leading-relaxed border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-none"
                  />
                ) : (
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-4 min-h-[200px]">
                    {selectedSource.content || t('knowledge.modal.empty')}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
