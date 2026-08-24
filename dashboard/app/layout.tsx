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
  title: 'Gemini AI-Fund — Trading Desk',
  description: 'Live paper trading desk for the Gemini AI-Fund multi-agent roster.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg pb-14 text-ink antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
