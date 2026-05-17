# Gantt Timeline Tree View — Design Spec
Date: 2026-05-17

## Summary

Rewrite the existing **📅 Gantt** tab to render a hierarchical project → epic → task → subtask timeline based directly on Jira data. Year view (Jan-Dec), status filter chips, color-coded bars by Jira status, OVR overdue badge, expandable rows, and a "revised dates" dashed bar derived from Jira changelog.

This replaces the existing `GanttView` component entirely. Other view tabs (Report / Board / Log) keep current behavior.

---

## Scope

| Pipeline | Source projects | Issuetypes shown |
|----------|----------------|------------------|
| Sales (`sales`) | BDM | Customer (flat — no children) |
| Projects (`project`) | EP, GOR, RP | Epic, Task, Subtask, Story (NO Bug) |

Both pipelines use the same `GanttTreeView` component with their respective tree payload.

---

## Data Model

### Tree node

```ts
type TreeNode = {
  id: string;                  // Jira key (e.g. "EP-49") or synthetic project id (e.g. "proj:EP")
  kind: "project" | "epic" | "task" | "subtask" | "customer";
  name: string;
  projectKey: string;          // "EP", "GOR", "RP", "BDM"
  status: string;              // Jira status name; for "project" kind: ""
  startDate: string | null;    // YYYY-MM-DD; from customfield_10015 (Start date)
  dueDate: string | null;      // YYYY-MM-DD; from duedate
  originalDueDate: string | null; // earliest non-null toString in changelog for `duedate` field if differs from current
  isOverdue: boolean;          // dueDate < today AND status ∉ doneStatuses
  parentId: string | null;     // parent Jira key, or projectKey for top-level epics, or null for project
  children: TreeNode[];        // populated server-side
};
```

### Project metadata

```ts
type ProjectMeta = {
  key: string;        // "EP"
  name: string;       // "EIR Project"
  color: string;      // hex; assigned per project (see palette)
  totalEpics: number; // for header label like "4 epics · 0 done"
  doneEpics: number;
};
```

### Server response

```ts
GET /api/jira/tree?refresh=1

{
  ok: true,
  syncedAt: string,
  source: "jira" | "cache",
  sales: { projects: ProjectMeta[], tree: TreeNode[] },
  project: { projects: ProjectMeta[], tree: TreeNode[] }
}
```

---

## Status Filter Chips

Top of view, horizontal chip row:

| Chip | Membership |
|------|-----------|
| All | every node |
| Active | `status ∉ {Done, On Hold, Closed Won, Closed Lost, Closed, Inactive, Dropped}` |
| Delay | `status ∈ {Delay, delay}` |
| Done | `status ∈ {Done, Closed Won, Live, Signed, Closed Lost, Dropped}` (terminal) |
| In Progress | `status == "In Progress"` |
| To Do | `status == "To Do"` |

(Counts in parens computed client-side from filtered tree; project-kind rows excluded from counts.)

`Waiting telco` chip from screenshot — **skipped** (not present in current Jira statuses).

Selected chip filters which leaf nodes (epic/task/subtask/customer) are visible. Project header always visible if it has matching descendants.

---

## Status Color Map

```ts
{
  "Done": "#22C55E",           // green
  "Closed Won": "#22C55E",
  "Live": "#22C55E",
  "Signed": "#22C55E",
  "In Progress": "#3B82F6",    // blue
  "To Do": "#6B82A4",          // slate-blue
  "Delay": "#EF4444",          // red
  "delay": "#EF4444",
  "On Hold": "#F59E0B",        // amber
  "Review": "#A855F7",         // purple
  "Testing QA": "#A855F7",
  "Ready For Deployment": "#10B981",  // emerald
  "Ready To Deploy": "#10B981",
  "STG / READY TO DEPLOY": "#10B981",
  "Dropped": "#64748B",        // gray
  "Closed Lost": "#64748B",
  "Inactive": "#64748B",
  // sales statuses
  "Proposal": "#F59E0B",
  "Negotiation": "#3B82F6",
  "Follow-up": "#A855F7",
  "Contract Sent": "#10B981",
  "New": "#6B82A4",
}
// fallback: "#A3B5CC"
```

Bottom legend strip echoes 6 swatches: Done, In Progress, To Do, Delay, On Hold, Review (the most common).

---

## Project Palette

Assigned in fixed order to projects in order of first appearance:

```ts
["#22C55E", "#F59E0B", "#3B82F6", "#A855F7", "#EF4444", "#10B981"]
```

Used for project group header text + ghost outline bar around child rows.

---

## Timeline

- **Range:** Jan 1 → Dec 31 of **current year** (derived from `new Date().getFullYear()`).
- **Granularity:** Months (12 columns). Each column equal width.
- **Today line:** orange/yellow vertical line (`#F59E0B`), 2px, full body height, with `Today (DD Mon YYYY)` text at bottom.
- **Y-axis labels:** left column 240px wide showing project / epic / task / subtask name with indent and key badge.

A bar's left/width = percentage of `(startDate, dueDate)` within `(Jan 1, Dec 31)`. If either date missing, the bar is omitted (only the row label and date text are shown).

---

## Hierarchy

### Project row (always shown, kind = `project`)

```
[▾ EIR Project]                       [────── ghost outline bar ──────]
[EP] 4 epics · 0 done
```

- Project name in bold (color = project palette color).
- Key badge below it (e.g. `EP`).
- Epic count label: `<N> epics · <doneN> done`.
- Ghost outline bar spans `min(child startDate) → max(child dueDate)`. Hollow, 2px dashed outline using project color.

### Epic row (kind = `epic`)

```
[▸ EP-49 EIR – GSMA Integration         6]    [████ status-colored bar ████] 01 Jun → 03 Jul
```

- Status-colored solid bar `startDate → dueDate`.
- Right-side text: `<bar label>  <DD Mon> → <DD Mon>`.
- Triangle toggle (▸/▾) on left. Default collapsed.
- Number badge on right of name = child task count.
- OVR badge (red pill) if overdue.
- Bar label inside bar = `name` truncated.
- **Revised dates indicator:** if `originalDueDate` differs from `dueDate`, render a dashed outline bar at `startDate → originalDueDate` UNDER the solid bar, in same color but dashed.

### Task row (kind = `task`) — shown when parent epic expanded

Same render as Epic but indented further, 12px high bars.

### Subtask row (kind = `subtask`) — shown when parent task expanded

Same render as Task but indented further, 10px high bars.

### Customer row (kind = `customer`) — Sales pipeline only

Same render as Epic but no children, no expand triangle.

---

## Field Mapping (Jira → TreeNode)

| Jira | TreeNode |
|------|---------|
| `key` | `id` |
| `fields.issuetype.name` lowercased | `kind` (with mapping: Customer → "customer", Sub-task/Subtask → "subtask") |
| `fields.summary` | `name` |
| `key.split("-")[0]` | `projectKey` |
| `fields.status.name` | `status` |
| `fields.customfield_10015` → date part | `startDate` |
| `fields.duedate` | `dueDate` |
| changelog: earliest `toString` for `duedate` (where ≠ current duedate) | `originalDueDate` (null if same) |
| `fields.parent?.key` | `parentId` (else projectKey if Epic, else null) |

Story issuetype mapped to `task` kind (treated same in render).

---

## Server: `app/api/jira/tree/route.ts`

```ts
GET /api/jira/tree?refresh=1
```

- Module-level cache, 30-min TTL, `?refresh=1` bypass (same pattern as `/api/jira/deals`).
- Internally calls new helper `fetchTree()` that:
  1. Fetches project metadata for BDM, EP, GOR, RP
  2. Fetches BDM Customers (with changelog, `customfield_10015`, `duedate`, status, etc.) — already in flat list
  3. Fetches EP+GOR+RP issues in `(Epic, Task, Subtask, Story)` (NO Bug) with changelog
  4. Builds tree per pipeline (sales / project) — group by projectKey, link by parent
  5. Computes `originalDueDate` from changelog
  6. Computes `isOverdue`
  7. Computes per-project `totalEpics` / `doneEpics`

`fetchTree` lives in `app/api/jira/_lib/jira.ts` alongside existing functions.

---

## Client: replacing `GanttView`

- Existing `GanttView` component in `app/page.tsx` deleted.
- New `GanttTreeView` component added in same place.
- Existing fetch logic stays for `/api/jira/deals` (used by Report / Board / Log).
- Additional `useEffect` triggers `/api/jira/tree` on mount + 30-min interval.
- Refresh button now triggers BOTH endpoints.
- `tree` state at Page level: `{sales: TreeBundle | null, project: TreeBundle | null}`.
- `GanttTreeView` receives `bundle: TreeBundle` for the active pipeline (sales or project).

Collapse/expand state: `useState<Set<string>>` of node ids, default = all project rows expanded + all epic rows collapsed.

Status chip selection: `useState<string>("All")`.

---

## Layout Dimensions

| Element | Value |
|---------|-------|
| Label column width | 240px |
| Project row height | 48px (multi-line label) |
| Epic row height | 28px |
| Task row height | 24px |
| Subtask row height | 22px |
| Customer row height | 28px |
| Epic bar height | 18px, top: 5px |
| Task bar height | 14px, top: 5px |
| Subtask bar height | 11px, top: 5px |
| Project ghost bar height | 14px (centered) |
| Month column min width | 90px |

Horizontal scroll if total width exceeds container.

---

## OVR Badge

Red pill, font 8px, white text, "OVR", padding 2x6px, radius 3px. Shown after the row name in the label column when `node.isOverdue`.

---

## Out of Scope

- Tabs other than Gantt Timeline (Jira Dashboard / KPI Report / Velocity Report / Epic MD Report / Data Gap Summary remain unimplemented for now)
- Drag-resize bars
- Bar tooltips on hover
- Inline status edit
- Sprint or board integration
- Auto-fit timeline range (locked to Jan-Dec current year)
- Bug issuetype (excluded per user direction)
- "Waiting telco" status chip (not present in current Jira statuses)
- Custom field for "Original Due Date" (changelog approach used instead)
