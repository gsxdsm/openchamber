# Task: 09-session-linking-between-openchamber-and-hive

## Feature: agent-hive-integration

## Dependencies

- **1. Server-side Hive service and API routes** (01-server-side-hive-service-and-api-routes)
- **2. Zustand Hive store** (02-zustand-hive-store)
- **5. Feature detail panel and create feature dialog** (05-feature-detail-panel-and-create-feature-dialog)

## Plan Section

### 9. Session linking between OpenChamber and Hive

**Depends on**: 1, 2, 5

**Files:**
- Modify: `packages/ui/src/components/views/hive/panels/FeaturePanel.tsx` (add link button)
- Modify: `packages/ui/src/stores/useHiveStore.ts` (add link action implementation)

**What to do:**

- Step 1: Add a "Link Current Session" button to `FeaturePanel.tsx`. In the sessions section, add:
  ```tsx
  // In FeaturePanel.tsx, add to the sessions section:
  const currentSessionId = useSessionStore(s => s.currentSessionId);
  const linkSession = useHiveStore(s => s.linkSession);

  const handleLinkSession = async () => {
    if (!directory || !selectedFeature || !currentSessionId) return;
    await linkSession(directory, selectedFeature, currentSessionId);
    toast.success('Session linked to feature');
    // Refresh detail
    if (directory && selectedFeature) fetchFeatureDetail(directory, selectedFeature);
  };

  // In JSX, after the sessions list:
  {currentSessionId && (
    <Button size="sm" variant="outline" onClick={handleLinkSession}>
      <RiLinkM size={14} className="mr-1" /> Link Current Session
    </Button>
  )}
  ```

- Step 2: Add session navigation. When clicking a session ID that matches an OpenChamber session, switch to chat tab and that session:
  ```tsx
  // In the sessions list items:
  const setCurrentSession = useSessionStore(s => s.setCurrentSession);
  const setActiveMainTab = useUIStore(s => s.setActiveMainTab);

  const handleSessionClick = (sessionId: string) => {
    setCurrentSession(sessionId);
    setActiveMainTab('chat');
  };

  // Update session list item to be clickable:
  <button key={s.sessionId} onClick={() => handleSessionClick(s.sessionId)}
    className="flex items-center justify-between w-full px-2 py-1 rounded bg-surface-muted typography-micro hover:bg-interactive-hover">
    <span className="truncate">{s.sessionId}</span>
    {s.taskFolder && <span className="text-muted-foreground">{s.taskFolder}</span>}
  </button>
  ```

- Step 3: In `useHiveStore.ts`, complete the `linkSession` implementation:
  ```typescript
  linkSession: async (directory, feature, sessionId, taskFolder) => {
    await hiveApi(`/api/hive/features/${encodeURIComponent(feature)}/sessions?directory=${encodeURIComponent(directory)}`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, taskFolder }),
    });
  },
  ```

**Must NOT do:**
- Do not auto-link sessions (manual only — user chooses when to link)
- Do not create bidirectional links (session store doesn't need to know about Hive)

**References:**
- `packages/ui/src/stores/useSessionStore.ts` — Session store for currentSessionId
- `packages/ui/src/stores/useUIStore.ts` — setActiveMainTab for tab switching

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] "Link Current Session" button appears when a session is active
- [ ] Clicking a linked session navigates to Chat tab with that session

---
