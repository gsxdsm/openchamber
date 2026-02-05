# Task: 05-rewrite-hivesidebar-as-expandable-tree

## Feature: hive-ui-enhancements

## Dependencies

- **3. Update useHiveStore with comment types and summary state** (03-update-usehivestore-with-comment-types-and-summary-state)

## Plan Section

### 5. Rewrite HiveSidebar as expandable tree

**Depends on**: 3

**Files:**
- Modify: `packages/ui/src/components/views/hive/sidebar/HiveSidebar.tsx` (full rewrite)

**What to do**:
- Step 1: Import `featureSummaries` from the store:
  ```tsx
  const summaries = useHiveStore((s) => s.featureSummaries);
  ```
- Step 2: Build status-grouped tree. Each feature node expands to show:
  - Plan item (status badge: None / Draft / Approved, comment count if > 0)
  - Context folder (expands to show individual file names)
  - Tasks folder (expands to show individual tasks with status icons)
- Step 3: Implement the tree using nested `Collapsible` components:
  ```
  Level 0: Status group (In Progress, Approved, Planning, Completed)
    Level 1: Feature name (with active dot, task progress "3/5")
      Level 2: Plan / Context / Tasks
        Level 3: Individual context files or tasks
  ```
- Step 4: Add click handlers that navigate to the appropriate panel:
  - Click feature name → `selectFeature(name)` + `setActivePanel('feature')`
  - Click "Plan" → `selectFeature(name)` + `setActivePanel('plan')`
  - Click context file → `selectFeature(name)` + `selectContext(fileName)` + `setActivePanel('context-detail')`
  - Click task → `selectFeature(name)` + `selectTask(taskFolder)` + `setActivePanel('task-detail')`
  - Click "Tasks" header → `selectFeature(name)` + `setActivePanel('tasks')`
  - Click "Context" header → `selectFeature(name)` + `setActivePanel('context')`
- Step 5: Use status icons for tasks:
  - `done` → `RiCheckLine` green
  - `in_progress` → `RiLoader4Line` blue (or spinning)
  - `pending` → `RiCircleLine` muted
  - `blocked` → `RiLockLine` orange
  - `failed` → `RiCloseCircleLine` red
- Step 6: Use icons for tree nodes:
  - Plan: `RiFileTextLine`
  - Context folder: `RiFolder3Line`
  - Context file: `RiFileTextLine`
  - Tasks folder: `RiListCheck2`
- Step 7: Highlight the currently active panel/item in the tree (use `bg-interactive-selection`)
- Step 8: Commit

**Must NOT do**:
- Don't fetch full feature details for every feature in the tree — use summaries endpoint
- Don't add drag-and-drop
- Don't change the HivePanel union type (use existing panel names)

**References**:
- `packages/ui/src/components/views/hive/sidebar/HiveSidebar.tsx` — Current flat implementation
- `packages/ui/src/components/views/hive/sidebar/StatusBadge.tsx` — Reuse for feature status
- `packages/ui/src/components/ui/collapsible.tsx` — Radix Collapsible primitives

**Verify**:
- [ ] Run: `bun run type-check` → no new errors
- [ ] Tree renders with status groups → features → plan/context/tasks → items
- [ ] Clicking a tree leaf navigates to the correct panel
- [ ] Active/selected items are highlighted
- [ ] Features with no tasks/context/plan show appropriate empty state
