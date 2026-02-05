import React, { useState } from 'react';
import { useHiveStore, type HiveTask } from '@/stores/useHiveStore';
import { StatusBadge } from '../sidebar/StatusBadge';
import { RiArrowLeftLine, RiAddLine, RiArrowRightSLine } from '@remixicon/react';
import { CreateTaskDialog } from '../dialogs/CreateTaskDialog';

export const TasksPanel: React.FC = () => {
  const detail = useHiveStore((s) => s.featureDetail);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);
  const selectTask = useHiveStore((s) => s.selectTask);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const tasks = detail?.tasks || [];
  const done = tasks.filter((t) => t.status === 'done').length;

  const handleTaskClick = (task: HiveTask) => {
    selectTask(task.folder);
    setActivePanel('task-detail');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('feature')}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          >
            <RiArrowLeftLine size={16} />
          </button>
          <span className="typography-ui-label">
            Tasks ({done}/{tasks.length})
          </span>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          title="Create Task"
        >
          <RiAddLine size={16} />
        </button>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="px-4 py-2">
          <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-status-success rounded-full transition-all duration-300"
              style={{ width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="p-4 text-muted-foreground typography-ui">
            No tasks yet. Approve the plan and sync tasks, or create manually.
          </div>
        ) : (
          tasks.map((task) => (
            <button
              key={task.folder}
              onClick={() => handleTaskClick(task)}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-interactive-hover border-b border-border text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="typography-ui truncate">
                  {task.planTitle || task.folder}
                </div>
                {task.summary && (
                  <div className="typography-micro text-muted-foreground truncate mt-0.5">
                    {task.summary}
                  </div>
                )}
                {task.dependsOn && task.dependsOn.length > 0 && (
                  <div className="typography-micro text-muted-foreground mt-0.5">
                    Depends on: {task.dependsOn.join(', ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <StatusBadge status={task.status} />
                <RiArrowRightSLine
                  size={14}
                  className="text-muted-foreground"
                />
              </div>
            </button>
          ))
        )}
      </div>

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};
