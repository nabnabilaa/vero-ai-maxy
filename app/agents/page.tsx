'use client';

import { useEffect, useState } from 'react';
import { useStore, AgentConfig } from '@/lib/store';
import { Bot, Plus, QrCode, Pencil, Trash2, Copy, ExternalLink, ToggleLeft, ToggleRight, Code } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import AgentForm from './AgentForm';
import { useTranslation } from '@/hooks/useTranslation';

export default function AgentsPage() {
    const { admin, agents, setAgents } = useStore();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [showQR, setShowQR] = useState<string | null>(null);
    const [appUrl, setAppUrl] = useState('');

    // View state: 'list' or editing/creating
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editAgentId, setEditAgentId] = useState<string | null>(null);

    useEffect(() => {
        setAppUrl(window.location.origin);
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents');
            if (!res.ok) {
                console.error('Failed to fetch agents:', res.statusText);
                setLoading(false);
                return;
            }
            const text = await res.text();
            if (!text) {
                setLoading(false);
                return;
            }
            const data = JSON.parse(text);
            if (data.agents) setAgents(data.agents);
        } catch (e) { console.error('Fetch agents error:', e); }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('agents.deleteConfirm'))) return;
        try {
            const res = await fetch(`/api/agents?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setAgents(agents.filter(a => a.id !== id));
                toast.success(t('agents.deletedSuccess'));
            } else {
                toast.error(t('agents.deleteError'));
            }
        } catch (err) {
            toast.error(t('agents.deleteError'));
        }
    };

    const handleToggle = async (agent: AgentConfig) => {
        try {
            const res = await fetch('/api/agents', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...agent, is_active: agent.is_active ? 0 : 1 }),
            });
            if (res.ok) {
                setAgents(agents.map(a => a.id === agent.id ? { ...a, is_active: agent.is_active ? 0 : 1 } : a));
            } else {
                toast.error(t('agents.toggleError'));
            }
        } catch (err) {
            toast.error(t('agents.toggleError'));
        }
    };

    const copyLink = (id: string) => {
        navigator.clipboard.writeText(`${appUrl}/bot/${id}`);
        toast.success(t('agents.linkCopied'));
    };

    const copyEmbed = (id: string) => {
        navigator.clipboard.writeText(`${appUrl}/bot/${id}`);
        toast.success('Link bot berhasil disalin!');
    };

    const handleBackFromForm = () => {
        setView('list');
        setEditAgentId(null);
        fetchAgents();
    };

    // Show the form (create or edit)
    if (view === 'create' || view === 'edit') {
        return <AgentForm editId={editAgentId} onBack={handleBackFromForm} />;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">{t('agents.title')}</h1>
                    <p className="text-gray-500 mt-2">{t('agents.subtitle')}</p>
                </div>
                <button
                    onClick={() => { setEditAgentId(null); setView('create'); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
                >
                    <Plus className="w-4 h-4" />
                    {t('agents.newAgent')}
                </button>
            </div>

            {agents.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                    <Bot className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('agents.noAgentsTitle')}</h3>
                    <p className="text-gray-500 mb-6">{t('agents.noAgentsSubtitle')}</p>
                    <button
                        onClick={() => { setEditAgentId(null); setView('create'); }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
                    >
                        <Plus className="w-4 h-4" />
                        {t('agents.createAgentBtn')}
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {agents.map((agent, i) => (
                        <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                            {agent.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                                            <p className="text-xs text-gray-500">{agent.role}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggle(agent)} title={agent.is_active ? t('agents.active') : t('agents.inactive')}>
                                        {agent.is_active ? (
                                            <ToggleRight className="w-6 h-6 text-emerald-500" />
                                        ) : (
                                            <ToggleLeft className="w-6 h-6 text-gray-300" />
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{t('agents.industry')}</span>
                                        <span className="font-medium text-gray-900">{agent.industry}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{t('agents.tokensUsed')}</span>
                                        <span className="font-mono text-gray-900">{agent.token_usage?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{t('agents.knowledgeSources')}</span>
                                        <span className="font-medium text-gray-900">{agent.knowledge_count || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{t('agents.conversations')}</span>
                                        <span className="font-medium text-gray-900">{agent.conversation_count || 0}</span>
                                    </div>
                                </div>

                                {/* QR Code */}
                                <div className="flex flex-col items-center gap-3 py-4 border-t border-gray-50">
                                    <button
                                        onClick={() => setShowQR(showQR === agent.id ? null : agent.id)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                        <QrCode className="w-4 h-4" />
                                        {showQR === agent.id ? t('agents.hideQR') : t('agents.showQR')}
                                    </button>

                                    <AnimatePresence>
                                        {showQR === agent.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="flex flex-col items-center gap-2"
                                            >
                                                <div className="bg-white p-3 rounded-xl border shadow-sm">
                                                    <QRCodeSVG
                                                        value={`${appUrl}/bot/${agent.id}`}
                                                        size={140}
                                                        level="M"
                                                        includeMargin={false}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-400 text-center break-all max-w-[200px]">
                                                    {`${appUrl}/bot/${agent.id}`}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-6 py-3 bg-gray-50/60 border-t border-gray-100 flex gap-2">
                                <button
                                    onClick={() => { setEditAgentId(agent.id); setView('edit'); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {t('common.edit')}
                                </button>
                                <button
                                    onClick={() => copyEmbed(agent.id)}
                                    className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors"
                                    title="Salin Link Bot"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <Link href={`/bot/${agent.id}`} target="_blank">
                                    <button className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-emerald-600 py-2 px-3 rounded-lg hover:bg-emerald-50 transition-colors">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                </Link>
                                <button
                                    onClick={() => handleDelete(agent.id)}
                                    className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 hover:text-red-600 py-2 px-3 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
