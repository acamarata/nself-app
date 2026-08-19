/**
 * DraggableTodoList.tsx — Drag-and-drop sortable todo item list
 * Purpose: Wrap TodoItem rows with @dnd-kit/sortable to allow fractional
 *          sort_order reordering via keyboard + pointer drag.
 * Inputs:  todos (NpTask[]), onReorder(id, newSortOrder) callback.
 * Outputs: Sorted list with drag handles; emits reorder on drop.
 * Constraints: Keyboard accessible (Space/Enter to grab, arrows to move).
 *              Fractional index via between() helper. WCAG drag semantics.
 *              ≤200 lines. SPORT: D2-S7
 */
import { useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TodoItem } from './TodoItem'
import type { NpTask } from '@/lib/graphql'

// ── Drag handle icon ─────────────────────────────────────────────────────────

function DragHandleIcon() {
  return (
    <svg
      className="h-4 w-4 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.25" fill="currentColor" />
      <circle cx="11" cy="4" r="1.25" fill="currentColor" />
      <circle cx="5" cy="8" r="1.25" fill="currentColor" />
      <circle cx="11" cy="8" r="1.25" fill="currentColor" />
      <circle cx="5" cy="12" r="1.25" fill="currentColor" />
      <circle cx="11" cy="12" r="1.25" fill="currentColor" />
    </svg>
  )
}

// ── Sortable row wrapper ──────────────────────────────────────────────────────

interface SortableRowProps {
  todo: NpTask
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SortableRow({ todo, onToggle, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  }

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1">
      {/* Drag handle — visually hidden until hover/focus */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        aria-roledescription="sortable"
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded"
        tabIndex={0}
      >
        <DragHandleIcon />
      </button>

      <div className="flex-1 min-w-0">
        <TodoItem
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface DraggableTodoListProps {
  todos: NpTask[]
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Called when user drops an item; receives the id and new numeric position */
  onReorder: (id: string, newPosition: number) => void
}

export function DraggableTodoList({
  todos,
  onToggle,
  onDelete,
  onReorder,
}: DraggableTodoListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = todos.findIndex((t) => t.id === active.id)
      const newIndex = todos.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // Compute numeric position between neighbors
      const prevPos = todos[newIndex - 1]?.position ?? null
      const nextPos = todos[newIndex]?.position ?? null
      const lo = prevPos ?? 0
      const hi = nextPos ?? lo + 2000
      const newPosition = (lo + hi) / 2

      onReorder(String(active.id), newPosition)
    },
    [todos, onReorder]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label="Tasks" role="list" className="space-y-1">
          {todos.map((todo) => (
            <li key={todo.id}>
              <SortableRow
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
