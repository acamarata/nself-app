import { getBackend } from '../backend';
import type { BackendClient } from '../types/backend';
import { Tables } from '../utils/tables';
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoSortOptions,
  RecurringInstance,
  TodoAttachment,
} from '../types/todos';

export interface TodoShare {
  id: string;
  todo_id: string;
  shared_with_email: string;
  permission: 'view' | 'edit';
  created_at: string;
}

export interface ShareTodoInput {
  todo_id: string;
  shared_with_email: string;
  permission: 'view' | 'edit';
}

export class TodoService {
  private backend: BackendClient;

  constructor(backendAdapter: BackendClient) {
    this.backend = backendAdapter;
  }

  async getTodos(listId?: string): Promise<Todo[]> {
    const where = listId ? { list_id: listId } : undefined;

    const { data, error } = await this.backend.db.query<Todo>(Tables.TODOS, {
      where,
      orderBy: [
        { column: 'position', ascending: true },
        { column: 'created_at', ascending: false },
      ],
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async getTodoById(id: string): Promise<Todo | null> {
    const { data, error } = await this.backend.db.queryById<Todo>(Tables.TODOS, id);

    if (error) throw new Error(error);
    return data;
  }

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await this.backend.db.insert<Todo>(Tables.TODOS, {
      user_id: user.id,
      list_id: input.list_id,
      title: input.title,
      completed: input.completed ?? false,
      is_public: input.is_public ?? false,
      position: Date.now(),
      due_date: input.due_date || null,
      priority: input.priority || 'none',
      tags: input.tags || [],
      notes: input.notes || null,
      reminder_time: input.reminder_time || null,
      location_name: input.location_name || null,
      location_lat: input.location_lat || null,
      location_lng: input.location_lng || null,
      location_radius: input.location_radius || null,
      recurrence_rule: input.recurrence_rule || null,
      attachments: [],
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to create todo');
    return data;
  }

  async updateTodo(id: string, input: UpdateTodoInput): Promise<Todo> {
    const { data, error } = await this.backend.db.update<Todo>(Tables.TODOS, id, input as Record<string, unknown>);

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update todo');
    return data;
  }

  async deleteTodo(id: string): Promise<void> {
    const { error } = await this.backend.db.remove(Tables.TODOS, id);

    if (error) throw new Error(error);
  }

  async toggleTodo(id: string): Promise<Todo> {
    const todo = await this.getTodoById(id);
    if (!todo) throw new Error('Todo not found');

    return this.updateTodo(id, { completed: !todo.completed });
  }

  async togglePublic(id: string): Promise<Todo> {
    const todo = await this.getTodoById(id);
    if (!todo) throw new Error('Todo not found');

    return this.updateTodo(id, { is_public: !todo.is_public });
  }

  // --- Sharing ---

  async getShares(todoId: string): Promise<TodoShare[]> {
    const { data, error } = await this.backend.db.query<TodoShare>(Tables.TODO_SHARES, {
      where: { todo_id: todoId },
      orderBy: [{ column: 'created_at', ascending: false }],
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async shareTodo(input: ShareTodoInput): Promise<TodoShare> {
    const { data, error } = await this.backend.db.insert<TodoShare>(Tables.TODO_SHARES, {
      todo_id: input.todo_id,
      shared_with_email: input.shared_with_email,
      permission: input.permission,
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to share todo');
    return data;
  }

  async removeShare(shareId: string): Promise<void> {
    const { error } = await this.backend.db.remove(Tables.TODO_SHARES, shareId);

    if (error) throw new Error(error);
  }

  async updateSharePermission(shareId: string, permission: 'view' | 'edit'): Promise<TodoShare> {
    const { data, error } = await this.backend.db.update<TodoShare>(Tables.TODO_SHARES, shareId, { permission });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update share');
    return data;
  }

  // --- Advanced Features ---

  async getTodosWithFilters(filters: TodoFilters, sort?: TodoSortOptions): Promise<Todo[]> {
    const where: Record<string, unknown> = {};

    if (filters.listId) where.list_id = filters.listId;
    if (filters.completed !== undefined) where.completed = filters.completed;
    if (filters.priority) where.priority = filters.priority;
    if (filters.hasLocation !== undefined) {
      if (filters.hasLocation) {
        // @ts-expect-error - Backend will understand this filter
        where.location_name = { _is_null: false };
      }
    }
    if (filters.isRecurring !== undefined) {
      if (filters.isRecurring) {
        // @ts-expect-error - Backend will understand this filter
        where.recurrence_rule = { _is_null: false };
      }
    }

    const orderBy = sort
      ? [{ column: sort.field, ascending: sort.ascending ?? true }]
      : [
          { column: 'position', ascending: true },
          { column: 'created_at', ascending: false },
        ];

    let { data, error } = await this.backend.db.query<Todo>(Tables.TODOS, {
      where,
      orderBy,
    });

    if (error) throw new Error(error);
    let todos = data || [];

    // Client-side filters for complex queries
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      todos = todos.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.notes?.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      todos = todos.filter((t) => filters.tags!.some((tag) => t.tags.includes(tag)));
    }

    if (filters.dueBefore) {
      const beforeDate = new Date(filters.dueBefore);
      todos = todos.filter((t) => t.due_date && new Date(t.due_date) <= beforeDate);
    }

    if (filters.dueAfter) {
      const afterDate = new Date(filters.dueAfter);
      todos = todos.filter((t) => t.due_date && new Date(t.due_date) >= afterDate);
    }

    return todos;
  }

  async getOverdueTodos(listId?: string): Promise<Todo[]> {
    const now = new Date().toISOString();
    return this.getTodosWithFilters({
      listId,
      completed: false,
      dueBefore: now,
    });
  }

  async getTodosDueToday(listId?: string): Promise<Todo[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todos = await this.getTodosWithFilters({
      listId,
      completed: false,
    });

    return todos.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate < tomorrow;
    });
  }

  async bulkComplete(todoIds: string[]): Promise<void> {
    await Promise.all(todoIds.map((id) => this.updateTodo(id, { completed: true })));
  }

  async bulkDelete(todoIds: string[]): Promise<void> {
    await Promise.all(todoIds.map((id) => this.deleteTodo(id)));
  }

  async bulkSetPriority(todoIds: string[], priority: string): Promise<void> {
    await Promise.all(todoIds.map((id) => this.updateTodo(id, { priority } as UpdateTodoInput)));
  }

  async bulkAddTag(todoIds: string[], tag: string): Promise<void> {
    for (const id of todoIds) {
      const todo = await this.getTodoById(id);
      if (todo && !todo.tags.includes(tag)) {
        await this.updateTodo(id, { tags: [...todo.tags, tag] });
      }
    }
  }

  async bulkMoveTo(todoIds: string[], listId: string): Promise<void> {
    // Note: This would require updating list_id which may have RLS implications
    // Implementation depends on your RLS policies
    for (const id of todoIds) {
      await this.backend.db.update<Todo>(Tables.TODOS, id, { list_id: listId });
    }
  }

  // --- Recurring Tasks ---

  async getRecurringInstance(todoId: string, date: string): Promise<RecurringInstance | null> {
    const { data, error } = await this.backend.db.query<RecurringInstance>(Tables.RECURRING_INSTANCES, {
      where: { parent_todo_id: todoId, instance_date: date },
    });

    if (error) throw new Error(error);
    return data && data.length > 0 ? data[0] : null;
  }

  async completeRecurringInstance(parentTodoId: string, date: string): Promise<RecurringInstance> {
    // Check if instance already exists
    const existing = await this.getRecurringInstance(parentTodoId, date);

    if (existing) {
      // Update existing instance
      const { data, error } = await this.backend.db.update<RecurringInstance>(
        Tables.RECURRING_INSTANCES,
        existing.id,
        {
          completed: true,
          completed_at: new Date().toISOString(),
        }
      );
      if (error) throw new Error(error);
      if (!data) throw new Error('Failed to update recurring instance');
      return data;
    } else {
      // Create new instance
      const { data, error } = await this.backend.db.insert<RecurringInstance>(Tables.RECURRING_INSTANCES, {
        parent_todo_id: parentTodoId,
        instance_date: date,
        completed: true,
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(error);
      if (!data) throw new Error('Failed to create recurring instance');
      return data;
    }
  }

  async uncompleteRecurringInstance(parentTodoId: string, date: string): Promise<void> {
    const existing = await this.getRecurringInstance(parentTodoId, date);
    if (existing) {
      await this.backend.db.update<RecurringInstance>(Tables.RECURRING_INSTANCES, existing.id, {
        completed: false,
        completed_at: null,
      });
    }
  }

  // --- Attachments ---

  async uploadAttachment(todoId: string, file: File): Promise<TodoAttachment> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Upload file to storage
    const path = `todos/${todoId}/${Date.now()}_${file.name}`;
    const { url, error: uploadError } = await this.backend.storage.upload('attachments', path, file);

    if (uploadError) throw new Error(uploadError);
    if (!url) throw new Error('Failed to upload file');

    // Create attachment record
    const attachment: TodoAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      size: file.size,
      mime_type: file.type,
      uploaded_at: new Date().toISOString(),
    };

    // Update todo with new attachment
    const todo = await this.getTodoById(todoId);
    if (!todo) throw new Error('Todo not found');

    await this.updateTodo(todoId, {
      attachments: [...todo.attachments, attachment],
    } as UpdateTodoInput);

    return attachment;
  }

  async deleteAttachment(todoId: string, attachmentId: string): Promise<void> {
    const todo = await this.getTodoById(todoId);
    if (!todo) throw new Error('Todo not found');

    const attachment = todo.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new Error('Attachment not found');

    // Delete from storage
    const pathMatch = attachment.url.match(/todos\/[^/]+\/[^/]+$/);
    if (pathMatch) {
      await this.backend.storage.remove('attachments', [pathMatch[0]]);
    }

    // Update todo
    await this.updateTodo(todoId, {
      attachments: todo.attachments.filter((a) => a.id !== attachmentId),
    } as UpdateTodoInput);
  }

  subscribeToTodos(listId: string, callback: (todos: Todo[]) => void): () => void {
    const channelName = `${Tables.TODOS}:${listId}`;
    const channel = this.backend.realtime.channel(channelName);

    channel
      .on('*', async () => {
        const todos = await this.getTodos(listId);
        callback(todos);
      })
      .subscribe();

    return () => {
      this.backend.realtime.removeChannel(channelName);
    };
  }
}

export const todoService = new TodoService(getBackend());
