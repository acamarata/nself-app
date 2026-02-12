'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLists } from '@/hooks/use-lists';
import { Skeleton } from '@/components/ui/skeleton';

export default function ListsPage() {
  const router = useRouter();
  const { lists, loading } = useLists();

  useEffect(() => {
    if (!loading && lists.length > 0) {
      // Redirect to the default list or the first list
      const defaultList = lists.find((l) => l.is_default) || lists[0];
      router.replace(`/lists/${defaultList.id}`);
    }
  }, [lists, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-12 w-64" />
        </div>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No lists yet</h2>
          <p className="mt-2 text-muted-foreground">
            Create your first list to get started
          </p>
        </div>
      </div>
    );
  }

  return null; // Will redirect in useEffect
}
