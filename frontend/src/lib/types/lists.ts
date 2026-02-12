/**
 * List Types - Todo list containers and collaboration
 */

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;

  // Computed fields (from joins)
  todo_count?: number;
  completed_count?: number;
  share_count?: number;
}

export interface ListShare {
  id: string;
  list_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string;
  permission: 'owner' | 'editor' | 'viewer';
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface ListPresence {
  id: string;
  list_id: string;
  user_id: string;
  status: 'viewing' | 'editing';
  editing_todo_id: string | null;
  last_seen_at: string;
  created_at: string;

  // Joined user info
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface CreateListInput {
  title: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateListInput {
  title?: string;
  description?: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface ShareListInput {
  list_id: string;
  shared_with_email: string;
  permission: 'owner' | 'editor' | 'viewer';
}

export interface UpdatePresenceInput {
  list_id: string;
  status: 'viewing' | 'editing';
  editing_todo_id?: string | null;
}
