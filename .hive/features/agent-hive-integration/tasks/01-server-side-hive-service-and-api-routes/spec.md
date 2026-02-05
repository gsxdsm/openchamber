# Task: 01-server-side-hive-service-and-api-routes

## Feature: agent-hive-integration

## Dependencies

_None_

## Plan Section

### 1. Server-side Hive service and API routes

**Depends on**: none

**Files:**
- Create: `packages/web/server/lib/hive-service.js`
- Modify: `packages/web/server/index.js` (mount routes, ~5 lines)

**What to do:**

- Step 1: Create `packages/web/server/lib/hive-service.js` with functions that read/write `.hive/` files directly. No external dependencies — just `fs`, `path`, `os`. Replicate the file format from hive-core:
  ```javascript
  // hive-service.js — Lightweight .hive/ file reader/writer
  import fs from 'fs';
  import path from 'path';

  const HIVE_DIR = '.hive';

  export function findHiveRoot(directory) {
    // Walk up from directory to find .hive/ folder
    let dir = directory;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, HIVE_DIR))) return dir;
      dir = path.dirname(dir);
    }
    return null;
  }

  export function hiveExists(directory) {
    return findHiveRoot(directory) !== null;
  }

  export function getActiveFeature(hiveRoot) {
    const activeFile = path.join(hiveRoot, HIVE_DIR, 'active-feature');
    if (!fs.existsSync(activeFile)) return null;
    return fs.readFileSync(activeFile, 'utf8').trim();
  }

  export function listFeatures(hiveRoot) {
    const featuresDir = path.join(hiveRoot, HIVE_DIR, 'features');
    if (!fs.existsSync(featuresDir)) return [];
    const dirs = fs.readdirSync(featuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    return dirs.map(d => {
      const featureJson = path.join(featuresDir, d.name, 'feature.json');
      if (!fs.existsSync(featureJson)) return null;
      return JSON.parse(fs.readFileSync(featureJson, 'utf8'));
    }).filter(Boolean);
  }

  export function getFeature(hiveRoot, name) { /* read feature.json */ }
  export function createFeature(hiveRoot, name, ticket) { /* write feature.json + dirs */ }
  export function updateFeatureStatus(hiveRoot, name, status) { /* patch feature.json */ }

  export function getPlan(hiveRoot, feature) { /* read plan.md */ }
  export function writePlan(hiveRoot, feature, content) { /* write plan.md, clear APPROVED */ }
  export function approvePlan(hiveRoot, feature) { /* touch APPROVED, update feature status */ }

  export function listTasks(hiveRoot, feature) { /* read all tasks/*/status.json */ }
  export function getTask(hiveRoot, feature, taskFolder) { /* read task status.json + spec + report */ }
  export function createTask(hiveRoot, feature, name, order) { /* create task dir + status.json */ }
  export function updateTask(hiveRoot, feature, taskFolder, updates) { /* patch status.json */ }
  export function syncTasks(hiveRoot, feature) { /* parse plan.md
