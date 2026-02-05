# Hive UI Enhancements: Markdown Plan + Comments, Tree Sidebar

## Discovery

### Original Request
- "The plan panel currently renders plan content as plain `<pre>` text — needs to use SimpleMarkdownRenderer"
- "Need a line-anchored comment system matching the VS Code extension's comments.json format"
- "Currently HiveSidebar.tsx shows a flat list of features grouped by status — need to make it an expandable tree like VS Code extension"

### Interview Summary
- Plan rendering: Use `SimpleMarkdownRenderer` (already in codebase)
- Comments: Match `.hive/features/<name>/comments.json` format from VS Code extension
- Comment → AI flow: Use `useInlineCommentDraftStore` to attach comments as inline drafts to chat session
- Sidebar: Expandable tree with feature → plan/context/tasks → individual items
- Tree data: Add lightweight `/api/hive/features/:name/summary` endpoint for task counts + context file names without fetching full content

### Research Findings
- `packages/ui/src/components/chat/MarkdownRenderer.tsx:501`: `SimpleMarkdownRenderer` export — props: `{ content, className?, variant? }`
- `packages/ui/src/stores/useInlineCommentDraftStore.ts`: Full inline comment draft system with `addDraft`, `consumeDrafts`, `hasDrafts`
- `packages/ui/src/components/ui/collapsible.tsx`: Radix `Collapsible` components used throughout the app
- `packages/ui/src/components/views/hive/sidebar/StatusBadge.tsx`: Existing status badge component in sidebar

---

## Non-Goals (What we're NOT building)
- Real-time collaborative commenting (single user only)
- Comment threading/replies (flat comments per line)
- Drag-and-drop tree reordering
- Inline plan editing within the markdown view (keep separate edit mode)
- Full-text search within the tree sidebar

---

## Ghost Diffs (Alternatives rejected)
- **CodeMirror for plan editing**: Overkill — current Textarea for edit mode is fine; we only need markdown rendering for view mode
- **Virtual tree library (react-arborist)**: Too heavy — nested Collapsibles from Radix are sufficient for our depth (max 4 levels)
- **Fetching all feature details on mount**: Too expensive — use lightweight summary endpoint instead

---

## Tasks

### 1. Add comment CRUD to hive-service.js

**Depends on**: none

**Files:**
- Modify: `packages/web/server/lib/hive-service.js:141-191` (after Plans section)

**What to do**:
- Step 1: Add `getComments(hiveRoot, feature)` function
  - Read `.hive/features/<name>/comments.json`
  - Return `{ threads: [...] }` or `{ threads: [] }` if file doesn't exist
  - Use `safeReadJson` helper
- Step 2: Add `addComment(hiveRoot, feature, line, body, author)` function
  - Read existing comments or create new `{ threads: [] }`
  - Push new thread: `{ id: "comment-${Date.now()}", line, body, author, timestamp: new Date().toISOString() }`
  - Write back with `safeWriteJson`
- Step 3: Add `resolveComment(hiveRoot, feature, commentId)` function
  - Read comments, filter out the thread with matching id
  - Write back
- Step 4: Add `deleteComment(hiveRoot, feature, commentId)` — same as resolve (remove thread)
- Step 5: Add Express routes after the plan routes section:
  ```javascript
  // GET /api/hive/features/:name/comments
  app.get('/api/hive/features/:name/comments', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ threads: [] });
      const comments = getComments(req.hiveRoot, req.params.name);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/hive/features/:name/comments
  app.post('/api/hive/features/:name/comments', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { line, body, author } = req.body || {};
      if (line == null || !body) return res.status(400).json({ error: 'line and body required' });
      const comment = addComment(req.hiveRoot, req.params.name, line, body, author || 'You');
      res.status(201).json({ comment });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/hive/features/:name/comments/:commentId
  app.delete('/api/hive/features/:name/comments/:commentId', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      deleteComment(req.hiveRoot, req.params.name, req.params.commentId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  ```
- Step 6: Commit

**Must NOT do**:
- Don't add comment threading (replies) — keep it flat
- Don't modify the plan.md file when comments are added

**References**:
- `packages/web/server/lib/hive-service.js:33-61` — Existing helper functions (safeReadJson, safeWriteJson, etc.)
- `.hive/features/<name>/comments.json` — Format: `{ "threads": [{ "id", "line", "body", "author", "timestamp" }] }`

**Verify**:
- [ ] `bun run type-check` passes (no new TS errors — this is JS so mainly syntax check)
- [ ] Server starts without errors

### 2. Add feature summary endpoint to hive-service.js

**Depends on**: none

**Files:**
- Modify: `packages/web/server/lib/hive-service.js` (add after features section)

**What to do**:
- Step 1: Add `getFeatureSummary(hiveRoot, featureName)` function that returns:
  ```javascript
  {
    name: string,
    status: string,
    planStatus: 'none' | 'draft' | 'approved',
    commentCount: number,
    taskCounts: { total: number, done: number, inProgress: number, pending: number },
    contextFiles: string[] // just names
  }
  ```
  - Read feature.json, check plan.md + APPROVED existence, read comments.json thread count, count task folders by status, list context .md files
- Step 2: Add `getAllFeatureSummaries(hiveRoot)` — map over all features calling `getFeatureSummary`
- Step 3: Add route:
  ```javascript
  // GET /api/hive/summaries
  app.get('/api/hive/summaries', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ summaries: [] });
      const summaries = getAllFeatureSummaries(req.hiveRoot);
      res.json({ summaries });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  ```
- Step 4: Commit

**Must NOT do**:
- Don't read full plan content or full context content — only metadata
- Don't read task spec/report — only status.json

**Verify**:
- [ ] Server starts without errors

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

### 4. Rewrite PlanPanel with markdown rendering and comments

**Depends on**: 3

**Files:**
- Modify: `packages/ui/src/components/views/hive/panels/PlanPanel.tsx` (full rewrite)

**What to do**:
- Step 1: Replace `<pre>` rendering with `SimpleMarkdownRenderer`:
  ```tsx
  import { SimpleMarkdownRenderer } from '@/components/chat/MarkdownRenderer';
  ```
  In the view mode section, replace:
  ```tsx
  <pre className="...">{plan?.content}</pre>
  ```
  with:
  ```tsx
  <SimpleMarkdownRenderer content={plan?.content ?? ''} className="typography-markdown-body" />
  ```
- Step 2: Add line-number gutter alongside the rendered markdown. Wrap the markdown output in a container that assigns `data-line` attributes. Use a split layout:
  - Left: narrow gutter column (line numbers, clickable)
  - Right: markdown content
  - Split the plan content by `\n`, render each line wrapped in a div with `data-line={lineNum}`, apply markdown rendering per-block (or render as full markdown and overlay line numbers by splitting content)
  
  **Simpler approach**: Render plan as full markdown. Below the markdown view, show a "Comments" section listing all comments with their line references. Add a "Add Comment" button that opens a small form with line number input + text input. This avoids the complexity of line-anchored inline rendering while keeping full functionality.

- Step 3: Add comments section below the markdown view:
  ```tsx
  {/* Comments Section */}
  <div className="mt-4 border-t border-border pt-4">
    <div className="flex items-center justify-between mb-2">
      <span className="typography-ui-label">Comments ({comments.length})</span>
      <Button size="sm" variant="ghost" onClick={() => setShowCommentForm(true)}>
        <RiChat3Line size={14} className="mr-1" /> Add Comment
      </Button>
    </div>
    {showCommentForm && (
      <div className="mb-3 p-3 rounded border border-border bg-surface-muted">
        <div className="flex gap-2 mb-2">
          <label className="typography-micro text-muted-foreground">Line:</label>
          <input type="number" min={1} value={commentLine} onChange={...} className="w-16 ..." />
        </div>
        <Textarea value={commentBody} onChange={...} placeholder="Your feedback..." rows={2} />
        <div className="flex justify-end gap-2 mt-2">
          <Button size="sm" variant="ghost" onClick={() => setShowCommentForm(false)}>Cancel</Button>
          <Button size="sm" onClick={handleAddComment}>Submit</Button>
        </div>
      </div>
    )}
    {comments.map(c => (
      <div key={c.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
        <span className="typography-micro text-muted-foreground shrink-0">L{c.line}</span>
        <div className="flex-1">
          <p className="typography-ui">{c.body}</p>
          <span className="typography-micro text-muted-foreground">{c.author} · {formatTimestamp(c.timestamp)}</span>
        </div>
        <button onClick={() => handleDeleteComment(c.id)} className="p-1 rounded hover:bg-interactive-hover text-muted-foreground">
          <RiDeleteBinLine size={14} />
        </button>
      </div>
    ))}
  </div>
  ```

- Step 4: Add "Send to Chat" button that uses `useInlineCommentDraftStore.addDraft()`:
  ```tsx
  import { useInlineCommentDraftStore } from '@/stores/useInlineCommentDraftStore';
  // In component:
  const addDraft = useInlineCommentDraftStore((s) => s.addDraft);
  
  const handleSendToChat = (comment: HivePlanComment) => {
    const lines = (plan?.content ?? '').split('\n');
    const contextLine = lines[comment.line - 1] || '';
    addDraft({
      sessionKey: sessionId || 'draft',
      source: 'plan',
      fileLabel: `plan (${selectedFeature})`,
      startLine: comment.line,
      endLine: comment.line,
      code: contextLine,
      language: 'markdown',
      text: comment.body,
    });
    toast.success('Comment added to chat draft');
  };
  ```

- Step 5: Add "Send All Comments to Chat" button in the comments header
- Step 6: Block approve button if there are unresolved comments (show tooltip)
- Step 7: Commit

**Must NOT do**:
- Don't try to render comments inline within the markdown (too complex, fragile with re-renders)
- Don't modify SimpleMarkdownRenderer itself
- Don't change the edit mode (keep existing Textarea for editing)

**References**:
- `packages/ui/src/components/views/FilesView.tsx:1885` — Example usage of SimpleMarkdownRenderer
- `packages/ui/src/stores/useInlineCommentDraftStore.ts:43-61` — addDraft API
- `packages/ui/src/components/views/hive/panels/PlanPanel.tsx` — Current implementation to replace

**Verify**:
- [ ] Run: `bun run type-check` → no new errors
- [ ] Plan renders as formatted markdown (headings, lists, code blocks)
- [ ] Can add a comment with a line number
- [ ] Comments appear in the list
- [ ] Can delete a comment
- [ ] "Send to Chat" creates an inline draft
- [ ] Approve button is disabled when comments exist

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

### 6. Build verification

**Depends on**: 4, 5

**Files:**
- None (verification only)

**What to do**:
- Step 1: Run `bun run type-check` — must pass with zero new errors
- Step 2: Run `bun run lint` — fix any lint errors introduced
- Step 3: Run `bun run build` — Vite build must succeed
- Step 4: Commit any lint fixes

**Verify**:
- [ ] `bun run type-check` → 0 errors
- [ ] `bun run lint` → 0 errors
- [ ] `bun run build` → success
