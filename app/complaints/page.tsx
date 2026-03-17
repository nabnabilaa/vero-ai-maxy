'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, Phone, MessageSquare, User, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: 'bg-red-50', text: 'text-red-600', label: 'Open' },
    in_progress: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'In Progress' },
    resolved: { bg: 'bg-green-50', text: 'text-green-600', label: 'Resolved' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Closed' },
};

const priorityColors: Record<string, { bg: string; text: string }> = {
    low: { bg: 'bg-blue-50', text: 'text-blue-600' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-600' },
    high: { bg: 'bg-orange-50', text: 'text-orange-600' },
    urgent: { bg: 'bg-red-50', text: 'text-red-600' },
};

export default function ComplaintsPage() {
    const { t } = useTranslation();
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = () => {
        fetch('/api/complaints').then(r => r.json()).then(data => {
            setComplaints(data.complaints || []);
            setLoading(false);
        });
    };

    const updateStatus = async (id: string, status: string) => {
        await fetch('/api/complaints', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        fetchComplaints();
        toast.success(t('complaints.actions.statusUpdated', { status: t(`complaints.status.${status}`) }));
    };

    if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" /></div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">{t('complaints.title')}</h1>
                <p className="text-gray-500 mt-2">{t('complaints.subtitle')}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <CompactStat label={t('complaints.stats.open')} value={complaints.filter(c => c.status === 'open').length} color="red" />
                <CompactStat label={t('complaints.stats.inProgress')} value={complaints.filter(c => c.status === 'in_progress').length} color="amber" />
                <CompactStat label={t('complaints.stats.resolved')} value={complaints.filter(c => c.status === 'resolved').length} color="green" />
                <CompactStat label={t('complaints.stats.total')} value={complaints.length} color="blue" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List */}
                <div className="lg:col-span-1">
                    <Card className="rounded-2xl h-[550px] flex flex-col">
                        <CardHeader><CardTitle className="text-base">{t('complaints.listTitle')}</CardTitle></CardHeader>
                        <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
                            {complaints.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    {t('complaints.noComplaints')}
                                </div>
                            ) : complaints.map(comp => {
                                const sc = statusColors[comp.status] || statusColors.open;
                                const pc = priorityColors[comp.priority] || priorityColors.medium;
                                return (
                                    <button key={comp.id} onClick={() => setSelected(comp)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm ${selected?.id === comp.id ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
                                            }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900 truncate">{comp.user_name || t('complaints.unnamed')}</span>
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{t(`complaints.status.${comp.status}`)}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{t('complaints.agent')}: {comp.agent_name}</p>
                                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{comp.summary || comp.details}</p>
                                    </button>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                {/* Detail */}
                <div className="lg:col-span-2">
                    <Card className="rounded-2xl h-[550px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-base">{selected ? t('complaints.detailTitle') : t('complaints.selectComplaint')}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-6">
                            {!selected ? (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <div className="text-center">
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">{t('complaints.selectPlaceholder')}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Customer Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-gray-500" /><span className="text-xs font-medium text-gray-500">{t('complaints.customer')}</span></div>
                                            <p className="font-semibold text-gray-900">{selected.user_name || t('complaints.unnamed')}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2"><Phone className="w-4 h-4 text-gray-500" /><span className="text-xs font-medium text-gray-500">{t('complaints.phone')}</span></div>
                                            <p className="font-semibold text-gray-900">{selected.user_phone || t('complaints.notProvided')}</p>
                                            {selected.user_phone && (
                                                <a href={`tel:${selected.user_phone}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">{t('complaints.callNow')}</a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">{t('complaints.summary')}</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{selected.summary || t('complaints.noSummary')}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">{t('complaints.details')}</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{selected.details || t('complaints.noDetails')}</p>
                                    </div>

                                    {/* Meta */}
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-gray-500">{t('complaints.agent')}</p>
                                            <p className="text-sm font-medium">{selected.agent_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">{t('complaints.type')}</p>
                                            <p className="text-sm font-medium capitalize">{selected.session_type}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">{t('complaints.created')}</p>
                                            <p className="text-sm font-medium">{new Date(selected.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t">
                                        {selected.status !== 'in_progress' && <button onClick={() => updateStatus(selected.id, 'in_progress')}
                                            className="flex-1 py-2.5 bg-amber-50 text-amber-700 font-medium rounded-xl hover:bg-amber-100 text-sm transition-colors">{t('complaints.actions.markInProgress')}</button>}
                                        {selected.status !== 'resolved' && <button onClick={() => updateStatus(selected.id, 'resolved')}
                                            className="flex-1 py-2.5 bg-green-50 text-green-700 font-medium rounded-xl hover:bg-green-100 text-sm transition-colors">{t('complaints.actions.markResolved')}</button>}
                                        {selected.status !== 'closed' && <button onClick={() => updateStatus(selected.id, 'closed')}
                                            className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 text-sm transition-colors">{t('complaints.actions.close')}</button>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function CompactStat({ label, value, color }: any) {
    const colors: Record<string, string> = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-emerald-600', blue: 'text-blue-600' };
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
    );
}
