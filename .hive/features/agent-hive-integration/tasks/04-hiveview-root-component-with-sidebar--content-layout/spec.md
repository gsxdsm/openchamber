# Task: 04-hiveview-root-component-with-sidebar--content-layout

## Feature: agent-hive-integration

## Dependencies

- **2. Zustand Hive store** (02-zustand-hive-store)
- **3. Register the Hive tab in OpenChamber navigation** (03-register-the-hive-tab-in-openchamber-navigation)

## Plan Section

### 4. HiveView root component with sidebar + content layout

**Depends on**: 2, 3

**Files:**
- Modify: `packages/ui/src/components/views/HiveView.tsx` (replace stub)
- Create: `packages/ui/src/components/views/hive/HiveEmptyState.tsx`
- Create: `packages/ui/src/components/views/hive/HiveHeader.tsx`
- Create: `packages/ui/src/components/views/hive/sidebar/HiveSidebar.tsx`

**What to do:**

- Step 1: Create `HiveEmptyState.tsx` — shown when `.hive/` doesn't exist:
  ```tsx
  import React from 'react';
  import { RiHexagonLine } from '@remixicon/react';

  export const HiveEmptyState: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
      <RiHexagonLine size={48} className="opacity-40" />
      <p className="typography-ui-header">No Hive Detected</p>
      <p className="typography-ui text-center max-w-md">
        No <code>.hive/</code> directory found in this project. Start a Hive
        session from your AI agent to initialize feature tracking.
      </p>
    </div>
  );
  ```

- Step 2: Create `HiveHeader.tsx` — action bar with refresh + create feature:
  ```tsx
  import React from 'react';
  import { RiRefreshLine, RiAddLine } from '@remixicon/react';

  interface HiveHeaderProps {
    onRefresh: () => void;
    onCreateFeature: () => void;
    isLoading: boolean;
  }

  export const HiveHeader: React.FC<HiveHeaderProps> = ({ onRefresh, onCreateFeature, isLoading }) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <span className="typography-ui-label text-muted-foreground">Features</span>
      <div className="flex items-center gap-1">
        <button onClick={onRefresh} className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          disabled={isLoading} title="Refresh">
          <RiRefreshLine size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
        <button onClick={onCreateFeature} className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          title="Create Feature">
          <RiAddLine size={16} />
        </button>
      </div>
    </div>
  );
  ```

- Step 3: Create `HiveSidebar.tsx` — feature list grouped by status:
  ```tsx
  import React from 'react';
  import { useHiveStore, type HiveFeature, type FeatureStatus } from '@/stores/useHiveStore';
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
  import { RiArrowRightSLine } from '@remixicon/react';
  import { cn } from '@/lib/utils';
  import { StatusBadge } from './StatusBadge';

  const STATUS_GROUPS: { key: FeatureStatus; label: string; defaultOpen: boolean }[] = [
    { key: 'executing', label: 'In Progress', defaultOpen: true },
    { key: 'approved', label: 'Approved', defaultOpen: true },
    { key: 'planning', label: 'Planning', defaultOpen: true },
    { key: 'completed', label: 'Completed', defaultOpen: false },
  ];

  export const HiveSidebar: React.FC = () => {
    const features = useHiveStore(s => s.features);
    const selectedFeatureName = useHiveStore(s => s.selectedFeatureName);
    const activeFeatureName = useHiveStore(s => s.activeFeatureName);
    const selectFeature = useHiveStore(s => s.selectFeature);

    const grouped = React.useMemo(() => {
      const map = new Map<FeatureStatus, HiveFeature[]>();
      for (const f of features) {
        const list = map.get(f.status) || [];
        list.push(f);
        map.set(f.status, list);
      }
      return map;
    }, [features]);

    return (
      <div className="flex flex-col overflow-y-auto">
        {STATUS_GROUPS.map(group => {
          const items = grouped.get(group.key) || [];
          if (items.length === 0) return null;
          return (
            <Collapsible key={group.key} defaultOpen={group.defaultOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 px-3 py-1.5 w-full text-left typography-micro text-muted-foreground hover:bg-interactive-hover">
                <RiArrowRightSLine size={14} className="transition-transform [[data-state=open]>&]:rotate-90" />
                {group.label} ({items.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                {items.map(f => (
                  <button
                    key={f.name}
                    onClick={() => selectFeature(f.name)}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-1.5 text-left typography-ui hover:bg-interactive-hover',
                      selectedFeatureName === f.name && 'bg-interactive-selection text-interactive-selection-foreground',
                    )}
                  >
                    <span className="truncate">
                      {f.name === activeFeatureName && '● '}
                      {f.name}
                    </span>
                    <StatusBadge status={f.status} />
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };
  ```

- Step 4: Create `StatusBadge.tsx`:
  ```tsx
  import React from 'react';
  import { cn } from '@/lib/utils';
  import type { FeatureStatus, TaskStatusType } from '@/stores/useHiveStore';

  const STATUS_COLORS: Record<string, string> = {
    planning: 'bg-status-info-background text-status-info',
    approved: 'bg-status-success-background text-status-success',
    executing: 'bg-status-warning-background text-status-warning',
    completed: 'bg-surface-muted text-muted-foreground',
    pending: 'bg-surface-muted text-muted-foreground',
    in_progress: 'bg-status-warning-background text-status-warning',
    done: 'bg-status-success-background text-status-success',
    cancelled: 'bg-surface-muted text-muted-foreground line-through',
    blocked: 'bg-status-error-background text-status-error',
    failed: 'bg-status-error-background text-status-error',
    partial: 'bg-status-warning-background text-status-warning',
  };

  export const StatusBadge: React.FC<{ status: FeatureStatus | TaskStatusType }> = ({ status }) => (
    <span className={cn('px-1.5 py-0.5 rounded typography-micro', STATUS_COLORS[status] || 'bg-surface-muted text-muted-foreground')}>
      {status.replace('_', ' ')}
    </span>
  );
  ```

- Step 5: Replace `HiveView.tsx` stub with full implementation:
  ```tsx
  import React, { useEffect, useCallback, useState } from 'react';
  import { useHiveStore, useHiveExists } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
  import { HiveEmptyState } from './hive/HiveEmptyState';
  import { HiveHeader } from './hive/HiveHeader';
  import { HiveSidebar } from './hive/sidebar/HiveSidebar';
  import { FeaturePanel } from './hive/panels/FeaturePanel';
  import { PlanPanel } from './hive/panels/PlanPanel';
  import { TasksPanel } from './hive/panels/TasksPanel';
  import { TaskDetailPanel } from './hive/panels/TaskDetailPanel';
  import { ContextPanel } from './hive/panels/ContextPanel';
  import { CreateFeatureDialog } from './hive/dialogs/CreateFeatureDialog';
  import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';

  export const HiveView: React.FC = () => {
    const directory = useEffectiveDirectory();
    const hiveExists = useHiveExists();
    const isLoading = useHiveStore(s => s.isLoading);
    const activePanel = useHiveStore(s => s.activePanel);
    const fetchHiveStatus = useHiveStore(s => s.fetchHiveStatus);
    const fetchFeatures = useHiveStore(s => s.fetchFeatures);
    const startPolling = useHiveStore(s => s.startPolling);
    const stopPolling = useHiveStore(s => s.stopPolling);
    const refresh = useHiveStore(s => s.refresh);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    useEffect(() => {
      if (directory) {
        fetchHiveStatus(directory);
        fetchFeatures(directory);
        startPolling(directory);
      }
      return () => stopPolling();
    }, [directory]);

    const handleRefresh = useCallback(() => {
      if (directory) refresh(directory);
    }, [directory, refresh]);

    if (!hiveExists) return <HiveEmptyState />;

    const renderPanel = () => {
      switch (activePanel) {
        case 'feature': return <FeaturePanel />;
        case 'plan': return <PlanPanel />;
        case 'tasks': return <TasksPanel />;
        case 'task-detail': return <TaskDetailPanel />;
        case 'context': case 'context-detail': return <ContextPanel />;
        default: return <FeaturePanel />;
      }
    };

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r border-border flex flex-col shrink-0">
            <HiveHeader onRefresh={handleRefresh} onCreateFeature={() => setShowCreateDialog(true)} isLoading={isLoading} />
            <HiveSidebar />
          </div>
          {/* Content */}
          <ScrollableOverlay className="flex-1">
            {renderPanel()}
          </ScrollableOverlay>
        </div>
        <CreateFeatureDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </div>
    );
  };
  ```

- Step 6: Verify:
  ```bash
  bun run type-check:ui
  ```

**Must NOT do:**
- Do not use hardcoded colors — use theme tokens only
- Do not import from any agent-hive package
- Do not add mobile layout yet (desktop-first for v1)

**References:**
- `packages/ui/src/components/views/GitView.tsx:1-50` — Composite view pattern
- `packages/ui/src/components/views/SettingsView.tsx` — Sidebar+content pattern
- `packages/ui/src/components/views/git/GitEmptyState.tsx` — Empty state pattern

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] HiveView renders empty state when no .hive/ directory
- [ ] HiveView renders sidebar + content when .hive/ exists

---
