'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, MessageSquare, Phone, Clock, Eye, Bot, User, Sparkles, Loader2, ThumbsUp, ThumbsDown, Minus, Package, UserSquare2, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function AnalyticsPage() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConv, setSelectedConv] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [agents, setAgents] = useState<any[]>([]);

    // Live Analysis State
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
    const [analyzingTopics, setAnalyzingTopics] = useState<Record<string, boolean>>({});
    const [topicAnalysis, setTopicAnalysis] = useState<Record<string, any>>({});
    const [activeView, setActiveView] = useState<'conversation' | 'analysis'>('conversation');
    const [activeAnalysisTopic, setActiveAnalysisTopic] = useState<string>('');

    useEffect(() => {
        Promise.all([
            fetch('/api/conversations').then(r => r.json()),
            fetch('/api/analytics').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
        ]).then(([convData, statsData, agentData]) => {
            setConversations(convData.conversations || []);
            setStats(statsData);
            setAgents(agentData.agents || []);
            setLoading(false);
        });
    }, []);

    const viewConversation = async (convId: string) => {
        setActiveView('conversation');
        const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: convId }),
        });
        const data = await res.json();
        setSelectedConv(data.conversation);
        setMessages(data.messages || []);
    };

    const runLiveAnalysis = async (topicName: string, agentIds: string[]) => {
        setAnalyzingTopics(prev => ({ ...prev, [topicName]: true }));
        setActiveView('analysis');
        setActiveAnalysisTopic(topicName);
        const loadingToast = toast.loading(`Menganalisis percakapan untuk topik ${topicName}...`);

        try {
            const res = await fetch('/api/analytics/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topicName, agentIds })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to analyze');

            setTopicAnalysis(prev => ({ ...prev, [topicName]: data.analysis }));
            toast.success(`✨ Analisis topik ${topicName} selesai!`, { id: loadingToast });
        } catch (e: any) {
            toast.error(e.message || 'Gagal menganalisis', { id: loadingToast });
        } finally {
            setAnalyzingTopics(prev => ({ ...prev, [topicName]: false }));
        }
    };

    // Group conversations by Topic
    // Mapping: conversation.agent_id -> agent -> agent.topic
    const groupedConversations = useMemo(() => {
        const groups: Record<string, { agentIds: Set<string>, conversations: any[] }> = {};

        conversations.forEach(conv => {
            const agent = agents.find(a => a.id === conv.agent_id);
            // Fallback to "General" if agent somehow has no topic
            const topic = agent?.topic || 'General / Uncategorized';

            if (!groups[topic]) {
                groups[topic] = { agentIds: new Set(), conversations: [] };
            }
            groups[topic].agentIds.add(conv.agent_id);
            groups[topic].conversations.push(conv);
        });

        // Sort conversations within each topic by newest first
        Object.keys(groups).forEach(topic => {
            groups[topic].conversations.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        });

        return groups;
    }, [conversations, agents]);

    if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto min-h-screen">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">Analytics & History</h1>
                <p className="text-gray-500 mt-2">Monitor percakapan, penggunaan token, dan Live Analysis per topik agent.</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={MessageSquare} label="Total Conversations" value={stats?.totalConversations || 0} color="blue" />
                <StatCard icon={BarChart3} label="Total Tokens" value={stats?.totalTokens?.toLocaleString() || '0'} color="indigo" />
                <StatCard icon={Bot} label="Active Agents" value={stats?.totalAgents || 0} color="emerald" />
                <StatCard icon={Clock} label="Today" value={stats?.todayConversations || 0} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">

                {/* Conversations Grouped by Topic */}
                <div className="lg:col-span-5 h-full flex flex-col">
                    <Card className="rounded-2xl h-full flex flex-col shadow-sm border-gray-100 overflow-hidden">
                        <CardHeader className="bg-white z-10 border-b border-gray-50 pb-4">
                            <CardTitle className="text-base flex items-center justify-between">
                                Daftar Percakapan Terkini
                                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{conversations.length} total</span>
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50/50">
                            {Object.keys(groupedConversations).length === 0 ? (
                                <div className="text-center py-10 text-gray-500 text-sm">Belum ada percakapan</div>
                            ) : Object.entries(groupedConversations).map(([topic, data]) => {
                                const isExpanded = expandedTopic === topic;
                                const analysis = topicAnalysis[topic];
                                const isAnalyzing = analyzingTopics[topic];

                                return (
                                    <div key={topic} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
                                        {/* Topic Header */}
                                        <div
                                            className="p-3 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors border-b border-gray-100"
                                            onClick={() => setExpandedTopic(isExpanded ? null : topic)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                    <Bot className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">Topik: {topic.replace('__ai_custom__', 'Custom AI Topic')}</h3>
                                                    <p className="text-xs text-gray-500">{data.conversations.length} percakapan</p>
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                        </div>

                                        {/* Live Analysis Dashboard (Shown when expanded) */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">

                                                    {/* AI Analysis Button — compact in sidebar */}
                                                    <div className="px-4 pt-3 pb-2 bg-indigo-50/30 border-b border-gray-100">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-xs font-bold text-indigo-900 tracking-wider uppercase flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Live Analysis</h4>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] rounded-lg border-indigo-200 bg-white hover:bg-indigo-50 hover:text-indigo-700"
                                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); runLiveAnalysis(topic, Array.from(data.agentIds)); }}
                                                                disabled={isAnalyzing}
                                                            >
                                                                {isAnalyzing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Bot className="w-3 h-3 mr-1" />}
                                                                {isAnalyzing ? 'Analyzing...' : (analysis ? 'Refresh' : 'Run Analysis')}
                                                            </Button>
                                                        </div>

                                                        {/* Mini sentiment badge inline */}
                                                        {analysis && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setActiveView('analysis'); setActiveAnalysisTopic(topic); setSelectedConv(null); }}
                                                                className="mt-2 w-full text-left flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all"
                                                            >
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${analysis.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-600' :
                                                                    analysis.sentiment === 'Negative' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {analysis.sentiment === 'Positive' ? <ThumbsUp className="w-2.5 h-2.5" /> :
                                                                        analysis.sentiment === 'Negative' ? <ThumbsDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                                                                </div>
                                                                <span className="text-xs text-gray-700 font-medium">{analysis.sentiment}</span>
                                                                <span className="text-[10px] text-gray-400 ml-auto">Klik untuk detail →</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Conversation History List */}
                                                    <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
                                                        {data.conversations.map(conv => (
                                                            <button
                                                                key={conv.id}
                                                                onClick={() => viewConversation(conv.id)}
                                                                className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm ${selectedConv?.id === conv.id ? 'border-indigo-200 bg-indigo-50/50 ring-1 ring-indigo-100' : 'border-transparent hover:bg-gray-50 hover:border-gray-100'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        {conv.session_type === 'voice' ? <Phone className="w-3.5 h-3.5 text-purple-500" /> : <MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                                                                        <span className="text-sm font-medium text-gray-900 truncate">{conv.user_name || 'Anonymous'}</span>
                                                                    </div>
                                                                    {conv.is_complaint === 1 ? <span className="text-[10px] bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Complaint</span>
                                                                        : <span className="text-[10px] text-gray-400">{new Date(conv.started_at).toLocaleDateString()}</span>}
                                                                </div>
                                                                <p className="text-xs text-gray-500 flex items-center gap-2">
                                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{conv.agent_name}</span>
                                                                    {conv.message_count} messages
                                                                </p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                {/* Conversation Detail Pane */}
                <div className="lg:col-span-7 h-full">
                    <Card className="rounded-2xl h-full flex flex-col shadow-sm border-gray-100">
                        <CardHeader className="bg-white z-10 border-b border-gray-50">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>{activeView === 'analysis' && activeAnalysisTopic ? `✨ AI Analysis — ${activeAnalysisTopic}` : selectedConv ? `${selectedConv.agent_name} — ${selectedConv.user_name || 'Anonymous'}` : 'Pilih percakapan'}</span>
                                {selectedConv && (
                                    <div className="flex gap-2">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedConv.session_type === 'voice' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                            }`}>{selectedConv.session_type}</span>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedConv.is_complaint ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            }`}>{selectedConv.is_complaint ? 'Complaint' : selectedConv.status}</span>
                                    </div>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 rounded-b-2xl">
                            {/* AI Analysis View */}
                            {activeView === 'analysis' && activeAnalysisTopic ? (() => {
                                const analysis = topicAnalysis[activeAnalysisTopic];
                                const isAnalyzing = analyzingTopics[activeAnalysisTopic];
                                return (
                                    <div className="space-y-5">
                                        {/* Header */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">AI Live Analysis</h3>
                                                <p className="text-xs text-gray-500">Topik: {activeAnalysisTopic.replace('__ai_custom__', 'Custom AI Topic')}</p>
                                            </div>
                                        </div>

                                        {isAnalyzing ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                                <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
                                                <p className="text-sm font-medium">Sedang menganalisis percakapan...</p>
                                                <p className="text-xs text-gray-400 mt-1">AI sedang membaca semua chat di topik ini</p>
                                            </div>
                                        ) : analysis ? (
                                            <div className="space-y-5">
                                                {/* Sentiment Card */}
                                                <div className={`p-5 rounded-2xl border-2 ${analysis.sentiment === 'Positive' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' :
                                                    analysis.sentiment === 'Negative' ? 'border-red-200 bg-gradient-to-br from-red-50 to-pink-50' :
                                                        'border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50'
                                                    }`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${analysis.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-600' :
                                                            analysis.sentiment === 'Negative' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {analysis.sentiment === 'Positive' ? <ThumbsUp className="w-5 h-5" /> :
                                                                analysis.sentiment === 'Negative' ? <ThumbsDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-lg font-bold text-gray-900">{analysis.sentiment} Sentiment</p>
                                                            <p className="text-sm text-gray-600">{analysis.sentimentReason}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Orders & Requests */}
                                                {analysis.orders && analysis.orders.length > 0 && (
                                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                                                            <Package className="w-4 h-4 text-indigo-500" /> Orders & Requests
                                                            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-auto">{analysis.orders.length} ditemukan</span>
                                                        </h4>
                                                        <div className="space-y-3">
                                                            {analysis.orders.map((o: any, i: number) => (
                                                                <div key={i} className="border-l-3 border-indigo-400 pl-4 py-2 bg-gray-50 rounded-r-xl">
                                                                    <p className="text-sm font-semibold text-gray-900">{o.itemOrRequest}</p>
                                                                    {o.quantityOrDetails && <p className="text-xs text-gray-600 mt-0.5">{o.quantityOrDetails}</p>}
                                                                    <p className="text-xs text-gray-400 mt-1">📌 {o.customerContext}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Extracted Customer Data */}
                                                {analysis.structuredDataExtractor && analysis.structuredDataExtractor.length > 0 && (
                                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                                                            <UserSquare2 className="w-4 h-4 text-emerald-500" /> Extracted Customer Data
                                                            <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full ml-auto">{analysis.structuredDataExtractor.length} pelanggan</span>
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {analysis.structuredDataExtractor.map((d: any, i: number) => (
                                                                <div key={i} className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                                                                    <p className="text-sm font-semibold text-gray-900">{d.customerName || 'Unknown User'}</p>
                                                                    {d.contactInfo && <p className="text-xs text-indigo-600 font-mono mt-1">{d.contactInfo}</p>}
                                                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{d.extractedInfo}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Empty state if no data */}
                                                {(!analysis.orders || analysis.orders.length === 0) && (!analysis.structuredDataExtractor || analysis.structuredDataExtractor.length === 0) && (
                                                    <div className="text-center py-6 text-gray-400">
                                                        <p className="text-sm">Tidak ditemukan pesanan atau data pelanggan spesifik di percakapan ini.</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                                <Sparkles className="w-10 h-10 text-gray-200 mb-4" />
                                                <p className="text-sm">Klik "Run Analysis" pada topik di kolom kiri</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : !selectedConv ? (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                    <div className="text-center">
                                        <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200 stroke-1" />
                                        <p>Pilih percakapan di kolom kiri untuk melihat detail</p>
                                        <p className="text-xs text-gray-300 mt-1">atau jalankan AI Analysis pada topik</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg: any) => (
                                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-600 text-white'
                                            }`}>
                                            {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                        </div>
                                        <div className={`max-w-[75%] px-5 py-3.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm' : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-2xl rounded-tl-sm'
                                            }`}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            <div className={`text-[10px] mt-2 flex items-center justify-end gap-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {msg.tokens_used > 0 && ` • ${msg.tokens_used} tokens`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: any) {
    const bg: Record<string, string> = { blue: 'bg-blue-50 text-blue-600 border-blue-100', indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100', amber: 'bg-amber-50 text-amber-600 border-amber-100' };
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-gradient-to-br ${bg[color]}`}><Icon className="w-5 h-5 opacity-80" /></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
            </div>
            <p className="text-3xl font-display font-bold text-gray-900">{value}</p>
        </motion.div>
    );
}
// Required dummy button for internal component until lucide / shadcn allows clean global injects without import
function Button({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
}
