# Task: 07-tasks-panel-and-task-detail-panel

## Feature: agent-hive-integration

## Dependencies

_None_

## Plan Section

### 7. Tasks panel and task detail panel

**Depends on**: 4

**Files:**
- Create: `packages/ui/src/components/views/hive/panels/TasksPanel.tsx`
- Create: `packages/ui/src/components/views/hive/panels/TaskDetailPanel.tsx`
- Create: `packages/ui/src/components/views/hive/dialogs/CreateTaskDialog.tsx`

**What to do:**

- Step 1: Create `TasksPanel.tsx` — list of tasks with status, progress bar, and create action:
  ```tsx
  import React, { useState } from 'react';
  import { useHiveStore, type HiveTask } from '@/stores/useHiveStore';
  import { StatusBadge } from '../sidebar/StatusBadge';
  import { RiArrowLeftLine, RiAddLine, RiArrowRightSLine } from '@remixicon/react';
  import { CreateTaskDialog } from '../dialogs/CreateTaskDialog';

  export const TasksPanel: React.FC = () => {
    const detail = useHiveStore(s => s.featureDetail);
    const setActivePanel = useHiveStore(s => s.setActivePanel);
    const selectTask = useHiveStore(s => s.selectTask);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    const tasks = detail?.tasks || [];
    const done = tasks.filter(t => t.status === 'done').length;

    const handleTaskClick = (task: HiveTask) => {
      selectTask(task.folder);
      setActivePanel('task-detail');
    };

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => setActivePanel('feature')}
              className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
              <RiArrowLeftLine size={16} />
            </button>
            <span className="typography-ui-label">Tasks ({done}/{tasks.length})</span>
          </div>
          <button onClick={() => setShowCreateDialog(true)}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground" title="Create Task">
            <RiAddLine size={16} />
          </button>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="px-4 py-2">
            <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div className="h-full bg-status-success rounded-full transition-all"
                style={{ width: `${(done / tasks.length) * 100}%` }} />
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
            tasks.map(task => (
              <button key={task.folder} onClick={() => handleTaskClick(task)}
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-interactive-hover border-b border-border text-left">
                <div className="flex-1 min-w-0">
                  <div className="typography-ui truncate">{task.planTitle || task.folder}</div>
                  {task.summary && (
                    <div className="typography-micro text-muted-foreground truncate">{task.summary}</div>
                  )}
                  {task.dependsOn && task.dependsOn.length > 0 && (
                    <div className="typography-micro text-muted-foreground">
                      Depends on: {task.dependsOn.join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <StatusBadge status={task.status} />
                  <RiArrowRightSLine size={14} className="text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>

        <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </div>
    );
  };
  ```

- Step 2: Create `TaskDetailPanel.tsx` — shows task detail with spec, report, session info, status update:
  ```tsx
  import React, { useEffect } from 'react';
  import { useHiveStore, type TaskStatusType } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
  import { StatusBadge } from '../sidebar/StatusBadge';
  import { RiArrowLeftLine } from '@remixicon/react';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { toast } from '@/components/ui';

  const TASK_STATUSES: TaskStatusType[] = ['pending', 'in_progress', 'done', 'cancelled', 'blocked', 'failed', 'partial'];

  export const TaskDetailPanel: React.FC = () => {
    const directory = useEffectiveDirectory();
    const detail = useHiveStore(s => s.featureDetail);
    const selectedFeature = useHiveStore(s => s.selectedFeatureName);
    const selectedTask = useHiveStore(s => s.selectedTaskFolder);
    const taskDetail = useHiveStore(s => s.taskDetail);
    const setActivePanel = useHiveStore(s => s.setActivePanel);
    const fetchTaskDetail = useHiveStore(s => s.fetchTaskDetail);
    const updateTask = useHiveStore(s => s.updateTask);

    const task = detail?.tasks.find(t => t.folder === selectedTask);

    useEffect(() => {
      if (directory && selectedFeature && selectedTask) {
        fetchTaskDetail(directory, selectedFeature, selectedTask);
      }
    }, [directory, selectedFeature, selectedTask]);

    const handleStatusChange = async (newStatus: string) => {
      if (!directory || !selectedFeature || !selectedTask) return;
      await updateTask(directory, selectedFeature, selectedTask, { status: newStatus as TaskStatusType });
      toast.success(`Task status updated to ${newStatus}`);
    };

    if (!task) {
      return <div className="p-4 text-muted-foreground">Task not found</div>;
    }

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <button onClick={() => setActivePanel('tasks')}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
            <RiArrowLeftLine size={16} />
          </button>
          <span className="typography-ui-label truncate">{task.planTitle || task.folder}</span>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Status selector */}
          <div className="flex items-center gap-3">
            <span className="typography-micro text-muted-foreground">Status:</span>
            <Select value={task.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meta */}
          <div className="typography-micro text-muted-foreground space-y-0.5">
            <div>Folder: <code>{task.folder}</code></div>
            <div>Origin: {task.origin}</div>
            {task.startedAt && <div>Started: {new Date(task.startedAt).toLocaleString()}</div>}
            {task.completedAt && <div>Completed: {new Date(task.completedAt).toLocaleString()}</div>}
            {task.workerSession && (
              <div>Worker: {task.workerSession.agent || 'unknown'} (session: {task.workerSession.sessionId})</div>
            )}
          </div>

          {/* Summary */}
          {task.summary && (
            <div>
              <h3 className="typography-ui-label text-muted-foreground mb-1">Summary</h3>
              <p className="typography-ui">{task.summary}</p>
            </div>
          )}

          {/* Spec */}
          {taskDetail?.spec && (
            <div>
              <h3 className="typography-ui-label text-muted-foreground mb-1">Spec</h3>
              <pre className="whitespace-pre-wrap typography-ui font-mono text-sm bg-surface-muted p-3 rounded-lg">
                {taskDetail.spec}
              </pre>
            </div>
          )}

          {/* Report */}
          {taskDetail?.report && (
            <div>
              <h3 className="typography-ui-label text-muted-foreground mb-1">Report</h3>
              <pre className="whitespace-pre-wrap typography-ui font-mono text-sm bg-surface-muted p-3 rounded-lg">
                {taskDetail.report}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };
  ```

- Step 3: Create `CreateTaskDialog.tsx`:
  ```tsx
  import React, { useState } from 'react';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { useHiveStore } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';

  interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

  export const CreateTaskDialog: React.FC<Props> = ({ open, onOpenChange }) => {
    const [name, setName] = useState('');
    const createTask = useHiveStore(s => s.createTask);
    const selectedFeature = useHiveStore(s => s.selectedFeatureName);
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
          <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="typography-micro text-muted-foreground mb-1 block">Task Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. implement-auth-logic" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
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

**Must NOT do:**
- Do not implement drag-and-drop task reordering
- Do not allow editing spec/report from UI (those are agent-generated)

**References:**
- `packages/ui/src/components/ui/select.tsx` — Select component API
- `packages/ui/src/components/views/git/HistorySection.tsx` — List item pattern

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Tasks panel shows list with status badges and progress bar
- [ ] Task detail shows status selector, spec, report, worker session info

---
