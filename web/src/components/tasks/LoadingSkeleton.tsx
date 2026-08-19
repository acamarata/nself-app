/**
 * LoadingSkeleton.tsx — ɳTask list and todo loading skeletons
 *
 * Purpose:    Animated placeholder components for the list and todo views while
 *             GraphQL data is loading.
 * Inputs:     None
 * Outputs:    ListSkeleton and TodoSkeleton components
 * Constraints: Must visually match real list/todo card dimensions
 */
export function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  )
}

export function TodoSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
