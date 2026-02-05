# Task: 02-add-feature-summary-endpoint-to-hive-servicejs

## Feature: hive-ui-enhancements

## Dependencies

_None_

## Plan Section

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
