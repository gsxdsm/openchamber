# Task: 03-register-the-hive-tab-in-openchamber-navigation

## Feature: agent-hive-integration

## Dependencies

_None_

## Plan Section

### 3. Register the Hive tab in OpenChamber navigation

**Depends on**: none

**Files:**
- Modify: `packages/ui/src/stores/useUIStore.ts:7` (1 line)
- Modify: `packages/ui/src/components/layout/Header.tsx:~406-433` (3 lines)
- Modify: `packages/ui/src/components/layout/MainLayout.tsx:~286-301` (3 lines)
- Modify: `packages/ui/src/components/views/index.ts` (1 line)
- Create: `packages/ui/src/components/views/HiveView.tsx` (stub)

**What to do:**

- Step 1: Add `'hive'` to MainTab type in `useUIStore.ts`:
  ```typescript
  // Change line 7 from:
  export type MainTab = 'chat' | 'plan' | 'git' | 'diff' | 'terminal' | 'files';
  // To:
  export type MainTab = 'chat' | 'plan' | 'git' | 'diff' | 'terminal' | 'files' | 'hive';
  ```

- Step 2: Add Hive tab to Header.tsx TabConfig array. Find the `tabs: TabConfig[]` useMemo (around line 406-433) and add after the `git` entry:
  ```typescript
  // After the git tab entry, add:
  {
    id: 'hive' as MainTab,
    label: 'Hive',
    icon: RiHexagonLine,
  },
  ```
  Also add the import at the top of Header.tsx:
  ```typescript
  import { RiHexagonLine } from '@remixicon/react';
  ```

- Step 3: Add HiveView to MainLayout.tsx switch statement. Find the `secondaryView` useMemo (around line 286) and add a case:
  ```typescript
  case 'hive':
      return <HiveView />;
  ```
  Also add the import:
  ```typescript
  import { HiveView } from '@/components/views';
  ```

- Step 4: Create stub `HiveView.tsx`:
  ```typescript
  // packages/ui/src/components/views/HiveView.tsx
  import React from 'react';

  export const HiveView: React.FC = () => {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Hive panel loading...
      </div>
    );
  };
  ```

- Step 5: Export from barrel:
  ```typescript
  // packages/ui/src/components/views/index.ts - add:
  export { HiveView } from './HiveView';
  ```

- Step 6: Verify:
  ```bash
  bun run type-check:ui
  bun run lint:ui
  ```

**Must NOT do:**
- Do not conditionally show/hide the Hive tab yet (always visible)
- Do not modify any other tab's behavior or position
- Do not add keyboard shortcut yet

**References:**
- `packages/ui/src/stores/useUIStore.ts:7` — MainTab union type
- `packages/ui/src/components/layout/Header.tsx:406-433` — Tab config construction
- `packages/ui/src/components/layout/MainLayout.tsx:286-301` — View switch

**Verify:**
- [ ] Run: `bun run type-check:ui` → no errors
- [ ] Run: `bun run lint:ui` → no errors
- [ ] Hive tab appears in the header after Git

---
