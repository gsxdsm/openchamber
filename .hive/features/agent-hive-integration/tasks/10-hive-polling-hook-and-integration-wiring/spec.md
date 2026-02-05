# Task: 10-hive-polling-hook-and-integration-wiring

## Feature: agent-hive-integration

## Dependencies

- **1. Server-side Hive service and API routes** (01-server-side-hive-service-and-api-routes)
- **2. Zustand Hive store** (02-zustand-hive-store)
- **4. HiveView root component with sidebar + content layout** (04-hiveview-root-component-with-sidebar--content-layout)

## Plan Section

### 10. Hive polling hook and integration wiring

**Depends on**: 1, 2, 4

**Files:**
- Create: `packages/ui/src/components/views/hive/hooks/useHivePolling.ts`
- Modify: `packages/ui/src/components/views/HiveView.tsx` (use polling hook)

**What to do:**

- Step 1: Create `useHivePolling.ts` to encapsulate polling lifecycle:
  ```typescript
  import { useEffect, useRef } from 'react';
  import { useHiveStore } from '@/stores/useHiveStore';

  export function useHivePolling(directory: string | null) {
    const startPolling = useHiveStore(s => s.startPolling);
    const stopPolling = useHiveStore(s => s.stopPolling);
    const fetchHiveStatus = useHiveStore(s => s.fetchHiveStatus);
    const fetchFeatures = useHiveStore(s => s.fetchFeatures);
    const directoryRef = useRef(directory);

    useEffect(() => {
      directoryRef.current = directory;
    }, [directory]);

    useEffect(() => {
      if (!directory) return;

      // Initial fetch
      fetchHiveStatus(directory);
      fetchFeatures(directory);
      startPolling(directory);

      return () => stopPolling();
    }, [directory, fetchHiveStatus, fetchFeatures, startPolling, stopPolling]);
  }
  ```

- Step 2: Update HiveView to use the hook (replace inline useEffect):
  ```tsx
  // In HiveView.tsx, replace the useEffect with:
  useHivePolling(directory);
  ```

- Step 3: Also check if the `showPlanTab` logic in Header needs to detect `.hive/` to conditionally show a badge or indicator on the Hive tab. For now, the tab is always visible — we can add a badge showing active feature count later.

- Step 4: Final verification:
  ```bash
  bun run type-check
  bun run lint
  bun run build
  ```

**Must NOT do:**
- Do not add SSE/WebSocket (polling is sufficient for v1)
- Do not poll when the Hive tab is not active (optimization for later)

**References:**
- `packages/ui/src/hooks/useGitPolling.tsx` — Polling hook pattern

**Verify:**
- [ ] Run: `bun run type-check` → no errors across all packages
- [ ] Run: `bun run lint` → no new lint errors
- [ ] Run: `bun run build` → builds successfully
- [ ] Hive tab auto-refreshes every 5 seconds when visible
- [ ] All panels (feature, plan, tasks, task-detail, context) work end-to-end

---

## Summary of OpenChamber touchpoints

| Existing file modified | Lines changed | What |
|------------------------|---------------|------|
| `packages/ui/src/stores/useUIStore.ts` | 1 | Add `'hive'` to MainTab |
| `packages/ui/src/components/layout/Header.tsx` | 4 | Add tab config + import |
| `packages/ui/src/components/layout/MainLayout.tsx` | 3 | Add case + import |
| `packages/ui/src/components/views/index.ts` | 1 | Export HiveView |
| `packages/web/server/index.js` | 2 | Mount hive routes |
| **Total** | **11** | |

All other code is new files in isolated directories.
