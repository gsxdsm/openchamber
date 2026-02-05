# Task: 02-zustand-hive-store

## Feature: agent-hive-integration

## Dependencies

_None_

## Plan Section

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
