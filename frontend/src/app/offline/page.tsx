import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <WifiOff className="h-24 w-24 mx-auto text-muted-foreground" />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">You're Offline</h1>
          <p className="text-muted-foreground">
            It looks like you've lost your internet connection. Some features may not be available until you're back online.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Try Again
          </Button>

          <p className="text-sm text-muted-foreground">
            Your data is safely cached and will sync when you reconnect.
          </p>
        </div>
      </div>
    </div>
  );
}
