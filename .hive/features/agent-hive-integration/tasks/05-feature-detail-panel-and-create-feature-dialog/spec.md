# Task: 05-feature-detail-panel-and-create-feature-dialog

## Feature: agent-hive-integration

## Dependencies

- **4. HiveView root component with sidebar + content layout** (04-hiveview-root-component-with-sidebar--content-layout)

## Plan Section

### 5. Feature detail panel and create feature dialog

**Depends on**: 4

**Files:**
- Create: `packages/ui/src/components/views/hive/panels/FeaturePanel.tsx`
- Create: `packages/ui/src/components/views/hive/dialogs/CreateFeatureDialog.tsx`

**What to do:**

- Step 1: Create `FeaturePanel.tsx` — displays selected feature overview with navigation to plan/tasks/context:
  ```tsx
  import React from 'react';
  import { useHiveStore } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
  import { StatusBadge } from '../sidebar/StatusBadge';
  import { RiFileTextLine, RiListCheck2, RiArticleLine, RiLinkM } from '@remixicon/react';

  export const FeaturePanel: React.FC = () => {
    const directory = useEffectiveDirectory();
    const detail = useHiveStore(s => s.featureDetail);
    const selectedFeature = useHiveStore(s => s.selectedFeatureName);
    const setActivePanel = useHiveStore(s => s.setActivePanel);
    const fetchFeatureDetail = useHiveStore(s => s.fetchFeatureDetail);
    const isLoading = useHiveStore(s => s.isLoadingDetail);

    React.useEffect(() => {
      if (directory && selectedFeature) {
        fetchFeatureDetail(directory, selectedFeature);
      }
    }, [directory, selectedFeature]);

    if (!selectedFeature) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground typography-ui">
          Select a feature from the sidebar
        </div>
      );
    }

    if (isLoading || !detail) {
      return <div className="p-4 text-muted-foreground">Loading...</div>;
    }

    const { feature, plan, tasks, contextFiles, sessions } = detail;
    const doneTasks = tasks.filter(t => t.status === 'done').length;

    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h2 className="typography-ui-header text-foreground">{feature.name}</h2>
          <StatusBadge status={feature.status} />
          {feature.ticket && (
            <span className="typography-micro text-muted-foreground">{feature.ticket}</span>
          )}
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActivePanel('plan')}
            className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-interactive-hover text-left">
            <RiFileTextLine size={20} className="text-muted-foreground" />
            <div>
              <div className="typography-ui">Plan</div>
              <div className="typography-micro text-muted-foreground">
                {plan ? (plan.isApproved ? 'Approved' : 'Draft') : 'No plan yet'}
              </div>
            </div>
          </button>

          <button onClick={() => setActivePanel('tasks')}
            className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-interactive-hover text-left">
            <RiListCheck2 size={20} className="text-muted-foreground" />
            <div>
              <div className="typography-ui">Tasks</div>
              <div className="typography-micro text-muted-foreground">
                {doneTasks}/{tasks.length} completed
              </div>
            </div>
          </button>

          <button onClick={() => setActivePanel('context')}
            className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-interactive-hover text-left">
            <RiArticleLine size={20} className="text-muted-foreground" />
            <div>
              <div className="typography-ui">Context</div>
              <div className="typography-micro text-muted-foreground">
                {contextFiles.length} file(s)
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 p-3 rounded-lg border border-border text-left">
            <RiLinkM size={20} className="text-muted-foreground" />
            <div>
              <div className="typography-ui">Sessions</div>
              <div className="typography-micro text-muted-foreground">
                {sessions.length} linked
              </div>
            </div>
          </div>
        </div>

        {/* Sessions list */}
        {sessions.length > 0 && (
          <div>
            <h3 className="typography-ui-label text-muted-foreground mb-2">Linked Sessions</h3>
            <div className="space-y-1">
              {sessions.map(s => (
                <div key={s.sessionId} className="flex items-center justify-between px-2 py-1 rounded bg-surface-muted typography-micro">
                  <span className="truncate">{s.sessionId}</span>
                  {s.taskFolder && <span className="text-muted-foreground">{s.taskFolder}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="typography-micro text-muted-foreground space-y-0.5">
          <div>Created: {new Date(feature.createdAt).toLocaleString()}</div>
          {feature.approvedAt && <div>Approved: {new Date(feature.approvedAt).toLocaleString()}</div>}
          {feature.completedAt && <div>Completed: {new Date(feature.completedAt).toLocaleString()}</div>}
        </div>
      </div>
    );
  };
  ```

- Step 2: Create `CreateFeatureDialog.tsx`:
  ```tsx
  import React, { useState } from 'react';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { useHiveStore } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  export const CreateFeatureDialog: React.FC<Props> = ({ open, onOpenChange }) => {
    const [name, setName] = useState('');
    const [ticket, setTicket] = useState('');
    const createFeature = useHiveStore(s => s.createFeature);
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
              <label className="typography-micro text-muted-foreground mb-1 block">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. user-auth-flow" autoFocus />
            </div>
            <div>
              <label className="typography-micro text-muted-foreground mb-1 block">Ticket (optional)</label>
              <Input value={ticket} onChange={e => setTicket(e.target.value)}
                placeholder="e.g. PROJ-123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  ```

- Step 3: Verify:
  ```bash
  bun run type-check:ui
  ```

**Must NOT do:**
- Do not auto-navigate to sessions (just display them)
- Do not add feature deletion (dangerous, not in VS Code extension either)

**References:**
- `packages/ui/src/components/views/git/GitHeader.tsx` — Header pattern
- `packages/ui/src/components/ui/dialog.tsx` — Dialog component API

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Feature panel shows overview with navigation cards
- [ ] Create dialog validates name input

---
