import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { todoService, type TodoShare, type ShareTodoInput } from '@/lib/services/todos';
import type { Todo, CreateTodoInput, UpdateTodoInput, TodoFilters, TodoPriority } from '@/lib/types/todos';

export function useTodos(listId: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await todoService.getTodos(listId);
      setTodos(data);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast.error('Error loading todos', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchTodos();

    const unsubscribe = todoService.subscribeToTodos(listId, (updatedTodos) => {
      setTodos(updatedTodos);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTodos, listId]);

  const createTodo = useCallback(async (input: CreateTodoInput) => {
    try {
      const newTodo = await todoService.createTodo(input);
      setTodos((prev) => [newTodo, ...prev]);
      toast.success('Todo created');
      return newTodo;
    } catch (err) {
      const error = err as Error;
      toast.error('Error creating todo', { description: error.message });
      throw error;
    }
  }, []);

  const updateTodo = useCallback(async (id: string, input: UpdateTodoInput) => {
    try {
      const updatedTodo = await todoService.updateTodo(id, input);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
      return updatedTodo;
    } catch (err) {
      const error = err as Error;
      toast.error('Error updating todo', { description: error.message });
      throw error;
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    try {
      await todoService.deleteTodo(id);
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
      toast.success('Todo deleted');
    } catch (err) {
      const error = err as Error;
      toast.error('Error deleting todo', { description: error.message });
      throw error;
    }
  }, []);

  const toggleTodo = useCallback(async (id: string) => {
    try {
      const updatedTodo = await todoService.toggleTodo(id);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
      return updatedTodo;
    } catch (err) {
      const error = err as Error;
      toast.error('Error toggling todo', { description: error.message });
      throw error;
    }
  }, []);

  const togglePublic = useCallback(async (id: string) => {
    try {
      const updatedTodo = await todoService.togglePublic(id);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
      toast.success(updatedTodo.is_public ? 'Todo is now public' : 'Todo is now private');
      return updatedTodo;
    } catch (err) {
      const error = err as Error;
      toast.error('Error updating visibility', { description: error.message });
      throw error;
    }
  }, []);

  const shareTodo = useCallback(async (input: ShareTodoInput) => {
    try {
      const share = await todoService.shareTodo(input);
      toast.success(`Shared with ${input.shared_with_email}`);
      return share;
    } catch (err) {
      const error = err as Error;
      toast.error('Error sharing todo', { description: error.message });
      throw error;
    }
  }, []);

  const removeShare = useCallback(async (shareId: string) => {
    try {
      await todoService.removeShare(shareId);
      toast.success('Share removed');
    } catch (err) {
      const error = err as Error;
      toast.error('Error removing share', { description: error.message });
      throw error;
    }
  }, []);

  const getShares = useCallback(async (todoId: string) => {
    try {
      return await todoService.getShares(todoId);
    } catch (err) {
      const error = err as Error;
      toast.error('Error loading shares', { description: error.message });
      throw error;
    }
  }, []);

  // --- New Methods for Advanced Features ---

  const uploadAttachment = useCallback(async (todoId: string, file: File) => {
    try {
      const attachment = await todoService.uploadAttachment(todoId, file);
      toast.success('Attachment uploaded');
      await fetchTodos(); // Refresh to get updated attachments
      return attachment;
    } catch (err) {
      const error = err as Error;
      toast.error('Error uploading attachment', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const deleteAttachment = useCallback(async (todoId: string, attachmentId: string) => {
    try {
      await todoService.deleteAttachment(todoId, attachmentId);
      toast.success('Attachment deleted');
      await fetchTodos(); // Refresh to get updated attachments
    } catch (err) {
      const error = err as Error;
      toast.error('Error deleting attachment', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const bulkComplete = useCallback(async (todoIds: string[]) => {
    try {
      await todoService.bulkComplete(todoIds);
      toast.success(`${todoIds.length} todos completed`);
      await fetchTodos();
    } catch (err) {
      const error = err as Error;
      toast.error('Error completing todos', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const bulkDelete = useCallback(async (todoIds: string[]) => {
    try {
      await todoService.bulkDelete(todoIds);
      toast.success(`${todoIds.length} todos deleted`);
      await fetchTodos();
    } catch (err) {
      const error = err as Error;
      toast.error('Error deleting todos', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const bulkSetPriority = useCallback(async (todoIds: string[], priority: TodoPriority) => {
    try {
      await todoService.bulkSetPriority(todoIds, priority);
      toast.success('Priority updated');
      await fetchTodos();
    } catch (err) {
      const error = err as Error;
      toast.error('Error updating priority', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const bulkAddTag = useCallback(async (todoIds: string[], tag: string) => {
    try {
      await todoService.bulkAddTag(todoIds, tag);
      toast.success('Tag added');
      await fetchTodos();
    } catch (err) {
      const error = err as Error;
      toast.error('Error adding tag', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  const completeRecurringInstance = useCallback(async (parentTodoId: string, date: string) => {
    try {
      await todoService.completeRecurringInstance(parentTodoId, date);
      toast.success('Recurring todo completed for today');
      await fetchTodos();
    } catch (err) {
      const error = err as Error;
      toast.error('Error completing recurring todo', { description: error.message });
      throw error;
    }
  }, [fetchTodos]);

  return {
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
    uploadAttachment,
    deleteAttachment,
    bulkComplete,
    bulkDelete,
    bulkSetPriority,
    bulkAddTag,
    completeRecurringInstance,
    refetch: fetchTodos,
  };
}

export function useTodo(id: string) {
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTodo() {
      try {
        setLoading(true);
        setError(null);
        const data = await todoService.getTodoById(id);
        setTodo(data);
      } catch (err) {
        const error = err as Error;
        setError(error);
        toast.error('Error loading todo', { description: error.message });
      } finally {
        setLoading(false);
      }
    }

    fetchTodo();
  }, [id]);

  return { todo, loading, error };
}
