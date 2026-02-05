# Task: 01-add-comment-crud-to-hive-servicejs

## Feature: hive-ui-enhancements

## Dependencies

_None_

## Plan Section

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
