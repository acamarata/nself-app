'use client';

import Link from 'next/link';
import { List as ListIcon, Check } from 'lucide-react';
import type { List } from '@/lib/types/lists';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ListItemProps {
  list: List;
  isActive?: boolean;
}

export function ListItem({ list, isActive }: ListItemProps) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent',
        isActive && 'bg-accent'
      )}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: list.color + '20' }}
      >
        <ListIcon className="h-4 w-4" style={{ color: list.color }} />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="truncate">{list.title}</span>
        {list.description && (
          <span className="truncate text-xs text-muted-foreground">
            {list.description}
          </span>
        )}
      </div>

      {list.todo_count !== undefined && (
        <div className="flex items-center gap-1">
          {list.completed_count !== undefined && list.completed_count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              <Check className="mr-1 h-3 w-3" />
              {list.completed_count}
            </Badge>
          )}
          {list.todo_count > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs">
              {list.todo_count}
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}
