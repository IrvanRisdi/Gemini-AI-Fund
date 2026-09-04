import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Fund Hub - Coin & IDX Paper Trading',
  description: 'Portal paper-trading multi-aset untuk strategi Coin dan saham IDX.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-bg pb-14 text-ink antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
