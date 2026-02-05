import React from 'react';
import {
  useHiveStore,
  type HiveFeatureSummary,
  type FeatureStatus,
  type TaskStatusType,
  type HivePanel,
} from '@/stores/useHiveStore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  RiArrowRightSLine,
  RiFileTextLine,
  RiFolder3Line,
  RiListCheck2,
  RiCheckLine,
  RiLoader4Line,
  RiCircleLine,
  RiLockLine,
  RiCloseCircleLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';

const STATUS_GROUPS: { key: FeatureStatus; label: string; defaultOpen: boolean }[] = [
  { key: 'executing', label: 'In Progress', defaultOpen: true },
  { key: 'approved', label: 'Approved', defaultOpen: true },
  { key: 'planning', label: 'Planning', defaultOpen: true },
  { key: 'completed', label: 'Completed', defaultOpen: false },
];

const TASK_STATUS_ICONS: Record<TaskStatusType, { icon: React.ElementType; className: string }> = {
  done: { icon: RiCheckLine, className: 'text-status-success' },
  in_progress: { icon: RiLoader4Line, className: 'text-status-info' },
  pending: { icon: RiCircleLine, className: 'text-muted-foreground' },
  blocked: { icon: RiLockLine, className: 'text-status-warning' },
  failed: { icon: RiCloseCircleLine, className: 'text-status-error' },
  cancelled: { icon: RiCloseCircleLine, className: 'text-muted-foreground' },
  partial: { icon: RiCheckLine, className: 'text-status-warning' },
};

interface TaskStatusIconProps {
  status: TaskStatusType;
  size?: number;
}

const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, size = 14 }) => {
  const { icon: Icon, className } = TASK_STATUS_ICONS[status] || TASK_STATUS_ICONS.pending;
  return <Icon size={size} className={className} />;
};

interface TreeNodeProps {
  children: React.ReactNode;
  className?: string;
  isSelected?: boolean;
  onClick?: () => void;
  indent?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  children,
  className,
  isSelected,
  onClick,
  indent = 0,
}) => {
  const paddingLeft = 12 + indent * 16;
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 pr-3 text-left typography-ui',
        onClick && 'cursor-pointer hover:bg-interactive-hover',
        isSelected && 'bg-interactive-selection text-interactive-selection-foreground',
        className
      )}
      style={{ paddingLeft }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface FeatureTreeNodeProps {
  summary: HiveFeatureSummary;
  selectedFeatureName: string | null;
  activeFeatureName: string | null;
  activePanel: HivePanel;
  selectedTaskFolder: string | null;
  selectedContextName: string | null;
  onNavigate: (
    featureName: string,
    panel: HivePanel,
    taskFolder?: string,
    contextName?: string
  ) => void;
}

const FeatureTreeNode: React.FC<FeatureTreeNodeProps> = ({
  summary,
  selectedFeatureName,
  activeFeatureName,
  activePanel,
  selectedTaskFolder,
  selectedContextName,
  onNavigate,
}) => {
  const isFeatureSelected = selectedFeatureName === summary.name && activePanel === 'feature';
  const isPlanSelected = selectedFeatureName === summary.name && activePanel === 'plan';
  const isTasksListSelected = selectedFeatureName === summary.name && activePanel === 'tasks';
  const isContextListSelected = selectedFeatureName === summary.name && activePanel === 'context';

  const hasTasks = summary.tasks.length > 0;
  const hasContext = summary.contextFiles.length > 0;
  const hasPlan = summary.planStatus !== 'none';

  const progressText = `${summary.taskCounts.done}/${summary.taskCounts.total}`;

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <TreeNode
          isSelected={isFeatureSelected}
          onClick={() => onNavigate(summary.name, 'feature')}
          indent={0}
          className="flex-1"
        >
          <RiArrowRightSLine
            size={14}
            className="shrink-0 transition-transform [[data-state=open]>&]:rotate-90"
          />
          <span className="truncate flex-1">
            {summary.name === activeFeatureName && (
              <span className="text-status-success mr-1" title="Active feature">
                ●
              </span>
            )}
            {summary.name}
          </span>
          <StatusBadge status={summary.status} />
        </TreeNode>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Plan node */}
        <TreeNode
          isSelected={isPlanSelected}
          onClick={() => onNavigate(summary.name, 'plan')}
          indent={1}
        >
          <RiFileTextLine size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1">
            Plan
            {hasPlan && summary.commentCount > 0 && (
              <span className="ml-1 text-muted-foreground typography-micro">
                ({summary.commentCount} comment{summary.commentCount !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          {!hasPlan && <span className="text-muted-foreground typography-micro">(none)</span>}
          {hasPlan && summary.planStatus === 'draft' && (
            <span className="text-muted-foreground typography-micro">(Draft)</span>
          )}
          {hasPlan && summary.planStatus === 'approved' && (
            <span className="text-status-success typography-micro">(Approved)</span>
          )}
        </TreeNode>

        {/* Context node */}
        {hasContext ? (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex w-full hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <TreeNode
                isSelected={isContextListSelected}
                onClick={() => onNavigate(summary.name, 'context')}
                indent={1}
                className="flex-1"
              >
                <RiArrowRightSLine
                  size={14}
                  className="shrink-0 transition-transform [[data-state=open]>&]:rotate-90 text-muted-foreground"
                />
                <RiFolder3Line size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1">Context ({summary.contextFiles.length})</span>
              </TreeNode>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {summary.contextFiles.map((fileName) => (
                <TreeNode
                  key={fileName}
                  isSelected={
                    selectedFeatureName === summary.name &&
                    activePanel === 'context-detail' &&
                    selectedContextName === fileName
                  }
                  onClick={() => onNavigate(summary.name, 'context-detail', undefined, fileName)}
                  indent={2}
                >
                  <RiFileTextLine size={12} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{fileName}</span>
                </TreeNode>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <TreeNode indent={1}>
            <RiFolder3Line size={14} className="shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Context (0)</span>
          </TreeNode>
        )}

        {/* Tasks node */}
        {hasTasks ? (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex w-full hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <TreeNode
                isSelected={isTasksListSelected}
                onClick={() => onNavigate(summary.name, 'tasks')}
                indent={1}
                className="flex-1"
              >
                <RiArrowRightSLine
                  size={14}
                  className="shrink-0 transition-transform [[data-state=open]>&]:rotate-90 text-muted-foreground"
                />
                <RiListCheck2 size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1">Tasks ({progressText})</span>
              </TreeNode>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {summary.tasks.map((task) => (
                <TreeNode
                  key={task.folder}
                  isSelected={
                    selectedFeatureName === summary.name &&
                    activePanel === 'task-detail' &&
                    selectedTaskFolder === task.folder
                  }
                  onClick={() => onNavigate(summary.name, 'task-detail', task.folder)}
                  indent={2}
                >
                  <TaskStatusIcon status={task.status} size={12} />
                  <span className="truncate">{task.folder}</span>
                </TreeNode>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <TreeNode indent={1}>
            <RiListCheck2 size={14} className="shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Tasks (0)</span>
          </TreeNode>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const HiveSidebar: React.FC = () => {
  const featureSummaries = useHiveStore((s) => s.featureSummaries);
  const selectedFeatureName = useHiveStore((s) => s.selectedFeatureName);
  const activeFeatureName = useHiveStore((s) => s.activeFeatureName);
  const activePanel = useHiveStore((s) => s.activePanel);
  const selectedTaskFolder = useHiveStore((s) => s.selectedTaskFolder);
  const selectedContextName = useHiveStore((s) => s.selectedContextName);
  const selectFeature = useHiveStore((s) => s.selectFeature);
  const selectTask = useHiveStore((s) => s.selectTask);
  const selectContext = useHiveStore((s) => s.selectContext);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);

  const navigateTo = React.useCallback(
    (featureName: string, panel: HivePanel, taskFolder?: string, contextName?: string) => {
      // Only reset if changing feature
      if (featureName !== selectedFeatureName) {
        selectFeature(featureName);
      }
      if (taskFolder) selectTask(taskFolder);
      if (contextName) selectContext(contextName);
      setActivePanel(panel);
    },
    [selectedFeatureName, selectFeature, selectTask, selectContext, setActivePanel]
  );

  const grouped = React.useMemo(() => {
    const map = new Map<FeatureStatus, HiveFeatureSummary[]>();
    for (const summary of featureSummaries) {
      const list = map.get(summary.status) || [];
      list.push(summary);
      map.set(summary.status, list);
    }
    return map;
  }, [featureSummaries]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {STATUS_GROUPS.map((group) => {
        const items = grouped.get(group.key) || [];
        if (items.length === 0) return null;
        return (
          <Collapsible key={group.key} defaultOpen={group.defaultOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 px-3 py-1.5 w-full text-left typography-micro text-muted-foreground hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <RiArrowRightSLine
                size={14}
                className="shrink-0 transition-transform [[data-state=open]>&]:rotate-90"
              />
              {group.label} ({items.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              {items.map((summary) => (
                <FeatureTreeNode
                  key={summary.name}
                  summary={summary}
                  selectedFeatureName={selectedFeatureName}
                  activeFeatureName={activeFeatureName}
                  activePanel={activePanel}
                  selectedTaskFolder={selectedTaskFolder}
                  selectedContextName={selectedContextName}
                  onNavigate={navigateTo}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      {featureSummaries.length === 0 && (
        <div className="px-3 py-4 text-muted-foreground typography-micro text-center">
          No features yet
        </div>
      )}
    </div>
  );
};
