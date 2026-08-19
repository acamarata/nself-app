/**
 * useAllTodos.ts — Cross-list todo data hook for view pages
 *
 * Purpose:    Shared loading/error/refresh state for Today/Upcoming/Inbox/
 *             Logbook/Calendar/Board — every view that needs todos across
 *             ALL of the user's lists (not scoped to one list_id).
 * Inputs:     none
 * Outputs:    { todos, lists, loading, error, reload, toggle, remove, move }
 * Constraints: Cookie-auth GraphQL only; no polling — caller re-invokes reload().
 * SPORT: view pages — Today/Upcoming/Inbox/Logbook/Calendar/Board.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  getAllTodos,
  getLists,
  toggleTodo,
  deleteTodo,
  updateTodo,
  type NpTask,
  type NpList,
} from '@/lib/graphql'

interface UseAllTodosResult {
  todos: NpTask[]
  lists: NpList[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  toggle: (id: string, completed: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Move a todo to a different list (used by Inbox triage + drag targets). */
  moveToList: (id: string, listId: string) => Promise<void>
  /** Update priority (used by Board drag between priority columns). */
  setPriority: (id: string, priority: NpTask['priority']) => Promise<void>
  /** Update due date (used by Calendar drag-to-reschedule + click-to-reschedule). */
  setDueDate: (id: string, dueDate: string) => Promise<void>
}

export function useAllTodos(): UseAllTodosResult {
  const [todos, setTodos] = useState<NpTask[]>([])
  const [lists, setLists] = useState<NpList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [todosResult, listsResult] = await Promise.all([getAllTodos(), getLists()])
      setTodos(todosResult)
      setLists(listsResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggle = useCallback(async (id: string, completed: boolean) => {
    const ok = await toggleTodo(id, completed)
    if (ok) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)))
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    const ok = await deleteTodo(id)
    if (ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id))
    }
  }, [])

  const moveToList = useCallback(async (id: string, listId: string) => {
    const result = await updateTodo(id, { list_id: listId })
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, list_id: listId } : t)))
    }
  }, [])

  const setPriority = useCallback(async (id: string, priority: NpTask['priority']) => {
    const result = await updateTodo(id, { priority })
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)))
    }
  }, [])

  const setDueDate = useCallback(async (id: string, dueDate: string) => {
    const result = await updateTodo(id, { due_date: dueDate })
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: dueDate } : t)))
    }
  }, [])

  return { todos, lists, loading, error, reload, toggle, remove, moveToList, setPriority, setDueDate }
}
