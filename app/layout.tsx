import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vero AI - Intelligent Agent Platform',
  description: 'Powered by Maxy Academy',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="antialiased min-h-screen bg-gray-50 text-slate-900">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
