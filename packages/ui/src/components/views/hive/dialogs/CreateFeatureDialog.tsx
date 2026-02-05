import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHiveStore } from '@/stores/useHiveStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateFeatureDialog: React.FC<Props> = ({
  open,
  onOpenChange,
}) => {
  const [name, setName] = useState('');
  const [ticket, setTicket] = useState('');
  const createFeature = useHiveStore((s) => s.createFeature);
  const directory = useEffectiveDirectory();

  const handleCreate = async () => {
    if (!name.trim() || !directory) return;
    await createFeature(directory, name.trim(), ticket.trim() || undefined);
    setName('');
    setTicket('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Feature</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="typography-micro text-muted-foreground mb-1 block">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. user-auth-flow"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="typography-micro text-muted-foreground mb-1 block">
              Ticket (optional)
            </label>
            <Input
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="e.g. PROJ-123"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
