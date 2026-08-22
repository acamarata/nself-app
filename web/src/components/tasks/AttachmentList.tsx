/**
 * AttachmentList.tsx — List of file attachments for a task
 * Purpose: Display np_attachments with image thumbnails, file icons, delete + download.
 * Inputs: todoId (string).
 * Outputs: Attachment grid; optimistic delete; download URLs via Hasura getDownloadUrl action.
 * Constraints: Optimistic remove on delete; WCAG aria labels; <300 lines.
 * SPORT: D2-S7-T1
 */
import { useEffect, useState } from 'react'
import { useScreenState } from '@/hooks/useScreenState'
import { useT } from '@/lib/i18n'
import { getAttachments, deleteAttachment, getDownloadUrl } from '@/lib/graphql-attachments'
import type { NpAttachment } from '@/lib/graphql-attachments'

interface AttachmentListProps {
  todoId: string
  /** Extra items added by AttachmentDropzone (optimistic) */
  newItems?: NpAttachment[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon() {
  return (
    <svg
      className="h-8 w-8 text-gray-400 dark:text-gray-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface AttachmentItemProps {
  attachment: NpAttachment
  url: string
  onDelete: (id: string) => void
  tDelete: string
  tDownload: string
}

function AttachmentItem({ attachment, url, onDelete, tDelete, tDownload }: AttachmentItemProps) {
  const isImage = attachment.mime_type.startsWith('image/')

  return (
    <div className="group relative flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center justify-center h-16 bg-gray-50 dark:bg-gray-800/50">
        {isImage ? (
          <img
            src={url}
            alt={attachment.file_name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <FileIcon />
        )}
      </div>

      <div className="px-2 py-1.5 flex-1 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${tDownload}: ${attachment.file_name}`}
          className="block text-xs font-medium text-gray-800 dark:text-gray-200 truncate hover:underline"
        >
          {attachment.file_name}
        </a>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatSize(attachment.file_size_bytes)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onDelete(attachment.id)}
        aria-label={`${tDelete}: ${attachment.file_name}`}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-white/80 dark:bg-gray-800/80 text-gray-400 hover:text-red-500 transition-all"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

export function AttachmentList({ todoId, newItems = [] }: AttachmentListProps) {
  const t = useT('tasks')
  const [attachments, setAttachments] = useState<NpAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urlCache, setUrlCache] = useState<Record<string, string>>({})

  const combined = [...attachments, ...newItems.filter((n) => !attachments.some((a) => a.id === n.id))]
  const screen = useScreenState({ loading, data: combined, error })

  async function loadDownloadUrl(attachment: NpAttachment) {
    if (urlCache[attachment.id]) return
    const result = await getDownloadUrl(attachment.id)
    if (result) {
      setUrlCache((prev) => ({ ...prev, [attachment.id]: result.downloadUrl }))
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getAttachments(todoId)
      if (!cancelled) {
        setAttachments(result)
        setLoading(false)
        result.forEach((a) => { void loadDownloadUrl(a) })
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoId])

  useEffect(() => {
    newItems.forEach((a) => { void loadDownloadUrl(a) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItems])

  async function handleDelete(id: string) {
    const previous = attachments
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    const ok = await deleteAttachment(id)
    if (!ok) setAttachments(previous)
  }

  return (
    <div className="mt-3">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('attachments.title')}
        {combined.length > 0 && (
          <span className="ml-1.5 text-xs text-gray-400">({combined.length})</span>
        )}
      </h3>

      {screen.isLoading && (
        <p className="text-sm text-gray-400 animate-pulse">{t('states.loading')}</p>
      )}

      {screen.isError && !screen.isLoading && (
        <p className="text-sm text-red-500">{t('states.error')}</p>
      )}

      {!screen.isLoading && screen.isEmpty && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-1">
          {t('attachments.empty')}
        </p>
      )}

      {!screen.isLoading && combined.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {combined.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              url={urlCache[attachment.id] ?? '#pending'}
              onDelete={handleDelete}
              tDelete={t('attachments.delete')}
              tDownload={t('attachments.download')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
