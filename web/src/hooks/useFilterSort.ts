/**
 * useFilterSort.ts — Filter + sort state synced with URL search params
 * Purpose: Persist filter/sort selections in the URL so views are shareable
 *          and survive browser refresh.
 * Inputs:  None (reads from window.location.search via URLSearchParams).
 * Outputs: { filters, setFilter, sort, setSort, clearAll }
 * Constraints: Uses replaceState (no navigation history entries). ≤120 lines.
 * SPORT: D2-S7-T2
 */
import { useCallback, useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type DueRange = 'all' | 'today' | 'week' | 'overdue' | 'none'
export type SortField = 'created_at' | 'due_date' | 'priority' | 'title'
export type SortDirection = 'asc' | 'desc'
export type StatusFilter = 'all' | 'active' | 'completed'

export interface FilterParams {
  status: StatusFilter
  priority: string
  tagIds: string[]
  dueRange: DueRange
}

export interface SortState {
  field: SortField
  direction: SortDirection
}

export interface UseFilterSortResult {
  filters: FilterParams
  setFilter: <K extends keyof FilterParams>(key: K, value: FilterParams[K]) => void
  sort: SortState
  setSort: (sort: SortState) => void
  clearAll: () => void
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterParams = {
  status: 'all',
  priority: '',
  tagIds: [],
  dueRange: 'all',
}

const DEFAULT_SORT: SortState = {
  field: 'created_at',
  direction: 'desc',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFromParams(): { filters: FilterParams; sort: SortState } {
  const params = new URLSearchParams(window.location.search)
  const tagIds = params.get('tags')
  return {
    filters: {
      status: (params.get('status') as StatusFilter) || DEFAULT_FILTERS.status,
      priority: params.get('priority') ?? '',
      tagIds: tagIds ? tagIds.split(',').filter(Boolean) : [],
      dueRange: (params.get('due') as DueRange) || DEFAULT_FILTERS.dueRange,
    },
    sort: {
      field: (params.get('sortField') as SortField) || DEFAULT_SORT.field,
      direction: (params.get('sortDir') as SortDirection) || DEFAULT_SORT.direction,
    },
  }
}

function writeToParams(filters: FilterParams, sort: SortState): void {
  const params = new URLSearchParams(window.location.search)
  params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  else params.delete('priority')
  if (filters.tagIds.length) params.set('tags', filters.tagIds.join(','))
  else params.delete('tags')
  params.set('due', filters.dueRange)
  params.set('sortField', sort.field)
  params.set('sortDir', sort.direction)
  const newSearch = params.toString()
  const url = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname
  window.history.replaceState(null, '', url)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFilterSort(): UseFilterSortResult {
  const [state, setState] = useState<{ filters: FilterParams; sort: SortState }>(() =>
    readFromParams()
  )

  useEffect(() => {
    writeToParams(state.filters, state.sort)
  }, [state])

  const setFilter = useCallback(
    <K extends keyof FilterParams>(key: K, value: FilterParams[K]) => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, [key]: value },
      }))
    },
    []
  )

  const setSort = useCallback((sort: SortState) => {
    setState((prev) => ({ ...prev, sort }))
  }, [])

  const clearAll = useCallback(() => {
    setState({ filters: DEFAULT_FILTERS, sort: DEFAULT_SORT })
  }, [])

  return { filters: state.filters, setFilter, sort: state.sort, setSort, clearAll }
}
