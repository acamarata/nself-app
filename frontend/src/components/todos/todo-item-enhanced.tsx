'use client';

import { useState } from 'react';
import type { Todo, UpdateTodoInput, TodoPriority } from '@/lib/types/todos';
import type { TodoShare } from '@/lib/services/todos';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  Globe,
  Calendar,
  MapPin,
  Repeat,
  Paperclip,
  FileText,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShareTodoDialog } from './share-todo-dialog';
import { format, isToday, isTomorrow, isPast, differenceInHours } from 'date-fns';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => Promise<void>;
  onUpdate: (id: string, input: UpdateTodoInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePublic: (id: string) => Promise<void>;
  onShare: (todoId: string, email: string, permission: 'view' | 'edit') => Promise<void>;
  onRemoveShare: (shareId: string) => Promise<void>;
  getShares: (todoId: string) => Promise<TodoShare[]>;
  timeFormat?: '12h' | '24h';
}

const priorityConfig: Record<TodoPriority, { color: string; label: string; icon: string }> = {
  none: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: '', icon: '' },
  low: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Low', icon: '⬇️' },
  medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Med', icon: '➡️' },
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'High', icon: '⬆️' },
};

export function TodoItemEnhanced({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  onTogglePublic,
  onShare,
  onRemoveShare,
  getShares,
  timeFormat = '12h',
}: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isLoading, setIsLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onToggle(todo.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setIsLoading(true);
    try {
      await onUpdate(todo.id, { title: editTitle });
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(todo.title);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(todo.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Due date helpers
  const getDueDateColor = () => {
    if (!todo.due_date || todo.completed) return '';

    const dueDate = new Date(todo.due_date);
    if (isPast(dueDate)) return 'text-red-600 dark:text-red-400';

    const hoursUntilDue = differenceInHours(dueDate, new Date());
    if (hoursUntilDue < 24) return 'text-orange-600 dark:text-orange-400';

    return 'text-muted-foreground';
  };

  const formatDueDate = (date: string) => {
    const dueDate = new Date(date);

    if (isToday(dueDate)) {
      const timeStr = format(dueDate, timeFormat === '24h' ? 'HH:mm' : 'h:mm a');
      return `Today at ${timeStr}`;
    }

    if (isTomorrow(dueDate)) {
      const timeStr = format(dueDate, timeFormat === '24h' ? 'HH:mm' : 'h:mm a');
      return `Tomorrow at ${timeStr}`;
    }

    return format(dueDate, timeFormat === '24h' ? 'MMM d, HH:mm' : 'MMM d, h:mm a');
  };

  return (
    <>
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors group">
        <Checkbox
          checked={todo.completed}
          onCheckedChange={handleToggle}
          disabled={isLoading || isEditing}
          className="mt-1"
        />

        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
            autoFocus
          />
        ) : (
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row */}
            <div className="flex items-start gap-2 flex-wrap">
              <p
                className={cn(
                  'text-sm font-medium',
                  todo.completed && 'line-through text-muted-foreground'
                )}
              >
                {todo.title}
              </p>

              {/* Priority badge */}
              {todo.priority !== 'none' && (
                <Badge
                  variant="secondary"
                  className={cn('text-[10px] px-2 py-0 h-5 shrink-0', priorityConfig[todo.priority].color)}
                >
                  <Flag className="h-3 w-3 mr-1" />
                  {priorityConfig[todo.priority].label}
                </Badge>
              )}

              {/* Public badge */}
              {todo.is_public && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 shrink-0">
                  <Globe className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {/* Due date */}
              {todo.due_date && (
                <div className={cn('flex items-center gap-1', getDueDateColor())}>
                  <Calendar className="h-3 w-3" />
                  <span>{formatDueDate(todo.due_date)}</span>
                </div>
              )}

              {/* Location */}
              {todo.location_name && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{todo.location_name}</span>
                </div>
              )}

              {/* Recurring */}
              {todo.recurrence_rule && (
                <div className="flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  <span>Repeats {todo.recurrence_rule.split(':')[0]}</span>
                </div>
              )}

              {/* Attachments count */}
              {todo.attachments && todo.attachments.length > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  <span>{todo.attachments.length}</span>
                </div>
              )}

              {/* Notes indicator */}
              {todo.notes && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>Note</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {todo.tags && todo.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {todo.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] px-2 py-0 h-5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isEditing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                disabled={isLoading || !editTitle.trim()}
                className="h-8 w-8"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShareOpen(true)}
                disabled={isLoading}
                title="Share"
                className="h-8 w-8"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                title="Edit"
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={isLoading}
                title="Delete"
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <ShareTodoDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        todoId={todo.id}
        todoTitle={todo.title}
        isPublic={todo.is_public}
        onTogglePublic={() => onTogglePublic(todo.id)}
        onShare={(email, perm) => onShare(todo.id, email, perm)}
        onRemoveShare={onRemoveShare}
        getShares={getShares}
      />
    </>
  );
}
