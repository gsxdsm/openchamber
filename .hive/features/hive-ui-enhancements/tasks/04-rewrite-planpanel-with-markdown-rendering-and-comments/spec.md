# Task: 04-rewrite-planpanel-with-markdown-rendering-and-comments

## Feature: hive-ui-enhancements

## Dependencies

- **3. Update useHiveStore with comment types and summary state** (03-update-usehivestore-with-comment-types-and-summary-state)

## Plan Section

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
