import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { appConfig } from '@/lib/app.config';
import { ClientProviders } from './client-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
  icons: {
    icon: appConfig.branding.favicon,
    apple: appConfig.branding.appleTouchIcon,
  },
  themeColor: appConfig.theme.primaryColor,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appConfig.name,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
