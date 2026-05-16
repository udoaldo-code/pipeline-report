# Gantt Timeline View — Design Spec
Date: 2026-05-13

## Summary

Add a **📅 Gantt** tab to the pipeline view switcher (alongside Report / Board / Log). Shows planned vs actual progress per deal using ghost overlay bars, expandable stage sub-rows, and a variance pill.

---

## Data Model

Add optional `dueDate?: string` (format: `YYYY-MM-DD`) to the `Deal` type.

```ts
type Deal = {
  // ...existing fields...
  dueDate?: string;   // optional planned completion date
};
```

Update `SEED` data with sample `dueDate` values for project deals:
- Fleet360 MVP Bus Module: `dueDate: "2026-06-02"` (W23 — 6-week sprint from Apr 21)
- MIRS Laos Phase 2: `dueDate: "2026-05-25"` (W22)

Add `dueDate` date input to `AddSheet` and `DealSheet` forms (optional field, labelled "Due Date").

---

## New Helpers

```ts
// Parse ISO week string "2026-W18" → Monday Date of that week
wkToDate(wk: string): Date

// Convert a Date to a % position within [start, end] range
// Returns clamped 0–100
dateToPercent(d: Date, start: Date, end: Date): number
```

---

## GanttView Component

### Placement
New `"gantt"` option in the existing view switcher array. Available for all pipelines (not just projects). Receives same `pipeline` and `deals` props as `ReportView`.

### Timeline Range
- **Start:** earliest `at` date across all deals in current pipeline
- **End:** latest of `(max dueDate, today + 28 days)` — ensures future columns always visible
- **Granularity:** weekly columns, labelled "Wxx / Mon DD"
- **Future columns:** subtle light-blue tinted background (`#F5F8FC`)
- **Today column:** red-tinted background, red vertical today-line at current day position

### Per-Project Row (parent)

```
[▾ Project Name]  [Priority badge]  [Variance pill]
[                 timeline track                   ]
  |--- dashed ghost bar (at → dueDate) ---|◆ Due Wxx
  |=== solid actual bar (at → today) ====|
```

- **Ghost bar:** `position:absolute`, dashed outline (`border: 2px dashed #A3B5CC`), transparent fill, spans `at → dueDate`. Hidden if no `dueDate` set.
- **Actual bar:** solid fill using `pipeline.color` gradient, spans `at → today` (active) or `at → last hist.ts` (closed/on-hold).
- **Diamond marker `◆`:** at `dueDate` x-position, with `"Due Wxx"` label above. Hidden if no `dueDate`.
- **"✏ Set due date" prompt:** teal inline button shown in label area when `dueDate` missing.
- **Expand/collapse toggle:** `▾`/`▸` prefix on project name. Collapse state stored in `useState<Set<string>>` keyed by deal id.

### Stage Sub-Rows (expanded)

One row per `hist` entry for that deal:

- Bar spans `hist[i].ts → hist[i+1].ts` (for current/last entry: `hist[i].ts → today`)
- Stage-specific colors (keyed by exact stage name string, with fallback):
  - Prospect / Identified / Backlog → `#94A3B8`
  - Qualified / First Contact / In Discovery → `#6366F1`
  - Proposal / MOU Discussion / In Development → `#F59E0B`
  - Negotiation / Due Diligence / UAT → `#3BC9D4`
  - Closed Won / Signed / Live → `#22C55E`
  - Closed Lost / Inactive / On Hold → `#EF4444`
  - Unknown/fallback → `#A3B5CC`
- Active (last) stage bar has `▌` suffix and extends to today-line
- Row label (right-aligned, 190px col): stage name in `#6B82A4`

### Today Line

Red vertical line (`width: 2px`, `background: #EF4444`) spanning full height of gantt body. "Today" badge at top. Rendered at `dateToPercent(today, timelineStart, timelineEnd)`.

### Variance Pill

Shown in parent row label area, only when `dueDate` is set:

| Condition | Display |
|-----------|---------|
| `today > dueDate` | red `"+Xwk behind"` |
| `today < dueDate - 7 days` | green `"Xwk ahead"` |
| within 7 days either side | teal `"on track"` |

Weeks calculated as `Math.round(daysDiff / 7)`.

---

## Modified Components

### AddSheet
- Add optional `dueDate` date input field after "Notes"
- Label: "Due Date", type: `date`, maps to `f.dueDate`

### DealSheet
- Add optional `dueDate` date input in the "Update Stage" tab
- Shows current `dueDate` value if set, allows change

### addDeal handler
- Pass `dueDate` through from form state to new Deal object

---

## View Switcher

Extend the existing array from:
```ts
[["report","📋 Report"],["board","⊞ Board"],["history","⏱ Log"]]
```
to:
```ts
[["report","📋 Report"],["board","⊞ Board"],["history","⏱ Log"],["gantt","📅 Gantt"]]
```

Add `{view==="gantt" && <GanttView pipeline={pipeline} deals={pDeals}/>}` in the deal content block.

---

## Layout Dimensions

| Element | Value |
|---------|-------|
| Label column width | 190px |
| Parent row track height | 36px |
| Stage sub-row track height | 20px |
| Bar height (parent) | 20px, `top: 8px` |
| Bar height (stage) | 12px, `top: 4px` |
| Diamond size | 10×10px rotated 45° |

---

## Out of Scope

- Drag-to-resize bars (no interactivity on bars)
- Dependencies / arrows between projects
- Exporting Gantt as image
- Editing due date directly on the bar (only via deal sheet)
