import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
    title: 'GLUV - AI 혈당 & 식단 관리',
  description: '음성으로 간편하게 식단을 기록하고 AI가 혈당을 분석해드립니다. 당뇨 관리의 새로운 시작.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GLUV',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFF9F2',
};

import { AuthProvider } from '@/context/AuthContext';
import { VoiceInputProvider } from '@/context/VoiceInputContext';
import { BackHandlerProvider } from '@/context/BackHandlerContext';
import AppLayout from '@/components/layout/AppLayout';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] antialiased overscroll-none">
        <AuthProvider>
          <BackHandlerProvider>
            <VoiceInputProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </VoiceInputProvider>
          </BackHandlerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
