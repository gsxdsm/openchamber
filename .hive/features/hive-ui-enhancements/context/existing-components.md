# Existing Components Reference

## Files to modify
- `packages/ui/src/components/views/hive/panels/PlanPanel.tsx` (125 lines) — Currently renders plan as `<pre>` text. Has edit/save/approve/sync buttons.
- `packages/ui/src/components/views/hive/sidebar/HiveSidebar.tsx` (79 lines) — Flat feature list grouped by status using Collapsible.
- `packages/ui/src/stores/useHiveStore.ts` (406 lines) — Zustand store with types, CRUD actions, polling.
- `packages/web/server/lib/hive-service.js` (707 lines) — Express routes + file system operations for .hive/ directory.

## Key imports for plan panel
- `SimpleMarkdownRenderer` from `@/components/chat/MarkdownRenderer` — takes `content: string`, `className?: string`, `variant?: 'assistant' | 'tool'`
- `useInlineCommentDraftStore` from `@/stores/useInlineCommentDraftStore` — `addDraft({ sessionKey, source, fileLabel, startLine, endLine, code, language, text })`, `consumeDrafts(sessionKey)`, `hasDrafts(sessionKey)`
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from `@/components/ui/collapsible`

## Comment format (matching VS Code extension)
File: `.hive/features/<name>/comments.json`
```json
{ "threads": [{ "id": "comment-1718234567890", "line": 5, "body": "Split this task", "author": "You", "timestamp": "2024-..." }] }
```

## Sidebar tree structure target
```
▼ In Progress (1)
  ▼ my-feature ● Executing · 3/5
    ├── Plan (Draft, 2 comments)
    ├── Context (3 files)
    │   ├── research.md
    │   └── architecture.md
    └── Tasks (3/5)
        ├── 01-setup ✓
        ├── 02-api ⟳
        └── 03-ui ○
▶ Completed (2)
```

## HivePanel types
Current: `'feature' | 'plan' | 'tasks' | 'task-detail' | 'context' | 'context-detail'`

## Store selectors needed for tree sidebar
- `features` — list of all features
- `featureDetail` — detail for *selected* feature only
- Need to fetch detail for ALL features to populate tree (task counts, context file names)
- Alternative: Add a lightweight `featureSummaries` endpoint that returns counts without full content
