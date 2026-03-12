'use client';

import { Sidebar } from '@/components/Sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isBotPage = pathname?.startsWith('/bot');
  const isLoginPage = pathname?.startsWith('/login');

  useEffect(() => {
    if (mounted && !isBotPage && !isLoginPage && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isBotPage, isLoginPage, isAuthenticated, router]);

  // Don't render until hydrated
  if (!mounted) {
    return <div className="min-h-screen bg-[#F8F9FA]" />;
  }

  // Public pages - no auth needed
  if (isBotPage || isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Protected pages - loading state while redirecting
  if (!isAuthenticated) {
    return <div className="min-h-screen bg-[#F8F9FA]" />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <main className="pl-64">
        <div className="px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
