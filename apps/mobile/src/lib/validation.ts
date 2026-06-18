/**
 * Purpose: Zod-compatible validation schemas for task/project create inputs
 * Inputs: Raw user input objects
 * Outputs: ValidationResult with typed errors; parse helpers
 * Constraints: React Native / Expo compatible — no Node-only deps.
 *   Implements lightweight Zod-like API without importing zod (avoids RN bundler issues
 *   with Zod's use of Error.captureStackTrace on older Hermes). Simple, testable, no magic.
 * SPORT: T-P3-E5-W3-S1-T01-c
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ---------------------------------------------------------------------------
// taskCreateSchema
// ---------------------------------------------------------------------------
export interface TaskCreateInput {
  title: string;
  dueDate?: string | null;
  listId: string;
}

export function taskCreateSchema(input: unknown): ValidationResult<TaskCreateInput> {
  const errors: ValidationError[] = [];
  const raw = input as Record<string, unknown>;

  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    errors.push({ field: 'title', message: 'Title is required.' });
  } else if (title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 200 characters or fewer.' });
  }

  const listId = typeof raw?.listId === 'string' ? raw.listId : '';
  if (!listId) {
    errors.push({ field: 'listId', message: 'List ID is required.' });
  }

  let dueDate: string | null = null;
  if (raw?.dueDate != null && raw.dueDate !== '') {
    const ds = String(raw.dueDate);
    // Accept ISO date (YYYY-MM-DD) or ISO datetime
    const ISO_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;
    if (!ISO_RE.test(ds)) {
      errors.push({ field: 'dueDate', message: 'Due date must be a valid ISO date (YYYY-MM-DD).' });
    } else {
      dueDate = ds;
    }
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: { title, dueDate, listId } };
}

// ---------------------------------------------------------------------------
// projectCreateSchema (list creation)
// ---------------------------------------------------------------------------
export interface ProjectCreateInput {
  title: string;
  color?: string;
}

export function projectCreateSchema(input: unknown): ValidationResult<ProjectCreateInput> {
  const errors: ValidationError[] = [];
  const raw = input as Record<string, unknown>;

  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    errors.push({ field: 'title', message: 'Project name is required.' });
  } else if (title.length > 100) {
    errors.push({ field: 'title', message: 'Project name must be 100 characters or fewer.' });
  }

  let color: string | undefined;
  if (raw?.color != null) {
    const c = String(raw.color);
    if (!/^#[0-9A-Fa-f]{6}$/.test(c)) {
      errors.push({ field: 'color', message: 'Color must be a valid hex value (e.g. #6366f1).' });
    } else {
      color = c;
    }
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: { title, color } };
}
