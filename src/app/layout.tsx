import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { FirebaseProvider } from '@/components/providers/firebase-provider';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { AppUpdateManager } from '@/components/app-update-manager';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
}

export const metadata: Metadata = {
  title: 'NT Management App',
  description: 'Sistema de Gerenciamento de Notas Técnicas e Inventário',
  authors: [{ name: 'Agilework' }],
  applicationName: 'NT Management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NT Management',
  },
  formatDetection: {
    telephone: true,
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <FirebaseProvider>
            <NotificationProvider>
              <AppUpdateManager />
              {children}
              <Toaster position="top-center" />
            </NotificationProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}