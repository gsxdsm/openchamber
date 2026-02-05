import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHiveStore, useHiveExists } from '@/stores/useHiveStore';
import { useUIStore } from '@/stores/useUIStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import { useHivePolling } from './hive/hooks/useHivePolling';
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
  const isLoading = useHiveStore((s) => s.isLoading);
  const activePanel = useHiveStore((s) => s.activePanel);
  const refresh = useHiveStore((s) => s.refresh);
  const activeMainTab = useUIStore((s) => s.activeMainTab);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Start polling for hive status changes
  useHivePolling(directory);

  // Refresh data whenever the Hive tab becomes active (including first time)
  const prevTabRef = useRef<string | null>(null);
  useEffect(() => {
    const wasHive = prevTabRef.current === 'hive';
    const isHive = activeMainTab === 'hive';
    prevTabRef.current = activeMainTab;

    if (isHive && !wasHive && directory) {
      refresh(directory);
    }
  }, [activeMainTab, directory, refresh]);

  const handleRefresh = useCallback(() => {
    if (directory) refresh(directory);
  }, [directory, refresh]);

  if (!hiveExists) return <HiveEmptyState />;

  const renderPanel = () => {
    switch (activePanel) {
      case 'feature':
        return <FeaturePanel />;
      case 'plan':
        return <PlanPanel />;
      case 'tasks':
        return <TasksPanel />;
      case 'task-detail':
        return <TaskDetailPanel />;
      case 'context':
      case 'context-detail':
        return <ContextPanel />;
      default:
        return <FeaturePanel />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-64 border-r border-border flex flex-col shrink-0">
          <HiveHeader
            onRefresh={handleRefresh}
            onCreateFeature={() => setShowCreateDialog(true)}
            isLoading={isLoading}
          />
          <HiveSidebar />
        </div>
        {/* Content */}
        <ScrollableOverlay className="flex-1">
          {renderPanel()}
        </ScrollableOverlay>
      </div>
      <CreateFeatureDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};
