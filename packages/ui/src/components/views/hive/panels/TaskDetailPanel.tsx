import React, { useEffect } from 'react';
import { useHiveStore, type TaskStatusType } from '@/stores/useHiveStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import { StatusBadge } from '../sidebar/StatusBadge';
import { RiArrowLeftLine } from '@remixicon/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui';

const TASK_STATUSES: TaskStatusType[] = [
  'pending',
  'in_progress',
  'done',
  'cancelled',
  'blocked',
  'failed',
  'partial',
];

export const TaskDetailPanel: React.FC = () => {
  const directory = useEffectiveDirectory();
  const detail = useHiveStore((s) => s.featureDetail);
  const selectedFeature = useHiveStore((s) => s.selectedFeatureName);
  const selectedTask = useHiveStore((s) => s.selectedTaskFolder);
  const taskDetail = useHiveStore((s) => s.taskDetail);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);
  const fetchTaskDetail = useHiveStore((s) => s.fetchTaskDetail);
  const updateTask = useHiveStore((s) => s.updateTask);

  const task = detail?.tasks.find((t) => t.folder === selectedTask);

  useEffect(() => {
    if (directory && selectedFeature && selectedTask) {
      fetchTaskDetail(directory, selectedFeature, selectedTask);
    }
  }, [directory, selectedFeature, selectedTask, fetchTaskDetail]);

  const handleStatusChange = async (newStatus: string) => {
    if (!directory || !selectedFeature || !selectedTask) return;
    await updateTask(directory, selectedFeature, selectedTask, {
      status: newStatus as TaskStatusType,
    });
    toast.success(`Task status updated to ${newStatus.replace('_', ' ')}`);
  };

  if (!task) {
    return (
      <div className="p-4 text-muted-foreground typography-ui">
        Task not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => setActivePanel('tasks')}
          className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
        >
          <RiArrowLeftLine size={16} />
        </button>
        <span className="typography-ui-label truncate">
          {task.planTitle || task.folder}
        </span>
        <StatusBadge status={task.status} />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status selector */}
        <div className="flex items-center gap-3">
          <span className="typography-micro text-muted-foreground">
            Status:
          </span>
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Meta */}
        <div className="typography-micro text-muted-foreground space-y-0.5">
          <div>
            Folder: <code className="px-1 py-0.5 rounded bg-surface-muted">{task.folder}</code>
          </div>
          <div>Origin: {task.origin}</div>
          {task.startedAt && (
            <div>Started: {new Date(task.startedAt).toLocaleString()}</div>
          )}
          {task.completedAt && (
            <div>Completed: {new Date(task.completedAt).toLocaleString()}</div>
          )}
          {task.dependsOn && task.dependsOn.length > 0 && (
            <div>Depends on: {task.dependsOn.join(', ')}</div>
          )}
          {task.workerSession && (
            <div>
              Worker: {task.workerSession.agent || 'unknown'} (session:{' '}
              <code className="px-1 py-0.5 rounded bg-surface-muted">
                {task.workerSession.sessionId}
              </code>
              )
            </div>
          )}
        </div>

        {/* Summary */}
        {task.summary && (
          <div>
            <h3 className="typography-ui-label text-muted-foreground mb-1">
              Summary
            </h3>
            <p className="typography-ui">{task.summary}</p>
          </div>
        )}

        {/* Spec */}
        {taskDetail?.spec && (
          <div>
            <h3 className="typography-ui-label text-muted-foreground mb-1">
              Spec
            </h3>
            <pre className="whitespace-pre-wrap typography-ui font-mono text-sm bg-surface-muted p-3 rounded-lg overflow-auto">
              {taskDetail.spec}
            </pre>
          </div>
        )}

        {/* Report */}
        {taskDetail?.report && (
          <div>
            <h3 className="typography-ui-label text-muted-foreground mb-1">
              Report
            </h3>
            <pre className="whitespace-pre-wrap typography-ui font-mono text-sm bg-surface-muted p-3 rounded-lg overflow-auto">
              {taskDetail.report}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
