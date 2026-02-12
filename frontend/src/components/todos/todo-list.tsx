'use client';

import { useTodos } from '@/hooks/use-todos';
import { TodoItem } from './todo-item';
import { CreateTodoForm } from './create-todo-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CreateTodoInput, UpdateTodoInput } from '@/lib/services/todos';

interface TodoListProps {
  listId: string;
}

export function TodoList({ listId }: TodoListProps) {
  const {
    todos,
    loading,
    error,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    togglePublic,
    shareTodo,
    removeShare,
    getShares,
  } = useTodos(listId);

  const handleCreateTodo = async (input: CreateTodoInput) => {
    await createTodo({ ...input, list_id: listId });
  };

  const handleToggleTodo = async (id: string) => {
    await toggleTodo(id);
  };

  const handleUpdateTodo = async (id: string, input: UpdateTodoInput) => {
    await updateTodo(id, input);
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
  };

  const handleTogglePublic = async (id: string) => {
    await togglePublic(id);
  };

  const handleShare = async (todoId: string, email: string, permission: 'view' | 'edit') => {
    await shareTodo({ todo_id: todoId, shared_with_email: email, permission });
  };

  const handleRemoveShare = async (shareId: string) => {
    await removeShare(shareId);
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Todo</CardTitle>
          <CardDescription>Add a new task to your list</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTodoForm onSubmit={handleCreateTodo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Todos</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${todos.length} ${todos.length === 1 ? 'task' : 'tasks'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No todos yet. Create your first task above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={handleToggleTodo}
                  onUpdate={handleUpdateTodo}
                  onDelete={handleDeleteTodo}
                  onTogglePublic={handleTogglePublic}
                  onShare={handleShare}
                  onRemoveShare={handleRemoveShare}
                  getShares={getShares}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
