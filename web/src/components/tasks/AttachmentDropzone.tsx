/**
 * AttachmentDropzone.tsx — File upload dropzone for task attachments
 * Purpose: Drag-and-drop + click-to-attach with 25MB guard, upload progress,
 *          and presigned PUT upload via Hasura getUploadUrl action.
 * Inputs: todoId (string), onUploaded callback.
 * Outputs: Calls createAttachment() mutation after presigned upload completes.
 * Constraints: WCAG role=button on drop zone; 25MB client-side limit; <300 lines.
 * SPORT: D2-S7-T1
 */
import { useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { createAttachment, getUploadUrl } from '@/lib/graphql-attachments'
import type { NpAttachment } from '@/lib/graphql-attachments'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

type UploadStatus = 'idle' | 'uploading' | 'error'

interface AttachmentDropzoneProps {
  todoId: string
  onUploaded: (attachment: NpAttachment) => void
}

async function uploadFile(file: File, todoId: string): Promise<string | null> {
  const result = await getUploadUrl(file.name, file.type || 'application/octet-stream', todoId)
  if (!result) return null
  const res = await fetch(result.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  if (!res.ok) return null
  return result.storagePath
}

export function AttachmentDropzone({ todoId, onUploaded }: AttachmentDropzoneProps) {
  const t = useT('tasks')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [sizeError, setSizeError] = useState<string | null>(null)

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    setSizeError(null)

    const oversized = fileArray.filter((f) => f.size >= MAX_BYTES)
    if (oversized.length > 0) {
      setSizeError(t('attachments.tooLarge'))
      return
    }

    setStatus('uploading')
    try {
      for (const file of fileArray) {
        const storageKey = await uploadFile(file, todoId)
        if (!storageKey) {
          setStatus('error')
          return
        }
        const result = await createAttachment({
          todo_id: todoId,
          filename: file.name,
          size_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          storage_key: storageKey,
        })
        if (result) onUploaded(result)
      }
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="mt-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('attachments.drop')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-brand-primary bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600',
        ].join(' ')}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-indigo-50/80 dark:bg-indigo-900/40 pointer-events-none">
            <span className="text-sm font-medium text-brand-primary">{t('attachments.drop')}</span>
          </div>
        )}

        <svg
          className="mb-2 h-6 w-6 text-gray-400 dark:text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {status === 'uploading' ? (
          <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            {t('attachments.uploading')}
          </span>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('attachments.attach')}
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleInputChange}
        />
      </div>

      {status === 'error' && (
        <p role="alert" className="mt-1.5 text-xs text-red-500">
          {t('attachments.error')}
        </p>
      )}

      {sizeError && (
        <p role="alert" className="mt-1.5 text-xs text-red-500">
          {sizeError}
        </p>
      )}
    </div>
  )
}
