import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { todoService, type Todo, type TodoShare, type CreateTodoInput, type UpdateTodoInput, type ShareTodoInput } from '@/lib/services/todos';

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
