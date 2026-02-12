import { getBackend } from '../backend';
import type { BackendClient } from '../types/backend';
import { Tables } from '../utils/tables';
import type {
  List,
  ListShare,
  ListPresence,
  CreateListInput,
  UpdateListInput,
  ShareListInput,
  UpdatePresenceInput,
} from '../types/lists';

export class ListService {
  private backend: BackendClient;

  constructor(backendAdapter: BackendClient) {
    this.backend = backendAdapter;
  }

  // ---------------------------------------------------------------------------
  // Lists CRUD
  // ---------------------------------------------------------------------------

  async getLists(): Promise<List[]> {
    const { data, error } = await this.backend.db.query<List>(Tables.LISTS, {
      orderBy: [
        { column: 'is_default', ascending: false },
        { column: 'position', ascending: true },
        { column: 'created_at', ascending: false },
      ],
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async getListById(id: string): Promise<List | null> {
    const { data, error } = await this.backend.db.queryById<List>(Tables.LISTS, id);
    if (error) throw new Error(error);
    return data;
  }

  async createList(input: CreateListInput): Promise<List> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error} = await this.backend.db.insert<List>(Tables.LISTS, {
      user_id: user.id,
      title: input.title,
      description: input.description || '',
      color: input.color || '#6366f1',
      icon: input.icon || 'list',
      is_default: false,
      position: Date.now(),
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to create list');
    return data;
  }

  async updateList(id: string, input: UpdateListInput): Promise<List> {
    const { data, error } = await this.backend.db.update<List>(
      Tables.LISTS,
      id,
      input as Record<string, unknown>
    );

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update list');
    return data;
  }

  async deleteList(id: string): Promise<void> {
    const { error } = await this.backend.db.remove(Tables.LISTS, id);
    if (error) throw new Error(error);
  }

  // ---------------------------------------------------------------------------
  // Sharing
  // ---------------------------------------------------------------------------

  async getListShares(listId: string): Promise<ListShare[]> {
    const { data, error } = await this.backend.db.query<ListShare>(Tables.LIST_SHARES, {
      where: { list_id: listId },
      orderBy: [{ column: 'created_at', ascending: false }],
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async shareList(input: ShareListInput): Promise<ListShare> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await this.backend.db.insert<ListShare>(Tables.LIST_SHARES, {
      list_id: input.list_id,
      shared_with_email: input.shared_with_email,
      permission: input.permission,
      invited_by: user.id,
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to share list');
    return data;
  }

  async updateSharePermission(
    shareId: string,
    permission: 'owner' | 'editor' | 'viewer'
  ): Promise<ListShare> {
    const { data, error } = await this.backend.db.update<ListShare>(
      Tables.LIST_SHARES,
      shareId,
      { permission }
    );

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update share');
    return data;
  }

  async removeShare(shareId: string): Promise<void> {
    const { error } = await this.backend.db.remove(Tables.LIST_SHARES, shareId);
    if (error) throw new Error(error);
  }

  async acceptInvite(shareId: string): Promise<ListShare> {
    const { data, error } = await this.backend.db.update<ListShare>(
      Tables.LIST_SHARES,
      shareId,
      { accepted_at: new Date().toISOString() }
    );

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to accept invite');
    return data;
  }

  // ---------------------------------------------------------------------------
  // Presence
  // ---------------------------------------------------------------------------

  async updatePresence(input: UpdatePresenceInput): Promise<void> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await this.backend.db.rpc('upsert_presence', {
      p_list_id: input.list_id,
      p_user_id: user.id,
      p_status: input.status,
      p_editing_todo_id: input.editing_todo_id || null,
    });

    if (error) throw new Error(error);
  }

  async getListPresence(listId: string): Promise<ListPresence[]> {
    const { data, error } = await this.backend.db.query<ListPresence>(Tables.LIST_PRESENCE, {
      where: { list_id: listId },
      orderBy: [{ column: 'last_seen_at', ascending: false }],
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async leaveList(listId: string): Promise<void> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await this.backend.db.rpc('delete_presence', {
      p_list_id: listId,
      p_user_id: user.id,
    });

    if (error) throw new Error(error);
  }

  // ---------------------------------------------------------------------------
  // Real-time subscriptions
  // ---------------------------------------------------------------------------

  subscribeToLists(callback: (lists: List[]) => void): () => void {
    const channel = this.backend.realtime.channel(Tables.LISTS);

    channel
      .on('*', async () => {
        const lists = await this.getLists();
        callback(lists);
      })
      .subscribe();

    return () => {
      this.backend.realtime.removeChannel(Tables.LISTS);
    };
  }

  subscribeToListPresence(
    listId: string,
    callback: (presence: ListPresence[]) => void
  ): () => void {
    const channelName = `${Tables.LIST_PRESENCE}:${listId}`;
    const channel = this.backend.realtime.channel(channelName);

    channel
      .on('*', async () => {
        const presence = await this.getListPresence(listId);
        callback(presence);
      })
      .subscribe();

    return () => {
      this.backend.realtime.removeChannel(channelName);
    };
  }
}

export const listService = new ListService(getBackend());
