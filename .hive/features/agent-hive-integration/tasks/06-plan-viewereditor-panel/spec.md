# Task: 06-plan-viewereditor-panel

## Feature: agent-hive-integration

## Dependencies

- **4. HiveView root component with sidebar + content layout** (04-hiveview-root-component-with-sidebar--content-layout)

## Plan Section

### 6. Plan viewer/editor panel

**Depends on**: 4

**Files:**
- Create: `packages/ui/src/components/views/hive/panels/PlanPanel.tsx`

**What to do:**

- Step 1: Create `PlanPanel.tsx` — markdown plan viewer with edit mode and approve action:
  ```tsx
  import React, { useState, useEffect, useCallback } from 'react';
  import { useHiveStore } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
  import { RiArrowLeftLine, RiCheckLine, RiEditLine, RiSaveLine } from '@remixicon/react';
  import { Textarea } from '@/components/ui/textarea';
  import { Button } from '@/components/ui/button';
  import { toast } from '@/components/ui';

  export const PlanPanel: React.FC = () => {
    const directory = useEffectiveDirectory();
    const detail = useHiveStore(s => s.featureDetail);
    const selectedFeature = useHiveStore(s => s.selectedFeatureName);
    const setActivePanel = useHiveStore(s => s.setActivePanel);
    const savePlan = useHiveStore(s => s.savePlan);
    const approvePlan = useHiveStore(s => s.approvePlan);
    const syncTasks = useHiveStore(s => s.syncTasks);

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');

    const plan = detail?.plan;

    useEffect(() => {
      if (plan) setEditContent(plan.content);
    }, [plan]);

    const handleSave = useCallback(async () => {
      if (!directory || !selectedFeature) return;
      await savePlan(directory, selectedFeature, editContent);
      setIsEditing(false);
      toast.success('Plan saved');
    }, [directory, selectedFeature, editContent, savePlan]);

    const handleApprove = useCallback(async () => {
      if (!directory || !selectedFeature) return;
      await approvePlan(directory, selectedFeature);
      toast.success('Plan approved');
    }, [directory, selectedFeature, approvePlan]);

    const handleSyncTasks = useCallback(async () => {
      if (!directory || !selectedFeature) return;
      await syncTasks(directory, selectedFeature);
      toast.success('Tasks synced from plan');
    }, [directory, selectedFeature, syncTasks]);

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => setActivePanel('feature')}
              className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
              <RiArrowLeftLine size={16} />
            </button>
            <span className="typography-ui-label">Plan</span>
            {plan?.isApproved && (
              <span className="px-1.5 py-0.5 rounded typography-micro bg-status-success-background text-status-success">
                Approved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <Button size="sm" onClick={handleSave}>
                <RiSaveLine size={14} className="mr-1" /> Save
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                  <RiEditLine size={14} className="mr-1" /> Edit
                </Button>
                {plan && !plan.isApproved && (
                  <Button size="sm" onClick={handleApprove}>
                    <RiCheckLine size={14} className="mr-1" /> Approve
                  </Button>
                )}
                {plan?.isApproved && (
                  <Button size="sm" variant="outline" onClick={handleSyncTasks}>
                    Sync Tasks
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {!plan ? (
            <div className="text-muted-foreground typography-ui">
              No plan yet. Click Edit to write one.
              <Button size="sm" className="ml-2" onClick={() => { setIsEditing(true); setEditContent(''); }}>
                <RiEditLine size={14} className="mr-1" /> Create Plan
              </Button>
            </div>
          ) : isEditing ? (
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-full min-h-[400px] font-mono text-sm resize-none"
              placeholder="# Feature Plan\n\n## Discovery\n\n..."
            />
          ) : (
            <pre className="whitespace-pre-wrap typography-ui text-foreground font-mono text-sm leading-relaxed">
              {plan.content}
            </pre>
          )}
        </div>
      </div>
    );
  };
  ```

**Must NOT do:**
- Do not implement rich markdown rendering (monospace pre is fine for v1)
- Do not implement the plan comment system (VS Code-specific)

**References:**
- `packages/ui/src/components/ui/textarea.tsx` — Textarea component
- `packages/ui/src/components/ui/button.tsx` — Button variants

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Plan displays in read mode, switches to edit mode, saves

---
