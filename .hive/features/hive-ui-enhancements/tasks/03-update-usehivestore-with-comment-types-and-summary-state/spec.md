# Task: 03-update-usehivestore-with-comment-types-and-summary-state

## Feature: hive-ui-enhancements

## Dependencies

- **1. Add comment CRUD to hive-service.js** (01-add-comment-crud-to-hive-servicejs)
- **2. Add feature summary endpoint to hive-service.js** (02-add-feature-summary-endpoint-to-hive-servicejs)

## Plan Section

### 3. Update useHiveStore with comment types and summary state

**Depends on**: 1, 2

**Files:**
- Modify: `packages/ui/src/stores/useHiveStore.ts`

**What to do**:
- Step 1: Add types:
  ```typescript
  export interface HivePlanComment {
    id: string;
    line: number;
    body: string;
    author: string;
    timestamp: string;
  }

  export interface HiveFeatureSummary {
    name: string;
    status: FeatureStatus;
    planStatus: 'none' | 'draft' | 'approved';
    commentCount: number;
    taskCounts: { total: number; done: number; inProgress: number; pending: number };
    contextFiles: string[];
  }
  ```
- Step 2: Add `comments: HivePlanComment[]` to `HiveFeatureDetail` interface (alongside plan, tasks, etc.)
- Step 3: Add to store interface:
  ```typescript
  featureSummaries: HiveFeatureSummary[];
  fetchFeatureSummaries: (directory: string) => Promise<void>;
  fetchComments: (directory: string, feature: string) => Promise<HivePlanComment[]>;
  addComment: (directory: string, feature: string, line: number, body: string) => Promise<void>;
  deleteComment: (directory: string, feature: string, commentId: string) => Promise<void>;
  ```
- Step 4: Implement the actions:
  - `fetchFeatureSummaries`: GET `/api/hive/summaries?directory=...` → set `featureSummaries`
  - `fetchComments`: GET `/api/hive/features/:name/comments?directory=...` → return threads
  - `addComment`: POST `/api/hive/features/:name/comments` with `{ line, body, author: 'You' }` → refresh comments
  - `deleteComment`: DELETE `/api/hive/features/:name/comments/:commentId` → refresh comments
- Step 5: Update `fetchFeatureDetail` to also fetch comments and include in the detail object
- Step 6: Update polling in `startPolling` to also call `fetchFeatureSummaries`
- Step 7: Commit

**Must NOT do**:
- Don't change the existing HivePanel type yet
- Don't break existing selectFeature/selectTask flows

**References**:
- `packages/ui/src/stores/useHiveStore.ts:126-136` — Existing `hiveApi` helper and `enc` function
- `packages/ui/src/stores/useHiveStore.ts:182-206` — Existing `fetchFeatureDetail` pattern with Promise.all

**Verify**:
- [ ] Run: `bun run type-check` → no new errors
- [ ] Existing Hive tab still works (features list, plan view, tasks)
