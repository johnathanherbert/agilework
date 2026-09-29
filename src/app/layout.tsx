import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { FirebaseProvider } from '@/components/providers/firebase-provider';
import { SupabaseProvider } from '@/components/providers/supabase-provider';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { AppUpdateManager } from '@/components/app-update-manager';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1013' },
  ],
};

export const metadata: Metadata = {
  title: 'AgileWork · Gestão de NTs & Produção',
  description: 'Sistema Operacional e Nivelamento de Produção',
  authors: [{ name: 'AgileWork' }],
  applicationName: 'AgileWork',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AgileWork',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-app-bg text-app font-sans antialiased overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <FirebaseProvider>
            <SupabaseProvider>
              <NotificationProvider>
                <AppUpdateManager />
                {children}
                <Toaster 
                  position="top-center"
                  toastOptions={{
                    style: {
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      border: '1px solid var(--border-strong)',
                      fontSize: '12.5px',
                      borderRadius: 'var(--radius)',
                    }
                  }}
                />
              </NotificationProvider>
            </SupabaseProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}