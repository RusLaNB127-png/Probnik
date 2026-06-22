/* ============================================================
   ВКЛАДКА «ДАШБОРД РОП»
   ============================================================ */

function renderDashboard(){
  document.getElementById('dashSub').textContent = 'Управленческая сводка · '+BUILDINGS[state.building].name+' · июнь 2026';
  const fact = DASH.managers.reduce((s,m)=>s+m.fact,0);
  const pct = Math.round(fact/DASH.plan*100);
  const booksTotal = DASH.managers.reduce((s,m)=>s+m.books,0);

  // KPI
  document.getElementById('dashKpi').innerHTML = `
    ${kpi('План продаж', DASH.plan+' млн ₽','up','цель месяца')}
    ${kpi('Факт продаж', fact+' млн ₽', pct>=90?'up':'down', pct+'% плана')}
    ${kpi('Количество броней', booksTotal, 'up','+3 за неделю')}
    ${kpi('Просроченные задачи', DASH.overdue, 'down','требуют внимания')}`;

  // Кольцо плана
  const r=54, circ=2*Math.PI*r, off=circ*(1-Math.min(pct,100)/100);
  document.getElementById('planRing').innerHTML = `
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--sand)" stroke-width="12"/>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--terra)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 64 64)"/>
    </svg>
    <div class="pct"><b>${pct}%</b><span>выполнено</span></div>`;
  document.getElementById('planMeta').innerHTML = `
    <div class="row"><span>План месяца</span><b>${DASH.plan} млн ₽</b></div>
    <div class="row"><span>Факт</span><b style="color:var(--terra-dark)">${fact} млн ₽</b></div>
    <div class="row"><span>Осталось</span><b>${DASH.plan-fact} млн ₽</b></div>
    <div class="row"><span>Прогноз закрытия</span><b style="color:var(--st-free)">${Math.round(fact*1.18)} млн ₽</b></div>`;

  // Продажи по менеджерам
  const max = Math.max(...DASH.managers.map(m=>m.fact), ...DASH.managers.map(m=>m.plan));
  document.getElementById('dashMgrChart').innerHTML = DASH.managers.map(m=>`
    <div class="hbar"><div class="top"><span>${m.name}</span><b>${m.fact} / ${m.plan} млн ₽</b></div>
    <div class="track" style="background:var(--sand);position:relative;">
      <div style="position:absolute;left:${m.plan/max*100}%;top:-3px;height:16px;width:2px;background:var(--brown);opacity:.4;"></div>
      <div class="fill" style="width:${m.fact/max*100}%"></div></div></div>`).join('');

  // Горячие клиенты
  document.getElementById('hotClients').innerHTML = DASH.hot.map(([n,o,chip,p])=>`
    <div class="hot-item"><div class="avatar">${n.split(' ').map(w=>w[0]).join('')}</div>
      <div class="meta"><b>${n}</b><span>${o}</span></div>
      <span class="chip ${chip}">${p}</span></div>`).join('');

  // Проблемные сделки
  document.getElementById('problemDeals').innerHTML = DASH.problems.map(([n,d,tag])=>`
    <div class="problem-item"><div class="ic" style="width:30px;height:30px;border-radius:8px;background:#FBE3D3;color:var(--terra-dark);display:grid;place-items:center;">!</div>
      <div class="meta"><b>${n}</b><span>${d}</span></div>
      <span class="chip warn">${tag}</span></div>`).join('');

  // Таблица + рейтинг
  const maxFact = Math.max(...DASH.managers.map(m=>m.fact));
  document.getElementById('mgrTable').innerHTML = `
    <thead><tr><th>#</th><th>Менеджер</th><th>План/Факт</th><th>Продажи</th><th>Брони</th><th>Конв.</th><th>Рейтинг</th></tr></thead>
    <tbody>${DASH.managers.map((m,i)=>{
      const rc = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      return `<tr><td><span class="rank ${rc}">${i+1}</span></td>
        <td><b>${m.name}</b></td>
        <td>${m.plan}/${m.fact}</td>
        <td><span class="tbl-bar" style="width:${m.fact/maxFact*70}px"></span> ${m.fact} млн</td>
        <td>${m.books}</td><td>${m.conv}%</td>
        <td><span class="chip ${m.rating>=4.5?'ok':m.rating>=4?'warn':'hot'}">★ ${m.rating}</span></td></tr>`;
    }).join('')}</tbody>`;

  // Прогноз выручки
  document.getElementById('forecast').innerHTML = `
    <div style="text-align:center;padding:8px 0 14px;">
      <div style="font-family:'Fraunces',serif;font-size:34px;color:var(--terra-dark);line-height:1;">${Math.round(fact*1.18)} млн ₽</div>
      <div style="font-size:12px;color:var(--brown-soft);margin-top:6px;">прогноз на конец месяца</div>
    </div>
    <div class="hbar"><div class="top"><span>Подтверждённые сделки</span><b>${fact} млн</b></div><div class="track"><div class="fill" style="width:${fact/(fact*1.18)*100}%"></div></div></div>
    <div class="hbar"><div class="top"><span>В работе (вероятные)</span><b>+${Math.round(fact*0.18)} млн</b></div><div class="track"><div class="fill" style="width:18%;background:var(--st-booked)"></div></div></div>`;

  // План-факт по объектам
  const pfMax = Math.max(...DASH.planFact.flatMap(p=>[p[1],p[2]]));
  document.getElementById('planFactObjects').innerHTML = DASH.planFact.map(([n,pl,fa])=>`
    <div class="hbar"><div class="top"><span>${n}</span><b>${fa}/${pl} млн ₽ · ${Math.round(fa/pl*100)}%</b></div>
    <div class="track" style="position:relative;"><div style="position:absolute;left:${pl/pfMax*100}%;top:-3px;height:16px;width:2px;background:var(--brown);opacity:.4;"></div>
    <div class="fill" style="width:${fa/pfMax*100}%"></div></div></div>`).join('');

  // Журнал действий
  const ICONS = {book:'⌂',show:'👁',deal:'✎',note:'✉',call:'☎',lead:'＋'};
  document.getElementById('actionLog').innerHTML = DASH.log.map(([t,who,act,ic])=>`
    <div class="log-item"><div class="ic">${ICONS[ic]||'•'}</div>
      <div style="flex:1;"><div><b>${who}</b> ${act}</div></div>
      <div class="tm">${t}</div></div>`).join('');

  // AI рекомендации
  document.getElementById('aiRecs').innerHTML = DASH.aiRecs.map(([t,d])=>`
    <div style="background:rgba(255,255,255,.55);border:1px solid #E8CBAE;border-radius:11px;padding:15px;">
      <b style="font-family:'Fraunces',serif;font-size:14.5px;color:var(--terra-dark);display:block;margin-bottom:7px;">${t}</b>
      <p style="margin:0;font-size:12.5px;line-height:1.55;color:var(--brown);">${d}</p>
    </div>`).join('');
}
