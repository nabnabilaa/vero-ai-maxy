'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, BookOpen, Bot, BarChart3, Settings, LogOut, AlertTriangle, QrCode } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const navigation = [
  { id: 'dashboard', href: '/', icon: LayoutDashboard },
  { id: 'agents', href: '/agents', icon: Bot },
  { id: 'knowledgeBase', href: '/knowledge', icon: BookOpen },
  { id: 'analytics', href: '/analytics', icon: BarChart3 },
  { id: 'complaints', href: '/complaints', icon: AlertTriangle },
  { id: 'settings', href: '/settings', icon: Settings },
];

const industryColors: Record<string, string> = {
  Hotel: 'from-blue-500 to-indigo-600',
  Retail: 'from-emerald-500 to-teal-600',
  Restaurant: 'from-orange-500 to-red-500',
  'Real Estate': 'from-violet-500 to-purple-600',
  General: 'from-slate-500 to-slate-700',
};

const industryEmoji: Record<string, string> = {
  Hotel: '🏨',
  Retail: '🛒',
  Restaurant: '🍽️',
  'Real Estate': '🏠',
  General: '⚡',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useStore();
  const { t } = useTranslation();
  const industry = admin?.industry || 'General';
  const gradient = industryColors[industry] || industryColors.General;

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200 fixed left-0 top-0 z-10">
      {/* Brand Header */}
      <div className={`flex h-20 items-center px-6 bg-gradient-to-r ${gradient}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <div>
            <span className="text-lg font-bold text-white font-display tracking-tight">Vero AI</span>
            <p className="text-xs text-white/70">{industryEmoji[industry]} {industry} Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                />
                {t(`sidebar.${item.id}` as any)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Info + Logout */}
      <div className="border-t border-gray-200 p-4 space-y-3">
        <div className="px-3 pb-2 border-b border-gray-100 mb-2">
          <LanguageSwitcher />
        </div>
        {admin && (
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{admin.name}</p>
            <p className="text-xs text-gray-500 truncate">{admin.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-red-500" />
          {t('sidebar.logout')}
        </button>
      </div>
    </div>
  );
}
