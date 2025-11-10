/* PROPHETIA — PLP (listado) */
.filters{ display:grid; gap:14px; border-right:1px solid var(--line); padding-right:18px; margin-right:18px; }
.filters-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.35); opacity:0; pointer-events:none; transition:opacity .28s; z-index:1190; }
.filters-overlay.open{ opacity:1; pointer-events:auto; }
.filters-drawer{ position:fixed; top:0; right:0; bottom:0; width:min(520px,92vw); background:#fff; border-left:1px solid var(--line);
  box-shadow:-18px 0 40px rgba(0,0,0,.18); transform:translateX(100%); transition:transform .28s; z-index:1210; }
.filters-drawer.open{ transform:translateX(0); }

.results-bar{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:8px 0; }
.cat-toolbar{ position:relative; margin:clamp(8px,1vw,14px) 0 clamp(22px,3vw,40px); padding-inline:var(--edge); display:flex; gap:16px; }
.camisetas-page #gridCamisetas{ padding-inline:var(--edge); }
