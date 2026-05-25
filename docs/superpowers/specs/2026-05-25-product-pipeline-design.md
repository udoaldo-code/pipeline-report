# Product Pipeline — Design

**Date:** 2026-05-25
**Status:** Approved (design phase)

## Goal

Add a third pipeline tab — "Product" — to the Project & Sales Pipeline Report,
sourcing data live from the Jira `PD` (Product Team) board. Renders in all four
existing views (Report, Board, Log, Gantt). Epics group Stories beneath them;
Report view expands/collapses Stories per Epic.

## Source data

- Jira project: `PD` ("Product Team")
- Issuetypes consumed: `Epic`, `Story`
- Live workflow statuses (no hardcoding)
- Today: 9 Epics, ~200 Stories

## Architecture decision

Extend existing routes (`/api/jira/deals`, `/api/jira/tree`) rather than create
a new route. Reuses the unified payload + cache model. Frontend `Deal` type
gains two optional fields to express Epic/Story hierarchy.

## Data model

### `Deal` type (`app/api/jira/_lib/jira.ts`)

```ts
type Deal = {
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
  parent?: string;            // NEW — parent Epic key (PD-31, etc.) for Product Stories
  kind?: "epic" | "story";    // NEW — Product rows only; absent for Sales/Projects
};
```

### `/api/jira/deals` payload

Adds `productStages: string[]` (union of PD Epic + Story workflow statuses).
Existing fields unchanged. `deals[]` now contains Sales + Projects + Product
items.

### `/api/jira/tree` payload

Adds `product: TreeBundle` alongside existing `sales` and `project`. Built via
existing `buildProjectTree` against PD issues (`project = PD AND issuetype IN
(Epic, Story)`). `kindFromIssueType` already maps Story → task layer, Epic →
epic layer — no new tree logic.

## Backend changes

### `_lib/jira.ts`

- Extend `Deal` type with `parent?` and `kind?` fields.
- Extend `issueToDeal` signature to accept optional `parentKey` and `kind`.
- Add `"PD"` handling inside `fetchTree`.

### `deals/route.ts` — `buildFresh`

Add three Jira fetches inside the existing `Promise.all`:

```ts
const [
  salesStages, projectStages, salesIssues, projectIssues, leadIssues,
  productEpicStages, productStoryStages, productEpics, productStories,
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

// Union both lists preserving order; helper added to _lib/jira.ts:
//   export const unionOrdered = (a: string[], b: string[]) => {
//     const seen = new Set<string>(); const out: string[] = [];
//     for (const s of [...a, ...b]) if (!seen.has(s)) { seen.add(s); out.push(s); }
//     return out;
//   };
const productStages = unionOrdered(productEpicStages, productStoryStages);

const productDeals: Deal[] = [
  ...productEpics.map(i => issueToDeal(i, "product", undefined, "epic")),
  ...productStories.map(i => issueToDeal(i, "product", i.fields.parent?.key, "story")),
];
```

`issueToDeal` sets `parent` and `kind` when provided.

Payload extends with `productStages`.

### `tree/route.ts`

No route-level change; `fetchTree` now returns `{ sales, project, product }`.
Payload type extends with `product: TreeBundle`.

## Frontend changes (`app/page.tsx`)

### `PIPES` config (line 46)

```ts
{ id:"product", label:"Product", emoji:"🎨", color:"#3B82F6", lt:"#DBEAFE", stages:[] }
```

Stages overwritten post-fetch from `productStages` (same pattern Sales/Projects
use today).

### `VISIBLE_PIPES`

No change (`partnership` still filtered out). Product visible.

### Report view — expandable rows

State:
```ts
const [expanded, setExpanded] = useState<Set<string>>(new Set());
```

Visibility rule (Product tab only):
- Epic rows (`kind==="epic"`): always rendered. Sort key = Epic order.
- Story rows (`kind==="story"`): rendered iff `expanded.has(d.parent)`.
- Render order: each Epic immediately followed by its Stories.

Row UI:
- Epic: chevron icon (▶ collapsed / ▼ expanded) in name column; click toggles
  `expanded` set; child count badge appended to name (e.g., "OmniPlay · 3").
  Epics with zero children: chevron hidden, click is no-op.
- Story: 24px left indent, smaller font, lighter row background.

Sales/Projects: unchanged (no chevron, flat list).

### Board view

- Columns: `productStages` (live Jira union).
- Cards: **Stories only**. Epic name shown as small chip on top of each Story
  card.
- Epics without Stories: not rendered on Board (visible in Report + Gantt).

### Log view

No special handling. Product deals flow through existing `hist[]`-driven
renderer. `hist[]` is empty for Jira-sourced deals today; remains empty for
Product. No regression.

### Gantt view

When active pipeline = `product`, render `tree.product` from
`/api/jira/tree`. Existing Gantt component consumes `TreeBundle` — no
component change needed beyond the data source switch.

### Filters + counters

- Owner filter: dropdown auto-derives from `deals[]` — Product assignees
  appear automatically.
- Stage filter: when Product tab active, options = `productStages`.
- Pipeline filter dropdown: gains "Product" entry from `VISIBLE_PIPES`.
- Top counter banner: new row "🎨 Product — N deals" (Epic + Story count).
  TOTAL row sums all three pipelines.

## Caching

Both routes keep 30-min in-memory TTL. Product fetches join the existing
`Promise.all` so a single Jira round-trip covers all pipelines. `?refresh=1`
invalidates the unified cache as today.

## Out of scope (YAGNI)

- Writing back to Jira (Add Deal stays local-only).
- PD Sub-task hierarchy (Story-of-Story nesting).
- Custom Product stage mapping or status renaming.
- Persisting `expanded` set across reloads.

## Files touched

- `app/api/jira/_lib/jira.ts` — `Deal` type, `issueToDeal`, `fetchTree`.
- `app/api/jira/deals/route.ts` — `buildFresh`, payload type.
- `app/api/jira/tree/route.ts` — payload type.
- `app/page.tsx` — `PIPES`, Report expand state + row render, Board card
  source, counter banner.

## Testing checklist

- `/api/jira/deals` returns `productStages` + Product Epics/Stories with
  correct `kind` and `parent`.
- `/api/jira/tree` returns `product` bundle with Epic→Story hierarchy.
- Product tab visible in sidebar/tab strip; selecting it renders Report.
- Report: Epic rows collapsible/expandable; Stories appear under parent.
- Board: Stories appear in correct Jira-status column; Epic chip visible.
- Gantt: Product tree renders identical structure to Jira hierarchy.
- Filters (Owner, Stage, Priority, Pipeline) work for Product rows.
- Counter banner shows correct Product count; TOTAL includes Product.
- 30-min cache holds; `?refresh=1` invalidates.
