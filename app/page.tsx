'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Bot, Coins, MessageSquare, AlertTriangle, ArrowUpRight, Phone, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useTranslation } from '@/hooks/useTranslation';

export default function DashboardPage() {
  const { admin } = useStore();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [tokenPeriod, setTokenPeriod] = useState('7d');

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`/api/analytics/tokens?period=${tokenPeriod}`)
      .then(r => r.json()).then(d => setTokenData(d)).catch(() => { });
  }, [tokenPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const industryGreeting: Record<string, string> = {
    Hotel: 'Manage your hotel AI concierge agents',
    Retail: 'Manage your retail AI shopping assistants',
    Restaurant: 'Manage your restaurant AI service agents',
    'Real Estate': 'Manage your property AI consultation agents',
    General: 'Manage your multi-purpose AI agents',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
            {t('dashboard.welcome', { name: admin?.name?.split(' ')[0] || '' })}
          </h1>
          <p className="text-gray-500 mt-2">
            {industryGreeting[admin?.industry || 'General']}
          </p>
        </div>
        <Link href="/agents">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25">
            <Bot className="w-4 h-4" />
            {t('dashboard.btnCreateAgent')}
          </button>
        </Link>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t('dashboard.totalTokenUsage')} value={stats?.totalTokens?.toLocaleString() || '0'} icon={Coins} color="blue" />
        <StatsCard title={t('dashboard.activeAgents')} value={stats?.totalAgents?.toString() || '0'} icon={Bot} color="indigo" />
        <StatsCard title={t('dashboard.todaysConversations')} value={stats?.todayConversations?.toString() || '0'} icon={MessageSquare} color="emerald" />
        <StatsCard title={t('dashboard.openComplaints')} value={stats?.openComplaints?.toString() || '0'} icon={AlertTriangle} color="red" />
      </div>

      {/* {t('dashboard.agentPerformance')} */}
      {stats?.perAgent?.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">{t('dashboard.agentPerformance')}</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.perAgent.map((agent: any) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {agent.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.conversations} {t('dashboard.conversations')}</p>
                    </div>
                  </div>
                  {agent.open_complaints > 0 && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                      {agent.open_complaints} {t('dashboard.complaints')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('dashboard.tokensUsed')}</span>
                  <span className="font-mono font-medium text-gray-900">{agent.token_usage?.toLocaleString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Token Usage Dashboard */}
      {tokenData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> {t('dashboard.apiTokenUsage')}</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {[{ l: t('dashboard.days7'), v: '7d' }, { l: t('dashboard.days30'), v: '30d' }, { l: t('dashboard.all'), v: 'all' }].map(p => (
                <button key={p.v} onClick={() => setTokenPeriod(p.v)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tokenPeriod === p.v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs text-blue-500 font-medium">{t('dashboard.totalToken')}</p>
              <p className="text-2xl font-bold text-blue-700">{tokenData.totals?.totalTokens?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-blue-400 mt-1">{tokenData.totals?.totalRequests || 0} {t('dashboard.requests')}</p>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
              <p className="text-xs text-orange-500 font-medium">{t('dashboard.aiToken')}</p>
              <p className="text-2xl font-bold text-orange-700">{tokenData.totals?.aiTokens?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-orange-400 mt-1">{t('dashboard.aiTokenDesc')}</p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-100 p-4">
              <p className="text-xs text-green-500 font-medium">{t('dashboard.savedFromCache')}</p>
              <p className="text-2xl font-bold text-green-700">~{tokenData.totals?.estimatedSaved?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-green-400 mt-1">{tokenData.totals?.cachedRequests || 0} cached {t('dashboard.requests')}</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
              <p className="text-xs text-purple-500 font-medium">{t('dashboard.cacheHitRate')}</p>
              <p className="text-2xl font-bold text-purple-700">{tokenData.totals?.cacheHitRate || 0}%</p>
              <p className="text-[10px] text-purple-400 mt-1">{t('dashboard.cacheHitRateDesc')}</p>
            </div>
          </div>

          {/* By Source & Agent */}
          <div className="grid gap-4 md:grid-cols-2">
            {tokenData.bySource?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.bySource')}</h4>
                <div className="space-y-2">
                  {tokenData.bySource.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{s.source === 'chat' ? '💬' : s.source === 'voice' ? '📞' : '🔧'}</span>
                        <span className="text-sm font-medium text-gray-700 capitalize">{s.source}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{Number(s.tokens || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({s.requests} {t('dashboard.requests')}, {s.cached} cached)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tokenData.byAgent?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.byAgent')}</h4>
                <div className="space-y-2">
                  {tokenData.byAgent.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">{a.agent_name?.charAt(0) || '?'}</div>
                        <span className="text-sm font-medium text-gray-700">{a.agent_name || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{Number(a.tokens || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({a.cached} cached)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Token Logs */}
          {tokenData.recentLogs?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50"><h4 className="text-sm font-semibold text-gray-700">{t('dashboard.recentTokenLogs')}</h4></div>
              <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
                {tokenData.recentLogs.map((log: any, i: number) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{log.source === 'chat' ? '💬' : log.source === 'voice' ? '📞' : '🔧'}</span>
                      <div>
                        <p className="font-medium text-gray-800">{log.agent_name || t('dashboard.system')} — <span className="text-gray-500 font-normal">{log.action}</span></p>
                        <p className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${log.from_cache ? 'text-green-600' : 'text-gray-900'}`}>{log.from_cache ? '✓ cached' : `${Number(log.tokens_used).toLocaleString()} token`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unanswered Queries */}
      {stats?.unanswered?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('dashboard.unansweredQueries')}
            </h3>
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full font-medium">{t('dashboard.helpAddToKnowledge')}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {stats.unanswered.map((u: any) => (
              <div key={u.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{u.agent_name}</span>
                    <span className="text-[10px] text-gray-400">{new Date(u.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium">"{u.question}"</p>
                </div>
                <Link href="/knowledge">
                  <button className="text-xs px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-lg transition-colors border border-indigo-100">
                    Tambah Knowledge
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Conversations */}
      {stats?.recentConvs?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-lg">{t('dashboard.recentConversations')}</h3>
            <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              {t('dashboard.seeAll')} <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {stats.recentConvs.map((conv: any) => (
                <div key={conv.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${conv.session_type === 'voice' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                      {conv.session_type === 'voice' ? <Phone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {conv.user_name || t('dashboard.anonymous')} → {conv.agent_name}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1 max-w-md">{conv.last_message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {conv.is_complaint === 1 && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{t('dashboard.complaint')}</span>
                    )}
                    <span className="text-xs text-gray-400">{new Date(conv.started_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {
        stats?.totalAgents === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center"
          >
            <Bot className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('dashboard.noAgents')}</h3>
            <p className="text-gray-500 mb-6">{t('dashboard.createFirstAgent')}</p>
            <Link href="/agents">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25">
                <Bot className="w-4 h-4" />
                {t('dashboard.btnCreateAgent')}
              </button>
            </Link>
          </motion.div>
        )
      }
    </div >
  );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    red: 'from-red-500 to-red-600 shadow-red-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
    </motion.div>
  );
}
