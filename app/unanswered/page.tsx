'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bot, CheckCircle, HelpCircle, Loader2, Plus, Trash2, BookOpen, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/hooks/useTranslation';

type UnansweredQuery = {
    id: string;
    agent_id: string;
    agent_name: string;
    question: string;
    status: string;
    created_at: string;
};

export default function UnansweredPage() {
    const { admin } = useStore();
    const { t } = useTranslation();
    const [queries, setQueries] = useState<UnansweredQuery[]>([]);
    const [stats, setStats] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [addingKnowledge, setAddingKnowledge] = useState<string | null>(null);
    const [knowledgeAnswer, setKnowledgeAnswer] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchData = () => {
        fetch('/api/unanswered')
            .then(r => r.json())
            .then(data => {
                setQueries(data.queries || []);
                setStats(data.stats || {});
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const dismissQuery = async (id: string) => {
        await fetch(`/api/unanswered?id=${id}`, { method: 'DELETE' });
        setQueries(prev => prev.filter(q => q.id !== id));
        toast.success(t('unanswered.dismissed'));
    };

    const dismissAll = async () => {
        if (!confirm(t('unanswered.confirmDismissAll'))) return;
        await fetch('/api/unanswered?all=true', { method: 'DELETE' });
        setQueries([]);
        toast.success(t('unanswered.allDismissed'));
    };

    const saveAsKnowledge = async (q: UnansweredQuery) => {
        if (!knowledgeAnswer.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: q.agent_id,
                    type: 'text',
                    name: `FAQ: ${q.question.substring(0, 80)}`,
                    content: `Pertanyaan: ${q.question}\n\nJawaban: ${knowledgeAnswer}`,
                }),
            });
            if (!res.ok) throw new Error('Failed to save');
            // Dismiss the query
            await fetch(`/api/unanswered?id=${q.id}`, { method: 'DELETE' });
            setQueries(prev => prev.filter(item => item.id !== q.id));
            setAddingKnowledge(null);
            setKnowledgeAnswer('');
            toast.success(t('unanswered.savedAsKnowledge'));
        } catch {
            toast.error(t('unanswered.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
                    {t('unanswered.title')}
                </h1>
                <p className="text-gray-500 mt-2">{t('unanswered.subtitle')}</p>
            </motion.div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-2xl border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <HelpCircle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-amber-900">{stats.total || 0}</p>
                                <p className="text-xs text-amber-600">{t('unanswered.totalGaps')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-900">{stats.agents_affected || 0}</p>
                                <p className="text-xs text-blue-600">{t('unanswered.agentsAffected')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-purple-100 bg-gradient-to-br from-purple-50 to-violet-50/50">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <Lightbulb className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-purple-900">{stats.unique_questions || 0}</p>
                                <p className="text-xs text-purple-600">{t('unanswered.uniqueQuestions')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            {queries.length > 0 && (
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={dismissAll} className="rounded-xl text-xs text-gray-500 border-gray-200">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        {t('unanswered.dismissAll')}
                    </Button>
                </div>
            )}

            {/* Empty State */}
            {queries.length === 0 && (
                <Card className="rounded-2xl">
                    <CardContent className="p-12 text-center">
                        <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900">{t('unanswered.allClear')}</h3>
                        <p className="text-sm text-gray-500 mt-2">{t('unanswered.allClearDesc')}</p>
                    </CardContent>
                </Card>
            )}

            {/* Query List */}
            <div className="space-y-3">
                <AnimatePresence>
                    {queries.map((q) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            layout
                        >
                            <Card className="rounded-2xl hover:shadow-md transition-all border-gray-100">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <AlertCircle className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 leading-relaxed">"{q.question}"</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Bot className="w-3 h-3" /> {q.agent_name}
                                                </span>
                                                <span>{new Date(q.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>

                                            {/* Answer & Add to Knowledge Form */}
                                            {addingKnowledge === q.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-3 space-y-2"
                                                >
                                                    <textarea
                                                        className="w-full rounded-xl border border-blue-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-blue-50/30"
                                                        placeholder={t('unanswered.answerPlaceholder')}
                                                        rows={3}
                                                        value={knowledgeAnswer}
                                                        onChange={(e) => setKnowledgeAnswer(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => saveAsKnowledge(q)}
                                                            disabled={!knowledgeAnswer.trim() || saving}
                                                            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs"
                                                        >
                                                            {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <BookOpen className="w-3 h-3 mr-1.5" />}
                                                            {t('unanswered.saveToKnowledge')}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => { setAddingKnowledge(null); setKnowledgeAnswer(''); }}
                                                            className="rounded-xl text-xs"
                                                        >
                                                            {t('unanswered.cancel')}
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setAddingKnowledge(addingKnowledge === q.id ? null : q.id); setKnowledgeAnswer(''); }}
                                                className="rounded-xl text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-1" />
                                                {t('unanswered.answer')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => dismissQuery(q.id)}
                                                className="rounded-xl text-xs text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
