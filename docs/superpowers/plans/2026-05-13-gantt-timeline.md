# Gantt Timeline View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `📅 Gantt` tab to the pipeline view switcher showing planned-vs-actual progress bars with expandable stage sub-rows, ghost overlay for planned duration, and a variance pill.

**Architecture:** All changes are in `app/page.tsx`. New helpers (`wkToDate`, `dateToPercent`, `STAGE_COLORS`/`stageColor`) go after existing helpers. A new `GanttView` component renders after `HistoryView`. Minimal surgical edits wire it into the existing view switcher and deal content block.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, inline CSS (no Tailwind in component code)

---

### Task 1: React import + Deal type + SEED + helpers

**Files:**
- Modify: `app/page.tsx:3` (import line)
- Modify: `app/page.tsx:184` (Deal type)
- Modify: `app/page.tsx:67-72` (SEED project deals)
- Modify: `app/page.tsx:107` (after sfParse — insert new helpers)

- [ ] **Step 1: Extend React import to include React namespace (needed for Fragment key)**

Replace line 3:
```ts
import { useState, useEffect } from "react";
```
with:
```ts
import React, { useState, useEffect } from "react";
```

- [ ] **Step 2: Add `dueDate` to Deal type**

Replace line 184:
```ts
type Deal = { id: string; pid: string; name: string; owner: string; val: number; stage: string; pri: string; notes: string; hist: HistEntry[]; at: string };
```
with:
```ts
type Deal = { id: string; pid: string; name: string; owner: string; val: number; stage: string; pri: string; notes: string; hist: HistEntry[]; at: string; dueDate?: string };
```

- [ ] **Step 3: Add `dueDate` to project deals in SEED**

Replace the d3 line (currently line 67):
```ts
  { id:"d3", pid:"project",     name:"Fleet360 MVP — Bus Module",    owner:"Ghoffar", val:0,          stage:"In Development", pri:"Critical", notes:"Week 3 of 6-week MVP sprint.",
    hist:[{wk:"2026-W17",stage:"Backlog",note:"BRD approved.",by:"Ghoffar",ts:"2026-04-27"},{wk:"2026-W18",stage:"In Discovery",note:"Tech stack locked.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"In Development",note:"API skeleton complete.",by:"Ghoffar",ts:"2026-05-12"}], at:"2026-04-21" },
```
with:
```ts
  { id:"d3", pid:"project",     name:"Fleet360 MVP — Bus Module",    owner:"Ghoffar", val:0,          stage:"In Development", pri:"Critical", notes:"Week 3 of 6-week MVP sprint.",
    hist:[{wk:"2026-W17",stage:"Backlog",note:"BRD approved.",by:"Ghoffar",ts:"2026-04-27"},{wk:"2026-W18",stage:"In Discovery",note:"Tech stack locked.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"In Development",note:"API skeleton complete.",by:"Ghoffar",ts:"2026-05-12"}], at:"2026-04-21", dueDate:"2026-06-02" },
```

Replace the d5 line (currently line 71):
```ts
  { id:"d5", pid:"project",     name:"MIRS Laos Phase 2",            owner:"Ghoffar", val:0,          stage:"UAT",            pri:"High",     notes:"Government IMEI registration — regulatory milestone.",
    hist:[{wk:"2026-W18",stage:"In Development",note:"Phase 2 build complete.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"UAT",note:"UAT started with Laos MOICT team.",by:"Ghoffar",ts:"2026-05-11"}], at:"2026-04-14" },
```
with:
```ts
  { id:"d5", pid:"project",     name:"MIRS Laos Phase 2",            owner:"Ghoffar", val:0,          stage:"UAT",            pri:"High",     notes:"Government IMEI registration — regulatory milestone.",
    hist:[{wk:"2026-W18",stage:"In Development",note:"Phase 2 build complete.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"UAT",note:"UAT started with Laos MOICT team.",by:"Ghoffar",ts:"2026-05-11"}], at:"2026-04-14", dueDate:"2026-05-25" },
```

- [ ] **Step 4: Add Gantt helpers after the closing `};` of `sfParse` (after line 107)**

Insert after the `};` that closes `sfParse`:
```ts
/* ────────────────────────────────────
   GANTT HELPERS
──────────────────────────────────── */
const wkToDate = (wk: string): Date => {
  const [yearStr, wStr] = wk.split("-W");
  const year = parseInt(yearStr, 10), w = parseInt(wStr, 10);
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4); mon1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const result = new Date(mon1); result.setDate(mon1.getDate() + (w - 1) * 7);
  return result;
};

const dateToPercent = (d: Date, start: Date, end: Date): number => {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((d.getTime() - start.getTime()) / total) * 100));
};

const STAGE_COLORS: Record<string, string> = {
  "Prospect":"#94A3B8","Identified":"#94A3B8","Backlog":"#94A3B8",
  "Qualified":"#6366F1","First Contact":"#6366F1","In Discovery":"#6366F1",
  "Proposal":"#F59E0B","MOU Discussion":"#F59E0B","In Development":"#F59E0B",
  "Negotiation":"#3BC9D4","Due Diligence":"#3BC9D4","UAT":"#3BC9D4",
  "Closed Won":"#22C55E","Signed":"#22C55E","Live":"#22C55E",
  "Closed Lost":"#EF4444","Inactive":"#EF4444","On Hold":"#EF4444",
};
const stageColor = (s: string): string => STAGE_COLORS[s] ?? "#A3B5CC";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors (or only pre-existing errors unrelated to these changes).

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat: add dueDate to Deal type, SEED, and Gantt helpers"
```

---

### Task 2: GanttView component

**Files:**
- Modify: `app/page.tsx` — insert `GanttView` function after `HistoryView` (currently ending around line 434)

- [ ] **Step 1: Insert `GanttView` after the closing `}` of `HistoryView`**

Insert the following complete function immediately after the closing `}` of `HistoryView` and before the `/* ════ BOTTOM SHEET ════ */` comment:

```tsx
/* ════════════════════════════════════════════
   GANTT VIEW
════════════════════════════════════════════ */
function GanttView({ pipeline, deals }: { pipeline: Pipeline; deals: Deal[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const today = new Date(); today.setHours(0,0,0,0);

  if (deals.length === 0) return <EmptyState msg="No deals in this pipeline yet." />;

  const tStart = new Date(Math.min(...deals.map(d => new Date(d.at).getTime())));
  const fallback = new Date(today); fallback.setDate(today.getDate() + 28);
  const dueTimes = deals.filter(d => d.dueDate).map(d => new Date(d.dueDate!).getTime());
  const tEnd = new Date(Math.max(fallback.getTime(), ...dueTimes));

  // Build weekly column headers (Monday of each week)
  const weeks: Date[] = [];
  const cur = new Date(tStart); cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
  while (cur <= tEnd) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }

  const pct   = (d: Date) => dateToPercent(d, tStart, tEnd);
  const todayPct = pct(today);
  const LABEL_W = 190;

  const toggle = (id: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const getVariance = (due: string) => {
    const diff = Math.round((new Date(due).getTime() - today.getTime()) / 86400000);
    const wks  = Math.round(Math.abs(diff) / 7);
    if (diff < -1) return { label:`+${wks}wk behind`, fg:"#B91C1C", bg:"#FEE2E2" };
    if (diff > 7)  return { label:`${wks}wk ahead`,   fg:"#0E7862", bg:"#D1FAE5" };
    return             { label:"on track",             fg:"#0E7862", bg:C.tealLt  };
  };

  // Shared grid overlay for a track cell
  const TrackGrid = () => (
    <div style={{position:"absolute",inset:0,display:"flex",pointerEvents:"none"}}>
      {weeks.map((wd,i) => (
        <div key={i} style={{
          flex:1, borderRight:`1px dashed ${wd > today ? "#E2E8F0" : C.border}`,
          background: wd > today ? "rgba(107,130,164,.03)" : "transparent",
        }}/>
      ))}
    </div>
  );

  // Red today line for a track cell
  const TodayLine = () => (
    <div style={{position:"absolute",top:0,bottom:0,width:2,left:`${todayPct}%`,background:C.red,borderRadius:1,zIndex:20,pointerEvents:"none"}}/>
  );

  return (
    <div style={{padding:16,overflowX:"auto",minWidth:500}}>

      {/* Column headers */}
      <div style={{display:"flex",marginBottom:8,alignItems:"flex-end"}}>
        <div style={{width:LABEL_W,flexShrink:0,fontSize:10,fontWeight:700,color:C.inkDim,textTransform:"uppercase",letterSpacing:".07em",paddingBottom:4}}>
          Project / Stage
        </div>
        <div style={{flex:1,position:"relative",borderLeft:`1px solid ${C.border}`}}>
          <div style={{display:"flex"}}>
            {weeks.map((wd,i) => {
              const near = Math.abs(wd.getTime() - today.getTime()) < 7*86400000;
              return (
                <div key={i} style={{
                  flex:1,fontSize:9,fontWeight:700,textAlign:"center",
                  color:near ? C.red : C.inkDim,fontFamily:"'JetBrains Mono',monospace",
                  borderRight:`1px dashed ${wd > today ? "#E2E8F0" : C.border}`,
                  background:wd > today ? "#F5F8FC" : "transparent",paddingBottom:4,
                }}>
                  {week(wd).split("-")[1]}<br/>
                  <span style={{fontWeight:400,opacity:.7}}>
                    {wd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Today line + badge in header */}
          <div style={{position:"absolute",top:0,bottom:0,width:2,left:`${todayPct}%`,background:C.red,borderRadius:1,zIndex:20}}>
            <div style={{position:"absolute",bottom:"calc(100% + 2px)",left:"50%",transform:"translateX(-50%)",background:C.red,color:"#fff",fontSize:8,fontWeight:700,padding:"2px 5px",borderRadius:3,whiteSpace:"nowrap"}}>
              Today
            </div>
          </div>
        </div>
      </div>

      {/* Deal rows */}
      {deals.map(deal => {
        const isCollapsed = collapsed.has(deal.id);
        const dealStart   = new Date(deal.at);
        const isClosed    = ["Closed Lost","Inactive","On Hold","Live","Closed Won","Signed"].includes(deal.stage);
        const actualEnd   = isClosed ? new Date(deal.hist[deal.hist.length-1].ts) : today;
        const aLeft       = pct(dealStart);
        const aWidth      = Math.max(0, Math.min(pct(actualEnd) - aLeft, 100 - aLeft));
        const duePct      = deal.dueDate ? pct(new Date(deal.dueDate)) : null;
        const gWidth      = duePct !== null ? Math.max(0, duePct - aLeft) : null;
        const v           = deal.dueDate ? getVariance(deal.dueDate) : null;

        return (
          <React.Fragment key={deal.id}>

            {/* Parent row */}
            <div style={{display:"flex",alignItems:"center",marginBottom:3}}>
              <div style={{width:LABEL_W,flexShrink:0,paddingRight:8}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                  <span onClick={()=>toggle(deal.id)}
                    style={{cursor:"pointer",fontSize:11,color:C.inkSub,userSelect:"none",flexShrink:0}}>
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {deal.name}
                  </span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,paddingLeft:16,flexWrap:"wrap"}}>
                  <PriBadge p={deal.pri}/>
                  {v && (
                    <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:3,background:v.bg,color:v.fg,whiteSpace:"nowrap"}}>
                      {v.label}
                    </span>
                  )}
                  {!deal.dueDate && (
                    <span style={{fontSize:9,color:C.teal,fontWeight:700,cursor:"pointer"}}>✏ due date</span>
                  )}
                </div>
              </div>
              <div style={{flex:1,height:36,position:"relative",borderLeft:`1px solid ${C.border}`}}>
                <TrackGrid/>
                {/* Ghost planned bar */}
                {gWidth !== null && gWidth > 0 && (
                  <div style={{position:"absolute",top:8,height:20,left:`${aLeft}%`,width:`${gWidth}%`,border:"2px dashed #A3B5CC",borderRadius:4,background:"transparent",boxSizing:"border-box"}}/>
                )}
                {/* Actual bar */}
                {aWidth > 0 && (
                  <div style={{position:"absolute",top:8,height:20,left:`${aLeft}%`,width:`${aWidth}%`,background:`linear-gradient(90deg,${pipeline.color},${pipeline.color}cc)`,borderRadius:4,display:"flex",alignItems:"center",padding:"0 7px",fontSize:9,fontWeight:700,color:"#fff",overflow:"hidden",whiteSpace:"nowrap",boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}>
                    {deal.stage}
                  </div>
                )}
                {/* Due date diamond */}
                {duePct !== null && (
                  <div style={{position:"absolute",top:"50%",left:`${duePct}%`,transform:"translate(-50%,-50%)",zIndex:15}}>
                    <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{position:"absolute",bottom:"calc(100% + 3px)",left:"50%",transform:"translateX(-50%)",fontSize:8,fontWeight:700,color:C.inkSub,background:"#fff",padding:"1px 4px",borderRadius:3,border:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>
                        {week(new Date(deal.dueDate!))}
                      </div>
                      <div style={{width:10,height:10,transform:"rotate(45deg)",background:"#6B82A4",border:"2px solid #fff",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                    </div>
                  </div>
                )}
                <TodayLine/>
              </div>
            </div>

            {/* Stage sub-rows (shown when not collapsed) */}
            {!isCollapsed && deal.hist.map((h, i) => {
              const sStart = new Date(h.ts);
              const sEnd   = i < deal.hist.length-1 ? new Date(deal.hist[i+1].ts) : today;
              const sLeft  = pct(sStart);
              const sWidth = Math.max(0, Math.min(pct(sEnd) - sLeft, 100 - sLeft));
              const sc     = stageColor(h.stage);
              const isLast = i === deal.hist.length - 1;
              return (
                <div key={`${deal.id}-s${i}`} style={{display:"flex",alignItems:"center",marginBottom:isLast ? 10 : 3}}>
                  <div style={{width:LABEL_W,flexShrink:0,paddingRight:8,textAlign:"right"}}>
                    <span style={{fontSize:10,color:C.inkSub}}>{h.stage}</span>
                  </div>
                  <div style={{flex:1,height:20,position:"relative",borderLeft:`1px solid ${C.border}`}}>
                    <TrackGrid/>
                    {sWidth > 0 && (
                      <div style={{position:"absolute",top:4,height:12,left:`${sLeft}%`,width:`${sWidth}%`,background:sc,borderRadius:3,display:"flex",alignItems:"center",padding:"0 5px",fontSize:8,fontWeight:700,color:"#fff",overflow:"hidden",whiteSpace:"nowrap"}}>
                        {h.stage}{isLast ? " ▌" : ""}
                      </div>
                    )}
                    <TodayLine/>
                  </div>
                </div>
              );
            })}

          </React.Fragment>
        );
      })}

      {/* Legend */}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:6,fontSize:11,color:C.inkSub}}>
        {([
          [<div key="p" style={{width:18,height:8,border:"2px dashed #A3B5CC",borderRadius:2}}/>, "Planned"],
          [<div key="a" style={{width:18,height:8,borderRadius:2,background:pipeline.color}}/>,  "Actual"],
          [<div key="d" style={{width:9,height:9,transform:"rotate(45deg)",background:"#6B82A4",border:"2px solid #fff",boxShadow:"0 1px 2px rgba(0,0,0,.2)"}}/>, "Due date"],
          [<div key="t" style={{width:2,height:14,background:C.red,borderRadius:1}}/>,           "Today"],
        ] as [React.ReactNode, string][]).map(([el,lbl]) => (
          <div key={lbl} style={{display:"flex",alignItems:"center",gap:6}}>{el} {lbl}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat: add GanttView component with planned-vs-actual bars and stage sub-rows"
```

---

### Task 3: Wire GanttView into the view switcher and deal content

**Files:**
- Modify: `app/page.tsx:825` (view switcher array)
- Modify: `app/page.tsx:837-839` (deal content block)

- [ ] **Step 1: Add Gantt to the view switcher array**

Find (line ~825):
```tsx
                  {([["report","📋 Report"],["board","⊞ Board"],["history","⏱ Log"]] as [string,string][]).map(([v,lbl])=>(
```
Replace with:
```tsx
                  {([["report","📋 Report"],["board","⊞ Board"],["history","⏱ Log"],["gantt","📅 Gantt"]] as [string,string][]).map(([v,lbl])=>(
```

- [ ] **Step 2: Add GanttView to deal content block**

Find (line ~837-839):
```tsx
              {view==="report"  && <ReportView  pipeline={pipeline} deals={pDeals} filtered={filtered} fPipe={fPipe} onOpen={d=>setModal({type:"deal",data:d})}/>}
              {view==="board"   && <BoardView   pipeline={pipeline} deals={pDeals} onOpen={d=>setModal({type:"deal",data:d})}/>}
              {view==="history" && <HistoryView pipeline={pipeline} deals={pDeals}/>}
```
Replace with:
```tsx
              {view==="report"  && <ReportView  pipeline={pipeline} deals={pDeals} filtered={filtered} fPipe={fPipe} onOpen={d=>setModal({type:"deal",data:d})}/>}
              {view==="board"   && <BoardView   pipeline={pipeline} deals={pDeals} onOpen={d=>setModal({type:"deal",data:d})}/>}
              {view==="history" && <HistoryView pipeline={pipeline} deals={pDeals}/>}
              {view==="gantt"   && <GanttView   pipeline={pipeline} deals={pDeals}/>}
```

- [ ] **Step 3: Verify in browser — navigate to Projects tab, click 📅 Gantt**

```bash
open http://localhost:3002
```
Expected: Gantt tab visible, Fleet360 and MIRS Laos rows render with bars, ghost outlines, diamonds, and today line. Clicking ▾ collapses stage sub-rows.

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat: wire GanttView into pipeline view switcher"
```

---

### Task 4: AddSheet — dueDate field

**Files:**
- Modify: `app/page.tsx` — `AddSheet` component (lines ~533–570)

- [ ] **Step 1: Add `dueDate` to AddSheet form state**

Find:
```ts
  const [f, setF] = useState({name:"",owner:"",stage:pipeline.stages[0],pri:"Medium",val:"",notes:""});
```
Replace with:
```ts
  const [f, setF] = useState({name:"",owner:"",stage:pipeline.stages[0],pri:"Medium",val:"",notes:"",dueDate:""});
```

- [ ] **Step 2: Add Due Date input after the Notes textarea**

Find in `AddSheet`:
```tsx
        <div><div style={lblSt}>Notes</div><textarea value={f.notes} onChange={e=>upd("notes",e.target.value)} rows={2} placeholder="Optional…" style={{...iSt,resize:"vertical" as const}}/></div>
```
Replace with:
```tsx
        <div><div style={lblSt}>Notes</div><textarea value={f.notes} onChange={e=>upd("notes",e.target.value)} rows={2} placeholder="Optional…" style={{...iSt,resize:"vertical" as const}}/></div>
        <div><div style={lblSt}>Due Date</div><input type="date" value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} style={iSt}/></div>
```

- [ ] **Step 3: Pass `dueDate` (or undefined when empty) in the onAdd call**

Find in `AddSheet`:
```tsx
        <button onClick={()=>{ if(ok) onAdd({...f, val:parseFloat(f.val)||0}); }} className="btn btn-navy" style={{flex:2,padding:"11px",borderRadius:8,opacity:ok?1:.5,cursor:ok?"pointer":"default"}}>Add to Pipeline</button>
```
Replace with:
```tsx
        <button onClick={()=>{ if(ok) onAdd({...f, val:parseFloat(f.val)||0, dueDate:f.dueDate||undefined}); }} className="btn btn-navy" style={{flex:2,padding:"11px",borderRadius:8,opacity:ok?1:.5,cursor:ok?"pointer":"default"}}>Add to Pipeline</button>
```

- [ ] **Step 4: Verify TypeScript + browser**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors. In browser: click `+ Add Deal`, verify "Due Date" date picker appears.

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat: add dueDate field to AddSheet form"
```

---

### Task 5: DealSheet + updateDeal — dueDate support

**Files:**
- Modify: `app/page.tsx` — `DealSheet` component (lines ~455–528)
- Modify: `app/page.tsx` — `updateDeal` handler in `Page` (lines ~648–653)

- [ ] **Step 1: Add `dueDate` state to DealSheet**

Find in `DealSheet` (just after the function signature):
```ts
  const [stage, setStage] = useState(deal.stage);
  const [note,  setNote]  = useState("");
  const [by,    setBy]    = useState("");
  const [tab,   setTab]   = useState("update");
  const [conf,  setConf]  = useState(false);
```
Replace with:
```ts
  const [stage,   setStage]   = useState(deal.stage);
  const [note,    setNote]    = useState("");
  const [by,      setBy]      = useState("");
  const [dueDate, setDueDate] = useState(deal.dueDate ?? "");
  const [tab,     setTab]     = useState("update");
  const [conf,    setConf]    = useState(false);
```

- [ ] **Step 2: Update DealSheet `onUpdate` prop type signature**

Find (DealSheet function signature):
```ts
function DealSheet({deal, pipeline, onClose, onUpdate, onDel}: { deal: Deal; pipeline: Pipeline; onClose: () => void; onUpdate: (id: string, stage: string, note: string, by: string) => void; onDel: (id: string) => void }) {
```
Replace with:
```ts
function DealSheet({deal, pipeline, onClose, onUpdate, onDel}: { deal: Deal; pipeline: Pipeline; onClose: () => void; onUpdate: (id: string, stage: string, note: string, by: string, dueDate?: string) => void; onDel: (id: string) => void }) {
```

- [ ] **Step 3: Add Due Date input in DealSheet update tab (after Progress Note textarea)**

Find in DealSheet update tab:
```tsx
          <div><div style={lblSt}>Progress Note *</div><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="What happened? Wins, blockers, next steps…" style={{...iSt,resize:"vertical" as const}}/></div>
          <button onClick={()=>{ if(ok){ onUpdate(deal.id,stage,note,by); setNote(""); setBy(""); } }} className="btn btn-navy"
```
Replace with:
```tsx
          <div><div style={lblSt}>Progress Note *</div><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="What happened? Wins, blockers, next steps…" style={{...iSt,resize:"vertical" as const}}/></div>
          <div><div style={lblSt}>Due Date</div><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={iSt}/></div>
          <button onClick={()=>{ if(ok){ onUpdate(deal.id,stage,note,by,dueDate||undefined); setNote(""); setBy(""); } }} className="btn btn-navy"
```

- [ ] **Step 4: Update `updateDeal` handler in `Page` to accept and persist `dueDate`**

Find in `Page`:
```ts
  const updateDeal = (id: string, stage: string, note: string, by: string) => {
    setDeals(p=>p.map(d=>d.id!==id ? d : {
      ...d, stage,
      hist:[...d.hist,{wk:week(), stage, note:note||"Stage updated.", by:by||"System", ts:new Date().toISOString().slice(0,10)}],
    }));
  };
```
Replace with:
```ts
  const updateDeal = (id: string, stage: string, note: string, by: string, dueDate?: string) => {
    setDeals(p=>p.map(d=>d.id!==id ? d : {
      ...d, stage, ...(dueDate !== undefined && { dueDate }),
      hist:[...d.hist,{wk:week(), stage, note:note||"Stage updated.", by:by||"System", ts:new Date().toISOString().slice(0,10)}],
    }));
  };
```

- [ ] **Step 5: Verify TypeScript + browser**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && npx tsc --noEmit 2>&1
```
Expected: no errors.

In browser:
1. Switch to Projects pipeline → Gantt tab → Fleet360 shows dashed ghost bar and ◆ diamond, variance pill "+Xwk ahead/behind"
2. Click Fleet360 row → DealSheet opens → "Due Date" field shows `2026-06-02`
3. Change due date → close → Gantt updates diamond position and variance pill
4. Click ▾ → stage sub-rows expand with colored bars per stage
5. Click `+ Add Deal` → Due Date field visible

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/Project Pipeline/pipeline-app" && git add app/page.tsx && git commit -m "feat: add dueDate to DealSheet and wire updateDeal — Gantt planned-vs-actual complete"
```
