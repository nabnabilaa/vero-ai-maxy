'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, Phone, MessageSquare, User, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

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
        toast.success(`Status updated to ${status}`);
    };

    if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" /></div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">Complaint Handling</h1>
                <p className="text-gray-500 mt-2">Manage customer complaints from chat and voice sessions</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <CompactStat label="Open" value={complaints.filter(c => c.status === 'open').length} color="red" />
                <CompactStat label="In Progress" value={complaints.filter(c => c.status === 'in_progress').length} color="amber" />
                <CompactStat label="Resolved" value={complaints.filter(c => c.status === 'resolved').length} color="green" />
                <CompactStat label="Total" value={complaints.length} color="blue" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List */}
                <div className="lg:col-span-1">
                    <Card className="rounded-2xl h-[550px] flex flex-col">
                        <CardHeader><CardTitle className="text-base">All Complaints</CardTitle></CardHeader>
                        <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
                            {complaints.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    No complaints! 🎉
                                </div>
                            ) : complaints.map(comp => {
                                const sc = statusColors[comp.status] || statusColors.open;
                                const pc = priorityColors[comp.priority] || priorityColors.medium;
                                return (
                                    <button key={comp.id} onClick={() => setSelected(comp)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm ${selected?.id === comp.id ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
                                            }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900 truncate">{comp.user_name || 'Anonymous'}</span>
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Agent: {comp.agent_name}</p>
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
                            <CardTitle className="text-base">{selected ? 'Complaint Detail' : 'Select a complaint'}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-6">
                            {!selected ? (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <div className="text-center">
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">Click a complaint to view details</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Customer Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-gray-500" /><span className="text-xs font-medium text-gray-500">Customer</span></div>
                                            <p className="font-semibold text-gray-900">{selected.user_name || 'Anonymous'}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2"><Phone className="w-4 h-4 text-gray-500" /><span className="text-xs font-medium text-gray-500">Phone</span></div>
                                            <p className="font-semibold text-gray-900">{selected.user_phone || 'Not provided'}</p>
                                            {selected.user_phone && (
                                                <a href={`tel:${selected.user_phone}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">Call now →</a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{selected.summary || 'No summary'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{selected.details || 'No details provided'}</p>
                                    </div>

                                    {/* Meta */}
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-gray-500">Agent</p>
                                            <p className="text-sm font-medium">{selected.agent_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Type</p>
                                            <p className="text-sm font-medium capitalize">{selected.session_type}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Created</p>
                                            <p className="text-sm font-medium">{new Date(selected.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t">
                                        {selected.status !== 'in_progress' && <button onClick={() => updateStatus(selected.id, 'in_progress')}
                                            className="flex-1 py-2.5 bg-amber-50 text-amber-700 font-medium rounded-xl hover:bg-amber-100 text-sm transition-colors">Mark In Progress</button>}
                                        {selected.status !== 'resolved' && <button onClick={() => updateStatus(selected.id, 'resolved')}
                                            className="flex-1 py-2.5 bg-green-50 text-green-700 font-medium rounded-xl hover:bg-green-100 text-sm transition-colors">Mark Resolved</button>}
                                        {selected.status !== 'closed' && <button onClick={() => updateStatus(selected.id, 'closed')}
                                            className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 text-sm transition-colors">Close</button>}
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
