/**
 * Lightweight .hive/ directory reader/writer for OpenChamber web server.
 * Replicates agent-hive file formats without depending on hive-core.
 * All functions are async-safe and use the same JSON/Markdown formats
 * as the hive-core services.
 */
import fs from 'fs';
import path from 'path';

const fsPromises = fs.promises;
const HIVE_DIR = '.hive';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findHiveRoot(directory) {
  let dir = path.resolve(directory);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, HIVE_DIR))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function hivePath(hiveRoot, ...segments) {
  return path.join(hiveRoot, HIVE_DIR, ...segments);
}

function featPath(hiveRoot, feature, ...segments) {
  return hivePath(hiveRoot, 'features', feature, ...segments);
}

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeReadText(filePath, fallback = '') {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function safeWriteText(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Status ──────────────────────────────────────────────────────────────────

function getHiveStatus(directory) {
  const hiveRoot = findHiveRoot(directory);
  if (!hiveRoot) return { exists: false, activeFeature: null, hiveRoot: null };

  const activeFile = hivePath(hiveRoot, 'active-feature');
  const activeFeature = safeReadText(activeFile, '').trim() || null;

  return { exists: true, activeFeature, hiveRoot };
}

// ─── Features ────────────────────────────────────────────────────────────────

function listFeatures(hiveRoot) {
  const featuresDir = hivePath(hiveRoot, 'features');
  if (!fs.existsSync(featuresDir)) return [];

  const dirs = fs.readdirSync(featuresDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  return dirs.map(d => {
    const json = safeReadJson(featPath(hiveRoot, d.name, 'feature.json'));
    if (!json) return null;
    return json;
  }).filter(Boolean);
}

function getFeature(hiveRoot, name) {
  const json = safeReadJson(featPath(hiveRoot, name, 'feature.json'));
  return json || null;
}

function createFeature(hiveRoot, name, ticket) {
  const slug = slugify(name);
  const dir = featPath(hiveRoot, slug);
  if (fs.existsSync(dir)) {
    throw new Error(`Feature "${slug}" already exists`);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'context'), { recursive: true });

  const feature = {
    name: slug,
    status: 'planning',
    ticket: ticket || undefined,
    createdAt: new Date().toISOString(),
  };
  safeWriteJson(path.join(dir, 'feature.json'), feature);

  // Set as active feature
  safeWriteText(hivePath(hiveRoot, 'active-feature'), slug);

  return feature;
}

function updateFeatureStatus(hiveRoot, name, status) {
  const fp = featPath(hiveRoot, name, 'feature.json');
  const json = safeReadJson(fp);
  if (!json) throw new Error(`Feature "${name}" not found`);

  json.status = status;
  if (status === 'approved') json.approvedAt = new Date().toISOString();
  if (status === 'completed') json.completedAt = new Date().toISOString();

  safeWriteJson(fp, json);
  return json;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

function getPlan(hiveRoot, feature) {
  const planPath = featPath(hiveRoot, feature, 'plan.md');
  const content = safeReadText(planPath, null);
  if (content === null) return null;

  const approvedPath = featPath(hiveRoot, feature, 'APPROVED');
  const isApproved = fs.existsSync(approvedPath);

  return { content, isApproved };
}

function writePlan(hiveRoot, feature, content) {
  const planPath = featPath(hiveRoot, feature, 'plan.md');
  safeWriteText(planPath, content);

  // Remove APPROVED sentinel when plan is edited
  const approvedPath = featPath(hiveRoot, feature, 'APPROVED');
  if (fs.existsSync(approvedPath)) {
    fs.unlinkSync(approvedPath);
  }

  // Update feature status to planning if it was approved
  const fp = featPath(hiveRoot, feature, 'feature.json');
  const json = safeReadJson(fp);
  if (json && json.status === 'approved') {
    json.status = 'planning';
    safeWriteJson(fp, json);
  }
}

function approvePlan(hiveRoot, feature) {
  const planPath = featPath(hiveRoot, feature, 'plan.md');
  if (!fs.existsSync(planPath)) {
    throw new Error('No plan to approve');
  }

  // Touch APPROVED sentinel
  const approvedPath = featPath(hiveRoot, feature, 'APPROVED');
  fs.writeFileSync(approvedPath, '', 'utf8');

  // Update feature status
  const fp = featPath(hiveRoot, feature, 'feature.json');
  const json = safeReadJson(fp);
  if (json) {
    json.status = 'approved';
    json.approvedAt = new Date().toISOString();
    safeWriteJson(fp, json);
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

function getComments(hiveRoot, feature) {
  const commentsPath = featPath(hiveRoot, feature, 'comments.json');
  const json = safeReadJson(commentsPath, { threads: [] });
  return json;
}

function addComment(hiveRoot, feature, line, body, author) {
  const commentsPath = featPath(hiveRoot, feature, 'comments.json');
  const json = safeReadJson(commentsPath, { threads: [] });
  if (!json.threads) json.threads = [];

  const comment = {
    id: `comment-${Date.now()}`,
    line,
    body,
    author: author || 'You',
    timestamp: new Date().toISOString(),
  };
  json.threads.push(comment);
  safeWriteJson(commentsPath, json);
  return comment;
}

function deleteComment(hiveRoot, feature, commentId) {
  const commentsPath = featPath(hiveRoot, feature, 'comments.json');
  const json = safeReadJson(commentsPath, { threads: [] });
  if (!json.threads) return;
  json.threads = json.threads.filter(t => t.id !== commentId);
  safeWriteJson(commentsPath, json);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

function listTasks(hiveRoot, feature) {
  const tasksDir = featPath(hiveRoot, feature, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const dirs = fs.readdirSync(tasksDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return dirs.map(d => {
    const statusJson = safeReadJson(path.join(tasksDir, d.name, 'status.json'), {});
    return {
      folder: d.name,
      status: statusJson.status || 'pending',
      origin: statusJson.origin || 'manual',
      planTitle: statusJson.planTitle || null,
      summary: statusJson.summary || null,
      startedAt: statusJson.startedAt || null,
      completedAt: statusJson.completedAt || null,
      dependsOn: statusJson.dependsOn || [],
      workerSession: statusJson.workerSession || null,
    };
  });
}

function getTask(hiveRoot, feature, taskFolder) {
  const taskDir = featPath(hiveRoot, feature, 'tasks', taskFolder);
  if (!fs.existsSync(taskDir)) return null;

  const statusJson = safeReadJson(path.join(taskDir, 'status.json'), {});
  const spec = safeReadText(path.join(taskDir, 'spec.md'), null);
  const report = safeReadText(path.join(taskDir, 'report.md'), null);

  return {
    folder: taskFolder,
    status: statusJson.status || 'pending',
    origin: statusJson.origin || 'manual',
    planTitle: statusJson.planTitle || null,
    summary: statusJson.summary || null,
    startedAt: statusJson.startedAt || null,
    completedAt: statusJson.completedAt || null,
    dependsOn: statusJson.dependsOn || [],
    workerSession: statusJson.workerSession || null,
    spec,
    report,
  };
}

function createTask(hiveRoot, feature, name, order) {
  const tasksDir = featPath(hiveRoot, feature, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  // Determine next order number
  const existing = fs.readdirSync(tasksDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let orderNum = order;
  if (orderNum == null) {
    const maxNum = existing.reduce((max, n) => {
      const match = n.match(/^(\d+)-/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    orderNum = maxNum + 1;
  }

  const slug = slugify(name);
  const folder = `${String(orderNum).padStart(2, '0')}-${slug}`;
  const taskDir = path.join(tasksDir, folder);

  fs.mkdirSync(taskDir, { recursive: true });
  safeWriteJson(path.join(taskDir, 'status.json'), {
    schemaVersion: 1,
    status: 'pending',
    origin: 'manual',
    planTitle: name,
  });

  return { folder };
}

function updateTask(hiveRoot, feature, taskFolder, updates) {
  const statusPath = featPath(hiveRoot, feature, 'tasks', taskFolder, 'status.json');
  const json = safeReadJson(statusPath, {});

  if (updates.status != null) json.status = updates.status;
  if (updates.summary != null) json.summary = updates.summary;
  if (updates.status === 'in_progress' && !json.startedAt) {
    json.startedAt = new Date().toISOString();
  }
  if (updates.status === 'done' && !json.completedAt) {
    json.completedAt = new Date().toISOString();
  }

  safeWriteJson(statusPath, json);
  return json;
}

function syncTasks(hiveRoot, feature) {
  const planPath = featPath(hiveRoot, feature, 'plan.md');
  const planContent = safeReadText(planPath, '');
  if (!planContent) throw new Error('No plan to sync from');

  // Parse ### N. Task Name headers
  const taskRegex = /^###\s+(\d+)\.\s+(.+)$/gm;
  const dependsRegex = /^\*\*Depends on\*\*:\s*(.+)$/m;
  const tasks = [];
  let match;

  while ((match = taskRegex.exec(planContent)) !== null) {
    const num = parseInt(match[1], 10);
    const name = match[2].trim();

    // Find the section between this header and the next ### header
    const sectionStart = match.index + match[0].length;
    const nextHeader = planContent.indexOf('\n###', sectionStart);
    const section = nextHeader >= 0
      ? planContent.slice(sectionStart, nextHeader)
      : planContent.slice(sectionStart);

    // Parse depends-on
    const depsMatch = section.match(dependsRegex);
    let dependsOn = [];
    if (depsMatch) {
      const depsStr = depsMatch[1].trim().toLowerCase();
      if (depsStr !== 'none') {
        dependsOn = depsStr.split(/,\s*/).map(d => d.trim()).filter(Boolean);
      }
    }

    tasks.push({ num, name, dependsOn });
  }

  // Create task folders
  const tasksDir = featPath(hiveRoot, feature, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const existing = new Set(
    fs.readdirSync(tasksDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  );

  let created = 0;
  for (const task of tasks) {
    const slug = slugify(task.name);
    const folder = `${String(task.num).padStart(2, '0')}-${slug}`;

    if (existing.has(folder)) continue;

    const taskDir = path.join(tasksDir, folder);
    fs.mkdirSync(taskDir, { recursive: true });

    // Resolve dependsOn numbers to folder names
    const resolvedDeps = task.dependsOn.map(dep => {
      const depNum = parseInt(dep, 10);
      if (isNaN(depNum)) return dep;
      const depTask = tasks.find(t => t.num === depNum);
      if (!depTask) return dep;
      return `${String(depTask.num).padStart(2, '0')}-${slugify(depTask.name)}`;
    });

    safeWriteJson(path.join(taskDir, 'status.json'), {
      schemaVersion: 1,
      status: 'pending',
      origin: 'plan',
      planTitle: task.name,
      dependsOn: resolvedDeps.length > 0 ? resolvedDeps : undefined,
    });

    created++;
  }

  // Update feature status to executing if it was approved
  const fp = featPath(hiveRoot, feature, 'feature.json');
  const json = safeReadJson(fp);
  if (json && (json.status === 'approved' || json.status === 'planning')) {
    json.status = 'executing';
    safeWriteJson(fp, json);
  }

  return { created, total: tasks.length };
}

// ─── Context Files ───────────────────────────────────────────────────────────

function listContextFiles(hiveRoot, feature) {
  const ctxDir = featPath(hiveRoot, feature, 'context');
  if (!fs.existsSync(ctxDir)) return [];

  return fs.readdirSync(ctxDir, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.md'))
    .map(f => {
      const filePath = path.join(ctxDir, f.name);
      const stats = fs.statSync(filePath);
      return {
        name: f.name,
        updatedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getContextFile(hiveRoot, feature, name) {
  const filePath = featPath(hiveRoot, feature, 'context', name);
  return safeReadText(filePath, null);
}

function writeContextFile(hiveRoot, feature, name, content) {
  const filePath = featPath(hiveRoot, feature, 'context', name);
  safeWriteText(filePath, content);
}

function deleteContextFile(hiveRoot, feature, name) {
  const filePath = featPath(hiveRoot, feature, 'context', name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function listSessions(hiveRoot, feature) {
  const sessionsPath = featPath(hiveRoot, feature, 'sessions.json');
  const json = safeReadJson(sessionsPath, { sessions: [] });
  return json.sessions || [];
}

function linkSession(hiveRoot, feature, sessionId, taskFolder) {
  const sessionsPath = featPath(hiveRoot, feature, 'sessions.json');
  const json = safeReadJson(sessionsPath, { sessions: [] });
  if (!json.sessions) json.sessions = [];

  // Check if session already linked
  const existing = json.sessions.find(s => s.sessionId === sessionId);
  if (existing) {
    // Update task folder if provided
    if (taskFolder) existing.taskFolder = taskFolder;
    existing.lastActiveAt = new Date().toISOString();
  } else {
    json.sessions.push({
      sessionId,
      taskFolder: taskFolder || undefined,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
  }

  safeWriteJson(sessionsPath, json);
}

// ─── Feature Summaries ────────────────────────────────────────────────────────

function getFeatureSummary(hiveRoot, featureName) {
  const feature = getFeature(hiveRoot, featureName);
  if (!feature) return null;

  // Plan status
  const planPath = featPath(hiveRoot, featureName, 'plan.md');
  const approvedPath = featPath(hiveRoot, featureName, 'APPROVED');
  let planStatus = 'none';
  if (fs.existsSync(planPath)) {
    planStatus = fs.existsSync(approvedPath) ? 'approved' : 'draft';
  }

  // Comment count
  const comments = getComments(hiveRoot, featureName);
  const commentCount = (comments.threads || []).length;

  // Task counts
  const tasks = listTasks(hiveRoot, featureName);
  const taskCounts = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  // Context file names
  const contextFiles = listContextFiles(hiveRoot, featureName).map(f => f.name);

  return {
    name: featureName,
    status: feature.status,
    planStatus,
    commentCount,
    taskCounts,
    contextFiles,
    tasks: tasks.map(t => ({ folder: t.folder, status: t.status })),
  };
}

function getAllFeatureSummaries(hiveRoot) {
  const features = listFeatures(hiveRoot);
  return features
    .map(f => getFeatureSummary(hiveRoot, f.name))
    .filter(Boolean);
}

// ─── Express Route Factory ───────────────────────────────────────────────────

export function createHiveRoutes(app) {

  // Middleware to resolve hiveRoot from ?directory= param
  const resolveHive = (req, res, next) => {
    const directory = req.query.directory;
    if (!directory) {
      return res.status(400).json({ error: 'directory parameter is required' });
    }

    const status = getHiveStatus(directory);
    req.hiveRoot = status.hiveRoot;
    req.hiveExists = status.exists;
    next();
  };

  // Status
  app.get('/api/hive/status', (req, res) => {
    const directory = req.query.directory;
    if (!directory) {
      return res.status(400).json({ error: 'directory parameter is required' });
    }
    const status = getHiveStatus(directory);
    res.json({ exists: status.exists, activeFeature: status.activeFeature });
  });

  // ─── Features ──────────────────────────────────────────────────────────────

  app.get('/api/hive/features', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ features: [] });
      const features = listFeatures(req.hiveRoot);
      res.json({ features });
    } catch (error) {
      console.error('Failed to list features:', error);
      res.status(500).json({ error: error.message || 'Failed to list features' });
    }
  });

  app.get('/api/hive/summaries', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ summaries: [] });
      const summaries = getAllFeatureSummaries(req.hiveRoot);
      res.json({ summaries });
    } catch (error) {
      console.error('Failed to get summaries:', error);
      res.status(500).json({ error: error.message || 'Failed to get summaries' });
    }
  });

  app.get('/api/hive/features/:name', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const feature = getFeature(req.hiveRoot, req.params.name);
      if (!feature) return res.status(404).json({ error: 'Feature not found' });
      res.json({ feature });
    } catch (error) {
      console.error('Failed to get feature:', error);
      res.status(500).json({ error: error.message || 'Failed to get feature' });
    }
  });

  app.post('/api/hive/features', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) {
        // Create .hive/ directory structure
        const directory = req.query.directory;
        const hiveDir = path.join(directory, HIVE_DIR);
        fs.mkdirSync(path.join(hiveDir, 'features'), { recursive: true });
        req.hiveRoot = directory;
      }
      const { name, ticket } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const feature = createFeature(req.hiveRoot, name, ticket);
      res.status(201).json({ feature });
    } catch (error) {
      console.error('Failed to create feature:', error);
      res.status(500).json({ error: error.message || 'Failed to create feature' });
    }
  });

  app.patch('/api/hive/features/:name', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { status } = req.body || {};
      if (!status) return res.status(400).json({ error: 'status is required' });
      const feature = updateFeatureStatus(req.hiveRoot, req.params.name, status);
      res.json({ feature });
    } catch (error) {
      console.error('Failed to update feature:', error);
      res.status(500).json({ error: error.message || 'Failed to update feature' });
    }
  });

  // ─── Plans ─────────────────────────────────────────────────────────────────

  app.get('/api/hive/features/:name/plan', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const plan = getPlan(req.hiveRoot, req.params.name);
      if (!plan) return res.json({ plan: null });
      res.json({ plan });
    } catch (error) {
      console.error('Failed to get plan:', error);
      res.status(500).json({ error: error.message || 'Failed to get plan' });
    }
  });

  app.put('/api/hive/features/:name/plan', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { content } = req.body || {};
      if (content == null) return res.status(400).json({ error: 'content is required' });
      writePlan(req.hiveRoot, req.params.name, content);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to write plan:', error);
      res.status(500).json({ error: error.message || 'Failed to write plan' });
    }
  });

  app.post('/api/hive/features/:name/plan/approve', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      approvePlan(req.hiveRoot, req.params.name);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to approve plan:', error);
      res.status(500).json({ error: error.message || 'Failed to approve plan' });
    }
  });

  // ─── Comments ────────────────────────────────────────────────────────────────

  app.get('/api/hive/features/:name/comments', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ threads: [] });
      const comments = getComments(req.hiveRoot, req.params.name);
      res.json(comments);
    } catch (error) {
      console.error('Failed to get comments:', error);
      res.status(500).json({ error: error.message || 'Failed to get comments' });
    }
  });

  app.post('/api/hive/features/:name/comments', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { line, body, author } = req.body || {};
      if (line == null || !body) return res.status(400).json({ error: 'line and body are required' });
      const comment = addComment(req.hiveRoot, req.params.name, line, body, author || 'You');
      res.status(201).json({ comment });
    } catch (error) {
      console.error('Failed to add comment:', error);
      res.status(500).json({ error: error.message || 'Failed to add comment' });
    }
  });

  app.delete('/api/hive/features/:name/comments/:commentId', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      deleteComment(req.hiveRoot, req.params.name, req.params.commentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete comment' });
    }
  });

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  app.get('/api/hive/features/:name/tasks', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ tasks: [] });
      const tasks = listTasks(req.hiveRoot, req.params.name);
      res.json({ tasks });
    } catch (error) {
      console.error('Failed to list tasks:', error);
      res.status(500).json({ error: error.message || 'Failed to list tasks' });
    }
  });

  app.get('/api/hive/features/:name/tasks/:task', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const task = getTask(req.hiveRoot, req.params.name, req.params.task);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json({ task });
    } catch (error) {
      console.error('Failed to get task:', error);
      res.status(500).json({ error: error.message || 'Failed to get task' });
    }
  });

  app.post('/api/hive/features/:name/tasks', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { name: taskName, order } = req.body || {};
      if (!taskName) return res.status(400).json({ error: 'name is required' });
      const result = createTask(req.hiveRoot, req.params.name, taskName, order);
      res.status(201).json(result);
    } catch (error) {
      console.error('Failed to create task:', error);
      res.status(500).json({ error: error.message || 'Failed to create task' });
    }
  });

  app.patch('/api/hive/features/:name/tasks/:task', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const updates = req.body || {};
      const result = updateTask(req.hiveRoot, req.params.name, req.params.task, updates);
      res.json(result);
    } catch (error) {
      console.error('Failed to update task:', error);
      res.status(500).json({ error: error.message || 'Failed to update task' });
    }
  });

  app.post('/api/hive/features/:name/tasks/sync', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const result = syncTasks(req.hiveRoot, req.params.name);
      res.json(result);
    } catch (error) {
      console.error('Failed to sync tasks:', error);
      res.status(500).json({ error: error.message || 'Failed to sync tasks' });
    }
  });

  // ─── Context Files ─────────────────────────────────────────────────────────

  app.get('/api/hive/features/:name/context', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ files: [] });
      const files = listContextFiles(req.hiveRoot, req.params.name);
      res.json({ files });
    } catch (error) {
      console.error('Failed to list context files:', error);
      res.status(500).json({ error: error.message || 'Failed to list context files' });
    }
  });

  app.get('/api/hive/features/:name/context/:file', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const content = getContextFile(req.hiveRoot, req.params.name, req.params.file);
      if (content === null) return res.status(404).json({ error: 'Context file not found' });
      res.json({ content });
    } catch (error) {
      console.error('Failed to get context file:', error);
      res.status(500).json({ error: error.message || 'Failed to get context file' });
    }
  });

  app.put('/api/hive/features/:name/context/:file', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { content } = req.body || {};
      if (content == null) return res.status(400).json({ error: 'content is required' });
      writeContextFile(req.hiveRoot, req.params.name, req.params.file, content);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to write context file:', error);
      res.status(500).json({ error: error.message || 'Failed to write context file' });
    }
  });

  app.delete('/api/hive/features/:name/context/:file', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      deleteContextFile(req.hiveRoot, req.params.name, req.params.file);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete context file:', error);
      res.status(500).json({ error: error.message || 'Failed to delete context file' });
    }
  });

  // ─── Sessions ──────────────────────────────────────────────────────────────

  app.get('/api/hive/features/:name/sessions', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.json({ sessions: [] });
      const sessions = listSessions(req.hiveRoot, req.params.name);
      res.json({ sessions });
    } catch (error) {
      console.error('Failed to list sessions:', error);
      res.status(500).json({ error: error.message || 'Failed to list sessions' });
    }
  });

  app.post('/api/hive/features/:name/sessions', resolveHive, (req, res) => {
    try {
      if (!req.hiveExists) return res.status(404).json({ error: 'Hive not found' });
      const { sessionId, taskFolder } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
      linkSession(req.hiveRoot, req.params.name, sessionId, taskFolder);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to link session:', error);
      res.status(500).json({ error: error.message || 'Failed to link session' });
    }
  });
}
