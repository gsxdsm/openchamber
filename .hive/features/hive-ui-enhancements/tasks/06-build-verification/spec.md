# Task: 06-build-verification

## Feature: hive-ui-enhancements

## Dependencies

- **4. Rewrite PlanPanel with markdown rendering and comments** (04-rewrite-planpanel-with-markdown-rendering-and-comments)
- **5. Rewrite HiveSidebar as expandable tree** (05-rewrite-hivesidebar-as-expandable-tree)

## Plan Section

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
