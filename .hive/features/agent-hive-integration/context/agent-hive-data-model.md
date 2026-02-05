# Agent-Hive Data Model & Storage

## Storage: File-based in `.hive/` directory

```
.hive/
├── journal.md
├── active-feature
├── .worktrees/<feature>/<task>/
└── features/<feature-name>/
    ├── feature.json
    ├── plan.md
    ├── comments.json
    ├── APPROVED / BLOCKED (sentinel)
    ├── sessions.json
    ├── context/<name>.md
    └── tasks/<NN-task-name>/
        ├── status.json
        ├── spec.md / report.md
        └── subtasks/
```

## Key Types
- FeatureJson: name, status (planning|approved|executing|completed), ticket, sessionId, timestamps
- TaskStatus: status (pending|in_progress|done|cancelled|blocked|failed|partial), origin, summary, dependsOn[], workerSession
- WorkerSession: taskId, sessionId, workerId, agent, mode, attempt
- PlanComment: id, line, body, author, timestamp
- SessionInfo: sessionId, taskFolder, startedAt, lastActiveAt, messageCount

## Services (hive-core)
- FeatureService, PlanService, TaskService, WorktreeService, ContextService, SessionService, ConfigService
