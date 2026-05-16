"use client";

import React, { useState, useEffect } from "react";

/* ════════════════════════════════════════════
   DESIGN TOKENS
════════════════════════════════════════════ */
const C = {
  sidebarBg:    "#1B2B4B",
  sidebarText:  "#A8BACE",
  sidebarHover: "#243558",
  sidebarActive:"#1F3560",
  activeAccent: "#00C5A8",
  activeBg:     "#162440",
  pageBg:       "#E8EFF8",
  surface:      "#FFFFFF",
  surfaceAlt:   "#F5F8FC",
  headerBg:     "#FFFFFF",
  headerBorder: "#DDE6F0",
  ink:          "#1B2B4B",
  inkMid:       "#3A5175",
  inkSub:       "#6B82A4",
  inkDim:       "#A3B5CC",
  border:       "#DDE6F0",
  borderMid:    "#C4D4E8",
  teal:         "#00C5A8",
  tealLt:       "#E0F8F4",
  tealDark:     "#00A890",
  blue:         "#1B2B4B",
  blueBtn:      "#1B3A6B",
  green:        "#22C55E",
  greenBtn:     "#16A34A",
  orange:       "#F59E0B",
  red:          "#EF4444",
  redLt:        "#FEE2E2",
  thCurrent:    "#3BC9D4",
  thEstimated:  "#00C5A8",
  thLast:       "#F59E0B",
  shadow:       "0 1px 4px rgba(27,43,75,.08), 0 2px 8px rgba(27,43,75,.04)",
  shadowMd:     "0 4px 16px rgba(27,43,75,.12)",
};

/* ════════════════════════════════════════════
   PIPELINE CONFIG
════════════════════════════════════════════ */
const PIPES = [
  { id:"sales",       label:"Sales",       emoji:"💼", color:C.teal,   lt:C.tealLt,
    stages:["Prospect","Qualified","Proposal","Negotiation","Closed Won","Closed Lost"] },
  { id:"partnership", label:"Partnership", emoji:"🤝", color:"#6366F1", lt:"#EEF2FF",
    stages:["Identified","First Contact","MOU Discussion","Due Diligence","Signed","Inactive"] },
  { id:"project",     label:"Projects",    emoji:"🚀", color:C.orange,  lt:"#FEF9EE",
    stages:["Backlog","In Discovery","In Development","UAT","Live","On Hold"] },
];

const VISIBLE_PIPES = PIPES.filter(p => p.id !== "partnership");

const PRI: Record<string, { fg: string; bg: string; bd: string }> = {
  Critical: { fg:"#B91C1C", bg:"#FEE2E2", bd:"#FCA5A5" },
  High:     { fg:"#B45309", bg:"#FEF3C7", bd:"#FCD34D" },
  Medium:   { fg:"#0E7862", bg:"#D1FAE5", bd:"#6EE7B7" },
  Low:      { fg:C.inkSub,  bg:"#F1F5F9", bd:C.border  },
};

const SEED = [
  { id:"d1", pid:"sales",       name:"Telkomsel VAS Bundle Q3",     owner:"Bimo",    val:850000000,  stage:"Negotiation",    pri:"High",     notes:"Awaiting final sign-off from procurement.",
    hist:[{wk:"2026-W18",stage:"Qualified",note:"Initial scoping call done.",by:"Bimo",ts:"2026-05-04"},{wk:"2026-W19",stage:"Proposal",note:"Deck submitted.",by:"Bimo",ts:"2026-05-10"},{wk:"2026-W20",stage:"Negotiation",note:"Counter-offer received.",by:"Bimo",ts:"2026-05-12"}], at:"2026-04-28" },
  { id:"d2", pid:"partnership", name:"Axiata Group MOU",             owner:"Ricky",   val:0,          stage:"MOU Discussion", pri:"High",     notes:"Legal review ongoing.",
    hist:[{wk:"2026-W17",stage:"Identified",note:"Referred by Indra.",by:"Ricky",ts:"2026-04-27"},{wk:"2026-W19",stage:"MOU Discussion",note:"Draft MOU sent.",by:"Ricky",ts:"2026-05-10"}], at:"2026-04-21" },
  { id:"d3", pid:"project",     name:"Fleet360 MVP — Bus Module",    owner:"Ghoffar", val:0,          stage:"In Development", pri:"Critical", notes:"Week 3 of 6-week MVP sprint.",
    hist:[{wk:"2026-W17",stage:"Backlog",note:"BRD approved.",by:"Ghoffar",ts:"2026-04-27"},{wk:"2026-W18",stage:"In Discovery",note:"Tech stack locked.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"In Development",note:"API skeleton complete.",by:"Ghoffar",ts:"2026-05-12"}], at:"2026-04-21", dueDate:"2026-06-02" },
  { id:"d4", pid:"sales",       name:"Indosat PPOB Platform",        owner:"Bimo",    val:1200000000, stage:"Proposal",       pri:"Critical", notes:"Strategic deal — board-level visibility.",
    hist:[{wk:"2026-W19",stage:"Qualified",note:"Discovery call done.",by:"Bimo",ts:"2026-05-09"},{wk:"2026-W20",stage:"Proposal",note:"Proposal deck sent.",by:"Bimo",ts:"2026-05-12"}], at:"2026-05-05" },
  { id:"d5", pid:"project",     name:"MIRS Laos Phase 2",            owner:"Ghoffar", val:0,          stage:"UAT",            pri:"High",     notes:"Government IMEI registration — regulatory milestone.",
    hist:[{wk:"2026-W18",stage:"In Development",note:"Phase 2 build complete.",by:"Ghoffar",ts:"2026-05-04"},{wk:"2026-W20",stage:"UAT",note:"UAT started with Laos MOICT team.",by:"Ghoffar",ts:"2026-05-11"}], at:"2026-04-14", dueDate:"2026-05-25" },
  { id:"d6", pid:"partnership", name:"Jazz Pakistan SSO Integration", owner:"Ricky",  val:0,          stage:"Signed",         pri:"Medium",   notes:"SAML 2.0 integration live.",
    hist:[{wk:"2026-W16",stage:"Due Diligence",note:"SP metadata exchanged.",by:"Ricky",ts:"2026-04-20"},{wk:"2026-W18",stage:"Signed",note:"Integration live. Handover to QA.",by:"Ricky",ts:"2026-05-03"}], at:"2026-04-10" },
];

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
const uid  = () => Math.random().toString(36).slice(2,9);
const week = (d = new Date()) => {
  const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()+3-((x.getDay()+6)%7));
  const w1 = new Date(x.getFullYear(),0,4);
  return `${x.getFullYear()}-W${String(1+Math.round(((x.getTime()-w1.getTime())/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,"0")}`;
};
const money = (v: number) => {
  if(!v) return "—";
  if(v>=1e9) return `Rp ${(v/1e9).toFixed(1)}B`;
  if(v>=1e6) return `Rp ${(v/1e6).toFixed(0)}M`;
  return `Rp ${v.toLocaleString("id-ID")}`;
};
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
};
const sfParse = (txt: string) => {
  const o = {name:"",stage:"",owner:"",val:0,notes:""};
  txt.split("\n").map(l=>l.trim()).filter(Boolean).forEach(l=>{
    const lw=l.toLowerCase(), p=l.split(/[:\t]/), v=p.slice(1).join(":").trim();
    if(lw.match(/^(opportunity name|name)/)) o.name=v;
    if(lw.match(/^(stage|sales stage)/))    o.stage=v;
    if(lw.match(/^(owner|account owner)/))  o.owner=v;
    if(lw.match(/^(amount|value)/))         o.val=parseFloat(v.replace(/[^0-9.]/g,""))||0;
    if(lw.match(/^(description|notes)/))    o.notes=v;
  });
  return o;
};

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

/* ════════════════════════════════════════════
   CSS
════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{margin:0;padding:0;font-family:'Nunito Sans',sans-serif;color:${C.ink};background:${C.pageBg};-webkit-font-smoothing:antialiased;}
input,textarea,select{font-family:'Nunito Sans',sans-serif;}
input::placeholder,textarea::placeholder{color:${C.inkDim};}
input:focus,textarea:focus,select:focus{outline:none;border-color:${C.teal}!important;box-shadow:0 0 0 3px ${C.teal}20!important;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${C.borderMid};border-radius:4px;}
@keyframes fadeUp  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn  {from{opacity:0}to{opacity:1}}
@keyframes scaleIn {from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes spin    {to{transform:rotate(360deg)}}
@keyframes pulse   {0%,100%{opacity:1}50%{opacity:.3}}
@keyframes toastIn {from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.fu{animation:fadeUp  .22s cubic-bezier(.22,1,.36,1) both;}
.fi{animation:fadeIn  .18s ease both;}
.si{animation:scaleIn .2s  cubic-bezier(.22,1,.36,1) both;}
.nav-item{display:flex;align-items:center;gap:12px;padding:10px 18px;cursor:pointer;transition:all .15s ease;color:${C.sidebarText};font-size:13px;font-weight:600;border-left:3px solid transparent;position:relative;user-select:none;}
.nav-item:hover{background:${C.sidebarHover};color:#fff;}
.nav-item.active{background:${C.activeBg};color:${C.activeAccent};border-left-color:${C.activeAccent};}
.nav-item .nav-arrow{margin-left:auto;font-size:10px;transition:transform .2s;}
.btn{cursor:pointer;border:none;outline:none;font-family:'Nunito Sans',sans-serif;transition:all .15s ease;font-weight:700;}
.btn:active{transform:scale(.97);}
.btn-navy{background:${C.blueBtn};color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;}
.btn-navy:hover{background:#243d7a;}
.btn-outline{background:#fff;color:${C.inkMid};padding:8px 20px;border-radius:6px;font-size:13px;border:1.5px solid ${C.border};}
.btn-outline:hover{border-color:${C.borderMid};background:${C.surfaceAlt};}
.btn-teal{background:${C.teal};color:#fff;padding:8px 18px;border-radius:6px;font-size:13px;}
.btn-teal:hover{background:${C.tealDark};}
.btn-green{background:${C.greenBtn};color:#fff;padding:8px 18px;border-radius:6px;font-size:13px;}
.btn-green:hover{background:#15803d;}
.btn-ghost{background:transparent;color:${C.inkSub};padding:6px 12px;border-radius:6px;font-size:12px;border:1px solid ${C.border};}
.btn-ghost:hover{background:${C.surfaceAlt};}
.data-table{width:100%;border-collapse:collapse;}
.data-table th{font-size:11px;font-weight:700;padding:10px 14px;text-align:left;color:#fff;font-family:'JetBrains Mono',monospace;letter-spacing:.04em;}
.data-table td{font-size:12px;padding:10px 14px;border-bottom:1px solid ${C.border};vertical-align:middle;}
.data-table tr:last-child td{border-bottom:none;}
.data-table tr:hover td{background:${C.surfaceAlt};}
.filter-select{background:#fff;border:1.5px solid ${C.border};border-radius:6px;padding:7px 10px;font-size:13px;color:${C.ink};font-family:'Nunito Sans',sans-serif;cursor:pointer;min-width:140px;}
.filter-select:focus{border-color:${C.teal};outline:none;}
.card{background:#fff;border-radius:10px;border:1px solid ${C.border};box-shadow:${C.shadow};transition:box-shadow .15s,border-color .15s;}
.card-hover:hover{box-shadow:${C.shadowMd};border-color:${C.borderMid};}
.sheet-overlay{position:fixed;inset:0;background:rgba(27,43,75,.45);z-index:400;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);}
.sheet-body{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -12px 40px rgba(27,43,75,.15);}
@media(max-width:767px){
  .sidebar{display:none!important;}
  .layout{display:block!important;}
  .mobile-header{display:flex!important;}
  .desktop-header{display:none!important;}
}
@media(min-width:768px){
  .layout{display:grid!important;grid-template-columns:230px 1fr;min-height:100vh;}
  .sidebar{display:flex!important;}
  .mobile-header{display:none!important;}
  .desktop-header{display:flex!important;}
  .sheet-body{border-radius:12px!important;max-height:88vh!important;align-self:center!important;}
  .sheet-overlay{align-items:center!important;}
}
.pri-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;}
.stage-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;white-space:nowrap;}
.deal-row{cursor:pointer;transition:background .12s;}
.deal-row:hover td{background:#F0F7FF!important;}
.pipe-tab{border-bottom:2px solid transparent;transition:all .15s;cursor:pointer;background:none;border-top:none;border-left:none;border-right:none;font-family:'Nunito Sans',sans-serif;}
.pipe-tab.active{border-bottom-color:${C.teal};color:${C.teal};}
`;

/* ════════════════════════════════════════════
   TYPES
════════════════════════════════════════════ */
type HistEntry = { wk: string; stage: string; note: string; by: string; ts: string };
type Deal = { id: string; pid: string; name: string; owner: string; val: number; stage: string; pri: string; notes: string; hist: HistEntry[]; at: string; dueDate?: string };
type Pipeline = typeof PIPES[number];
type ModalState = { type: "deal"; data: Deal } | { type: "add" } | { type: "sf" } | null;

/* ════════════════════════════════════════════
   SHARED STYLES
════════════════════════════════════════════ */
const lblSt: React.CSSProperties = { fontSize:11, fontWeight:700, color:C.inkSub, marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" };
const iSt: React.CSSProperties   = { width:"100%", background:C.surfaceAlt, border:`1.5px solid ${C.border}`, borderRadius:7, padding:"9px 12px", color:C.ink, fontSize:13, transition:"border-color .15s,box-shadow .15s" };

/* ════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════ */
function Clock() {
  const [t, setT] = useState("");
  useEffect(() => { setT(nowStr()); const i = setInterval(() => setT(nowStr()), 1000); return () => clearInterval(i); }, []);
  return <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:C.inkSub}}>{t}</span>;
}

/* ════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════ */
const NAV = [
  { icon:"⊞",  label:"Dashboard",                       id:"dashboard" },
  { icon:"📄", label:"Report",                          id:"report",    arrow:true },
  { icon:"📊", label:"Analytic",                        id:"analytic",  arrow:true },
  { icon:"👥", label:"Management",                      id:"management",arrow:true },
  { icon:"📋", label:"Service Catalogue",               id:"catalogue" },
  { icon:"🔧", label:"Tools Management",                id:"tools",     arrow:true },
  { icon:"🎫", label:"Ticket Tools",                    id:"ticket",    arrow:true },
  { icon:"📈", label:"Project & Sales Pipeline Report", id:"pipeline",  highlight:true },
  { icon:"🚪", label:"Logout",                          id:"logout" },
];

function Sidebar({ activePage, onNav }: { activePage: string; onNav: (id: string) => void }) {
  return (
    <aside className="sidebar" style={{flexDirection:"column",background:C.sidebarBg,borderRight:"1px solid #243558",width:230,position:"sticky",top:0,height:"100vh",overflowY:"auto",zIndex:50}}>
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #243558"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.teal},#1B6FC8)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:"#fff"}}>L</div>
          <div style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:".02em"}}>LinkIT<span style={{color:C.teal}}>⊙</span></div>
        </div>
      </div>
      <nav style={{flex:1,paddingTop:8}}>
        {NAV.map(n => {
          const isActive = activePage === n.id;
          return (
            <div key={n.id} className={`nav-item${isActive?" active":""}`} onClick={()=>onNav(n.id)}
              style={n.highlight && !isActive ? {color:C.teal,fontWeight:700} : {}}>
              <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>{n.icon}</span>
              <span style={{flex:1,fontSize:13}}>{n.label}</span>
              {n.arrow && <span className="nav-arrow">▶</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ════════════════════════════════════════════
   SYNC INDICATOR
════════════════════════════════════════════ */
function SyncIndicator() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.teal,fontFamily:"'JetBrains Mono',monospace",background:C.tealLt,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.teal}44`}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:C.teal}}/>
      Preview
    </div>
  );
}

/* ════════════════════════════════════════════
   PRI BADGE
════════════════════════════════════════════ */
function PriBadge({p}: {p: string}) {
  const c = PRI[p] || PRI.Low;
  return <span className="pri-badge" style={{background:c.bg,color:c.fg,border:`1px solid ${c.bd}`}}>{p}</span>;
}

/* ════════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════════ */
function EmptyState({msg="No deals in this stage yet."}: {msg?: string}) {
  return (
    <div style={{textAlign:"center",padding:"48px 20px",color:C.inkDim}}>
      <div style={{fontSize:36,marginBottom:10,opacity:.4}}>📭</div>
      <div style={{fontSize:13,color:C.inkSub,lineHeight:1.7}}>{msg}</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   REPORT VIEW
════════════════════════════════════════════ */
function ReportView({ pipeline, deals, filtered, fPipe, onOpen }: { pipeline: Pipeline; deals: Deal[]; filtered: Deal[]; fPipe: string; onOpen: (d: Deal) => void }) {
  const list = fPipe === "all" ? filtered : deals;
  return (
    <div style={{overflowX:"auto"}}>
      {list.length === 0 && <EmptyState/>}
      {list.length > 0 && (
        <table className="data-table" style={{width:"100%"}}>
          <thead>
            <tr>
              {["Deal / Project","Owner","Stage","Priority","Value","Last Update","Week",""].map((h,i)=>(
                <th key={i} style={{background:C.ink,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((d,i)=>{
              const last = d.hist[d.hist.length-1];
              const p = PIPES.find(x=>x.id===d.pid) || pipeline;
              return (
                <tr key={d.id} className="deal-row fu" style={{animationDelay:`${i*25}ms`}} onClick={()=>onOpen(d)}>
                  <td style={{maxWidth:220}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:3,height:32,borderRadius:2,background:p.color,flexShrink:0}}/>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:C.ink,lineHeight:1.3}}>{d.name}</div>
                        {d.notes && <div style={{fontSize:11,color:C.inkDim,marginTop:1}}>{d.notes.slice(0,40)}{d.notes.length>40?"…":""}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:22,height:22,borderRadius:11,background:p.lt,border:`1px solid ${p.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:p.color}}>{(d.owner||"?")[0].toUpperCase()}</div>
                      <span style={{fontSize:12,color:C.inkMid}}>{d.owner}</span>
                    </div>
                  </td>
                  <td><span className="stage-pill" style={{background:p.lt,color:p.color}}>{d.stage}</span></td>
                  <td><PriBadge p={d.pri}/></td>
                  <td style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:d.val?C.teal:C.inkDim,fontSize:12,whiteSpace:"nowrap"}}>{money(d.val)}</td>
                  <td style={{fontSize:11,color:C.inkSub,maxWidth:160}}>{last?.note?.slice(0,50)}{(last?.note?.length??0)>50?"…":""}</td>
                  <td><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.inkDim,background:"#F1F5F9",padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{last?.wk}</span></td>
                  <td><span style={{fontSize:18,color:C.inkDim}}>›</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEAL CARD
════════════════════════════════════════════ */
function DealCard({ deal, pipeline, onClick, i=0 }: { deal: Deal; pipeline: Pipeline; onClick: () => void; i?: number }) {
  const last = deal.hist[deal.hist.length-1];
  return (
    <div onClick={onClick} className="card card-hover fu" style={{padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${pipeline.color}`,animationDelay:`${i*35}ms`,borderRadius:8}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:9}}>
        <div style={{fontWeight:700,fontSize:14,color:C.ink,lineHeight:1.35,flex:1}}>{deal.name}</div>
        <PriBadge p={deal.pri}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",rowGap:5}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.inkSub}}>
          <div style={{width:22,height:22,borderRadius:11,background:pipeline.lt,border:`1px solid ${pipeline.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:pipeline.color}}>{(deal.owner||"?")[0].toUpperCase()}</div>
          {deal.owner}
        </div>
        {deal.val>0 && <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:800,color:C.teal,marginLeft:"auto"}}>{money(deal.val)}</div>}
      </div>
      {last && <div style={{borderTop:`1px solid ${C.border}`,paddingTop:9,marginTop:10,display:"flex",justifyContent:"space-between",gap:10}}>
        <div style={{fontSize:11,color:C.inkSub,lineHeight:1.5,flex:1}}>{last.note?.slice(0,80)}{(last.note?.length??0)>80?"…":""}</div>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.inkDim,background:"#F1F5F9",padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,flexShrink:0,whiteSpace:"nowrap"}}>{last.wk}</span>
      </div>}
    </div>
  );
}

/* ════════════════════════════════════════════
   BOARD VIEW
════════════════════════════════════════════ */
function BoardView({pipeline, deals, onOpen, stages}: { pipeline: Pipeline; deals: Deal[]; onOpen: (d: Deal) => void; stages: string[] }) {
  const [sel, setSel] = useState(stages[0]);
  useEffect(()=>setSel(stages[0]),[pipeline.id, stages]);
  const sd = deals.filter(d=>d.stage===sel);
  const sv = sd.reduce((s,d)=>s+(d.val||0),0);
  return (
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
        {stages.map(s=>{
          const cnt = deals.filter(d=>d.stage===s).length, act = sel===s;
          return (
            <button key={s} onClick={()=>setSel(s)} className="btn"
              style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:act?700:600,background:act?pipeline.color:"#F1F5F9",color:act?"#fff":C.inkMid,border:`1.5px solid ${act?pipeline.color:C.border}`,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,boxShadow:act?`0 2px 8px ${pipeline.color}40`:"none"}}>
              {s}
              {cnt>0 && <span style={{fontFamily:"'JetBrains Mono',monospace",background:act?"rgba(255,255,255,.25)":"#E2E8F0",color:act?"#fff":C.inkDim,padding:"0 5px",borderRadius:6,fontSize:10,fontWeight:700}}>{cnt}</span>}
            </button>
          );
        })}
      </div>
      {sv>0 && <div style={{background:C.tealLt,border:`1px solid ${C.teal}33`,borderRadius:7,padding:"8px 14px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:12,color:C.inkSub}}>Stage Total</span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,color:C.teal}}>{money(sv)}</span>
      </div>}
      {sd.length===0 ? <EmptyState/> : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sd.map((d,i)=><DealCard key={d.id} deal={d} pipeline={pipeline} onClick={()=>onOpen(d)} i={i}/>)}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   HISTORY VIEW
════════════════════════════════════════════ */
function HistoryView({ pipeline, deals }: { pipeline: Pipeline; deals: Deal[] }) {
  const all = deals.flatMap(d=>d.hist.map(h=>({...h,dealName:d.name}))).sort((a,b)=>b.ts.localeCompare(a.ts));
  const byWk = all.reduce((acc: Record<string, typeof all>, h)=>{ (acc[h.wk]||(acc[h.wk]=[])).push(h); return acc; },{});
  const weeks = Object.keys(byWk).sort((a,b)=>b.localeCompare(a));
  return (
    <div style={{padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,color:C.ink,fontSize:14}}>Backlog Audit Log — Week-by-Week</div>
        <span style={{background:pipeline.lt,color:pipeline.color,padding:"3px 10px",borderRadius:9,fontSize:11,fontWeight:700,border:`1px solid ${pipeline.color}33`}}>{all.length} updates</span>
      </div>
      {weeks.length===0 && <EmptyState msg="No history yet."/>}
      {weeks.map((wk,wi)=>(
        <div key={wk} className="fu" style={{marginBottom:20,animationDelay:`${wi*40}ms`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:pipeline.color,background:pipeline.lt,padding:"4px 12px",borderRadius:6,border:`1px solid ${pipeline.color}33`,flexShrink:0}}>{wk}</span>
            <div style={{flex:1,height:1,background:C.border}}/>
            <span style={{fontSize:11,color:C.inkDim}}>{byWk[wk].length} update{byWk[wk].length>1?"s":""}</span>
          </div>
          <div style={{borderLeft:`3px solid ${pipeline.color}33`,paddingLeft:14,display:"flex",flexDirection:"column",gap:8}}>
            {byWk[wk].map((h,i)=>(
              <div key={i} className="card" style={{padding:"12px 14px",borderLeft:`3px solid ${pipeline.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:7}}>
                  <span style={{fontWeight:700,fontSize:13,color:C.ink}}>{h.dealName}</span>
                  <span className="stage-pill" style={{background:pipeline.lt,color:pipeline.color}}>{h.stage}</span>
                </div>
                <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:8}}>{h.note}</div>
                <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                  <span style={{fontSize:11,color:C.inkSub,display:"flex",alignItems:"center",gap:5}}>
                    <span style={{width:18,height:18,borderRadius:9,background:pipeline.lt,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:pipeline.color}}>{(h.by||"?")[0].toUpperCase()}</span>
                    {h.by}
                  </span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.inkDim,background:"#F1F5F9",padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`}}>{h.ts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

/* ════════════════════════════════════════════
   BOTTOM SHEET
════════════════════════════════════════════ */
function Sheet({children, onClose}: {children: React.ReactNode; onClose: () => void}) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-body si" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px",flexShrink:0}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.borderMid}}/>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DEAL SHEET
════════════════════════════════════════════ */
function DealSheet({deal, pipeline, onClose, onUpdate, onDel, stages}: { deal: Deal; pipeline: Pipeline; onClose: () => void; onUpdate: (id: string, stage: string, note: string, by: string, dueDate?: string) => void; onDel: (id: string) => void; stages: string[] }) {
  const [stage,   setStage]   = useState(deal.stage);
  const [note,    setNote]    = useState("");
  const [by,      setBy]      = useState("");
  const [dueDate, setDueDate] = useState(deal.dueDate ?? "");
  const [tab,     setTab]     = useState("update");
  const [conf,    setConf]    = useState(false);
  const ok = note.trim().length > 0;
  return (
    <Sheet onClose={onClose}>
      <div style={{padding:"10px 18px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:9}}>
          <div style={{fontWeight:800,fontSize:15,color:C.ink,flex:1,lineHeight:1.3}}>{deal.name}</div>
          <button className="btn btn-ghost" onClick={onClose} style={{width:30,height:30,padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
          <span className="stage-pill" style={{background:pipeline.lt,color:pipeline.color}}>{deal.stage}</span>
          <PriBadge p={deal.pri}/>
          {deal.val>0 && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:800,color:C.teal}}>{money(deal.val)}</span>}
          <span style={{fontSize:11,color:C.inkSub,marginLeft:"auto"}}>👤 {deal.owner}</span>
        </div>
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {[["update","Update Stage"],["history",`History (${deal.hist.length})`]].map(([v,lbl])=>(
          <button key={v} onClick={()=>setTab(v)} className={`pipe-tab btn${tab===v?" active":""}`}
            style={{flex:1,padding:"10px",fontSize:12,fontWeight:tab===v?700:600,color:tab===v?C.teal:C.inkMid}}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"16px 18px"}}>
        {tab==="update" && <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {deal.notes && <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",fontSize:13,color:C.inkMid,lineHeight:1.6}}>{deal.notes}</div>}
          <div>
            <div style={lblSt}>Move to Stage</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {stages.map(s=>(
                <button key={s} onClick={()=>setStage(s)} className="btn"
                  style={{padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:stage===s?700:500,background:stage===s?pipeline.lt:"#F1F5F9",color:stage===s?pipeline.color:C.inkMid,border:`1.5px solid ${stage===s?pipeline.color:C.border}`}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div><div style={lblSt}>Your Name</div><input value={by} onChange={e=>setBy(e.target.value)} placeholder="e.g. Bimo" style={iSt}/></div>
          <div><div style={lblSt}>Progress Note *</div><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="What happened? Wins, blockers, next steps…" style={{...iSt,resize:"vertical" as const}}/></div>
          <div><div style={lblSt}>Due Date</div><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={iSt}/></div>
          <button onClick={()=>{ if(ok){ onUpdate(deal.id,stage,note,by,dueDate||undefined); setNote(""); setBy(""); } }} className="btn btn-navy" style={{width:"100%",padding:"11px",fontSize:13,borderRadius:8,opacity:ok?1:.5,cursor:ok?"pointer":"default"}}>↵ Log Update</button>
        </div>}
        {tab==="history" && <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {[...deal.hist].reverse().map((h,i)=>(
            <div key={i} style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${pipeline.color}`,borderRadius:8,padding:"10px 13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:6}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:pipeline.color,fontWeight:700,background:pipeline.lt,padding:"2px 8px",borderRadius:4}}>{h.wk}</span>
                <span style={{background:"#F1F5F9",color:C.inkSub,padding:"1px 8px",borderRadius:4,fontSize:10,border:`1px solid ${C.border}`}}>{h.stage}</span>
              </div>
              <div style={{fontSize:12,color:C.inkMid,lineHeight:1.55,marginBottom:7}}>{h.note}</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:C.inkSub}}>👤 {h.by}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.inkDim}}>{h.ts}</span>
              </div>
            </div>
          ))}
        </div>}
      </div>
      <div style={{padding:"12px 18px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
        {!conf
          ? <button onClick={()=>setConf(true)} className="btn" style={{width:"100%",background:"#fff",border:`1px solid ${C.border}`,color:C.red,padding:"10px",borderRadius:8,fontSize:12,fontWeight:600}}>🗑 Remove Deal</button>
          : <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConf(false)} className="btn btn-outline" style={{flex:1,padding:"10px"}}>Cancel</button>
              <button onClick={()=>onDel(deal.id)} className="btn" style={{flex:2,background:C.redLt,border:"1px solid #FCA5A5",color:"#B91C1C",padding:"10px",borderRadius:8,fontSize:12,fontWeight:700}}>Confirm Delete</button>
            </div>}
      </div>
    </Sheet>
  );
}

/* ════════════════════════════════════════════
   ADD SHEET
════════════════════════════════════════════ */
function AddSheet({pipeline, onClose, onAdd, stages}: { pipeline: Pipeline; onClose: () => void; onAdd: (d: Omit<Deal,"id"|"pid"|"at"|"hist">) => void; stages: string[] }) {
  const [f, setF] = useState({name:"",owner:"",stage:stages[0] ?? pipeline.stages[0],pri:"Medium",val:"",notes:"",dueDate:""});
  const upd = (k: string, v: string) => setF(p=>({...p,[k]:v}));
  const ok = f.name.trim().length > 0;
  return (
    <Sheet onClose={onClose}>
      <div style={{padding:"10px 18px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:15,fontWeight:800,color:C.ink}}>{pipeline.emoji} New {pipeline.label} Deal</div>
        <button className="btn btn-ghost" onClick={onClose} style={{width:30,height:30,padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"16px 18px",display:"flex",flexDirection:"column",gap:13}}>
        {(([["Deal Name *","name","text"],["Owner","owner","text"],["Value (Rp)","val","number"]] as [string,string,string][])).map(([lbl,k,type])=>(
          <div key={k}><div style={lblSt}>{lbl}</div><input type={type} value={f[k as keyof typeof f]} onChange={e=>upd(k,e.target.value)} style={iSt}/></div>
        ))}
        <div><div style={lblSt}>Notes</div><textarea value={f.notes} onChange={e=>upd("notes",e.target.value)} rows={2} placeholder="Optional…" style={{...iSt,resize:"vertical" as const}}/></div>
        <div><div style={lblSt}>Due Date</div><input type="date" value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} style={iSt}/></div>
        <div>
          <div style={lblSt}>Stage</div>
          <select value={f.stage} onChange={e=>upd("stage",e.target.value)} style={{...iSt,appearance:"none" as const}}>
            {stages.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={lblSt}>Priority</div>
          <div style={{display:"flex",gap:7}}>
            {["Low","Medium","High","Critical"].map(p=>{
              const c=PRI[p], act=f.pri===p;
              return <button key={p} onClick={()=>upd("pri",p)} className="btn" style={{flex:1,padding:"7px 4px",borderRadius:7,fontSize:11,fontWeight:act?700:500,background:act?c.bg:"#F1F5F9",color:act?c.fg:C.inkSub,border:`1.5px solid ${act?c.bd:C.border}`}}>{p}</button>;
            })}
          </div>
        </div>
      </div>
      <div style={{padding:"12px 18px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:9}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1,padding:"11px"}}>Cancel</button>
        <button onClick={()=>{ if(ok) onAdd({...f, val:parseFloat(f.val)||0, dueDate:f.dueDate||undefined}); }} className="btn btn-navy" style={{flex:2,padding:"11px",borderRadius:8,opacity:ok?1:.5,cursor:ok?"pointer":"default"}}>Add to Pipeline</button>
      </div>
    </Sheet>
  );
}

/* ════════════════════════════════════════════
   SF SHEET
════════════════════════════════════════════ */
function SFSheet({pipeline, onClose, onAdd, stages}: { pipeline: Pipeline; onClose: () => void; onAdd: (d: Omit<Deal,"id"|"pid"|"at"|"hist">) => void; stages: string[] }) {
  const [raw,    setRaw]    = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof sfParse>|null>(null);
  const [pri,    setPri]    = useState("Medium");
  return (
    <Sheet onClose={onClose}>
      <div style={{padding:"10px 18px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.ink,marginBottom:2}}>⬆ Paste from Salesforce</div>
            <div style={{fontSize:11,color:C.inkSub}}>Copy any SF opportunity record and paste below</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{width:30,height:30,padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✕</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
        <textarea value={raw} onChange={e=>{setRaw(e.target.value);setParsed(null);}} rows={6}
          placeholder={"Opportunity Name: Telkomsel Q3 Bundle\nStage: Negotiation\nOwner: Bimo\nAmount: 850000000\nDescription: Strategic offer…"}
          style={{...iSt,fontFamily:"'JetBrains Mono',monospace",fontSize:11,resize:"vertical" as const,lineHeight:1.7}}/>
        <button onClick={()=>setParsed(sfParse(raw))} disabled={!raw.trim()} className="btn btn-navy" style={{opacity:raw.trim()?1:.5,cursor:raw.trim()?"pointer":"default",padding:"9px"}}>🔍 Parse</button>
        {parsed && <div className="fi" style={{background:C.tealLt,border:`1.5px solid ${C.teal}44`,borderRadius:10,padding:14}}>
          <div style={{fontSize:10,fontWeight:700,color:C.teal,fontFamily:"'JetBrains Mono',monospace",marginBottom:10,letterSpacing:".07em"}}>PARSED ✓</div>
          {([["Name",parsed.name],["Stage",parsed.stage],["Owner",parsed.owner],["Value",money(parsed.val)],["Notes",parsed.notes]] as [string,string][]).filter(([,v])=>v).map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:12,marginBottom:6,fontSize:12}}>
              <span style={{color:C.inkSub,width:46,fontFamily:"'JetBrains Mono',monospace",fontSize:10,flexShrink:0}}>{k}</span>
              <span style={{color:C.ink,fontWeight:600,flex:1,wordBreak:"break-word"}}>{v}</span>
            </div>
          ))}
          <div style={{marginTop:12}}>
            <div style={lblSt}>Priority</div>
            <div style={{display:"flex",gap:7}}>
              {["Low","Medium","High","Critical"].map(p=>{
                const c=PRI[p], act=pri===p;
                return <button key={p} onClick={()=>setPri(p)} className="btn" style={{flex:1,padding:"6px 4px",borderRadius:7,fontSize:11,fontWeight:act?700:500,background:act?c.bg:"#fff",color:act?c.fg:C.inkSub,border:`1.5px solid ${act?c.bd:C.border}`}}>{p}</button>;
              })}
            </div>
          </div>
        </div>}
      </div>
      <div style={{padding:"12px 18px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:9}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1,padding:"11px"}}>Cancel</button>
        {parsed && parsed.name && (
          <button onClick={()=>{ onAdd({...parsed, pri, stage:parsed.stage||(stages[0] ?? pipeline.stages[0])}); onClose(); }} className="btn btn-teal" style={{flex:2,padding:"11px",borderRadius:8,fontSize:13}}>
            Import to {pipeline.label}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ════════════════════════════════════════════
   JIRA SYNC PILL
════════════════════════════════════════════ */
function JiraSyncPill({sync, onRefresh}: {
  sync: {at: string | null; ok: boolean; loading: boolean; error: string | null};
  onRefresh: () => void;
}) {
  const timeLabel = sync.at
    ? new Date(sync.at).toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", hour12: false})
    : "—";
  const bg = sync.ok ? C.tealLt : sync.error ? "#FEE2E2" : "#F1F5F9";
  const fg = sync.ok ? "#0E7862" : sync.error ? "#B91C1C" : C.inkSub;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <button onClick={onRefresh} className="btn btn-ghost"
        disabled={sync.loading}
        style={{padding:"5px 10px",fontSize:11,fontWeight:700,opacity:sync.loading?.5:1,cursor:sync.loading?"default":"pointer"}}>
        {sync.loading ? "⏳ Syncing…" : "🔄 Refresh"}
      </button>
      <span style={{
        fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,
        padding:"3px 8px",borderRadius:5,background:bg,color:fg,whiteSpace:"nowrap",
      }} title={sync.error ?? ""}>
        {sync.ok    ? `Synced ${timeLabel} · Jira` :
         sync.error ? `⚠ Offline (SEED fallback)`  :
                      `Loading…`}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════
   APP ROOT
════════════════════════════════════════════ */
export default function Page() {
  const [deals,  setDeals]  = useState<Deal[]>(SEED.filter(d => d.pid !== "partnership"));
  const [pipe,   setPipe]   = useState("sales");
  const [view,   setView]   = useState("report");
  const [modal,  setModal]  = useState<ModalState>(null);
  const [page,   setPage]   = useState("pipeline");

  const [jiraStages, setJiraStages] = useState<{sales: string[] | null; project: string[] | null}>({sales: null, project: null});
  const [sync, setSync] = useState<{at: string | null; ok: boolean; loading: boolean; error: string | null}>({at: null, ok: false, loading: true, error: null});

  const pipelineStages = (pid: string): string[] => {
    if (pid === "sales"   && jiraStages.sales)   return jiraStages.sales;
    if (pid === "project" && jiraStages.project) return jiraStages.project;
    return PIPES.find(p => p.id === pid)?.stages ?? [];
  };

  const [fPipe,  setFPipe]  = useState("all");
  const [fStage, setFStage] = useState("all");
  const [fOwner, setFOwner] = useState("all");
  const [fPri,   setFPri]   = useState("all");

  const addDeal = (d: Omit<Deal,"id"|"pid"|"at"|"hist">) => {
    const nd: Deal = {
      ...d, id:uid(), pid:pipe, at:new Date().toISOString().slice(0,10),
      hist:[{wk:week(), stage:d.stage, note:"Deal created.", by:d.owner||"System", ts:new Date().toISOString().slice(0,10)}],
    };
    setDeals(p=>[...p,nd]); setModal(null);
  };
  const updateDeal = (id: string, stage: string, note: string, by: string, dueDate?: string) => {
    setDeals(p=>p.map(d=>d.id!==id ? d : {
      ...d, stage, ...(dueDate !== undefined && { dueDate }),
      hist:[...d.hist,{wk:week(), stage, note:note||"Stage updated.", by:by||"System", ts:new Date().toISOString().slice(0,10)}],
    }));
  };
  const delDeal = (id: string) => { setDeals(p=>p.filter(d=>d.id!==id)); setModal(null); };

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

  useEffect(() => {
    fetchJira();
    const id = setInterval(() => fetchJira(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const pipeline   = PIPES.find(p=>p.id===pipe)!;
  const owners     = [...new Set(deals.map(d=>d.owner).filter(Boolean))];
  const active     = deals.filter(d=>!["Closed Lost","Inactive","On Hold"].includes(d.stage)).length;
  const critical   = deals.filter(d=>d.pri==="Critical").length;
  const wonCount   = deals.filter(d=>["Closed Won","Signed","Live"].includes(d.stage)).length;
  const totalSales = deals.filter(d=>d.pid==="sales").reduce((s,d)=>s+(d.val||0),0);
  const filtered   = deals.filter(d=>{
    if(fPipe!=="all"  && d.pid!==fPipe)   return false;
    if(fStage!=="all" && d.stage!==fStage) return false;
    if(fOwner!=="all" && d.owner!==fOwner) return false;
    if(fPri!=="all"   && d.pri!==fPri)    return false;
    return true;
  });
  const pDeals = deals.filter(d=>d.pid===pipe);

  return (
    <div style={{minHeight:"100vh",background:C.pageBg,fontFamily:"'Nunito Sans',sans-serif",color:C.ink}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      <div className="layout" style={{display:"block"}}>

        <Sidebar activePage={page} onNav={id=>setPage(id)}/>

        <div style={{display:"flex",flexDirection:"column",minWidth:0}}>

          {/* Desktop Header */}
          <header className="desktop-header" style={{background:C.headerBg,borderBottom:`1px solid ${C.headerBorder}`,padding:"0 24px",height:56,alignItems:"center",gap:16,flexShrink:0,position:"sticky",top:0,zIndex:80}}>
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:16}}>☰</button>
            <div style={{flex:1}}/>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},#1B6FC8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff"}}>A</div>
              <span style={{fontSize:13,fontWeight:700,color:C.teal}}>Aldo bangsawan</span>
            </div>
            <div style={{width:1,height:24,background:C.border,margin:"0 8px"}}/>
            <JiraSyncPill sync={sync} onRefresh={()=>fetchJira(true)}/>
            <div style={{width:1,height:24,background:C.border,margin:"0 8px"}}/>
            <Clock/>
          </header>

          {/* Mobile Header */}
          <header className="mobile-header" style={{background:C.headerBg,borderBottom:`1px solid ${C.headerBorder}`,padding:"0 14px",height:52,alignItems:"center",gap:10,flexShrink:0,position:"sticky",top:0,zIndex:80}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
              <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.teal},#1B6FC8)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#fff"}}>L</div>
              <span style={{fontSize:14,fontWeight:800,color:C.ink}}>LinkIT<span style={{color:C.teal}}>⊙</span></span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>A</div>
              <span style={{fontSize:11,color:C.teal,fontWeight:700}}>Aldo</span>
            </div>
          </header>

          <main style={{flex:1,padding:"20px 16px 60px"}}>

            <div style={{marginBottom:20}}>
              <h1 style={{margin:0,fontSize:22,fontWeight:800,color:C.ink}}>Project & Sales Pipeline Report</h1>
              <div style={{fontSize:13,color:C.inkSub,marginTop:3}}>Pipeline tracking and deal history for business team</div>
            </div>

            {/* Filter Card */}
            <div className="card" style={{padding:"18px 20px",marginBottom:16}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-end"}}>
                <div>
                  <div style={lblSt}>Pipeline</div>
                  <select className="filter-select" value={fPipe} onChange={e=>{setFPipe(e.target.value); if(e.target.value!=="all") setPipe(e.target.value);}}>
                    <option value="all">All Pipelines</option>
                    {VISIBLE_PIPES.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lblSt}>Stage</div>
                  <select className="filter-select" value={fStage} onChange={e=>setFStage(e.target.value)}>
                    <option value="all">All Stages</option>
                    {pipelineStages(pipeline.id).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lblSt}>Owner</div>
                  <select className="filter-select" value={fOwner} onChange={e=>setFOwner(e.target.value)}>
                    <option value="all">All Owners</option>
                    {owners.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lblSt}>Priority</div>
                  <select className="filter-select" value={fPri} onChange={e=>setFPri(e.target.value)}>
                    <option value="all">All Priorities</option>
                    {["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}/>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="btn btn-outline" onClick={()=>{ setFPipe("all"); setFStage("all"); setFOwner("all"); setFPri("all"); }}>Reset</button>
                  <button className="btn btn-teal" onClick={()=>setModal({type:"sf"})}>⬆ Salesforce</button>
                  <button className="btn btn-navy" onClick={()=>setModal({type:"add"})}>+ Add Deal</button>
                </div>
              </div>
            </div>

            {/* Summary Bar */}
            <div style={{marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div style={{background:C.blueBtn,color:"#fff",padding:"5px 14px",borderRadius:5,fontSize:13,fontWeight:700,display:"inline-block"}}>
                All Pipelines ({deals.length}) | Active ({active})
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-green" style={{fontSize:12}}>📥 Export as XLS</button>
                <SyncIndicator/>
              </div>
            </div>

            {/* KPI Table */}
            <div className="card" style={{marginBottom:16,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{background:C.ink,minWidth:180}}>METRIC</th>
                      <th style={{background:C.thCurrent,minWidth:130,textAlign:"center"}}>Sales Pipeline</th>
                      <th style={{background:C.thEstimated,minWidth:130,textAlign:"center"}}>Active Deals</th>
                      <th style={{background:"#16A34A",minWidth:130,textAlign:"center"}}>Won / Signed</th>
                      <th style={{background:C.red,minWidth:100,textAlign:"center"}}>Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VISIBLE_PIPES.map(p=>{
                      const pd = deals.filter(d=>d.pid===p.id);
                      const pv = pd.reduce((s,d)=>s+(d.val||0),0);
                      const pa = pd.filter(d=>!["Closed Lost","Inactive","On Hold"].includes(d.stage)).length;
                      const pw = pd.filter(d=>["Closed Won","Signed","Live"].includes(d.stage)).length;
                      const pc = pd.filter(d=>d.pri==="Critical").length;
                      return (
                        <tr key={p.id} onClick={()=>{setPipe(p.id);setView("report");}} style={{cursor:"pointer"}}>
                          <td style={{fontWeight:700,color:C.ink}}>
                            <span style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{width:10,height:10,borderRadius:2,background:p.color,display:"inline-block",flexShrink:0}}/>
                              {p.emoji} {p.label}
                            </span>
                          </td>
                          <td style={{textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:C.teal}}>{pv?money(pv):pd.length+" deals"}</td>
                          <td style={{textAlign:"center",fontWeight:700,color:pa>0?C.blueBtn:C.inkDim}}>{pa}</td>
                          <td style={{textAlign:"center",fontWeight:700,color:pw>0?"#16A34A":C.inkDim}}>{pw}</td>
                          <td style={{textAlign:"center",fontWeight:700,color:pc>0?C.red:C.inkDim}}>{pc}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:"#F0F7FF",fontWeight:800}}>
                      <td style={{fontWeight:800,color:C.ink}}>TOTAL</td>
                      <td style={{textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:800,color:C.teal}}>{money(totalSales)}</td>
                      <td style={{textAlign:"center",fontWeight:800,color:C.blueBtn}}>{active}</td>
                      <td style={{textAlign:"center",fontWeight:800,color:"#16A34A"}}>{wonCount}</td>
                      <td style={{textAlign:"center",fontWeight:800,color:C.red}}>{critical}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pipeline Tabs */}
            <div className="card" style={{marginBottom:0,borderRadius:"10px 10px 0 0",borderBottom:"none"}}>
              <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
                {VISIBLE_PIPES.map(p=>{
                  const cnt = deals.filter(d=>d.pid===p.id).length, act = pipe===p.id;
                  return (
                    <button key={p.id} onClick={()=>setPipe(p.id)} className={`pipe-tab btn${act?" active":""}`}
                      style={{padding:"12px 18px",fontSize:13,fontWeight:act?700:600,color:act?C.teal:C.inkMid,display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}>
                      {p.emoji} {p.label}
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,background:act?C.tealLt:"#F1F5F9",color:act?C.teal:C.inkDim,padding:"1px 7px",borderRadius:10,border:`1px solid ${act?C.teal+"44":C.border}`}}>{cnt}</span>
                    </button>
                  );
                })}
                <div style={{flex:1,borderBottom:`1px solid ${C.border}`}}/>
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 12px"}}>
                  {([["report","📋 Report"],["board","⊞ Board"],["history","⏱ Log"],["gantt","📅 Gantt"]] as [string,string][]).map(([v,lbl])=>(
                    <button key={v} onClick={()=>setView(v)} className="btn btn-ghost"
                      style={{fontSize:11,padding:"5px 10px",fontWeight:view===v?700:500,background:view===v?C.tealLt:"transparent",color:view===v?C.teal:C.inkSub,border:`1px solid ${view===v?C.teal+"44":C.border}`,borderRadius:5}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deal Content */}
            <div className="card" style={{borderRadius:"0 0 10px 10px",borderTop:"none",overflow:"hidden"}}>
              {view==="report"  && <ReportView  pipeline={pipeline} deals={pDeals} filtered={filtered} fPipe={fPipe} onOpen={d=>setModal({type:"deal",data:d})}/>}
              {view==="board"   && <BoardView   pipeline={pipeline} deals={pDeals} onOpen={d=>setModal({type:"deal",data:d})} stages={pipelineStages(pipeline.id)}/>}
              {view==="history" && <HistoryView pipeline={pipeline} deals={pDeals}/>}
              {view==="gantt"   && <GanttView   pipeline={pipeline} deals={pDeals}/>}
            </div>

          </main>
        </div>
      </div>

      {modal?.type==="deal" && <DealSheet deal={modal.data} pipeline={pipeline} onClose={()=>setModal(null)} onUpdate={updateDeal} onDel={delDeal} stages={pipelineStages(pipeline.id)}/>}
      {modal?.type==="add"  && <AddSheet  pipeline={pipeline} onClose={()=>setModal(null)} onAdd={addDeal} stages={pipelineStages(pipeline.id)}/>}
      {modal?.type==="sf"   && <SFSheet   pipeline={pipeline} onClose={()=>setModal(null)} onAdd={addDeal} stages={pipelineStages(pipeline.id)}/>}
    </div>
  );
}
