# Agent-Hive Integration into OpenChamber

## Discovery

### Original Request
- "I'd like to integrate agent-hive into OpenChamber. I'd like similar functionality to the vscode extension. I'd like a new tab at the top of OpenChamber that opens up an agent-hive control panel - where I can see tasks/features/plans, update, edit, and add them. It should be full featured and a detailed plan. I would like the implementation fairly isolated so it doesn't touch a lot of openchamber code (eventually it will be a plugin). I would like some linkage between OpenChamber sessions and the agent-hive interface."

### Interview Summary
- **Scope**: Full-featured Hive panel matching VS Code extension capabilities (features, plans, tasks, context, session linking)
- **Isolation**: Minimal touchpoints with existing OpenChamber code; self-contained module that could become a plugin
- **Session linkage**: Connect OpenChamber chat sessions to Hive features/tasks
- **Tab placement**: New top-level tab in the Header alongside Chat, Git, Terminal, etc.

### Research Findings
- `packages/ui/src/stores/useUIStore.ts:7`: MainTab type defines available tabs — we add `'hive'` here (1 line)
- `packages/ui/src/components/layout/Header.tsx:406-433`: Tab config array — we add Hive tab entry (3 lines)
- `packages/ui/src/components/layout/MainLayout.tsx:286-301`: View switch statement — we add `case 'hive'` (2 lines)
- `packages/ui/src/components/views/index.ts`: Barrel exports — we add HiveView export (1 line)
- `packages/web/server/index.js`: Express server — we mount `/api/hive/*` routes (1 line import + 1 line `app.use`)
- Agent-hive stores data in `.hive/` directory using flat files (JSON + Markdown). Services are in `hive-core` package.
- VS Code extension has: tree sidebar (features grouped by status → plan + context + tasks), plan comment system, commands for CRUD, file watcher for auto-refresh.
- `packages/ui/src/stores/useGitStore.ts`: Model for directory-scoped store with polling — we follow this pattern for Hive store.
- `packages/ui/src/components/views/git/`: Model for composite view with section components — we follow this pattern for Hive view.
- hive-core services: FeatureService, PlanService, TaskService, ContextService, SessionService — we call these server-side.

---

## Non-Goals (What we're NOT building)

- **Not building**: Git worktree management UI (exec_start/exec_complete/merge). These are agent operations, not user operations.
- **Not building**: Agent dispatch or worker spawning. The Hive panel is for visibility and management, not running agents.
- **Not building**: Plan comment system (VS Code uses its native Comment API which has no web equivalent). Users can edit plans directly instead.
- **Not building**: Hive configuration/settings UI. Config management stays in `~/.config/opencode/agent_hive.json`.
- **Not building**: Subtask management. Keep the first version focused on features → plans → tasks.
- **Not building**: Journal viewer. The journal is an append-only audit trail, not a user-facing feature.
- **Not building**: Session-to-task auto-assignment. We provide manual linking and display of linked sessions only.

---

## Ghost Diffs (Rejected Alternatives)

1. **Embed hive-core as npm dependency**: Rejected — hive-core has a `simple-git` dependency and is designed for Node.js server use. We'd need to vendor or fork it. Instead, we read `.hive/` files directly with our own lightweight server-side service, replicating the same file format but with minimal code. This is more isolated and avoids dependency coupling.

2. **Build as a Settings sidebar section**: Rejected — Hive is a primary workflow, not a configuration panel. It deserves a top-level tab like Git/Terminal. The sidebar+content pattern from SettingsView would be a good internal layout though.

3. **WebSocket/SSE for live updates**: Rejected for v1 — Polling (like GitStore) is simpler and proven. File watcher + SSE can be a v2 enhancement.

4. **Inline CodeMirror for plan editing**: Rejected for v1 — Start with a simple textarea. CodeMirror adds complexity and a new dependency.

---

## Architecture Overview

### Touchpoints with existing OpenChamber code (7 lines across 4 files):

| File | Change | Lines |
|------|--------|-------|
| `packages/ui/src/stores/useUIStore.ts:7` | Add `'hive'` to MainTab union | 1 |
| `packages/ui/src/components/layout/Header.tsx:~415` | Add Hive tab to TabConfig array | 3 |
| `packages/ui/src/components/layout/MainLayout.tsx:~290` | Add `case 'hive'` to view switch | 2 |
| `packages/ui/src/components/views/index.ts` | Add `export { HiveView }` | 1 |

### New files (all isolated in `packages/ui/src/components/views/hive/` and `packages/web/server/lib/hive-service.js`):

```
packages/ui/src/components/views/hive/
├── HiveView.tsx                    # Root view (sidebar + content)
├── HiveEmptyState.tsx              # Shown when no .hive/ directory
├── HiveHeader.tsx                  # Header bar with actions
├── sidebar/
│   ├── HiveSidebar.tsx             # Feature list sidebar
│   ├── FeatureItem.tsx             # Single feature row
│   └── StatusBadge.tsx             # Status pill component
├── panels/
│   ├── FeaturePanel.tsx            # Feature detail view
│   ├── PlanPanel.tsx               # Plan viewer/editor
│   ├── TasksPanel.tsx              # Task list view
│   ├── TaskDetailPanel.tsx         # Single task detail
│   └── ContextPanel.tsx            # Context files viewer/editor
├── dialogs/
│   ├── CreateFeatureDialog.tsx     # Create new feature modal
│   └── CreateTaskDialog.tsx        # Create manual task modal
└── hooks/
    └── useHivePolling.ts           # Polling hook for .hive/ changes

packages/ui/src/stores/
└── useHiveStore.ts                 # Zustand store for hive state

packages/web/server/lib/
└── hive-service.js                 # Server-side .hive/ file reader/writer
```

### Data flow:
```
.hive/ files ←→ hive-service.js ←→ /api/hive/* ←→ useHiveStore ←→ HiveView components
```

---

## Tasks

### 1. Server-side Hive service and API routes

**Depends on**: none

**Files:**
- Create: `packages/web/server/lib/hive-service.js`
- Modify: `packages/web/server/index.js` (mount routes, ~5 lines)

**What to do:**

- Step 1: Create `packages/web/server/lib/hive-service.js` with functions that read/write `.hive/` files directly. No external dependencies — just `fs`, `path`, `os`. Replicate the file format from hive-core:
  ```javascript
  // hive-service.js — Lightweight .hive/ file reader/writer
  import fs from 'fs';
  import path from 'path';

  const HIVE_DIR = '.hive';

  export function findHiveRoot(directory) {
    // Walk up from directory to find .hive/ folder
    let dir = directory;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, HIVE_DIR))) return dir;
      dir = path.dirname(dir);
    }
    return null;
  }

  export function hiveExists(directory) {
    return findHiveRoot(directory) !== null;
  }

  export function getActiveFeature(hiveRoot) {
    const activeFile = path.join(hiveRoot, HIVE_DIR, 'active-feature');
    if (!fs.existsSync(activeFile)) return null;
    return fs.readFileSync(activeFile, 'utf8').trim();
  }

  export function listFeatures(hiveRoot) {
    const featuresDir = path.join(hiveRoot, HIVE_DIR, 'features');
    if (!fs.existsSync(featuresDir)) return [];
    const dirs = fs.readdirSync(featuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    return dirs.map(d => {
      const featureJson = path.join(featuresDir, d.name, 'feature.json');
      if (!fs.existsSync(featureJson)) return null;
      return JSON.parse(fs.readFileSync(featureJson, 'utf8'));
    }).filter(Boolean);
  }

  export function getFeature(hiveRoot, name) { /* read feature.json */ }
  export function createFeature(hiveRoot, name, ticket) { /* write feature.json + dirs */ }
  export function updateFeatureStatus(hiveRoot, name, status) { /* patch feature.json */ }

  export function getPlan(hiveRoot, feature) { /* read plan.md */ }
  export function writePlan(hiveRoot, feature, content) { /* write plan.md, clear APPROVED */ }
  export function approvePlan(hiveRoot, feature) { /* touch APPROVED, update feature status */ }

  export function listTasks(hiveRoot, feature) { /* read all tasks/*/status.json */ }
  export function getTask(hiveRoot, feature, taskFolder) { /* read task status.json + spec + report */ }
  export function createTask(hiveRoot, feature, name, order) { /* create task dir + status.json */ }
  export function updateTask(hiveRoot, feature, taskFolder, updates) { /* patch status.json */ }
  export function syncTasks(hiveRoot, feature) { /* parse plan.md ### headers → create task dirs */ }

  export function listContextFiles(hiveRoot, feature) { /* readdir context/ */ }
  export function getContextFile(hiveRoot, feature, name) { /* read context/name.md */ }
  export function writeContextFile(hiveRoot, feature, name, content) { /* write context/name.md */ }
  export function deleteContextFile(hiveRoot, feature, name) { /* unlink context/name.md */ }

  export function listSessions(hiveRoot, feature) { /* read sessions.json */ }
  export function linkSession(hiveRoot, feature, sessionId, taskFolder) { /* update sessions.json */ }
  ```

- Step 2: Mount API routes in `packages/web/server/index.js`. Add near the other `/api/*` route groups:
  ```javascript
  // At top of file, with other imports:
  import { createHiveRoutes } from './lib/hive-service.js';

  // After other route registrations (near line ~6600):
  createHiveRoutes(app);
  ```

  The routes function creates Express routes:
  ```javascript
  export function createHiveRoutes(app) {
    // All routes take ?directory= query param

    app.get('/api/hive/status', async (req, res) => { /* hiveExists + activeFeature */ });

    // Features
    app.get('/api/hive/features', async (req, res) => { /* listFeatures */ });
    app.get('/api/hive/features/:name', async (req, res) => { /* getFeature */ });
    app.post('/api/hive/features', async (req, res) => { /* createFeature */ });
    app.patch('/api/hive/features/:name', async (req, res) => { /* updateFeatureStatus */ });

    // Plans
    app.get('/api/hive/features/:name/plan', async (req, res) => { /* getPlan */ });
    app.put('/api/hive/features/:name/plan', async (req, res) => { /* writePlan */ });
    app.post('/api/hive/features/:name/plan/approve', async (req, res) => { /* approvePlan */ });

    // Tasks
    app.get('/api/hive/features/:name/tasks', async (req, res) => { /* listTasks */ });
    app.get('/api/hive/features/:name/tasks/:task', async (req, res) => { /* getTask */ });
    app.post('/api/hive/features/:name/tasks', async (req, res) => { /* createTask */ });
    app.patch('/api/hive/features/:name/tasks/:task', async (req, res) => { /* updateTask */ });
    app.post('/api/hive/features/:name/tasks/sync', async (req, res) => { /* syncTasks */ });

    // Context
    app.get('/api/hive/features/:name/context', async (req, res) => { /* listContextFiles */ });
    app.get('/api/hive/features/:name/context/:file', async (req, res) => { /* getContextFile */ });
    app.put('/api/hive/features/:name/context/:file', async (req, res) => { /* writeContextFile */ });
    app.delete('/api/hive/features/:name/context/:file', async (req, res) => { /* deleteContextFile */ });

    // Sessions
    app.get('/api/hive/features/:name/sessions', async (req, res) => { /* listSessions */ });
    app.post('/api/hive/features/:name/sessions', async (req, res) => { /* linkSession */ });
  }
  ```

- Step 3: Test manually with curl after server is running:
  ```bash
  curl http://localhost:3000/api/hive/status?directory=$(pwd)
  curl http://localhost:3000/api/hive/features?directory=$(pwd)
  ```

**Must NOT do:**
- Do not import or depend on `hive-core` npm package
- Do not use file locking (keep it simple; UI is single-user)
- Do not implement worktree operations (exec_start, merge, etc.)
- Do not add authentication/authorization to hive routes

**References:**
- `packages/web/server/index.js:6035-6060` — Git status route as pattern for directory-scoped API
- `packages/web/server/lib/git-service.js` — Existing service pattern

**Verify:**
- [ ] Run: `bun run type-check:web` → no new errors (JS file, but import check)
- [ ] Run: `curl localhost:3000/api/hive/status?directory=/path/to/project` → `{"exists": true/false, "activeFeature": "..."}`

---

### 2. Zustand Hive store

**Depends on**: none

**Files:**
- Create: `packages/ui/src/stores/useHiveStore.ts`

**What to do:**

- Step 1: Create the store file. Follow the pattern from `useGitStore.ts` (directory-scoped state, polling, fetch methods):
  ```typescript
  import { create } from 'zustand';
  import { devtools } from 'zustand/middleware';

  // Types mirroring .hive/ file formats
  export type FeatureStatus = 'planning' | 'approved' | 'executing' | 'completed';
  export type TaskStatusType = 'pending' | 'in_progress' | 'done' | 'cancelled' | 'blocked' | 'failed' | 'partial';

  export interface HiveFeature {
    name: string;
    status: FeatureStatus;
    ticket?: string;
    sessionId?: string;
    createdAt: string;
    approvedAt?: string;
    completedAt?: string;
  }

  export interface HiveTask {
    folder: string;
    status: TaskStatusType;
    origin: 'plan' | 'manual';
    planTitle?: string;
    summary?: string;
    startedAt?: string;
    completedAt?: string;
    dependsOn?: string[];
    workerSession?: {
      sessionId: string;
      agent?: string;
      attempt?: number;
    };
  }

  export interface HiveContextFile {
    name: string;
    updatedAt: string;
  }

  export interface HiveSessionInfo {
    sessionId: string;
    taskFolder?: string;
    startedAt: string;
    lastActiveAt: string;
  }

  export interface HivePlan {
    content: string;
    isApproved: boolean;
  }

  // Selected feature detail state
  export interface HiveFeatureDetail {
    feature: HiveFeature;
    plan: HivePlan | null;
    tasks: HiveTask[];
    contextFiles: HiveContextFile[];
    sessions: HiveSessionInfo[];
  }

  interface HiveStore {
    // Global state
    hiveExists: boolean;
    features: HiveFeature[];
    activeFeatureName: string | null;
    selectedFeatureName: string | null;
    selectedTaskFolder: string | null;

    // Detail state (for selected feature)
    featureDetail: HiveFeatureDetail | null;
    taskDetail: { spec: string; report: string } | null;
    contextContent: string | null;
    selectedContextName: string | null;

    // Panel navigation
    activePanel: 'feature' | 'plan' | 'tasks' | 'task-detail' | 'context' | 'context-detail';

    // Loading
    isLoading: boolean;
    isLoadingDetail: boolean;
    error: string | null;

    // Actions
    fetchHiveStatus: (directory: string) => Promise<void>;
    fetchFeatures: (directory: string) => Promise<void>;
    fetchFeatureDetail: (directory: string, featureName: string) => Promise<void>;
    fetchTaskDetail: (directory: string, featureName: string, taskFolder: string) => Promise<void>;
    fetchContextContent: (directory: string, featureName: string, contextName: string) => Promise<void>;

    selectFeature: (name: string | null) => void;
    selectTask: (folder: string | null) => void;
    selectContext: (name: string | null) => void;
    setActivePanel: (panel: HiveStore['activePanel']) => void;

    createFeature: (directory: string, name: string, ticket?: string) => Promise<void>;
    updateFeatureStatus: (directory: string, name: string, status: FeatureStatus) => Promise<void>;

    savePlan: (directory: string, feature: string, content: string) => Promise<void>;
    approvePlan: (directory: string, feature: string) => Promise<void>;
    syncTasks: (directory: string, feature: string) => Promise<void>;

    createTask: (directory: string, feature: string, name: string) => Promise<void>;
    updateTask: (directory: string, feature: string, folder: string, updates: Partial<HiveTask>) => Promise<void>;

    writeContext: (directory: string, feature: string, name: string, content: string) => Promise<void>;
    deleteContext: (directory: string, feature: string, name: string) => Promise<void>;

    linkSession: (directory: string, feature: string, sessionId: string, taskFolder?: string) => Promise<void>;

    // Polling
    pollIntervalId: ReturnType<typeof setInterval> | null;
    startPolling: (directory: string) => void;
    stopPolling: () => void;
    refresh: (directory: string) => Promise<void>;
  }

  const HIVE_POLL_INTERVAL = 5000;

  // Helper for API calls
  const hiveApi = async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  };

  export const useHiveStore = create<HiveStore>()(
    devtools(
      (set, get) => ({
        hiveExists: false,
        features: [],
        activeFeatureName: null,
        selectedFeatureName: null,
        selectedTaskFolder: null,
        featureDetail: null,
        taskDetail: null,
        contextContent: null,
        selectedContextName: null,
        activePanel: 'feature',
        isLoading: false,
        isLoadingDetail: false,
        error: null,
        pollIntervalId: null,

        fetchHiveStatus: async (directory) => {
          try {
            const data = await hiveApi(`/api/hive/status?directory=${encodeURIComponent(directory)}`);
            set({ hiveExists: data.exists, activeFeatureName: data.activeFeature });
          } catch { set({ hiveExists: false }); }
        },

        fetchFeatures: async (directory) => {
          try {
            set({ isLoading: true });
            const data = await hiveApi(`/api/hive/features?directory=${encodeURIComponent(directory)}`);
            set({ features: data.features, isLoading: false });
          } catch (e) { set({ isLoading: false, error: String(e) }); }
        },

        fetchFeatureDetail: async (directory, featureName) => {
          try {
            set({ isLoadingDetail: true });
            const [feature, plan, tasks, context, sessions] = await Promise.all([
              hiveApi(`/api/hive/features/${encodeURIComponent(featureName)}?directory=${encodeURIComponent(directory)}`),
              hiveApi(`/api/hive/features/${encodeURIComponent(featureName)}/plan?directory=${encodeURIComponent(directory)}`).catch(() => null),
              hiveApi(`/api/hive/features/${encodeURIComponent(featureName)}/tasks?directory=${encodeURIComponent(directory)}`),
              hiveApi(`/api/hive/features/${encodeURIComponent(featureName)}/context?directory=${encodeURIComponent(directory)}`),
              hiveApi(`/api/hive/features/${encodeURIComponent(featureName)}/sessions?directory=${encodeURIComponent(directory)}`),
            ]);
            set({
              featureDetail: {
                feature: feature.feature,
                plan: plan?.plan || null,
                tasks: tasks.tasks,
                contextFiles: context.files,
                sessions: sessions.sessions,
              },
              isLoadingDetail: false,
            });
          } catch (e) { set({ isLoadingDetail: false, error: String(e) }); }
        },

        // ... remaining action implementations follow same pattern
        // Each calls hiveApi() → updates store state

        startPolling: (directory) => {
          const { stopPolling, fetchHiveStatus, fetchFeatures } = get();
          stopPolling();
          const id = setInterval(async () => {
            await fetchHiveStatus(directory);
            if (get().hiveExists) await fetchFeatures(directory);
            const selected = get().selectedFeatureName;
            if (selected) await get().fetchFeatureDetail(directory, selected);
          }, HIVE_POLL_INTERVAL);
          set({ pollIntervalId: id });
        },

        stopPolling: () => {
          const { pollIntervalId } = get();
          if (pollIntervalId) clearInterval(pollIntervalId);
          set({ pollIntervalId: null });
        },

        refresh: async (directory) => {
          await get().fetchHiveStatus(directory);
          if (get().hiveExists) await get().fetchFeatures(directory);
          const selected = get().selectedFeatureName;
          if (selected) await get().fetchFeatureDetail(directory, selected);
        },
      }),
      { name: 'hive-store' }
    )
  );

  // Convenience selectors
  export const useHiveExists = () => useHiveStore((s) => s.hiveExists);
  export const useHiveFeatures = () => useHiveStore((s) => s.features);
  export const useHiveActiveFeature = () => useHiveStore((s) => s.activeFeatureName);
  export const useHiveSelectedFeature = () => useHiveStore((s) => s.selectedFeatureName);
  export const useHiveFeatureDetail = () => useHiveStore((s) => s.featureDetail);
  ```

- Step 2: Verify types compile:
  ```bash
  bun run type-check:ui
  ```

**Must NOT do:**
- Do not persist to localStorage (hive state comes from files, not cache)
- Do not import from `hive-core` or any agent-hive package
- Do not add session auto-linking logic (manual only for v1)

**References:**
- `packages/ui/src/stores/useGitStore.ts:1-69` — Pattern for directory-scoped store with polling
- `packages/ui/src/stores/useSkillsStore.ts` — Pattern for CRUD store

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Store types match the API response shapes from Task 1

---

### 3. Register the Hive tab in OpenChamber navigation

**Depends on**: none

**Files:**
- Modify: `packages/ui/src/stores/useUIStore.ts:7` (1 line)
- Modify: `packages/ui/src/components/layout/Header.tsx:~406-433` (3 lines)
- Modify: `packages/ui/src/components/layout/MainLayout.tsx:~286-301` (3 lines)
- Modify: `packages/ui/src/components/views/index.ts` (1 line)
- Create: `packages/ui/src/components/views/HiveView.tsx` (stub)

**What to do:**

- Step 1: Add `'hive'` to MainTab type in `useUIStore.ts`:
  ```typescript
  // Change line 7 from:
  export type MainTab = 'chat' | 'plan' | 'git' | 'diff' | 'terminal' | 'files';
  // To:
  export type MainTab = 'chat' | 'plan' | 'git' | 'diff' | 'terminal' | 'files' | 'hive';
  ```

- Step 2: Add Hive tab to Header.tsx TabConfig array. Find the `tabs: TabConfig[]` useMemo (around line 406-433) and add after the `git` entry:
  ```typescript
  // After the git tab entry, add:
  {
    id: 'hive' as MainTab,
    label: 'Hive',
    icon: RiHexagonLine,
  },
  ```
  Also add the import at the top of Header.tsx:
  ```typescript
  import { RiHexagonLine } from '@remixicon/react';
  ```

- Step 3: Add HiveView to MainLayout.tsx switch statement. Find the `secondaryView` useMemo (around line 286) and add a case:
  ```typescript
  case 'hive':
      return <HiveView />;
  ```
  Also add the import:
  ```typescript
  import { HiveView } from '@/components/views';
  ```

- Step 4: Create stub `HiveView.tsx`:
  ```typescript
  // packages/ui/src/components/views/HiveView.tsx
  import React from 'react';

  export const HiveView: React.FC = () => {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Hive panel loading...
      </div>
    );
  };
  ```

- Step 5: Export from barrel:
  ```typescript
  // packages/ui/src/components/views/index.ts - add:
  export { HiveView } from './HiveView';
  ```

- Step 6: Verify:
  ```bash
  bun run type-check:ui
  bun run lint:ui
  ```

**Must NOT do:**
- Do not conditionally show/hide the Hive tab yet (always visible)
- Do not modify any other tab's behavior or position
- Do not add keyboard shortcut yet

**References:**
- `packages/ui/src/stores/useUIStore.ts:7` — MainTab union type
- `packages/ui/src/components/layout/Header.tsx:406-433` — Tab config construction
- `packages/ui/src/components/layout/MainLayout.tsx:286-301` — View switch

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Run: `bun run lint:ui` → no errors
- [ ] Hive tab appears in the header after Git

---

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

### 8. Context files panel

**Depends on**: 4

**Files:**
- Create: `packages/ui/src/components/views/hive/panels/ContextPanel.tsx`

**What to do:**

- Step 1: Create `ContextPanel.tsx` — list context files, view/edit them, create new ones:
  ```tsx
  import React, { useState, useCallback, useEffect } from 'react';
  import { useHiveStore } from '@/stores/useHiveStore';
  import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
  import { RiArrowLeftLine, RiAddLine, RiEditLine, RiSaveLine, RiDeleteBinLine } from '@remixicon/react';
  import { Textarea } from '@/components/ui/textarea';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { toast } from '@/components/ui';

  export const ContextPanel: React.FC = () => {
    const directory = useEffectiveDirectory();
    const detail = useHiveStore(s => s.featureDetail);
    const selectedFeature = useHiveStore(s => s.selectedFeatureName);
    const selectedContext = useHiveStore(s => s.selectedContextName);
    const contextContent = useHiveStore(s => s.contextContent);
    const activePanel = useHiveStore(s => s.activePanel);
    const setActivePanel = useHiveStore(s => s.setActivePanel);
    const selectContext = useHiveStore(s => s.selectContext);
    const fetchContextContent = useHiveStore(s => s.fetchContextContent);
    const writeContext = useHiveStore(s => s.writeContext);
    const deleteContext = useHiveStore(s => s.deleteContext);

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [newFileName, setNewFileName] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const files = detail?.contextFiles || [];

    useEffect(() => {
      if (directory && selectedFeature && selectedContext) {
        fetchContextContent(directory, selectedFeature, selectedContext);
      }
    }, [directory, selectedFeature, selectedContext]);

    useEffect(() => {
      if (contextContent !== null) setEditContent(contextContent);
    }, [contextContent]);

    const handleFileClick = (name: string) => {
      selectContext(name);
      setActivePanel('context-detail');
      setIsEditing(false);
    };

    const handleSave = useCallback(async () => {
      if (!directory || !selectedFeature || !selectedContext) return;
      await writeContext(directory, selectedFeature, selectedContext, editContent);
      setIsEditing(false);
      toast.success('Context file saved');
    }, [directory, selectedFeature, selectedContext, editContent, writeContext]);

    const handleCreateNew = useCallback(async () => {
      if (!directory || !selectedFeature || !newFileName.trim()) return;
      const name = newFileName.trim().replace(/\.md$/, '') + '.md';
      await writeContext(directory, selectedFeature, name, '# ' + newFileName.trim());
      setNewFileName('');
      setShowCreate(false);
      handleFileClick(name);
      toast.success('Context file created');
    }, [directory, selectedFeature, newFileName, writeContext]);

    const handleDelete = useCallback(async () => {
      if (!directory || !selectedFeature || !selectedContext) return;
      if (!confirm(`Delete ${selectedContext}?`)) return;
      await deleteContext(directory, selectedFeature, selectedContext);
      selectContext(null);
      setActivePanel('context');
      toast.success('Context file deleted');
    }, [directory, selectedFeature, selectedContext, deleteContext]);

    // Detail view
    if (activePanel === 'context-detail' && selectedContext) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <button onClick={() => { setActivePanel('context'); selectContext(null); }}
                className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
                <RiArrowLeftLine size={16} />
              </button>
              <span className="typography-ui-label truncate">{selectedContext}</span>
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
                  <Button size="sm" variant="ghost" onClick={handleDelete} className="text-status-error">
                    <RiDeleteBinLine size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isEditing ? (
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="w-full h-full min-h-[300px] font-mono text-sm resize-none" />
            ) : (
              <pre className="whitespace-pre-wrap typography-ui font-mono text-sm leading-relaxed">
                {contextContent || 'Empty file'}
              </pre>
            )}
          </div>
        </div>
      );
    }

    // List view
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => setActivePanel('feature')}
              className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
              <RiArrowLeftLine size={16} />
            </button>
            <span className="typography-ui-label">Context Files ({files.length})</span>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
            <RiAddLine size={16} />
          </button>
        </div>

        {showCreate && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Input value={newFileName} onChange={e => setNewFileName(e.target.value)}
              placeholder="filename" className="flex-1" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreateNew()} />
            <Button size="sm" onClick={handleCreateNew} disabled={!newFileName.trim()}>Create</Button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {files.length === 0 ? (
            <div className="p-4 text-muted-foreground typography-ui">No context files yet.</div>
          ) : (
            files.map(f => (
              <button key={f.name} onClick={() => handleFileClick(f.name)}
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-interactive-hover border-b border-border text-left">
                <span className="typography-ui">{f.name}</span>
                <span className="typography-micro text-muted-foreground">
                  {new Date(f.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  };
  ```

**Must NOT do:**
- Do not implement rich markdown preview
- Do not auto-compile context (that's an agent operation)

**References:**
- `packages/ui/src/components/sections/skills/SkillsPage.tsx` — View/edit pattern for markdown files

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Context panel lists files, opens detail, allows edit/create/delete

---

### 9. Session linking between OpenChamber and Hive

**Depends on**: 1, 2, 5

**Files:**
- Modify: `packages/ui/src/components/views/hive/panels/FeaturePanel.tsx` (add link button)
- Modify: `packages/ui/src/stores/useHiveStore.ts` (add link action implementation)

**What to do:**

- Step 1: Add a "Link Current Session" button to `FeaturePanel.tsx`. In the sessions section, add:
  ```tsx
  // In FeaturePanel.tsx, add to the sessions section:
  const currentSessionId = useSessionStore(s => s.currentSessionId);
  const linkSession = useHiveStore(s => s.linkSession);

  const handleLinkSession = async () => {
    if (!directory || !selectedFeature || !currentSessionId) return;
    await linkSession(directory, selectedFeature, currentSessionId);
    toast.success('Session linked to feature');
    // Refresh detail
    if (directory && selectedFeature) fetchFeatureDetail(directory, selectedFeature);
  };

  // In JSX, after the sessions list:
  {currentSessionId && (
    <Button size="sm" variant="outline" onClick={handleLinkSession}>
      <RiLinkM size={14} className="mr-1" /> Link Current Session
    </Button>
  )}
  ```

- Step 2: Add session navigation. When clicking a session ID that matches an OpenChamber session, switch to chat tab and that session:
  ```tsx
  // In the sessions list items:
  const setCurrentSession = useSessionStore(s => s.setCurrentSession);
  const setActiveMainTab = useUIStore(s => s.setActiveMainTab);

  const handleSessionClick = (sessionId: string) => {
    setCurrentSession(sessionId);
    setActiveMainTab('chat');
  };

  // Update session list item to be clickable:
  <button key={s.sessionId} onClick={() => handleSessionClick(s.sessionId)}
    className="flex items-center justify-between w-full px-2 py-1 rounded bg-surface-muted typography-micro hover:bg-interactive-hover">
    <span className="truncate">{s.sessionId}</span>
    {s.taskFolder && <span className="text-muted-foreground">{s.taskFolder}</span>}
  </button>
  ```

- Step 3: In `useHiveStore.ts`, complete the `linkSession` implementation:
  ```typescript
  linkSession: async (directory, feature, sessionId, taskFolder) => {
    await hiveApi(`/api/hive/features/${encodeURIComponent(feature)}/sessions?directory=${encodeURIComponent(directory)}`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, taskFolder }),
    });
  },
  ```

**Must NOT do:**
- Do not auto-link sessions (manual only — user chooses when to link)
- Do not create bidirectional links (session store doesn't need to know about Hive)

**References:**
- `packages/ui/src/stores/useSessionStore.ts` — Session store for currentSessionId
- `packages/ui/src/stores/useUIStore.ts` — setActiveMainTab for tab switching

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] "Link Current Session" button appears when a session is active
- [ ] Clicking a linked session navigates to Chat tab with that session

---

### 10. Hive polling hook and integration wiring

**Depends on**: 1, 2, 4

**Files:**
- Create: `packages/ui/src/components/views/hive/hooks/useHivePolling.ts`
- Modify: `packages/ui/src/components/views/HiveView.tsx` (use polling hook)

**What to do:**

- Step 1: Create `useHivePolling.ts` to encapsulate polling lifecycle:
  ```typescript
  import { useEffect, useRef } from 'react';
  import { useHiveStore } from '@/stores/useHiveStore';

  export function useHivePolling(directory: string | null) {
    const startPolling = useHiveStore(s => s.startPolling);
    const stopPolling = useHiveStore(s => s.stopPolling);
    const fetchHiveStatus = useHiveStore(s => s.fetchHiveStatus);
    const fetchFeatures = useHiveStore(s => s.fetchFeatures);
    const directoryRef = useRef(directory);

    useEffect(() => {
      directoryRef.current = directory;
    }, [directory]);

    useEffect(() => {
      if (!directory) return;

      // Initial fetch
      fetchHiveStatus(directory);
      fetchFeatures(directory);
      startPolling(directory);

      return () => stopPolling();
    }, [directory, fetchHiveStatus, fetchFeatures, startPolling, stopPolling]);
  }
  ```

- Step 2: Update HiveView to use the hook (replace inline useEffect):
  ```tsx
  // In HiveView.tsx, replace the useEffect with:
  useHivePolling(directory);
  ```

- Step 3: Also check if the `showPlanTab` logic in Header needs to detect `.hive/` to conditionally show a badge or indicator on the Hive tab. For now, the tab is always visible — we can add a badge showing active feature count later.

- Step 4: Final verification:
  ```bash
  bun run type-check
  bun run lint
  bun run build
  ```

**Must NOT do:**
- Do not add SSE/WebSocket (polling is sufficient for v1)
- Do not poll when the Hive tab is not active (optimization for later)

**References:**
- `packages/ui/src/hooks/useGitPolling.tsx` — Polling hook pattern

**Verify:**
- [ ] Run: `bun run type-check` → no errors across all packages
- [ ] Run: `bun run lint` → no new lint errors
- [ ] Run: `bun run build` → builds successfully
- [ ] Hive tab auto-refreshes every 5 seconds when visible
- [ ] All panels (feature, plan, tasks, task-detail, context) work end-to-end

---

## Summary of OpenChamber touchpoints

| Existing file modified | Lines changed | What |
|------------------------|---------------|------|
| `packages/ui/src/stores/useUIStore.ts` | 1 | Add `'hive'` to MainTab |
| `packages/ui/src/components/layout/Header.tsx` | 4 | Add tab config + import |
| `packages/ui/src/components/layout/MainLayout.tsx` | 3 | Add case + import |
| `packages/ui/src/components/views/index.ts` | 1 | Export HiveView |
| `packages/web/server/index.js` | 2 | Mount hive routes |
| **Total** | **11** | |

All other code is new files in isolated directories.
