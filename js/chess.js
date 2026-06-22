/* ============================================================
   ВКЛАДКА «ШАХМАТКА» + БОКОВАЯ ПАНЕЛЬ ОБЪЕКТА
   ============================================================ */

function buildLegend(){
  document.getElementById('legend').innerHTML = STATUS_ORDER.map(s=>
    `<span class="item"><span class="dot" style="background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span>`).join('');
}

function buildFilters(){
  const b = BUILDINGS[state.building];
  const all = units();
  const floors = [...new Set(all.map(u=>u.floor))].sort((a,c)=>c-a);
  document.getElementById('fCorp').innerHTML = `<option value="">Все корпуса</option>`+b.corps.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('fFloor').innerHTML = `<option value="">Все этажи</option>`+floors.map(f=>`<option value="${f}">${f} этаж</option>`).join('');
  document.getElementById('fStatus').innerHTML = `<option value="">Все статусы</option>`+STATUS_ORDER.map(s=>`<option value="${s}">${STATUSES[s].label}</option>`).join('');
  document.getElementById('fManager').innerHTML = `<option value="">Все менеджеры</option>`+MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  ['fCorp','fFloor','fStatus','fManager','fPriceMin','fPriceMax','fAreaMin','fAreaMax'].forEach(id=>{
    if(document.getElementById(id).tagName==='INPUT') document.getElementById(id).value='';
  });
}

function passFilter(u){
  const f = state.filters;
  if(f.corp && u.corp!==f.corp) return false;
  if(f.floor && u.floor!=f.floor) return false;
  if(f.status && u.status!==f.status) return false;
  if(f.manager && u.managerId!==f.manager) return false;
  if(f.priceMin && u.pricePerM < +f.priceMin) return false;
  if(f.priceMax && u.pricePerM > +f.priceMax) return false;
  if(f.areaMin && u.area < +f.areaMin) return false;
  if(f.areaMax && u.area > +f.areaMax) return false;
  return true;
}

function renderChess(){
  const b = BUILDINGS[state.building];
  const all = units();
  document.getElementById('chessTitle').textContent = 'Шахматка · '+b.name;
  const grid = document.getElementById('chessGrid');
  let html = '';
  b.corps.forEach(corp=>{
    if(state.filters.corp && state.filters.corp!==corp) return;
    html += `<div class="chess-corp-title">${corp}</div>`;
    const floors = [...new Set(all.filter(u=>u.corp===corp).map(u=>u.floor))].sort((a,c)=>c-a);
    floors.forEach(f=>{
      const rowUnits = all.filter(u=>u.corp===corp && u.floor===f);
      html += `<div class="chess-row"><div class="floor-label">${f} эт.</div><div class="cells">`;
      rowUnits.forEach(u=>{
        const visible = passFilter(u);
        html += `<div class="cell ${visible?'':'dim'} ${u.id===state.selectedUnitId?'sel':''}"
                    style="background:${STATUSES[u.status].color}" data-id="${u.id}" title="${u.displayNum} · ${STATUSES[u.status].label}">
                   <span class="num">${u.displayNum}</span><span class="area">${u.area} м²</span></div>`;
      });
      html += `</div></div>`;
    });
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.cell:not(.dim)').forEach(c=>c.onclick=()=>openPanel(c.dataset.id));
}

function renderAside(){
  const all = units().filter(passFilter);
  const counts = {}; STATUS_ORDER.forEach(s=>counts[s]=0);
  all.forEach(u=>counts[u.status]++);
  const total = all.length;
  const soldSum = all.filter(u=>u.status==='sold').reduce((s,u)=>s+u.total,0);
  const bookSum = all.filter(u=>u.status==='booked').reduce((s,u)=>s+u.total,0);
  document.getElementById('chessAside').innerHTML = `
    <div class="mini-card">
      <h4>Сводка по объекту</h4>
      ${STATUS_ORDER.map(s=>`<div class="mini-stat"><span style="display:flex;align-items:center;gap:7px;"><span class="dot" style="width:11px;height:11px;border-radius:3px;background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span><b>${counts[s]}</b></div>`).join('')}
      <div class="mini-stat" style="border-top:1px solid var(--line);margin-top:4px;padding-top:9px;"><span>Всего помещений</span><b>${total}</b></div>
    </div>
    <div class="mini-card">
      <h4>Финансы (видимые)</h4>
      <div class="mini-stat"><span>Сумма продаж</span><b style="color:var(--st-sold)">${fmtMoney(soldSum)}</b></div>
      <div class="mini-stat"><span>Сумма броней</span><b style="color:var(--st-booked)">${fmtMoney(bookSum)}</b></div>
      <div class="mini-stat"><span>Доступно к продаже</span><b>${counts.free}</b></div>
    </div>`;
}

function bindFilters(){
  const map = {fCorp:'corp',fFloor:'floor',fStatus:'status',fManager:'manager',fPriceMin:'priceMin',fPriceMax:'priceMax',fAreaMin:'areaMin',fAreaMax:'areaMax'};
  Object.entries(map).forEach(([id,key])=>{
    const el = document.getElementById(id);
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ state.filters[key]=el.value; renderChess(); renderAside(); });
  });
  document.getElementById('fReset').onclick=()=>{
    state.filters = {corp:'',floor:'',status:'',manager:'',priceMin:'',priceMax:'',areaMin:'',areaMax:''};
    buildFilters(); renderChess(); renderAside();
  };
}

/* ---------- Боковая панель объекта ---------- */
function openPanel(id){
  const u = units().find(x=>x.id===id);
  if(!u) return;
  state.selectedUnitId = id;
  renderChess();
  const st = STATUSES[u.status];
  document.getElementById('panel').innerHTML = `
    <div class="panel-head">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--brown-soft);">${u.kind} · ${u.corp}</div>
        <h3 style="font-size:24px;margin-top:3px;">${u.displayNum}</h3>
        <div style="margin-top:9px;"><span class="status-pill" style="background:${st.color}"><span class="dot"></span>${st.label}</span></div>
      </div>
      <button class="close" id="panelClose">✕</button>
    </div>
    <div class="panel-body">
      <div class="kv">
        <div><div class="k">Этаж</div><div class="v">${u.floor}</div></div>
        <div><div class="k">Площадь</div><div class="v">${u.area} м²</div></div>
        <div><div class="k">Цена за м²</div><div class="v">${u.pricePerM} тыс. ₽</div></div>
        <div><div class="k">Общая стоимость</div><div class="v" style="color:var(--terra-dark)">${fmtMoney(u.total)}</div></div>
      </div>

      <div class="panel-section-title">Закреплённый менеджер</div>
      <div class="person-row">
        <div class="avatar">${mgrShort(u.managerId)}</div>
        <div class="meta"><b>${mgrName(u.managerId)}</b><span>Менеджер отдела продаж</span></div>
      </div>

      <div class="panel-section-title">Клиент</div>
      ${ u.client ? `<div class="person-row">
            <div class="avatar">${u.client.split(' ').map(w=>w[0]).join('')}</div>
            <div class="meta"><b>${u.client}</b><span>Связан с помещением</span></div>
            <button class="btn btn-sm">Открыть</button>
         </div>`
        : `<div class="person-row" style="color:var(--brown-soft)"><div class="avatar" style="background:var(--line-soft)">—</div><div class="meta"><b>Клиент не закреплён</b><span>Помещение без активной сделки</span></div></div>` }

      <div class="panel-section-title">Сменить статус</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;" id="statusSwitcher">
        ${STATUS_ORDER.map(s=>`<button class="btn btn-sm" data-st="${s}" style="${s===u.status?'border-color:var(--terra);color:var(--terra);':''}">
            <span style="width:9px;height:9px;border-radius:3px;background:${STATUSES[s].color};display:inline-block;"></span>${STATUSES[s].label}</button>`).join('')}
      </div>
    </div>
    <div class="panel-actions">
      <button class="btn btn-primary" data-act="book">Забронировать</button>
      <button class="btn" data-act="show">Назначить показ</button>
      <button class="btn" data-act="deal">Создать сделку</button>
      <button class="btn" data-act="status">Изменить статус</button>
    </div>`;

  document.getElementById('panel').classList.add('show');
  document.getElementById('scrim').classList.add('show');
  document.getElementById('panelClose').onclick = closePanel;

  document.getElementById('statusSwitcher').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    u.status = btn.dataset.st;
    openPanel(id); renderAside(); toast(u.displayNum+' → '+STATUSES[u.status].label);
  });
  document.querySelectorAll('.panel-actions [data-act]').forEach(btn=>btn.onclick=()=>{
    const a = btn.dataset.act;
    if(a==='book'){ u.status='booked'; openPanel(id); renderAside(); toast(u.displayNum+' забронировано'); }
    else if(a==='show'){ u.status='show'; openPanel(id); renderAside(); toast('Показ назначен · '+u.displayNum); }
    else if(a==='deal'){ u.status='contract'; openPanel(id); renderAside(); toast('Сделка создана по '+u.displayNum); }
    else if(a==='status'){ document.getElementById('statusSwitcher').scrollIntoView({behavior:'smooth',block:'center'}); }
  });
}

function closePanel(){
  document.getElementById('panel').classList.remove('show');
  document.getElementById('scrim').classList.remove('show');
  state.selectedUnitId = null; renderChess();
}
