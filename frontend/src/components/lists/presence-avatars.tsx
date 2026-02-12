'use client';

import { useListPresence } from '@/hooks/use-list-presence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';

interface PresenceAvatarsProps {
  listId: string;
}

export function PresenceAvatars({ listId }: PresenceAvatarsProps) {
  const { presence, loading } = useListPresence(listId);

  if (loading || presence.length === 0) {
    return null;
  }

  const visiblePresence = presence.slice(0, 5);
  const overflowCount = presence.length - 5;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {visiblePresence.map((p) => {
          const initials = p.user?.display_name
            ? p.user.display_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
            : p.user?.email?.[0]?.toUpperCase() || '?';

          return (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={p.user?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {p.status === 'editing' && (
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Pencil className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">
                    {p.user?.display_name || p.user?.email || 'Unknown user'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === 'editing' ? 'Editing' : 'Viewing'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflowCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="h-8 rounded-full border-2 border-background px-2"
              >
                +{overflowCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{overflowCount} more active</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
