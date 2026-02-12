'use client';

import { useState } from 'react';
import { Copy, Mail, UserX, ChevronDown } from 'lucide-react';
import type { List } from '@/lib/types/lists';
import { useListSharing } from '@/hooks/use-list-sharing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface ShareListDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PERMISSION_LABELS = {
  owner: { label: 'Owner', description: 'Can do everything' },
  editor: { label: 'Editor', description: 'Can add and edit todos' },
  viewer: { label: 'Viewer', description: 'Can only view todos' },
};

export function ShareListDialog({ list, open, onOpenChange }: ShareListDialogProps) {
  const { shares, loading, shareList, updatePermission, removeShare } = useListSharing(
    open ? list.id : null
  );
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'owner' | 'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lists/${list.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    const success = await shareList({
      list_id: list.id,
      shared_with_email: email.trim(),
      permission,
    });

    if (success) {
      setEmail('');
      setPermission('viewer');
    }
    setInviting(false);
  };

  const handleRemoveShare = async (shareId: string) => {
    await removeShare(shareId);
  };

  const handleUpdatePermission = async (
    shareId: string,
    newPermission: 'owner' | 'editor' | 'viewer'
  ) => {
    await updatePermission(shareId, newPermission);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share list</DialogTitle>
          <DialogDescription>
            Collaborate with others on &quot;{list.title}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy link */}
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/lists/${list.id}`}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* Invite by email */}
          <form onSubmit={handleInvite} className="space-y-3">
            <Label>Invite by email</Label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={permission}
                onValueChange={(value: any) => setPermission(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!email.trim() || inviting}>
                <Mail className="mr-2 h-4 w-4" />
                {inviting ? 'Inviting...' : 'Invite'}
              </Button>
            </div>

            {/* Permission descriptions */}
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="mb-1 font-medium">Permissions:</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• <strong>Owner</strong>: Full control (edit, delete, share)</li>
                <li>• <strong>Editor</strong>: Add and edit todos</li>
                <li>• <strong>Viewer</strong>: View-only access</li>
              </ul>
            </div>
          </form>

          {/* People with access */}
          {shares.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>People with access ({shares.length})</Label>
                <div className="max-h-[200px] space-y-2 overflow-y-auto">
                  {shares.map((share) => {
                    const initials = share.user?.display_name
                      ? share.user.display_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                      : share.shared_with_email[0].toUpperCase();

                    return (
                      <div
                        key={share.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-2"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={share.user?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {share.user?.display_name || share.shared_with_email}
                            </span>
                            {!share.accepted_at && (
                              <Badge variant="secondary" className="w-fit text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={share.permission}
                            onValueChange={(value: any) =>
                              handleUpdatePermission(share.id, value)
                            }
                          >
                            <SelectTrigger className="h-8 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveShare(share.id)}
                          >
                            <UserX className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
