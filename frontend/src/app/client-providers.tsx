'use client';

import { useEffect, type ReactNode } from 'react';
import { AppProviders } from '@/lib/providers';
import { DevModeIndicator } from '@/components/dashboard/dev-mode-indicator';
import { registerServiceWorker } from '@/lib/utils/register-sw';

export function ClientProviders({ children }: { children: ReactNode }) {
  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined') {
      registerServiceWorker();
    }
  }, []);

  return (
    <AppProviders>
      {children}
      <DevModeIndicator />
    </AppProviders>
  );
}
