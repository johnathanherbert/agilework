/* =====================================================================
   AgileWork · helpers.js
   Cole no início do <script> de cada tela (arquivo HTML único, sem build).
   Compatível com visualizadores antigos: sem ?. ?? ||= nem catch{} sem parâmetro.
   ===================================================================== */

/* 1) Erro visível na tela em vez de página vazia — SEMPRE a primeira coisa */
window.addEventListener('error',function(e){
  var b=document.getElementById('errBanner');
  if(!b){ b=document.createElement('div'); b.id='errBanner';
    b.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99;background:#2a1215;border:1px solid #e5484d;color:#ffd7d9;padding:10px 14px;border-radius:6px;font:12px/1.5 monospace;white-space:pre-wrap';
    document.body.appendChild(b); }
  b.textContent='Erro na tela: '+(e.message||e)+(e.lineno?'  (linha '+e.lineno+')':'');
});

/* 2) Armazenamento seguro (localStorage pode lançar exceção no preview do SharePoint/OneDrive) */
var store = {
  get:function(k){ try{ return window.localStorage.getItem(k); }catch(e){ return null; } },
  set:function(k,v){ try{ window.localStorage.setItem(k,v); }catch(e){} },
  del:function(k){ try{ window.localStorage.removeItem(k); }catch(e){} }
};

/* 3) Formatação pt-BR */
function pad(n){ return (n<10?'0':'')+n; }
var DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var DIAS_L=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
var MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function nf(n){ return Number(n).toLocaleString('pt-BR'); }
function kg(n){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}); }
function pct(a,b){ return b ? Math.round(a/b*100) : 0; }
function pp(v){ return (v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1).replace('.',',')+' pp'; }
function hm(d){ return pad(d.getHours())+':'+pad(d.getMinutes()); }
function dm(d){ return pad(d.getDate())+'/'+pad(d.getMonth()+1); }
function dmhm(d){ return dm(d)+' '+hm(d); }
function key(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function fmtDur(min){ min=Math.round(min); return Math.floor(min/60)+'h '+pad(min%60)+'m'; }
function rel(d){
  var m=(Date.now()-d)/60000;
  if(m<1) return 'agora'; if(m<60) return 'há '+Math.floor(m)+' min';
  var t=new Date(), y=new Date(t.getFullYear(),t.getMonth(),t.getDate()-1);
  if(d.toDateString()===t.toDateString()) return 'hoje '+hm(d);
  if(d.toDateString()===y.toDateString()) return 'ontem '+hm(d);
  var dd=Math.floor(m/1440); return 'há '+dd+' dia'+(dd>1?'s':'');
}
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function ini(n){ var p=n.trim().split(/\s+/); return (p[0][0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); }

/* 4) Turnos Novamed — dia produtivo começa no 3º turno (véspera) */
var SHIFTS = [
  {n:3, l:'3º turno', a:[23,45], b:[7,20]},
  {n:1, l:'1º turno', a:[7,20],  b:[15,50]},
  {n:2, l:'2º turno', a:[15,50], b:[23,45]}
];
function currentShift(d){
  d=d||new Date();
  var t=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
  for(var i=0;i<SHIFTS.length;i++){
    var s=SHIFTS[i], a=s.a[0]*60+s.a[1], b=s.b[0]*60+s.b[1], len=(b-a+1440)%1440, el=(t-a+1440)%1440;
    if(el<len) return {s:s, el:el, len:len, frac:el/len, left:len-el};
  }
  return null;
}

/* 5) Toast */
function toast(msg){
  var t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._h); t._h=setTimeout(function(){ t.classList.remove('show'); },1800);
}

/* 6) Copiar texto com fallback (clipboard API exige contexto seguro) */
function copyText(txt){
  return new Promise(function(res){
    function fb(){ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); var ok=false; try{ ok=document.execCommand('copy'); }catch(e){} ta.remove(); res(ok); }
    try{ if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(txt).then(function(){res(true);},fb); } else fb(); }catch(e){ fb(); }
  });
}

/* 7) Download de arquivo (CSV com BOM para acentos no Excel, JSON etc.) */
function download(blob,name){
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
}
function downloadCSV(rows,name){
  var csv=rows.map(function(r){ return r.map(function(c){ return '"'+String(c==null?'':c).replace(/"/g,'""')+'"'; }).join(';'); }).join('\r\n');
  download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),name);
}

/* 8) Tema (lembra escolha; padrão segue o Windows) */
function initTheme(btnId){
  var t=store.get('aw_theme');
  if(!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  if(t==='light') document.documentElement.dataset.theme='light';
  var b=document.getElementById(btnId||'themeBtn');
  if(b) b.onclick=function(){ var r=document.documentElement, l=r.dataset.theme!=='light'; r.dataset.theme=l?'light':''; store.set('aw_theme',l?'light':'dark'); };
}

/* 9) Modo captura (tela limpa para print/WhatsApp) */
function enterCapture(onChange){
  document.body.classList.add('capture');
  try{ var r=document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if(r&&r.catch) r.catch(function(){}); }catch(e){}
  if(onChange) setTimeout(onChange,80);
  toast('Modo captura · Esc para sair');
}
function exitCapture(onChange){ document.body.classList.remove('capture'); if(onChange) setTimeout(onChange,50); }

/* 10) Ícones (mesmo traço em todas as telas) — use: ic('nts') */
var ICON = {
  home:'<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
  nts:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  done:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
  sol:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  cfg:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  mo:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.5-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.5 3.5 5.5"/>',
  painel:'<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  heij:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  del:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  chev:'<path d="m9 6 6 6-6 6"/>', chevL:'<path d="m15 6-6 6 6 6"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  upload:'<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  whatsapp:'<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',
  capture:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>',
  print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1"/><path d="M6 14h12v7H6z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pay:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
function ic(n,style){ return '<svg viewBox="0 0 24 24"'+(style?' style="'+style+'"':'')+'>'+(ICON[n]||'')+'</svg>'; }
