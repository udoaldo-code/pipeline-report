# Product Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third pipeline tab "Product" sourcing Epics + Stories from the Jira `PD` board, rendered across Report (tree), Board (Stories only), Log, and Gantt.

**Architecture:** Extend existing `/api/jira/deals` and `/api/jira/tree` routes (single payload, single cache). Reuse existing `TreeReportView` for Report hierarchy. Add `parent` + `kind` optional fields to `Deal` to express Epic→Story linkage for Board chip and counters.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Jira REST v3 (basic auth via env).

**Spec:** `docs/superpowers/specs/2026-05-25-product-pipeline-design.md`

**Note on TDD:** This project ships no test runner (`package.json` scripts: `dev`, `build`, `start`, `lint`). Verification uses `npm run build` (full TS + Next compile), `npm run lint`, and `curl` smoke tests against `localhost:3000` dev server.

---

## File map

- Modify: `app/api/jira/_lib/jira.ts` — `Deal` type, `issueToDeal` signature, new `unionOrdered` helper, `fetchTree` accepts PD.
- Modify: `app/api/jira/deals/route.ts` — `buildFresh` fetches PD Epics + Stories + statuses; `Payload` type gains `productStages`.
- Modify: `app/api/jira/tree/route.ts` — `Payload` type gains `product: TreeBundle`.
- Modify: `app/page.tsx` — `PIPES` config, `treeData` state shape, Report selector ternary, Board card render (Stories with Epic chip), counter banner.

---

## Task 1: Extend `Deal` type with `parent` and `kind`

**Files:**
- Modify: `app/api/jira/_lib/jira.ts:4-17`

- [ ] **Step 1: Edit type**

Replace the existing `Deal` type block:

```ts
export type Deal = {
  id: string;
  pid: string;
  name: string;
  owner: string;
  val: number;
  stage: string;
  pri: string;
  notes: string;
  hist: { wk: string; stage: string; note: string; by: string; ts: string }[];
  at: string;
  dueDate?: string;
  lead?: string;
  parent?: string;            // Product Stories: parent Epic key (e.g., "PD-31")
  kind?: "epic" | "story";    // Product rows only; absent for Sales/Projects
};
```

- [ ] **Step 2: Verify type compiles**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/api/jira/_lib/jira.ts
git commit -m "feat(types): add Deal.parent and Deal.kind for Product hierarchy"
```

---

## Task 2: Extend `issueToDeal` to accept `parentKey` and `kind`

**Files:**
- Modify: `app/api/jira/_lib/jira.ts:122-139`

- [ ] **Step 1: Replace signature + body**

Replace the existing `issueToDeal` function with:

```ts
export function issueToDeal(
  issue: JiraIssue,
  pid: "sales" | "project" | "product",
  parentKey?: string,
  kind?: "epic" | "story",
): Deal {
  const f = issue.fields;
  const at = f.customfield_10015 ? dateOnly(f.customfield_10015) : dateOnly(f.created);
  const deal: Deal = {
    id: issue.key,
    pid,
    name: f.summary || issue.key,
    owner: f.assignee?.displayName || "",
    val: 0,
    stage: f.status?.name || "Unknown",
    pri: mapPriority(f.priority?.name),
    notes: "",
    hist: [],
    at,
  };
  if (f.duedate) deal.dueDate = f.duedate;
  if (parentKey) deal.parent = parentKey;
  if (kind) deal.kind = kind;
  return deal;
}
```

- [ ] **Step 2: Verify existing callers still compile**

Existing callers in `deals/route.ts` pass only `(issue, "sales" | "project")`. The new `parentKey` and `kind` are optional, so they keep working unchanged.

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/api/jira/_lib/jira.ts
git commit -m "feat(jira): issueToDeal accepts optional parentKey and kind"
```

---

## Task 3: Add `unionOrdered` helper

**Files:**
- Modify: `app/api/jira/_lib/jira.ts` (append near other helpers, after `mapPriority` block ~line 82)

- [ ] **Step 1: Add helper**

After the `mapPriority` const, before `dateOnly`, add:

```ts
export const unionOrdered = (a: string[], b: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...a, ...b]) if (!seen.has(s)) { seen.add(s); out.push(s); }
  return out;
};
```

- [ ] **Step 2: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/api/jira/_lib/jira.ts
git commit -m "feat(jira): add unionOrdered helper for status list merging"
```

---

## Task 4: Extend `fetchTree` to include Product bundle

**Files:**
- Modify: `app/api/jira/_lib/jira.ts:345-357`

- [ ] **Step 1: Replace `fetchTree`**

Replace the existing function with:

```ts
export async function fetchTree(): Promise<{
  sales: TreeBundle;
  project: TreeBundle;
  product: TreeBundle;
}> {
  const [bdmMeta, projectMetas, pdMeta, bdmIssues, projectIssues, pdIssues] = await Promise.all([
    fetchProjectMeta("BDM"),
    Promise.all(PROJECT_KEYS.map(k => fetchProjectMeta(k))),
    fetchProjectMeta("PD"),
    searchIssuesWithChangelog('project = BDM AND issuetype IN (Lead, Customer)'),
    searchIssuesWithChangelog(`project IN (${PROJECT_KEYS.join(", ")}) AND issuetype IN (Epic, Task, Subtask, "Sub-task", Story)`),
    searchIssuesWithChangelog('project = PD AND issuetype IN (Epic, Story)'),
  ]);
  const sales = buildProjectTree(new Map([["BDM", bdmMeta]]), bdmIssues, 0, false);
  const projectMap = new Map<string, { key: string; name: string }>();
  PROJECT_KEYS.forEach((k, i) => projectMap.set(k, projectMetas[i]));
  const project = buildProjectTree(projectMap, projectIssues, 1, false);
  const product = buildProjectTree(new Map([["PD", pdMeta]]), pdIssues, 1 + PROJECT_KEYS.length, false);
  return { sales, project, product };
}
```

- [ ] **Step 2: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors (note: the `tree/route.ts` may need its `Payload` type updated — handled in Task 6).

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/api/jira/_lib/jira.ts
git commit -m "feat(jira): fetchTree returns product TreeBundle from PD board"
```

---

## Task 5: Wire Product into `/api/jira/deals` route

**Files:**
- Modify: `app/api/jira/deals/route.ts`

- [ ] **Step 1: Update imports**

Replace the import line:

```ts
import {
  type Deal, JiraApiError, JiraConfigError,
  fetchProjectStatuses, fetchProjectStatusesUnion, searchIssues, issueToDeal,
  unionOrdered,
} from "../_lib/jira";
```

- [ ] **Step 2: Extend `Payload` type**

Replace the `Payload` type block:

```ts
type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache";
  deals: Deal[];
  salesStages: string[];
  projectStages: string[];
  productStages: string[];
};
```

- [ ] **Step 3: Replace `buildFresh` body**

Replace the entire `buildFresh` function:

```ts
async function buildFresh(): Promise<Omit<Payload, "source">> {
  const [
    salesStages, projectStages,
    salesIssues, projectIssues, leadIssues,
    productEpicStages, productStoryStages,
    productEpics, productStories,
  ] = await Promise.all([
    fetchProjectStatuses("BDM", "Customer"),
    fetchProjectStatusesUnion(["GOR", "EP", "BR", "RP", "DMS", "UPM", "SYN"], "Epic"),
    searchIssues('project = BDM AND issuetype = Customer'),
    searchIssues('project IN (GOR, EP, BR, RP, DMS, UPM, SYN) AND issuetype = Epic'),
    searchIssues('project = BDM AND issuetype = Lead'),
    fetchProjectStatuses("PD", "Epic"),
    fetchProjectStatuses("PD", "Story"),
    searchIssues('project = PD AND issuetype = Epic'),
    searchIssues('project = PD AND issuetype = Story'),
  ]);

  const leadName = new Map<string, string>();
  for (const l of leadIssues) leadName.set(l.key, l.fields.summary || l.key);

  const salesDeals: Deal[] = salesIssues.map(i => {
    const d = issueToDeal(i, "sales");
    const parentKey = i.fields.parent?.key;
    if (parentKey && leadName.has(parentKey)) d.lead = leadName.get(parentKey)!;
    return d;
  });
  const projectDeals: Deal[] = projectIssues.map(i => issueToDeal(i, "project"));

  const productDeals: Deal[] = [
    ...productEpics.map(i => issueToDeal(i, "product", undefined, "epic")),
    ...productStories.map(i => issueToDeal(i, "product", i.fields.parent?.key, "story")),
  ];

  const productStages = unionOrdered(productEpicStages, productStoryStages);

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    deals: [...salesDeals, ...projectDeals, ...productDeals],
    salesStages,
    projectStages,
    productStages,
  };
}
```

- [ ] **Step 4: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd pipeline-app
git add app/api/jira/deals/route.ts
git commit -m "feat(api): /api/jira/deals returns Product Epics + Stories"
```

---

## Task 6: Update `/api/jira/tree` route payload type

**Files:**
- Modify: `app/api/jira/tree/route.ts:7-26`

- [ ] **Step 1: Extend `Payload`**

Replace the `Payload` type:

```ts
type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache";
  sales: TreeBundle;
  project: TreeBundle;
  product: TreeBundle;
};
```

- [ ] **Step 2: Update `buildFresh` return**

Replace `buildFresh`:

```ts
async function buildFresh(): Promise<Omit<Payload, "source">> {
  const data = await fetchTree();
  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    sales: data.sales,
    project: data.project,
    product: data.product,
  };
}
```

- [ ] **Step 3: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd pipeline-app
git add app/api/jira/tree/route.ts
git commit -m "feat(api): /api/jira/tree returns product TreeBundle"
```

---

## Task 7: Backend smoke test via curl

**Files:** none (verification only)

- [ ] **Step 1: Start dev server in background**

Run: `cd pipeline-app && npm run dev &`
Wait ~5 seconds for server to bind to localhost:3000.

- [ ] **Step 2: Hit /api/jira/deals**

Run:

```bash
curl -s 'http://localhost:3000/api/jira/deals?refresh=1' | python3 -c 'import sys,json
d=json.load(sys.stdin)
print("ok:", d.get("ok"))
print("productStages:", d.get("productStages"))
prod=[x for x in d.get("deals",[]) if x.get("pid")=="product"]
print("product deals:", len(prod))
print("epics:", sum(1 for x in prod if x.get("kind")=="epic"))
print("stories:", sum(1 for x in prod if x.get("kind")=="story"))
print("sample story parent:", next((x.get("parent") for x in prod if x.get("kind")=="story"), None))'
```

Expected:
- `ok: True`
- `productStages: [...]` (non-empty list of Jira workflow names)
- `product deals:` > 0
- `epics:` 9 (current PD Epic count)
- `stories:` > 0
- `sample story parent:` non-null PD-* key (some Stories may have no parent — that's allowed; the assertion is only that at least one does)

- [ ] **Step 3: Hit /api/jira/tree**

Run:

```bash
curl -s 'http://localhost:3000/api/jira/tree?refresh=1' | python3 -c 'import sys,json
d=json.load(sys.stdin)
print("ok:", d.get("ok"))
prod=d.get("product",{})
print("projects:", [p["key"] for p in prod.get("projects",[])])
print("tree roots:", len(prod.get("tree",[])))
root=prod.get("tree",[{}])[0]
print("root children:", len(root.get("children",[])))'
```

Expected:
- `ok: True`
- `projects: ["PD"]`
- `tree roots: 1`
- `root children:` > 0

- [ ] **Step 4: Stop dev server**

Run: `pkill -f "next dev" || true`

- [ ] **Step 5: Commit** (no code change, but record verification)

No commit needed — proceed to frontend.

---

## Task 8: Add Product to `PIPES` config

**Files:**
- Modify: `app/page.tsx:46-53`

- [ ] **Step 1: Extend `PIPES` array**

Replace the existing `PIPES` block:

```ts
const PIPES = [
  { id:"sales",       label:"Sales",       emoji:"💼", color:C.teal,    lt:C.tealLt,   stages:["Prospect","Qualified","Proposal","Negotiation","Closed Won","Closed Lost"] },
  { id:"partnership", label:"Partnership", emoji:"🤝", color:"#6366F1", lt:"#EEF2FF",  stages:["Identified","First Contact","MOU Discussion","Due Diligence","Signed","Inactive"] },
  { id:"project",     label:"Projects",    emoji:"🚀", color:C.orange,  lt:"#FEF9EE",  stages:["Backlog","In Discovery","In Development","UAT","Live","On Hold"] },
  { id:"product",     label:"Product",     emoji:"🎨", color:"#3B82F6", lt:"#DBEAFE",  stages:[] },
];
```

(`stages:[]` for Product because it is overwritten at runtime from `productStages` payload.)

- [ ] **Step 2: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/page.tsx
git commit -m "feat(ui): add Product pipeline to PIPES config"
```

---

## Task 9: Wire `productStages` + `treeData.product` into client state

**Files:**
- Modify: `app/page.tsx:1150` (treeData state init)
- Modify: `app/page.tsx:1152-1156` (`pipelineStages` helper)
- Modify: `app/page.tsx:1193-1218` (`fetchJira` setters)

Also: jiraStages state. Need to grep first to find it.

- [ ] **Step 1: Locate `jiraStages` state**

Run: `cd pipeline-app && grep -n "jiraStages\|setJiraStages" app/page.tsx`
Note line numbers for next edits.

- [ ] **Step 2: Extend `jiraStages` state shape**

Find the line that declares `useState` for `jiraStages` (likely `useState<{sales: string[] | null; project: string[] | null}>(...)`).

Replace it with:

```ts
const [jiraStages, setJiraStages] = useState<{sales: string[] | null; project: string[] | null; product: string[] | null}>({sales: null, project: null, product: null});
```

- [ ] **Step 3: Extend `treeData` state**

Replace line 1150:

```ts
const [treeData, setTreeData] = useState<{sales: TreeBundleC | null; project: TreeBundleC | null; product: TreeBundleC | null}>({sales: null, project: null, product: null});
```

- [ ] **Step 4: Extend `pipelineStages` helper**

Replace lines 1152-1156:

```ts
const pipelineStages = (pid: string): string[] => {
  if (pid === "sales"   && jiraStages.sales)   return jiraStages.sales;
  if (pid === "project" && jiraStages.project) return jiraStages.project;
  if (pid === "product" && jiraStages.product) return jiraStages.product;
  return PIPES.find(p => p.id === pid)?.stages ?? [];
};
```

- [ ] **Step 5: Update `fetchJira` setters**

Inside `fetchJira` (around line 1205 and 1208), replace:

```ts
if (dr.ok) {
  const ovr = readValOverrides();
  const deals = (dr.deals as Deal[]).map(d => ovr[d.id] !== undefined ? {...d, val: ovr[d.id]} : d);
  setDeals(deals);
  setJiraStages({sales: dr.salesStages, project: dr.projectStages, product: dr.productStages});
}
if (tr.ok) {
  setTreeData({sales: tr.sales, project: tr.project, product: tr.product});
}
```

- [ ] **Step 6: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd pipeline-app
git add app/page.tsx
git commit -m "feat(ui): wire productStages + product TreeBundle into client state"
```

---

## Task 10: Render Product Report via `TreeReportView`

**Files:**
- Modify: `app/page.tsx:1409-1411`

- [ ] **Step 1: Extend Report selector ternary**

Replace lines 1409-1411:

```tsx
{view==="report"  && pipeline.id === "project"
  ? <TreeReportView bundle={treeData.project}/>
  : view==="report" && pipeline.id === "product"
    ? <TreeReportView bundle={treeData.product}/>
    : view==="report" && <ReportView  pipeline={pipeline} deals={pDeals} filtered={filtered} fPipe={fPipe} onOpen={d=>setModal({type:"deal",data:d})} onUpdateValue={updateValue}/>}
```

- [ ] **Step 2: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/page.tsx
git commit -m "feat(ui): Product Report renders via TreeReportView"
```

---

## Task 11: Render Product Gantt via existing `GanttTreeView`

**Files:**
- Modify: `app/page.tsx:1414`

- [ ] **Step 1: Extend Gantt selector**

Replace line 1414:

```tsx
{view==="gantt"   && <GanttTreeView bundle={pipeline.id === "sales" ? treeData.sales : pipeline.id === "project" ? treeData.project : pipeline.id === "product" ? treeData.product : null}/>}
```

- [ ] **Step 2: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd pipeline-app
git add app/page.tsx
git commit -m "feat(ui): Product Gantt renders via GanttTreeView"
```

---

## Task 12: Board view — Stories only, Epic chip on cards

**Files:**
- Modify: `app/page.tsx:432-462` (`BoardView`)

The current `BoardView` already filters by stage and renders `DealCard` per deal. For Product, only Stories should appear (Epics are themes). Add a filter rule + show Epic name chip on Story cards.

- [ ] **Step 1: Build an Epic-key→name lookup at the call site**

Find the `BoardView` call site (line 1412):

```tsx
{view==="board"   && <BoardView   pipeline={pipeline} deals={pDeals} onOpen={d=>setModal({type:"deal",data:d})} stages={pipelineStages(pipeline.id)}/>}
```

Replace with:

```tsx
{view==="board"   && <BoardView   pipeline={pipeline} deals={pDeals} onOpen={d=>setModal({type:"deal",data:d})} stages={pipelineStages(pipeline.id)} epicNames={Object.fromEntries(pDeals.filter(d=>d.kind==="epic").map(e=>[e.id,e.name]))}/>}
```

- [ ] **Step 2: Extend `BoardView` signature**

Replace the `BoardView` function signature (line 432):

```tsx
function BoardView({pipeline, deals, onOpen, stages, epicNames}: { pipeline: Pipeline; deals: Deal[]; onOpen: (d: Deal) => void; stages: string[]; epicNames?: Record<string, string> }) {
```

- [ ] **Step 3: Filter Product Board to Stories only**

In `BoardView`, the existing line:

```tsx
const sd = deals.filter(d=>d.stage===sel);
```

Replace with:

```tsx
const baseList = pipeline.id === "product" ? deals.filter(d => d.kind === "story") : deals;
const sd = baseList.filter(d=>d.stage===sel);
```

Also update the column-count line:

```tsx
const cnt = deals.filter(d=>d.stage===s).length, act = sel===s;
```

Replace with:

```tsx
const cnt = baseList.filter(d=>d.stage===s).length, act = sel===s;
```

- [ ] **Step 4: Pass `epicNames` into `DealCard`**

In the card list render (around line 457):

```tsx
{sd.map((d,i)=><DealCard key={d.id} deal={d} pipeline={pipeline} onClick={()=>onOpen(d)} i={i}/>)}
```

Replace with:

```tsx
{sd.map((d,i)=><DealCard key={d.id} deal={d} pipeline={pipeline} onClick={()=>onOpen(d)} i={i} epicName={d.parent && epicNames ? epicNames[d.parent] : undefined}/>)}
```

- [ ] **Step 5: Locate `DealCard` definition**

Run: `cd pipeline-app && grep -n "function DealCard" app/page.tsx`
Note the line number.

- [ ] **Step 6: Extend `DealCard` signature + render**

Edit the `DealCard` function to accept an optional `epicName` prop. Add it to the props destructuring:

```tsx
function DealCard({deal, pipeline, onClick, i, epicName}: { deal: Deal; pipeline: Pipeline; onClick: () => void; i: number; epicName?: string }) {
```

Inside the card's JSX, immediately before the deal title (`{deal.name}`), add:

```tsx
{epicName && (
  <div style={{fontSize:10, fontWeight:700, color:pipeline.color, background:pipeline.lt, padding:"2px 6px", borderRadius:4, display:"inline-block", marginBottom:4, border:`1px solid ${pipeline.color}33`}}>
    {epicName}
  </div>
)}
```

- [ ] **Step 7: Compile**

Run: `cd pipeline-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd pipeline-app
git add app/page.tsx
git commit -m "feat(ui): Product Board shows Stories only with Epic chip"
```

---

## Task 13: Counter banner — Product row + TOTAL update

The KPI table at line 1349 already iterates `VISIBLE_PIPES` so Product appears automatically once added to PIPES. Only the TOTAL row (line 1370-1376) hardcodes `totalSales`. Verify TOTAL is still sensible.

**Files:**
- Modify: `app/page.tsx:1231` (`totalSales` derivation)

- [ ] **Step 1: Verify counter renders**

(no code change here — counter inherits from PIPES). Visual check happens in Task 14.

- [ ] **Step 2: Optional — extend TOTAL to sum across pipelines**

Currently `totalSales` only sums `pid==="sales"`. PD Stories have `val=0` so summing them is a no-op. Leave `totalSales` as-is (still represents sales-only $ figure under the "Sales Pipeline" column).

- [ ] **Step 3: No commit needed for this task** — verification only.

---

## Task 14: Full build + browser smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `cd pipeline-app && npm run build`
Expected: build succeeds, no TS errors, no Next compile errors.

- [ ] **Step 2: Lint**

Run: `cd pipeline-app && npm run lint`
Expected: no new lint errors. (Pre-existing warnings are acceptable; new ones are not.)

- [ ] **Step 3: Start dev server**

Run: `cd pipeline-app && npm run dev &`
Wait ~5 seconds.

- [ ] **Step 4: Open browser to http://localhost:3000**

Visual checklist:
- "🎨 Product" tab visible in pipe-tab strip, after "🚀 Projects".
- "🎨 Product" row visible in KPI counter table with deal count > 0.
- Pipeline filter dropdown contains "🎨 Product" option.
- Click Product tab → Report view shows tree with PD project header → 9 Epic rows → expandable to show Stories.
- Click Board → shows Story cards under correct stage columns; each card has Epic-name chip on top.
- Click Log → renders without error (empty list expected — no `hist[]` on Jira deals).
- Click Gantt → renders PD project tree with Epic→Story timeline bars.
- Switch back to Sales tab → unchanged.
- Switch to Projects tab → unchanged.

- [ ] **Step 5: Stop dev server**

Run: `pkill -f "next dev" || true`

- [ ] **Step 6: Final integration commit**

If any small fixes were needed during Step 4, commit them now. Otherwise no commit needed.

```bash
cd pipeline-app
git status  # verify clean tree
```

Expected: clean tree (or one bugfix commit if Step 4 surfaced a defect).

---

## Self-review checklist (run after implementation, before declaring done)

- [ ] All 14 tasks executed and committed.
- [ ] `npm run build` succeeds.
- [ ] Product tab renders all four views correctly.
- [ ] No regression in Sales or Projects tabs.
- [ ] `?refresh=1` invalidates cache on both routes.
