# Gantt Timeline Tree View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Gantt tab to show a hierarchical Project → Epic → Task → Subtask timeline based on live Jira data, with year-view, status chips, revised-dates indicator, OVR badge, and color-coded bars by Jira status.

**Architecture:** A new helper `fetchTree()` in `app/api/jira/_lib/jira.ts` pulls all relevant issues (with `expand=changelog`), groups them by project, links children to parents via `parent` field, computes `originalDueDate` from changelog. A new API route `app/api/jira/tree/route.ts` exposes this with 30-min cache. The client deletes the existing `GanttView` and replaces it with a new `GanttTreeView` plus a `StatusChips` component that filters tree leaves by status.

**Tech Stack:** Next.js 16 App Router (Node runtime), React 19, TypeScript 5, native fetch, Jira REST API v3.

---

### File Structure

| File | Action | Purpose |
|------|--------|---------|
| `app/api/jira/_lib/jira.ts` | modify (append) | New types: `IssueWithChangelog`, `TreeNode`, `ProjectMeta`, `TreeBundle`; helpers: `searchIssuesWithChangelog`, `extractOriginalDueDate`, `fetchProjectMeta`, `fetchTree` |
| `app/api/jira/tree/route.ts` | create | `GET /api/jira/tree[?refresh=1]` returns `{sales, project}` bundles |
| `app/page.tsx` | modify | Add `treeData` state + fetch, replace `GanttView` with `GanttTreeView`, add `StatusChips`, status color map, project palette |

The new tree code is additive to `_lib/jira.ts` — existing exports unchanged.

---

### Task 1: Tree types + project metadata fetch

**Files:**
- Modify: `app/api/jira/_lib/jira.ts` (append after existing exports)

- [ ] **Step 1: Verify base state**

Run:
```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git log --oneline -3
```
Expected: most recent commit `a002dfd docs: update spec project keys to EP/GOR/RP` or later. Branch should be `feat/jira-sync` initially — start a new branch from main below.

- [ ] **Step 2: Start branch off current main + merge feat/jira-sync first if not done**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git checkout main && git merge --ff-only feat/jira-sync && git checkout -b feat/gantt-tree
```

If fast-forward isn't possible, abort and ask the controller.

- [ ] **Step 3: Append new types + project metadata fetcher to `app/api/jira/_lib/jira.ts`**

Open the file and append at the end (after the existing `issueToDeal` function):

```ts
/* ──────────────────────────────────────────────
   GANTT TREE — types, project meta, changelog
   ────────────────────────────────────────────── */

export type TreeKind = "project" | "epic" | "task" | "subtask" | "customer";

export type TreeNode = {
  id: string;
  kind: TreeKind;
  name: string;
  projectKey: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  isOverdue: boolean;
  parentId: string | null;
  children: TreeNode[];
};

export type ProjectMeta = {
  key: string;
  name: string;
  color: string;
  totalEpics: number;
  doneEpics: number;
};

export type TreeBundle = {
  projects: ProjectMeta[];
  tree: TreeNode[];
};

const PROJECT_PALETTE = ["#22C55E", "#F59E0B", "#3B82F6", "#A855F7", "#EF4444", "#10B981"];

const DONE_STATUSES = new Set([
  "Done", "Closed Won", "Closed Lost", "Live", "Signed", "Dropped", "Inactive",
]);

export async function fetchProjectMeta(key: string): Promise<{ key: string; name: string }> {
  const data = await jiraGet<{ key: string; name: string }>(`/rest/api/3/project/${key}`);
  return { key: data.key, name: data.name };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors (hints OK).

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/api/jira/_lib/jira.ts && git commit -m "feat(jira): add Gantt tree types + project meta fetcher"
```

---

### Task 2: Search with changelog + original due date extraction

**Files:**
- Modify: `app/api/jira/_lib/jira.ts` (append)

- [ ] **Step 1: Append `searchIssuesWithChangelog` + `extractOriginalDueDate` to `app/api/jira/_lib/jira.ts`**

Append at the end:

```ts
type ChangelogItem = { field: string; fromString: string | null; toString: string | null };
type ChangelogEntry = { created: string; items: ChangelogItem[] };

export type IssueWithChangelog = {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    duedate: string | null;
    customfield_10015: string | null;
    parent: { key: string } | null;
  };
  changelog: { histories: ChangelogEntry[] };
};

export async function searchIssuesWithChangelog(jql: string): Promise<IssueWithChangelog[]> {
  const fields = ["summary", "status", "issuetype", "duedate", "customfield_10015", "parent"].join(",");
  const all: IssueWithChangelog[] = [];
  let nextPageToken: string | undefined;
  do {
    const q = new URLSearchParams({ jql, fields, expand: "changelog", maxResults: "100" });
    if (nextPageToken) q.set("nextPageToken", nextPageToken);
    const page = await jiraGet<{ issues: IssueWithChangelog[]; nextPageToken?: string; isLast: boolean }>(
      `/rest/api/3/search/jql?${q.toString()}`,
    );
    all.push(...page.issues);
    nextPageToken = !page.isLast && page.nextPageToken ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return all;
}

export function extractOriginalDueDate(
  current: string | null,
  changelog: { histories: ChangelogEntry[] },
): string | null {
  if (!current) return null;
  // Find first history entry where duedate was set (or changed).
  // Earliest non-null `toString` that differs from current means a revision occurred.
  const dueChanges: { created: string; toString: string | null; fromString: string | null }[] = [];
  for (const h of changelog.histories) {
    for (const it of h.items) {
      if (it.field === "duedate") {
        dueChanges.push({ created: h.created, toString: it.toString, fromString: it.fromString });
      }
    }
  }
  if (dueChanges.length === 0) return null;
  // sort ascending by created
  dueChanges.sort((a, b) => a.created.localeCompare(b.created));
  // earliest assigned date is first toString (or fromString of earliest if it started non-null)
  const earliest = dueChanges[0];
  // pick first non-null assignment from the timeline
  const original = earliest.fromString
    ? earliest.fromString.slice(0, 10)
    : earliest.toString
    ? earliest.toString.slice(0, 10)
    : null;
  if (!original || original === current) return null;
  return original;
}
```

Note: the `toString`/`fromString` returned by Jira looks like `"2026-05-06 00:00:00.0"` — slicing first 10 chars gives `YYYY-MM-DD`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/api/jira/_lib/jira.ts && git commit -m "feat(jira): add searchIssuesWithChangelog + extractOriginalDueDate"
```

---

### Task 3: `fetchTree` builder

**Files:**
- Modify: `app/api/jira/_lib/jira.ts` (append)

- [ ] **Step 1: Append `fetchTree` to `app/api/jira/_lib/jira.ts`**

Append at the end:

```ts
function kindFromIssueType(issuetype: string): TreeKind {
  const t = issuetype.toLowerCase();
  if (t === "customer") return "customer";
  if (t === "epic")     return "epic";
  if (t === "sub-task" || t === "subtask") return "subtask";
  // Task and Story both rendered as task layer
  return "task";
}

function buildNode(i: IssueWithChangelog, today: string): TreeNode {
  const status   = i.fields.status?.name ?? "Unknown";
  const dueDate  = i.fields.duedate;
  const overdue  = !!dueDate && dueDate < today && !DONE_STATUSES.has(status);
  return {
    id: i.key,
    kind: kindFromIssueType(i.fields.issuetype.name),
    name: i.fields.summary || i.key,
    projectKey: i.key.split("-")[0],
    status,
    startDate: i.fields.customfield_10015 ? i.fields.customfield_10015.slice(0, 10) : null,
    dueDate,
    originalDueDate: extractOriginalDueDate(dueDate, i.changelog),
    isOverdue: overdue,
    parentId: i.fields.parent?.key ?? null,
    children: [],
  };
}

function buildProjectTree(
  projectMetas: Map<string, { key: string; name: string }>,
  issues: IssueWithChangelog[],
  paletteOffset: number,
  isCustomerFlat: boolean,
): TreeBundle {
  const today = new Date().toISOString().slice(0, 10);
  const allNodes = issues.map(i => buildNode(i, today));

  // Index by id
  const byId = new Map<string, TreeNode>();
  for (const n of allNodes) byId.set(n.id, n);

  // Link parents
  const orphans: TreeNode[] = [];
  for (const n of allNodes) {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(n);
    } else {
      orphans.push(n);
    }
  }

  // Group orphans by projectKey
  const byProject = new Map<string, TreeNode[]>();
  for (const n of orphans) {
    const list = byProject.get(n.projectKey) ?? [];
    list.push(n);
    byProject.set(n.projectKey, list);
  }

  // Build project headers
  const projects: ProjectMeta[] = [];
  const tree: TreeNode[] = [];
  let pi = 0;
  for (const [pk, meta] of projectMetas) {
    const top = byProject.get(pk) ?? [];
    const epics = top.filter(n => n.kind === "epic");
    const doneEpics = epics.filter(n => DONE_STATUSES.has(n.status)).length;
    const color = PROJECT_PALETTE[(paletteOffset + pi) % PROJECT_PALETTE.length];
    projects.push({
      key: pk,
      name: meta.name,
      color,
      totalEpics: isCustomerFlat ? top.length : epics.length,
      doneEpics: isCustomerFlat ? top.filter(n => DONE_STATUSES.has(n.status)).length : doneEpics,
    });
    const projectNode: TreeNode = {
      id: `proj:${pk}`,
      kind: "project",
      name: meta.name,
      projectKey: pk,
      status: "",
      startDate: null,
      dueDate: null,
      originalDueDate: null,
      isOverdue: false,
      parentId: null,
      children: top,
    };
    tree.push(projectNode);
    pi++;
  }

  return { projects, tree };
}

export async function fetchTree(): Promise<{ sales: TreeBundle; project: TreeBundle }> {
  const [bdmMeta, epMeta, gorMeta, rpMeta, bdmIssues, projectIssues] = await Promise.all([
    fetchProjectMeta("BDM"),
    fetchProjectMeta("EP"),
    fetchProjectMeta("GOR"),
    fetchProjectMeta("RP"),
    searchIssuesWithChangelog('project = BDM AND issuetype = Customer'),
    searchIssuesWithChangelog('project IN (EP, GOR, RP) AND issuetype IN (Epic, Task, Subtask, "Sub-task", Story)'),
  ]);
  const sales = buildProjectTree(new Map([["BDM", bdmMeta]]), bdmIssues, 0, true);
  const project = buildProjectTree(
    new Map([["EP", epMeta], ["GOR", gorMeta], ["RP", rpMeta]]),
    projectIssues,
    1, // offset so project palette starts at a different color than sales
    false,
  );
  return { sales, project };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/api/jira/_lib/jira.ts && git commit -m "feat(jira): add fetchTree builder grouping issues by project + linking parents"
```

---

### Task 4: API route `/api/jira/tree`

**Files:**
- Create: `app/api/jira/tree/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/jira/tree/route.ts`:

```ts
import { NextResponse } from "next/server";
import { JiraApiError, JiraConfigError, fetchTree, type TreeBundle } from "../_lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache";
  sales: TreeBundle;
  project: TreeBundle;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { payload: Omit<Payload, "source">; expiresAt: number } | null = null;

async function buildFresh(): Promise<Omit<Payload, "source">> {
  const data = await fetchTree();
  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    sales: data.sales,
    project: data.project,
  };
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) {
    return NextResponse.json({ ...cache.payload, source: "cache" } satisfies Payload);
  }
  try {
    const payload = await buildFresh();
    cache = { payload, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json({ ...payload, source: "jira" } satisfies Payload);
  } catch (err) {
    console.error("[/api/jira/tree]", err);
    const message =
      err instanceof JiraConfigError ? "config error" :
      err instanceof JiraApiError    ? `Jira API error (${err.status})` :
      "unknown error";
    return NextResponse.json({ ok: false as const, error: message, syncedAt: null }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Hit endpoint**

Make sure dev server is running. If not:
```bash
cd "/Users/user/Project Pipeline/pipeline-app" && lsof -ti tcp:3002 | xargs -r kill -9; sleep 1; nohup npm run dev > /tmp/pipeline-dev.log 2>&1 & sleep 6
```

```bash
curl -s "http://localhost:3002/api/jira/tree?refresh=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('ok=',d.get('ok'),'source=',d.get('source'))
print('sales projects=',[p['key'] for p in d['sales']['projects']],'tree top=',[n['name']+'('+str(len(n['children']))+')' for n in d['sales']['tree']])
print('project projects=',[p['key'] for p in d['project']['projects']])
print('project tree counts:',[(n['name'],len(n['children'])) for n in d['project']['tree']])
# Check for revised dates
revised=[]
def walk(n):
  if n.get('originalDueDate'): revised.append((n['id'],n['originalDueDate'],n['dueDate']))
  for c in n.get('children',[]): walk(c)
for n in d['project']['tree']: walk(n)
print('revised dates count:',len(revised),'sample:',revised[:3])
overdue=[]
def w2(n):
  if n.get('isOverdue'): overdue.append((n['id'],n['status'],n['dueDate']))
  for c in n.get('children',[]): w2(c)
for n in d['project']['tree']: w2(n)
print('overdue count:',len(overdue),'sample:',overdue[:3])
"
```
Expected:
- `ok= True source= jira`
- sales projects = `['BDM']`, sales tree has 1 project node with ~37 children
- project projects = `['EP','GOR','RP']`, tree counts roughly: EP ~11+86, GOR ~21+100, RP ~13+40+45+11 (varies; what we hit excludes Bug)
- revised dates count > 0 (some issues had duedate changes; if 0, sanity check by hand)
- overdue count > 0

- [ ] **Step 4: Cache hit on second call**

```bash
curl -s http://localhost:3002/api/jira/tree | python3 -c "import json,sys; d=json.load(sys.stdin); print('source:',d.get('source'))"
```
Expected: `source: cache`

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/api/jira/tree/route.ts && git commit -m "feat(jira): add /api/jira/tree route with 30min cache"
```

---

### Task 5: Client — tree state + fetch loop

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add tree state declarations next to existing sync state**

Find this block (it should already exist from previous work):
```tsx
  const [jiraStages, setJiraStages] = useState<{sales: string[] | null; project: string[] | null}>({sales: null, project: null});
  const [sync, setSync] = useState<{at: string | null; ok: boolean; loading: boolean; error: string | null}>({at: null, ok: false, loading: true, error: null});
```

Replace with:
```tsx
  const [jiraStages, setJiraStages] = useState<{sales: string[] | null; project: string[] | null}>({sales: null, project: null});
  const [sync, setSync] = useState<{at: string | null; ok: boolean; loading: boolean; error: string | null}>({at: null, ok: false, loading: true, error: null});
  type TreeNodeC = {
    id: string;
    kind: "project" | "epic" | "task" | "subtask" | "customer";
    name: string;
    projectKey: string;
    status: string;
    startDate: string | null;
    dueDate: string | null;
    originalDueDate: string | null;
    isOverdue: boolean;
    parentId: string | null;
    children: TreeNodeC[];
  };
  type ProjectMetaC = { key: string; name: string; color: string; totalEpics: number; doneEpics: number };
  type TreeBundleC = { projects: ProjectMetaC[]; tree: TreeNodeC[] };
  const [treeData, setTreeData] = useState<{sales: TreeBundleC | null; project: TreeBundleC | null}>({sales: null, project: null});
```

- [ ] **Step 2: Extend existing `fetchJira` to also fetch tree**

Find:
```tsx
  const fetchJira = async (force = false) => {
    setSync(s => ({...s, loading: true}));
    try {
      const r = await fetch(`/api/jira/deals${force ? "?refresh=1" : ""}`, {cache: "no-store"});
      const j = await r.json();
      if (j.ok) {
        setDeals(j.deals as Deal[]);
        setJiraStages({sales: j.salesStages, project: j.projectStages});
        setSync({at: j.syncedAt, ok: true, loading: false, error: null});
      } else {
        setSync({at: null, ok: false, loading: false, error: j.error || "fetch failed"});
      }
    } catch (e) {
      setSync({at: null, ok: false, loading: false, error: (e as Error).message});
    }
  };
```

Replace with:
```tsx
  const fetchJira = async (force = false) => {
    setSync(s => ({...s, loading: true}));
    try {
      const qs = force ? "?refresh=1" : "";
      const [dr, tr] = await Promise.all([
        fetch(`/api/jira/deals${qs}`,  {cache: "no-store"}).then(r => r.json()),
        fetch(`/api/jira/tree${qs}`,   {cache: "no-store"}).then(r => r.json()),
      ]);
      if (dr.ok) {
        setDeals(dr.deals as Deal[]);
        setJiraStages({sales: dr.salesStages, project: dr.projectStages});
      }
      if (tr.ok) {
        setTreeData({sales: tr.sales, project: tr.project});
      }
      if (dr.ok || tr.ok) {
        setSync({at: dr.syncedAt || tr.syncedAt, ok: true, loading: false, error: null});
      } else {
        setSync({at: null, ok: false, loading: false, error: dr.error || tr.error || "fetch failed"});
      }
    } catch (e) {
      setSync({at: null, ok: false, loading: false, error: (e as Error).message});
    }
  };
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors. Hint about unused `treeData` is OK (used in next task).

- [ ] **Step 4: Verify both endpoints get called**

Reload http://localhost:3002 in browser → DevTools Network → expect TWO requests, one to `/api/jira/deals`, one to `/api/jira/tree`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat(pipeline): fetch /api/jira/tree alongside /api/jira/deals"
```

---

### Task 6: Replace `GanttView` with `GanttTreeView` skeleton

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Delete the existing `GanttView` function**

Find the section starting:
```tsx
/* ════════════════════════════════════════════
   GANTT VIEW
════════════════════════════════════════════ */
function GanttView({ pipeline, deals }: { pipeline: Pipeline; deals: Deal[] }) {
```

...through the closing brace of that function (it's a large function ~150 lines). Delete the entire function and its section comment.

- [ ] **Step 2: Insert `GanttTreeView` in the same location with status color map + helpers**

Insert at the location where `GanttView` was:

```tsx
/* ════════════════════════════════════════════
   GANTT TREE VIEW
════════════════════════════════════════════ */

const STATUS_COLORS_TREE: Record<string, string> = {
  "Done": "#22C55E",
  "Closed Won": "#22C55E",
  "Live": "#22C55E",
  "Signed": "#22C55E",
  "In Progress": "#3B82F6",
  "To Do": "#6B82A4",
  "Delay": "#EF4444",
  "delay": "#EF4444",
  "On Hold": "#F59E0B",
  "Review": "#A855F7",
  "Testing QA": "#A855F7",
  "Ready For Deployment": "#10B981",
  "Ready To Deploy": "#10B981",
  "STG / READY TO DEPLOY": "#10B981",
  "Dropped": "#64748B",
  "Closed Lost": "#64748B",
  "Inactive": "#64748B",
  "Proposal": "#F59E0B",
  "Negotiation": "#3B82F6",
  "Follow-up": "#A855F7",
  "Contract Sent": "#10B981",
  "New": "#6B82A4",
};
const TREE_FALLBACK_COLOR = "#A3B5CC";
const treeColor = (s: string): string => STATUS_COLORS_TREE[s] ?? TREE_FALLBACK_COLOR;

const DONE_STATUSES_C = new Set([
  "Done", "Closed Won", "Closed Lost", "Live", "Signed", "Dropped", "Inactive",
]);
const TERMINAL_STATUSES_C = new Set([
  ...DONE_STATUSES_C, "On Hold",
]);

type TreeNodeC2 = {
  id: string;
  kind: "project" | "epic" | "task" | "subtask" | "customer";
  name: string;
  projectKey: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  isOverdue: boolean;
  parentId: string | null;
  children: TreeNodeC2[];
};
type ProjectMetaC2 = { key: string; name: string; color: string; totalEpics: number; doneEpics: number };
type TreeBundleC2 = { projects: ProjectMetaC2[]; tree: TreeNodeC2[] };

const STATUS_CHIPS = ["All", "Active", "Delay", "Done", "In Progress", "To Do"] as const;
type StatusChip = typeof STATUS_CHIPS[number];

function matchesChip(status: string, chip: StatusChip): boolean {
  if (chip === "All") return true;
  if (chip === "Active") return !TERMINAL_STATUSES_C.has(status);
  if (chip === "Delay") return status === "Delay" || status === "delay";
  if (chip === "Done") return DONE_STATUSES_C.has(status);
  if (chip === "In Progress") return status === "In Progress";
  if (chip === "To Do") return status === "To Do";
  return false;
}

function countByChip(nodes: TreeNodeC2[], chip: StatusChip): number {
  let c = 0;
  const walk = (n: TreeNodeC2) => {
    if (n.kind !== "project" && matchesChip(n.status, chip)) c++;
    for (const ch of n.children) walk(ch);
  };
  for (const n of nodes) walk(n);
  return c;
}

// Earliest startDate and latest dueDate across descendants
function projectSpan(node: TreeNodeC2): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end:   string | null = null;
  const walk = (n: TreeNodeC2) => {
    if (n.startDate && (!start || n.startDate < start)) start = n.startDate;
    if (n.dueDate   && (!end   || n.dueDate   > end))   end   = n.dueDate;
    for (const c of n.children) walk(c);
  };
  for (const c of node.children) walk(c);
  return { start, end };
}

function GanttTreeView({ bundle }: { bundle: TreeBundleC2 | null }) {
  const [chip, setChip] = useState<StatusChip>("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // Default: project rows expanded; epic rows collapsed (so tasks hidden initially).
    return new Set();
  });
  if (!bundle) return <EmptyState msg="Loading Jira tree…"/>;
  return (
    <div style={{padding:14}}>
      <div style={{fontSize:13,color:C.inkMid}}>Status chips, headers, rows — implementation in next task. {bundle.tree.length} project(s) loaded.</div>
    </div>
  );
}
```

- [ ] **Step 3: Update the deal content block to use `GanttTreeView` for `view === "gantt"`**

Find:
```tsx
              {view==="gantt"   && <GanttView   pipeline={pipeline} deals={pDeals}/>}
```

Replace with:
```tsx
              {view==="gantt"   && <GanttTreeView bundle={pipeline.id === "sales" ? treeData.sales : pipeline.id === "project" ? treeData.project : null}/>}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 5: Verify dev server responds**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3002
```
Expected: `HTTP 200`.

Open browser http://localhost:3002 → Projects tab → 📅 Gantt → expect placeholder "Status chips, headers, rows — implementation in next task. 3 project(s) loaded." (or 1 project for Sales). This confirms the wiring.

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat(gantt): replace GanttView with GanttTreeView skeleton + types + helpers"
```

---

### Task 7: GanttTreeView — render chips + timeline header + project headers

**Files:**
- Modify: `app/page.tsx` — the `GanttTreeView` function body

- [ ] **Step 1: Replace `GanttTreeView` body with full chips + header + project rows**

Find:
```tsx
function GanttTreeView({ bundle }: { bundle: TreeBundleC2 | null }) {
  const [chip, setChip] = useState<StatusChip>("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // Default: project rows expanded; epic rows collapsed (so tasks hidden initially).
    return new Set();
  });
  if (!bundle) return <EmptyState msg="Loading Jira tree…"/>;
  return (
    <div style={{padding:14}}>
      <div style={{fontSize:13,color:C.inkMid}}>Status chips, headers, rows — implementation in next task. {bundle.tree.length} project(s) loaded.</div>
    </div>
  );
}
```

Replace with:
```tsx
function GanttTreeView({ bundle }: { bundle: TreeBundleC2 | null }) {
  const [chip, setChip] = useState<StatusChip>("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!bundle) return <EmptyState msg="Loading Jira tree…"/>;

  const year   = new Date().getFullYear();
  const yStart = new Date(year, 0, 1);
  const yEnd   = new Date(year, 11, 31);
  const today  = new Date(); today.setHours(0,0,0,0);
  const ms     = (d: Date) => d.getTime();
  const pct    = (d: Date) => Math.min(100, Math.max(0, ((ms(d) - ms(yStart)) / (ms(yEnd) - ms(yStart))) * 100));
  const todayPct = pct(today);

  const months = Array.from({length:12}, (_,i) => new Date(year, i, 1));

  const LABEL_W = 240;

  const toggle = (id: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Bar geometry
  const barGeom = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const sd = new Date(start); const ed = new Date(end);
    if (sd > yEnd || ed < yStart) return null;
    const left  = pct(sd < yStart ? yStart : sd);
    const right = pct(ed > yEnd ? yEnd : ed);
    const width = Math.max(0.5, right - left);
    return { left, width };
  };

  const renderBar = (n: TreeNodeC2, height: number) => {
    const main = barGeom(n.startDate, n.dueDate);
    const revised = n.originalDueDate ? barGeom(n.startDate, n.originalDueDate) : null;
    const color = treeColor(n.status);
    const dateLabel = (n.startDate && n.dueDate)
      ? `${new Date(n.startDate).toLocaleDateString("en-US",{day:"2-digit",month:"short"})} → ${new Date(n.dueDate).toLocaleDateString("en-US",{day:"2-digit",month:"short"})}`
      : "";
    return (
      <>
        {revised && main && revised.left !== main.left + main.width && (
          <div style={{
            position:"absolute", top: (height - 8) / 2 + height + 2, height: 6,
            left:`${revised.left}%`, width:`${revised.width}%`,
            border:`2px dashed ${color}`, borderRadius: 3, background:"transparent",
          }} title="Original due date"/>
        )}
        {main && (
          <div style={{
            position:"absolute", top: (height - Math.min(height-4, 18)) / 2,
            height: Math.min(height-4, 18),
            left:`${main.left}%`, width:`${main.width}%`,
            background: color, borderRadius:4, display:"flex", alignItems:"center",
            padding:"0 7px", fontSize:9, fontWeight:700, color:"#fff",
            overflow:"hidden", whiteSpace:"nowrap", boxShadow:"0 1px 3px rgba(0,0,0,.15)",
          }}>{n.name}</div>
        )}
        {main && dateLabel && (
          <div style={{
            position:"absolute", left:`calc(${main.left + main.width}% + 8px)`,
            top:"50%", transform:"translateY(-50%)",
            fontSize:10, color:C.inkSub, whiteSpace:"nowrap", pointerEvents:"none",
          }}>{n.name} <span style={{opacity:.7}}>{dateLabel}</span></div>
        )}
      </>
    );
  };

  // Filter walk: returns true if node or any descendant matches chip
  const nodeMatchesFilter = (n: TreeNodeC2): boolean => {
    if (n.kind === "project") return n.children.some(nodeMatchesFilter);
    if (matchesChip(n.status, chip)) return true;
    return n.children.some(nodeMatchesFilter);
  };

  // Render one node + children recursively
  const renderRow = (n: TreeNodeC2, depth: number): React.ReactNode[] => {
    const isProj = n.kind === "project";
    const isCollapsed = collapsed.has(n.id);
    const height = isProj ? 48 : n.kind === "epic" ? 28 : n.kind === "task" ? 24 : 22;
    const expandable = n.children.length > 0;

    if (!nodeMatchesFilter(n)) return [];

    const proj = bundle.projects.find(p => p.key === n.projectKey);
    const projColor = proj?.color ?? "#94A3B8";

    const out: React.ReactNode[] = [];

    out.push(
      <div key={n.id} style={{display:"flex", alignItems:"center", height, borderTop: isProj ? `1px solid ${C.border}` : "none"}}>
        <div style={{width:LABEL_W, flexShrink:0, paddingLeft: depth*14 + 8, paddingRight:8, display:"flex", flexDirection:"column", justifyContent:"center"}}>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            {expandable && (
              <span onClick={()=>toggle(n.id)}
                style={{cursor:"pointer", fontSize:11, color:C.inkSub, userSelect:"none"}}>
                {isCollapsed ? "▸" : "▾"}
              </span>
            )}
            {!expandable && <span style={{width:11}}/>}
            <span style={{
              fontSize: isProj ? 13 : 11,
              fontWeight: isProj ? 800 : n.kind === "epic" ? 700 : 500,
              color: isProj ? projColor : C.ink,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              {!isProj && <span style={{fontFamily:"'JetBrains Mono',monospace",color:C.inkDim,marginRight:6}}>{n.id}</span>}
              {n.name}
            </span>
            {n.isOverdue && (
              <span style={{background:C.red,color:"#fff",fontSize:8,fontWeight:700,padding:"2px 6px",borderRadius:3,marginLeft:4}}>OVR</span>
            )}
          </div>
          {isProj && proj && (
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:C.inkSub,marginTop:3,marginLeft:17}}>
              <span style={{background:projColor+"22",color:projColor,padding:"1px 6px",borderRadius:3,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{proj.key}</span>
              <span>{proj.totalEpics} {n.children.some(c=>c.kind==="customer") ? "customers" : "epics"} · {proj.doneEpics} done</span>
            </div>
          )}
        </div>
        <div style={{flex:1, position:"relative", borderLeft:`1px solid ${C.border}`, height:"100%"}}>
          {/* Month gridlines */}
          {months.map((m,i) => (
            <div key={i} style={{position:"absolute", top:0, bottom:0, left:`${pct(m)}%`, width:1, background:"#F1F5F9"}}/>
          ))}
          {/* Today line */}
          <div style={{position:"absolute",top:0,bottom:0,left:`${todayPct}%`,width:2,background:"#F59E0B",zIndex:20}}/>
          {/* Bar for non-project nodes */}
          {!isProj && renderBar(n, height)}
          {/* Project ghost outline */}
          {isProj && (() => {
            const span = projectSpan(n);
            const g = barGeom(span.start, span.end);
            if (!g) return null;
            return (
              <div style={{
                position:"absolute", top: (height - 14) / 2, height: 14,
                left:`${g.left}%`, width:`${g.width}%`,
                border:`2px dashed ${projColor}`, borderRadius: 8, background:"transparent",
              }}/>
            );
          })()}
        </div>
      </div>
    );

    if (!isCollapsed) {
      for (const c of n.children) out.push(...renderRow(c, depth + 1));
    }
    return out;
  };

  return (
    <div style={{padding:"12px 14px",overflowX:"auto"}}>
      {/* Status chips */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {STATUS_CHIPS.map(c => {
          const count = c === "All"
            ? bundle.tree.reduce((s,n)=>s+countByChip([n],"All"),0)
            : countByChip(bundle.tree, c);
          const active = chip === c;
          return (
            <button key={c} onClick={()=>setChip(c)} className="btn"
              style={{
                padding:"5px 12px", borderRadius:14, fontSize:11, fontWeight:700,
                background: active ? C.teal : "#fff",
                color: active ? "#fff" : C.inkMid,
                border: `1.5px solid ${active ? C.teal : C.border}`,
                display:"inline-flex", alignItems:"center", gap:6,
              }}>
              {c} <span style={{opacity:.75,fontWeight:500}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:10,fontSize:11,color:C.inkSub}}>
        {(["Done","In Progress","To Do","Delay","On Hold","Review"] as const).map(s => (
          <div key={s} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:12,height:10,borderRadius:3,background:treeColor(s)}}/>
            {s}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-end",borderBottom:`1px solid ${C.border}`,paddingBottom:6,marginBottom:4}}>
        <div style={{width:LABEL_W,flexShrink:0,fontSize:10,fontWeight:700,color:C.inkDim,textTransform:"uppercase",letterSpacing:".07em"}}>
          Project / Epic
        </div>
        <div style={{flex:1,position:"relative",borderLeft:`1px solid ${C.border}`,display:"flex"}}>
          {months.map((m,i) => (
            <div key={i} style={{flex:1,textAlign:"center",fontSize:10,fontWeight:700,color:C.inkDim,fontFamily:"'JetBrains Mono',monospace"}}>
              {m.toLocaleDateString("en-US",{month:"short"}).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{position:"relative"}}>
        {bundle.tree.flatMap(n => renderRow(n, 0))}
      </div>

      {/* Today footer */}
      <div style={{display:"flex",alignItems:"center",gap:10,fontSize:11,color:C.inkSub,marginTop:8}}>
        <div style={{width:18,height:2,background:"#F59E0B"}}/>
        Today ({today.toLocaleDateString("en-US",{day:"2-digit",month:"short",year:"numeric"})})
        <div style={{width:18,height:8,border:"1.5px dashed #A3B5CC",borderRadius:2,marginLeft:14}}/>
        New dates (revised)
        <span style={{marginLeft:14,color:C.inkDim}}>· Click ▸ to expand</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Verify in browser**

Open http://localhost:3002:
1. Projects tab → 📅 Gantt → expect:
   - 6 status chips at top with counts
   - Legend strip (Done/In Progress/To Do/Delay/On Hold/Review)
   - Month header Jan-Dec
   - 3 project headers: EIR Project (EP), E-Gorvernance (GOR), Airpay Reengineering (RP), each with ghost outline bar spanning child date range, color-coded
   - Today line (orange) at current date
2. Click ▸ on a project row → expect epic rows collapse (or already shown by default)
3. Click ▸ on an epic row → expect task rows appear underneath
4. Click "Done" chip → only rows with done status remain (project headers stay visible)
5. OVR badge shown next to overdue epic/task names
6. Some epics with revised dueDate show a dashed bar BELOW the solid bar

Sales tab → 📅 Gantt → expect:
- 1 project header "New Business & Sales" (BDM)
- ~37 Customer rows as direct children

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat(gantt): render hierarchical tree with chips, month header, OVR, revised bars"
```

---

### Task 8: Smoke + polish

**Files:** none unless adjustments needed

- [ ] **Step 1: Final endpoint sanity**

```bash
curl -s "http://localhost:3002/api/jira/tree?refresh=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
def w(n,depth=0):
  yield (depth,n['kind'],n['id'],n.get('status'),n.get('startDate'),n.get('dueDate'),n.get('originalDueDate'))
  for c in n.get('children',[]): yield from w(c, depth+1)
total = sum(1 for _ in (x for n in d['project']['tree'] for x in w(n)))
print('project total nodes:', total)
sales_total = sum(1 for _ in (x for n in d['sales']['tree'] for x in w(n)))
print('sales total nodes:', sales_total)
"
```

Expected: project total ~250+ nodes (1 project + 3 sub-projects + epics + tasks), sales ~38 (1 project + 37 customers).

- [ ] **Step 2: Browser walkthrough**

Confirm each item from Task 7 Step 3.

- [ ] **Step 3: Final commit if any tweaks needed**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git status
```
If clean, no commit needed.

---

## Self-Review Notes

- **Spec coverage:**
  - New `/api/jira/tree` endpoint → Task 4
  - Tree structure with parent linking → Task 3 (`buildProjectTree`)
  - Original due date from changelog → Task 2 (`extractOriginalDueDate`) + Task 3 (in `buildNode`)
  - OVR overdue → Task 3 + Task 7 render
  - Status chips with counts → Task 6 helpers + Task 7 render
  - Year view (Jan-Dec current year) → Task 7
  - Project header with ghost outline → Task 7 `projectSpan`
  - Color-coded bars by Jira status → Task 6 `treeColor`
  - Replaces existing GanttView entirely → Task 6 Step 1 deletes old function
  - Sales pipeline gets flat Customer rows → Task 3 `buildProjectTree` with `isCustomerFlat=true`
  - Bug excluded → Task 3 JQL excludes Bug
  - Waiting telco skipped → Task 6 chip list

- **No placeholders.** Every step has concrete code or commands.

- **Type consistency:** `TreeNode`/`TreeBundle`/`ProjectMeta` defined in `_lib/jira.ts` (server) are mirrored in `app/page.tsx` as `TreeNodeC2`/`TreeBundleC2`/`ProjectMetaC2` (client) with identical shape. Mirror is intentional — server code can't be imported into a "use client" file in this codebase pattern.

- **Risk:** First load of `/api/jira/tree` could take 3-6 seconds (Jira API + changelog expansion on ~350 issues). Cache covers subsequent requests. If too slow, future optimization: split into parallel project fetches or omit changelog for tasks (only fetch for epics).
