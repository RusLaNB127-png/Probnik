/* ============================================================
   ВКЛАДКА «АНАЛИТИКА» — сводный BI по всей платформе.
   Считает всё из реальных данных: шахматка + клиенты + показы +
   задачи + история цен. Графики — инлайн-SVG, без библиотек.
   ============================================================ */

/* ---------- Фильтры ---------- */
function anF(){
  if(!state.analyticsFilters) state.analyticsFilters = { corp:'', mgr:'', source:'' };
  return state.analyticsFilters;
}
function anUnits(){
  let a = units(); const f = anF();
  if(f.corp) a = a.filter(u=>u.corp===f.corp);
  if(f.mgr)  a = a.filter(u=>u.managerId===f.mgr);
  return a;
}
function anClients(){
  let a = clients(); const f = anF();
  if(f.mgr)    a = a.filter(c=>c.mgr===f.mgr);
  if(f.source) a = a.filter(c=>c.source===f.source);
  return a;
}
function anShows(){
  const f = anF();
  return state.shows.filter(s=> !f.mgr || s.managerId===f.mgr);
}

/* ---------- Графики (SVG / HTML) ---------- */
function chDonut(segs, size=156, th=24){
  const total = segs.reduce((s,x)=>s+x.value,0) || 1;
  const r=(size-th)/2, C=2*Math.PI*r; let acc=0;
  const arcs = segs.filter(s=>s.value>0).map(s=>{
    const len = s.value/total*C;
    const el = `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${th}"
      stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"
      transform="rotate(-90 ${size/2} ${size/2})"/>`;
    acc += len; return el;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--sand)" stroke-width="${th}"/>${arcs}</svg>`;
}
function chBars(items, opt){
  opt = opt || {};
  const max = Math.max(1, ...items.map(i=>i.value));
  return `<div class="an-bars">`+items.map(i=>`
    <div class="an-bar"><div class="an-bar-top"><span>${escapeHtml(i.label)}</span><b>${i.display!=null?i.display:i.value}${opt.unit||''}</b></div>
      <div class="an-bar-track"><div class="an-bar-fill" style="width:${i.value/max*100}%;background:${i.color||'var(--terra)'}"></div></div>
    </div>`).join('')+`</div>`;
}
function chFunnel(rows){
  const max = Math.max(1, rows.length?rows[0].value:1);
  return `<div class="an-funnel">`+rows.map((r,i)=>{
    const w = Math.max(8, r.value/max*100);
    const conv = i>0 && rows[i-1].value ? Math.round(r.value/rows[i-1].value*100) : null;
    return `<div class="an-funnel-row">
      <div class="an-funnel-bar" style="width:${w}%"><span>${escapeHtml(r.label)}</span><b>${r.value}</b></div>
      <span class="an-funnel-conv">${conv!=null?conv+'%':''}</span></div>`;
  }).join('')+`</div>`;
}
function chLine(points, opt){
  opt = opt || {}; const w=opt.w||600, h=opt.h||210, pad=opt.pad||40, color=opt.color||'var(--terra)';
  if(points.length<2) return `<div class="an-empty">Недостаточно данных для графика</div>`;
  const ys = points.map(p=>p.y), minY=Math.min(...ys), maxY=Math.max(...ys), rng=(maxY-minY)||1;
  const X = i => pad + i*(w-pad-14)/(points.length-1);
  const Y = v => h-pad - (v-minY)/rng*(h-2*pad);
  const line = points.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${X(points.length-1).toFixed(1)} ${h-pad} L${X(0).toFixed(1)} ${h-pad} Z`;
  const dots = points.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.2" fill="${color}"/>`).join('');
  const xlab = points.map((p,i)=>`<text x="${X(i).toFixed(1)}" y="${h-pad+16}" font-size="10.5" fill="var(--brown-soft)" text-anchor="middle">${p.label}</text>`).join('');
  const fmt = opt.fmt || (v=>v);
  const grid = [0,0.5,1].map(t=>{ const v=minY+rng*t, y=Y(v); return `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${w-14}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="4" y="${(y+3).toFixed(1)}" font-size="10" fill="var(--brown-soft)">${fmt(Math.round(v))}</text>`; }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" class="an-line">
    ${grid}<path d="${area}" fill="${color}" opacity="0.09"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${xlab}</svg>`;
}

/* ---------- Тепловая карта продаж ---------- */
function anHeatColor(ratio){
  const a=[240,232,216], b=[157,52,19];      // светлый песок → терракота
  const c=a.map((x,i)=>Math.round(x+(b[i]-x)*ratio));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function renderHeatmap(host){
  const us = anUnits();
  const bld = BUILDINGS[state.building];
  const corps = bld.corps.filter(c=> !anF().corp || c===anF().corp);
  const maxFloor = Math.max(1, ...us.map(u=>u.floor));
  const floors = []; for(let f=maxFloor; f>=1; f--) floors.push(f);

  const head = `<tr><th class="an-heat-corner"></th>${corps.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const body = floors.map(fl=>{
    const cells = corps.map(c=>{
      const cu = us.filter(u=>u.corp===c && u.floor===fl);
      if(!cu.length) return `<td class="an-heat-empty"></td>`;
      const sold = cu.filter(u=>u.status==='sold'||u.status==='contract').length;
      const ratio = sold/cu.length;
      const pct = Math.round(ratio*100);
      return `<td class="an-heat-cell" style="background:${anHeatColor(ratio)};color:${ratio>0.5?'#fff':'#5C534B'}"
        title="${c} · ${fl} эт.: продано ${sold} из ${cu.length}">${pct}%</td>`;
    }).join('');
    return `<tr><th class="an-heat-fl">${fl} эт.</th>${cells}</tr>`;
  }).join('');

  host.innerHTML = `
    <div class="an-heat-wrap"><table class="an-heat"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <div class="an-heat-legend">
      <span>Зависает</span>
      <span class="an-heat-scale"></span>
      <span>Продано</span>
      <span class="an-heat-note">Доля проданных и в договоре по этажу/корпусу</span>
    </div>`;
}

/* ---------- Агрегации ---------- */
function anPriceSeries(us){
  const map = {};
  us.forEach(u=> ensurePriceHistory(u).forEach(p=>{ const k=p.date.slice(0,7); (map[k]=map[k]||[]).push(p.pricePerM); }));
  return Object.keys(map).sort().map(k=>({
    label: k.slice(5)+'.'+k.slice(2,4),
    y: Math.round(map[k].reduce((a,b)=>a+b,0)/map[k].length),
  }));
}

/* ---------- Рендер вкладки ---------- */
function renderAnalytics(){
  const view = document.getElementById('view-analytics');
  if(!view) return;
  const f = anF();
  const us = anUnits(), cls = anClients();
  const money = v => Math.round(v).toLocaleString('ru-RU');

  // Фильтры
  const bld = BUILDINGS[state.building];
  document.getElementById('anFilters').innerHTML = `
    <div class="field"><label>Корпус</label><select id="anCorp"><option value="">Все корпуса</option>
      ${bld.corps.map(c=>`<option value="${c}" ${f.corp===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Менеджер</label><select id="anMgr"><option value="">Все менеджеры</option>
      ${MANAGERS.map(m=>`<option value="${m.id}" ${f.mgr===m.id?'selected':''}>${m.name}</option>`).join('')}</select></div>
    <div class="field"><label>Источник лида</label><select id="anSource"><option value="">Все источники</option>
      ${SOURCE_OPTIONS.map(s=>`<option value="${s}" ${f.source===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <button class="btn btn-sm" id="anReset">Сбросить</button>`;

  // ---- KPI ----
  const soldLike = us.filter(u=>u.status==='sold'||u.status==='contract');
  const revenue = soldLike.reduce((s,u)=>s+(+u.total||0),0);
  const avgCheck = soldLike.length ? revenue/soldLike.length : 0;
  const avgPriceM = us.length ? Math.round(us.reduce((s,u)=>s+(+u.pricePerM||0),0)/us.length) : 0;
  const finalStages = ['Договор','Оплата','Сделка закрыта'];
  const deals = cls.filter(c=>finalStages.includes(c.stage)).length;
  const conv = cls.length ? Math.round(deals/cls.length*100) : 0;
  document.getElementById('anKpi').innerHTML = `
    ${kpi('Выручка', money(revenue)+' млн ₽', 'up', soldLike.length+' сделок')}
    ${kpi('Средний чек', (Math.round(avgCheck*10)/10).toLocaleString('ru-RU')+' млн ₽', 'up', 'по закрытым')}
    ${kpi('Средняя цена м²', money(avgPriceM)+' тыс ₽', 'up', us.length+' помещений')}
    ${kpi('Конверсия в сделку', conv+'%', conv>=20?'up':'down', deals+' из '+cls.length+' лидов')}`;

  // ---- Продажи и остатки ----
  const byStatus = STATUS_ORDER.map(s=>({ label:STATUSES[s].label, value:us.filter(u=>u.status===s).length, color:STATUSES[s].color }));
  const legend = byStatus.filter(s=>s.value>0).map(s=>`<div class="an-leg"><span style="background:${s.color}"></span>${s.label} <b>${s.value}</b></div>`).join('');
  document.getElementById('anStatus').innerHTML =
    `<div class="an-donut-wrap"><div class="an-donut">${chDonut(byStatus)}<div class="an-donut-c"><b>${us.length}</b><span>всего</span></div></div><div class="an-legend">${legend}</div></div>`;

  const salesByCorp = bld.corps.map(c=>{
    const cu = us.filter(u=>u.corp===c && (u.status==='sold'||u.status==='contract'));
    return { label:c, value: Math.round(cu.reduce((s,u)=>s+(+u.total||0),0)), display: Math.round(cu.reduce((s,u)=>s+(+u.total||0),0)) };
  });
  document.getElementById('anSalesCorp').innerHTML = chBars(salesByCorp, { unit:' млн', color:'var(--terra)' });

  const freeByCorp = bld.corps.map(c=>{
    const fu = us.filter(u=>u.corp===c && u.status==='free');
    return { label:c, value:fu.length, display:fu.length+' · '+Math.round(fu.reduce((s,u)=>s+(+u.total||0),0))+' млн', color:'var(--st-free)' };
  });
  document.getElementById('anStock').innerHTML = chBars(freeByCorp);

  // ---- Тепловая карта ----
  renderHeatmap(document.getElementById('anHeat'));

  // ---- Воронка + источники ----
  const funnelRows = STAGES.map(st=>({ label:st, value: cls.filter(c=>STAGES.indexOf(c.stage) >= STAGES.indexOf(st)).length }));
  document.getElementById('anFunnel2').innerHTML = chFunnel(funnelRows);

  const bySource = SOURCE_OPTIONS.map(src=>{
    const leads = clients().filter(c=>c.source===src && (!f.mgr || c.mgr===f.mgr));
    const d = leads.filter(c=>finalStages.includes(c.stage)).length;
    return { label:src, value:leads.length, display:leads.length+(d?` · ${d} сдел.`:''), color:'var(--sea)' };
  }).filter(s=>s.value>0).sort((a,b)=>b.value-a.value);
  document.getElementById('anSources').innerHTML = bySource.length ? chBars(bySource) : `<div class="an-empty">Нет лидов под фильтр</div>`;

  // ---- Менеджеры (лидерборд) ----
  const rows = MANAGERS.map(m=>{
    const mu = units().filter(u=>u.managerId===m.id && (!f.corp || u.corp===f.corp));
    const sl = mu.filter(u=>u.status==='sold'||u.status==='contract');
    const mc = clients().filter(c=>c.mgr===m.id);
    const md = mc.filter(c=>finalStages.includes(c.stage)).length;
    const ms = state.shows.filter(s=>s.managerId===m.id).length;
    const st = (typeof taskStats==='function') ? taskStats(m.id) : { done:0, total:0 };
    return { m, rev: Math.round(sl.reduce((s,u)=>s+(+u.total||0),0)), deals:sl.length,
             clients:mc.length, shows:ms, conv: mc.length?Math.round(md/mc.length*100):0,
             tasks: st.done+'/'+st.total };
  }).sort((a,b)=>b.rev-a.rev);
  const maxRev = Math.max(1, ...rows.map(r=>r.rev));
  document.getElementById('anLeaders').innerHTML = `
    <table class="tbl an-lead-tbl">
      <thead><tr><th>#</th><th>Менеджер</th><th>Выручка</th><th>Сделок</th><th>Клиентов</th><th>Показов</th><th>Конв.</th><th>Задачи</th><th></th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td><b>${escapeHtml(r.m.name)}</b></td>
        <td><b style="color:var(--terra-dark)">${r.rev} млн</b></td>
        <td>${r.deals}</td><td>${r.clients}</td><td>${r.shows}</td>
        <td>${r.conv}%</td><td>${r.tasks}</td>
        <td style="min-width:120px"><div class="an-mini-track"><div class="an-mini-fill" style="width:${r.rev/maxRev*100}%"></div></div></td>
      </tr>`).join('')}</tbody>
    </table>`;

  // ---- Динамика цен ----
  document.getElementById('anPriceLine').innerHTML =
    chLine(anPriceSeries(us), { color:'var(--terra)', fmt:v=>v+'т' });

  const byFloor = {};
  us.forEach(u=>{ (byFloor[u.floor]=byFloor[u.floor]||[]).push(+u.pricePerM||0); });
  const floors = Object.keys(byFloor).map(Number).sort((a,b)=>a-b)
    .map(fl=>({ label:fl+' эт.', value: Math.round(byFloor[fl].reduce((a,b)=>a+b,0)/byFloor[fl].length), color:'var(--sea)' }));
  document.getElementById('anPriceFloor').innerHTML = chBars(floors, { unit:' т', color:'var(--sea)' });

  // Динамика по конкретной квартире
  if(!state.analyticsUnit || !us.find(u=>u.id===state.analyticsUnit)) state.analyticsUnit = us.length?us[0].id:'';
  document.getElementById('anUnitSel').innerHTML = us.slice().sort((a,b)=>a.displayNum.localeCompare(b.displayNum,'ru',{numeric:true}))
    .map(u=>`<option value="${u.id}" ${u.id===state.analyticsUnit?'selected':''}>${u.displayNum} · ${u.corp} · ${u.area} м²</option>`).join('');
  const selU = us.find(u=>u.id===state.analyticsUnit);
  document.getElementById('anUnitLine').innerHTML = selU
    ? chLine(ensurePriceHistory(selU).map(p=>({ label:p.date.slice(5,7)+'.'+p.date.slice(2,4), y:p.pricePerM })), { color:'var(--terra-dark)', fmt:v=>v+'т' })
    : `<div class="an-empty">Нет помещений под фильтр</div>`;

  wireAnalytics();
}

function wireAnalytics(){
  const f = anF();
  const bind = (id, key)=>{ const el=document.getElementById(id); if(el) el.onchange=()=>{ f[key]=el.value; renderAnalytics(); }; };
  bind('anCorp','corp'); bind('anMgr','mgr'); bind('anSource','source');
  const reset = document.getElementById('anReset');
  if(reset) reset.onclick = ()=>{ state.analyticsFilters={corp:'',mgr:'',source:''}; renderAnalytics(); };
  const usel = document.getElementById('anUnitSel');
  if(usel) usel.onchange = ()=>{ state.analyticsUnit = usel.value; renderAnalytics(); };
  const exp = document.getElementById('anExport');
  if(exp) exp.onclick = exportAnalyticsExcel;
  const pr = document.getElementById('anPrint');
  if(pr) pr.onclick = printAnalytics;
}
function printAnalytics(){
  document.body.classList.add('printing-analytics');
  const cleanup = ()=>{ document.body.classList.remove('printing-analytics'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 1500);
  window.print();
}

/* ---------- Выгрузка сводки в Excel ---------- */
function exportAnalyticsExcel(){
  const us = anUnits(), cls = anClients();
  const finalStages = ['Договор','Оплата','Сделка закрыта'];
  const rows = [['Показатель','Значение']];
  const soldLike = us.filter(u=>u.status==='sold'||u.status==='contract');
  rows.push(['Выручка, млн ₽', Math.round(soldLike.reduce((s,u)=>s+(+u.total||0),0))]);
  rows.push(['Сделок (договор+продано)', soldLike.length]);
  rows.push(['Средняя цена м², тыс ₽', us.length?Math.round(us.reduce((s,u)=>s+(+u.pricePerM||0),0)/us.length):0]);
  rows.push(['Лидов', cls.length]);
  rows.push(['Конверсия в сделку, %', cls.length?Math.round(cls.filter(c=>finalStages.includes(c.stage)).length/cls.length*100):0]);
  rows.push([]);
  rows.push(['Статус','Кол-во помещений']);
  STATUS_ORDER.forEach(s=>rows.push([STATUSES[s].label, us.filter(u=>u.status===s).length]));
  rows.push([]);
  rows.push(['Менеджер','Выручка, млн','Сделок','Клиентов','Показов','Конверсия, %']);
  MANAGERS.forEach(m=>{
    const sl = units().filter(u=>u.managerId===m.id && (u.status==='sold'||u.status==='contract'));
    const mc = clients().filter(c=>c.mgr===m.id);
    const md = mc.filter(c=>finalStages.includes(c.stage)).length;
    rows.push([m.name, Math.round(sl.reduce((s,u)=>s+(+u.total||0),0)), sl.length, mc.length,
      state.shows.filter(s=>s.managerId===m.id).length, mc.length?Math.round(md/mc.length*100):0]);
  });
  downloadBlob(buildXlsx('Аналитика', rows), 'Аналитика ' + BUILDINGS[state.building].short + '.xlsx');
  toast('Сводка выгружена');
}
