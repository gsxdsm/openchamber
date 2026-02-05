import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface HivePlanComment {
  id: string;
  line: number;
  body: string;
  author: string;
  timestamp: string;
}

export interface HivePlan {
  content: string;
  isApproved: boolean;
}

export interface HiveFeatureSummary {
  name: string;
  status: FeatureStatus;
  planStatus: 'none' | 'draft' | 'approved';
  commentCount: number;
  taskCounts: { total: number; done: number; inProgress: number; pending: number };
  contextFiles: string[];
  tasks: { folder: string; status: TaskStatusType }[];
}

export interface HiveFeatureDetail {
  feature: HiveFeature;
  plan: HivePlan | null;
  tasks: HiveTask[];
  contextFiles: HiveContextFile[];
  sessions: HiveSessionInfo[];
  comments: HivePlanComment[];
}

export type HivePanel = 'feature' | 'plan' | 'tasks' | 'task-detail' | 'context' | 'context-detail';

// ─── Store Interface ─────────────────────────────────────────────────────────

interface HiveStore {
  // Global state
  hiveExists: boolean;
  features: HiveFeature[];
  featureSummaries: HiveFeatureSummary[];
  activeFeatureName: string | null;
  selectedFeatureName: string | null;
  selectedTaskFolder: string | null;
  selectedContextName: string | null;

  // Detail state (for selected feature)
  featureDetail: HiveFeatureDetail | null;
  taskDetail: { spec: string | null; report: string | null } | null;
  contextContent: string | null;

  // Panel navigation
  activePanel: HivePanel;

  // Loading
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;

  // Actions — data fetching
  fetchHiveStatus: (directory: string) => Promise<void>;
  fetchFeatures: (directory: string) => Promise<void>;
  fetchFeatureSummaries: (directory: string) => Promise<void>;
  fetchFeatureDetail: (directory: string, featureName: string) => Promise<void>;
  fetchTaskDetail: (directory: string, featureName: string, taskFolder: string) => Promise<void>;
  fetchContextContent: (directory: string, featureName: string, contextName: string) => Promise<void>;

  // Actions — selection / navigation
  selectFeature: (name: string | null) => void;
  selectTask: (folder: string | null) => void;
  selectContext: (name: string | null) => void;
  setActivePanel: (panel: HivePanel) => void;

  // Actions — mutations
  createFeature: (directory: string, name: string, ticket?: string) => Promise<void>;
  updateFeatureStatus: (directory: string, name: string, status: FeatureStatus) => Promise<void>;

  savePlan: (directory: string, feature: string, content: string) => Promise<void>;
  approvePlan: (directory: string, feature: string) => Promise<void>;
  syncTasks: (directory: string, feature: string) => Promise<void>;

  createTask: (directory: string, feature: string, name: string) => Promise<void>;
  updateTask: (directory: string, feature: string, folder: string, updates: Partial<Pick<HiveTask, 'status' | 'summary'>>) => Promise<void>;

  writeContext: (directory: string, feature: string, name: string, content: string) => Promise<void>;
  deleteContext: (directory: string, feature: string, name: string) => Promise<void>;

  linkSession: (directory: string, feature: string, sessionId: string, taskFolder?: string) => Promise<void>;

  // Comments
  addComment: (directory: string, feature: string, line: number, body: string) => Promise<void>;
  deleteComment: (directory: string, feature: string, commentId: string) => Promise<void>;

  // Polling
  pollIntervalId: ReturnType<typeof setInterval> | null;
  startPolling: (directory: string) => void;
  stopPolling: () => void;
  refresh: (directory: string) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HIVE_POLL_INTERVAL = 5000;

const hiveApi = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as { error?: string }).error || `HTTP ${response.status}`);
  }
  return response.json();
};

const enc = (s: string) => encodeURIComponent(s);

// ─── Store ───────────────────────────────────────────────────────────────────

export const useHiveStore = create<HiveStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      hiveExists: false,
      features: [],
      featureSummaries: [],
      activeFeatureName: null,
      selectedFeatureName: null,
      selectedTaskFolder: null,
      selectedContextName: null,
      featureDetail: null,
      taskDetail: null,
      contextContent: null,
      activePanel: 'feature',
      isLoading: false,
      isLoadingDetail: false,
      error: null,
      pollIntervalId: null,

      // ─── Data Fetching ───────────────────────────────────────────────

      fetchHiveStatus: async (directory) => {
        try {
          const data = await hiveApi(`/api/hive/status?directory=${enc(directory)}`);
          set({ hiveExists: data.exists, activeFeatureName: data.activeFeature });
        } catch {
          set({ hiveExists: false });
        }
      },

      fetchFeatures: async (directory) => {
        try {
          set({ isLoading: true });
          const data = await hiveApi(`/api/hive/features?directory=${enc(directory)}`);
          set({ features: data.features || [], isLoading: false, error: null });
        } catch (e) {
          set({ isLoading: false, error: String(e) });
        }
      },

      fetchFeatureSummaries: async (directory) => {
        try {
          const data = await hiveApi(`/api/hive/summaries?directory=${enc(directory)}`);
          set({ featureSummaries: data.summaries || [] });
        } catch {
          set({ featureSummaries: [] });
        }
      },

      fetchFeatureDetail: async (directory, featureName) => {
        try {
          set({ isLoadingDetail: true });
          const [featureRes, planRes, tasksRes, contextRes, sessionsRes, commentsRes] = await Promise.all([
            hiveApi(`/api/hive/features/${enc(featureName)}?directory=${enc(directory)}`),
            hiveApi(`/api/hive/features/${enc(featureName)}/plan?directory=${enc(directory)}`).catch(() => ({ plan: null })),
            hiveApi(`/api/hive/features/${enc(featureName)}/tasks?directory=${enc(directory)}`).catch(() => ({ tasks: [] })),
            hiveApi(`/api/hive/features/${enc(featureName)}/context?directory=${enc(directory)}`).catch(() => ({ files: [] })),
            hiveApi(`/api/hive/features/${enc(featureName)}/sessions?directory=${enc(directory)}`).catch(() => ({ sessions: [] })),
            hiveApi(`/api/hive/features/${enc(featureName)}/comments?directory=${enc(directory)}`).catch(() => ({ threads: [] })),
          ]);
          set({
            featureDetail: {
              feature: featureRes.feature,
              plan: planRes.plan || null,
              tasks: tasksRes.tasks || [],
              contextFiles: contextRes.files || [],
              sessions: sessionsRes.sessions || [],
              comments: commentsRes.threads || [],
            },
            isLoadingDetail: false,
            error: null,
          });
        } catch (e) {
          set({ isLoadingDetail: false, error: String(e) });
        }
      },

      fetchTaskDetail: async (directory, featureName, taskFolder) => {
        try {
          const data = await hiveApi(`/api/hive/features/${enc(featureName)}/tasks/${enc(taskFolder)}?directory=${enc(directory)}`);
          set({
            taskDetail: {
              spec: data.task?.spec || null,
              report: data.task?.report || null,
            },
          });
        } catch {
          set({ taskDetail: null });
        }
      },

      fetchContextContent: async (directory, featureName, contextName) => {
        try {
          const data = await hiveApi(`/api/hive/features/${enc(featureName)}/context/${enc(contextName)}?directory=${enc(directory)}`);
          set({ contextContent: data.content ?? null });
        } catch {
          set({ contextContent: null });
        }
      },

      // ─── Selection / Navigation ──────────────────────────────────────

      selectFeature: (name) => {
        set({
          selectedFeatureName: name,
          selectedTaskFolder: null,
          selectedContextName: null,
          featureDetail: null,
          taskDetail: null,
          contextContent: null,
          activePanel: 'feature',
        });
      },

      selectTask: (folder) => {
        set({ selectedTaskFolder: folder, taskDetail: null });
      },

      selectContext: (name) => {
        set({ selectedContextName: name, contextContent: null });
      },

      setActivePanel: (panel) => {
        set({ activePanel: panel });
      },

      // ─── Mutations ──────────────────────────────────────────────────

      createFeature: async (directory, name, ticket) => {
        await hiveApi(`/api/hive/features?directory=${enc(directory)}`, {
          method: 'POST',
          body: JSON.stringify({ name, ticket }),
        });
        await get().fetchFeatures(directory);
        await get().fetchHiveStatus(directory);
      },

      updateFeatureStatus: async (directory, name, status) => {
        await hiveApi(`/api/hive/features/${enc(name)}?directory=${enc(directory)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        await get().fetchFeatures(directory);
        if (get().selectedFeatureName === name) {
          await get().fetchFeatureDetail(directory, name);
        }
      },

      savePlan: async (directory, feature, content) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/plan?directory=${enc(directory)}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      approvePlan: async (directory, feature) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/plan/approve?directory=${enc(directory)}`, {
          method: 'POST',
        });
        await get().fetchFeatures(directory);
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      syncTasks: async (directory, feature) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/tasks/sync?directory=${enc(directory)}`, {
          method: 'POST',
        });
        await get().fetchFeatures(directory);
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      createTask: async (directory, feature, name) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/tasks?directory=${enc(directory)}`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      updateTask: async (directory, feature, folder, updates) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/tasks/${enc(folder)}?directory=${enc(directory)}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      writeContext: async (directory, feature, name, content) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/context/${enc(name)}?directory=${enc(directory)}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      deleteContext: async (directory, feature, name) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/context/${enc(name)}?directory=${enc(directory)}`, {
          method: 'DELETE',
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      linkSession: async (directory, feature, sessionId, taskFolder) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/sessions?directory=${enc(directory)}`, {
          method: 'POST',
          body: JSON.stringify({ sessionId, taskFolder }),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      // ─── Comments ─────────────────────────────────────────────────────

      addComment: async (directory, feature, line, body) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/comments?directory=${enc(directory)}`, {
          method: 'POST',
          body: JSON.stringify({ line, body, author: 'You' }),
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      deleteComment: async (directory, feature, commentId) => {
        await hiveApi(`/api/hive/features/${enc(feature)}/comments/${enc(commentId)}?directory=${enc(directory)}`, {
          method: 'DELETE',
        });
        if (get().selectedFeatureName === feature) {
          await get().fetchFeatureDetail(directory, feature);
        }
      },

      // ─── Polling ─────────────────────────────────────────────────────

      startPolling: (directory) => {
        const { stopPolling } = get();
        stopPolling();
        const id = setInterval(async () => {
          const store = get();
          await store.fetchHiveStatus(directory);
          if (store.hiveExists) {
            await Promise.all([
              store.fetchFeatures(directory),
              store.fetchFeatureSummaries(directory),
            ]);
            const selected = store.selectedFeatureName;
            if (selected) {
              await store.fetchFeatureDetail(directory, selected);
            }
          }
        }, HIVE_POLL_INTERVAL);
        set({ pollIntervalId: id });
      },

      stopPolling: () => {
        const { pollIntervalId } = get();
        if (pollIntervalId) clearInterval(pollIntervalId);
        set({ pollIntervalId: null });
      },

      refresh: async (directory) => {
        const store = get();
        await store.fetchHiveStatus(directory);
        if (store.hiveExists) {
          await Promise.all([
            store.fetchFeatures(directory),
            store.fetchFeatureSummaries(directory),
          ]);
          const selected = store.selectedFeatureName;
          if (selected) {
            await store.fetchFeatureDetail(directory, selected);
          }
        }
      },
    }),
    { name: 'hive-store' }
  )
);

// ─── Convenience Selectors ───────────────────────────────────────────────────

export const useHiveExists = () => useHiveStore((s) => s.hiveExists);
export const useHiveFeatures = () => useHiveStore((s) => s.features);
export const useHiveActiveFeature = () => useHiveStore((s) => s.activeFeatureName);
export const useHiveSelectedFeature = () => useHiveStore((s) => s.selectedFeatureName);
export const useHiveFeatureDetail = () => useHiveStore((s) => s.featureDetail);
export const useHiveFeatureSummaries = () => useHiveStore((s) => s.featureSummaries);
