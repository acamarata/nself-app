'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLists } from '@/hooks/use-lists';
import { ListItem } from './list-item';
import { CreateListDialog } from './create-list-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface ListSidebarProps {
  activeListId?: string;
}

export function ListSidebar({ activeListId }: ListSidebarProps) {
  const { lists, loading } = useLists();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <>
      <div className="flex h-full w-64 flex-col border-r bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Lists</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </>
            ) : lists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">No lists yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first list
                </Button>
              </div>
            ) : (
              lists.map((list) => (
                <ListItem
                  key={list.id}
                  list={list}
                  isActive={list.id === activeListId}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
