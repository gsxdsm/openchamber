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

export const CreateTaskDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [name, setName] = useState('');
  const createTask = useHiveStore((s) => s.createTask);
  const selectedFeature = useHiveStore((s) => s.selectedFeatureName);
  const directory = useEffectiveDirectory();

  const handleCreate = async () => {
    if (!name.trim() || !directory || !selectedFeature) return;
    await createTask(directory, selectedFeature, name.trim());
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <label className="typography-micro text-muted-foreground mb-1 block">
            Task Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. implement-auth-logic"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
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
