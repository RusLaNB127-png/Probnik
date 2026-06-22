/* ============================================================
   ВКЛАДКА «ШАХМАТКА» + БОКОВАЯ ПАНЕЛЬ + АДМИН-РЕЖИМ
   ============================================================ */

function buildLegend(){
  document.getElementById('legend').innerHTML = STATUS_ORDER.map(s=>
    `<span class="item"><span class="dot" style="background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span>`).join('');
}

function buildFilters(){
  const b = state.buildingConfig;
  const all = units();
  const floors = [...new Set(all.map(u=>u.floor))].sort((a,c)=>c-a);
  document.getElementById('fCorp').innerHTML = `<option value="">Все корпуса</option>`+b.corps.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('fFloor').innerHTML = `<option value="">Все этажи</option>`+floors.map(f=>`<option value="${f}">${f} этаж</option>`).join('');
  document.getElementById('fStatus').innerHTML = `<option value="">Все статусы</option>`+STATUS_ORDER.map(s=>`<option value="${s}">${STATUSES[s].label}</option>`).join('');
  document.getElementById('fManager').innerHTML = `<option value="">Все менеджеры</option>`+MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  ['fCorp','fFloor','fStatus','fManager','fPriceMin','fPriceMax','fAreaMin','fAreaMax','fQuery'].forEach(id=>{
    const el = document.getElementById(id);
    if(el && el.tagName==='INPUT') el.value='';
  });
  document.getElementById('fFavorites').checked = false;
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
  if(f.favoritesOnly && !state.favorites.has(u.id)) return false;
  if(f.query){
    const q = f.query.toLowerCase();
    const client = getClient(u.clientId);
    const hit = u.displayNum.toLowerCase().includes(q)
             || (client && client.name.toLowerCase().includes(q))
             || (''+u.area).includes(q);
    if(!hit) return false;
  }
  return true;
}

function renderChess(){
  const b = state.buildingConfig;
  document.getElementById('chessTitle').textContent = 'Шахматка · '+b.name;
  const grid = document.getElementById('chessGrid');
  grid.classList.toggle('admin', state.adminMode);

  const all = units();
  let html = '';
  b.corps.forEach(corp=>{
    if(state.filters.corp && state.filters.corp!==corp) return;
    html += `<div class="chess-corp-title">${corp}</div>`;
    const floors = [...new Set(all.filter(u=>u.corp===corp).map(u=>u.floor))].sort((a,c)=>c-a);
    floors.forEach(f=>{
      const rowUnits = all
        .filter(u=>u.corp===corp && u.floor===f)
        .sort((a,c)=>a.position-c.position);
      html += `<div class="chess-row"><div class="floor-label">${f} эт.</div><div class="cells">`;
      rowUnits.forEach(u=>{
        const visible = passFilter(u);
        const fav = state.favorites.has(u.id) ? '<span class="fav-star">★</span>' : '';
        const adminBtn = state.adminMode ? '<span class="admin-edit" data-edit="'+u.id+'" title="Редактировать">✎</span>' : '';
        html += `<div class="cell ${visible?'':'dim'} ${u.id===state.selectedUnitId?'sel':''}"
                    style="background:${STATUSES[u.status].color}" data-id="${u.id}" title="${u.displayNum} · ${STATUSES[u.status].label}">
                   ${fav}
                   <span class="num">${u.displayNum}</span><span class="area">${u.area} м²</span>
                   ${adminBtn}
                 </div>`;
      });
      html += `</div></div>`;
    });
  });
  grid.innerHTML = html;

  grid.querySelectorAll('.cell:not(.dim)').forEach(c=>{
    c.addEventListener('click', e=>{
      if(e.target.closest('.admin-edit')){
        e.stopPropagation();
        openUnitForm(e.target.closest('.admin-edit').dataset.edit);
        return;
      }
      openPanel(c.dataset.id);
    });
  });
}

function renderAside(){
  const all = units().filter(passFilter);
  const counts = {}; STATUS_ORDER.forEach(s=>counts[s]=0);
  all.forEach(u=>counts[u.status]++);
  const total = all.length;
  const favCount = all.filter(u=>state.favorites.has(u.id)).length;
  const todayShows = showsOnDate(isoDate(TODAY)).length;
  const weekShows = state.shows.filter(s=>{
    const d = new Date(s.date+'T00:00:00');
    const diff = (d - TODAY) / 86400000;
    return diff >= -1 && diff < 7;
  }).length;

  document.getElementById('chessAside').innerHTML = `
    <div class="mini-card">
      <h4>Сводка по объекту</h4>
      ${STATUS_ORDER.map(s=>`<div class="mini-stat"><span style="display:flex;align-items:center;gap:7px;"><span class="dot" style="width:11px;height:11px;border-radius:3px;background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span><b>${counts[s]}</b></div>`).join('')}
      <div class="mini-stat" style="border-top:1px solid var(--line);margin-top:4px;padding-top:9px;"><span>Всего помещений</span><b>${total}</b></div>
      <div class="mini-stat"><span>★ Избранных</span><b>${favCount}</b></div>
    </div>
    <div class="mini-card">
      <h4>Активность показов</h4>
      <div class="mini-stat"><span>Показов сегодня</span><b style="color:var(--terra-dark)">${todayShows}</b></div>
      <div class="mini-stat"><span>Показов на неделю</span><b>${weekShows}</b></div>
      <button class="btn btn-sm" style="margin-top:10px; width:100%;" onclick="openCalendar()">Открыть календарь</button>
    </div>`;
}

function bindFilters(){
  const map = {fCorp:'corp',fFloor:'floor',fStatus:'status',fManager:'manager',fPriceMin:'priceMin',fPriceMax:'priceMax',fAreaMin:'areaMin',fAreaMax:'areaMax',fQuery:'query'};
  Object.entries(map).forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      state.filters[key]=el.value; renderChess(); renderAside();
    });
  });
  document.getElementById('fFavorites').addEventListener('change', e=>{
    state.filters.favoritesOnly = e.target.checked;
    renderChess(); renderAside();
  });
  document.getElementById('fReset').onclick=()=>{
    state.filters = {corp:'',floor:'',status:'',manager:'',priceMin:'',priceMax:'',areaMin:'',areaMax:'',favoritesOnly:false,query:''};
    buildFilters(); renderChess(); renderAside();
  };
}

/* ============================================================
   БОКОВАЯ ПАНЕЛЬ ОБЪЕКТА
   ============================================================ */
function openPanel(id){
  const u = getUnit(id);
  if(!u) return;
  state.selectedUnitId = id;
  renderChess();
  const st = STATUSES[u.status];
  const client = getClient(u.clientId);
  const isFav = state.favorites.has(id);

  const unitShows = state.shows
    .filter(s=>s.unitId===id && s.status!=='cancelled')
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  document.getElementById('panel').innerHTML = `
    <div class="panel-head">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--brown-soft);">${u.kind} · ${u.corp}</div>
        <h3 style="font-size:24px;margin-top:3px;">${u.displayNum}</h3>
        <div style="margin-top:9px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <span class="status-pill" style="background:${st.color}"><span class="dot"></span>${st.label}</span>
          <button class="fav-toggle ${isFav?'on':''}" id="favBtn">${isFav?'★ В избранном':'☆ В избранное'}</button>
        </div>
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
      ${ client ? `<div class="person-row">
            <div class="avatar">${client.name.split(' ').map(w=>w[0]).join('')}</div>
            <div class="meta"><b>${client.name}</b><span>${client.phone} · ${client.stage}</span></div>
            <button class="go-link" data-go-client="${client.id}">→ Карточка</button>
         </div>`
        : `<div class="person-row" style="color:var(--brown-soft)"><div class="avatar" style="background:var(--line-soft)">—</div><div class="meta"><b>Клиент не закреплён</b><span>Помещение без активной сделки</span></div></div>` }

      <div class="panel-section-title">Назначенные показы (${unitShows.length})</div>
      ${ unitShows.length
          ? unitShows.map(s=>{
              const c = getClient(s.clientId);
              const ss = SHOW_STATUSES[s.status];
              return `<div class="person-row" style="border-left:3px solid ${ss.color}">
                <div style="font-family:'Fraunces',serif; font-size:15px; font-weight:600; min-width:74px;">${s.time}</div>
                <div class="meta">
                  <b>${c ? c.name : 'Клиент'}</b>
                  <span>${fmtDateRu(s.date)} · ${mgrName(s.managerId)} · ${ss.label}</span>
                </div>
                <button class="go-link" data-go-show="${s.id}">→ В календарь</button>
              </div>`;
            }).join('')
          : `<div style="color:var(--brown-soft); font-size:13px; padding:6px 2px;">Показы не назначены</div>` }
      <button class="btn btn-sm" style="margin-top:9px;" onclick="openShowFormForUnit('${u.id}')">＋ Назначить показ</button>

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
      ${ state.adminMode
          ? `<button class="btn" data-act="edit">✎ Редактировать</button>`
          : `<button class="btn" data-act="status">Изменить статус</button>` }
    </div>`;

  document.getElementById('panel').classList.add('show');
  document.getElementById('scrim').classList.add('show');
  document.getElementById('panelClose').onclick = closePanel;

  document.getElementById('favBtn').onclick = ()=>{
    toggleFavorite(id);
    openPanel(id); renderChess(); renderAside();
    toast(state.favorites.has(id) ? u.displayNum+' в избранном' : 'Удалено из избранного');
  };

  document.getElementById('statusSwitcher').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    updateUnit(id, { status: btn.dataset.st });
    openPanel(id); renderAside(); renderChess();
    toast(u.displayNum+' → '+STATUSES[btn.dataset.st].label);
  });

  document.querySelectorAll('[data-go-client]').forEach(b=>b.onclick=()=>{
    goClient(b.dataset.goClient);
    closePanel();
  });
  document.querySelectorAll('[data-go-show]').forEach(b=>b.onclick=()=>{
    closePanel();
    openCalendarOnShow(b.dataset.goShow);
  });

  document.querySelectorAll('.panel-actions [data-act]').forEach(btn=>btn.onclick=()=>{
    const a = btn.dataset.act;
    if(a==='book'){ updateUnit(id,{status:'booked'}); openPanel(id); renderAside(); renderChess(); toast(u.displayNum+' забронировано'); }
    else if(a==='show'){ openShowFormForUnit(id); }
    else if(a==='deal'){ updateUnit(id,{status:'contract'}); openPanel(id); renderAside(); renderChess(); toast('Сделка создана по '+u.displayNum); }
    else if(a==='status'){ document.getElementById('statusSwitcher').scrollIntoView({behavior:'smooth',block:'center'}); }
    else if(a==='edit'){ closePanel(); openUnitForm(id); }
  });
}

function closePanel(){
  document.getElementById('panel').classList.remove('show');
  document.getElementById('scrim').classList.remove('show');
  state.selectedUnitId = null; renderChess();
}

/* ============================================================
   АДМИН-ПАНЕЛЬ
   ============================================================ */
function renderAdminPanel(){
  const panel = document.getElementById('adminPanel');
  if(!state.adminMode){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const cfg = state.buildingConfig;
  panel.innerHTML = `
    <div class="admin-panel-head">
      <h4>⚙ Управление структурой здания <span class="badge-admin">Админ</span></h4>
      <button class="btn btn-sm" id="adminAddCorp">＋ Добавить корпус</button>
    </div>
    <div class="admin-panel-corps">
      ${cfg.corps.map(corp=>{
        const corpUnits = units().filter(u=>u.corp===corp);
        return `<div class="admin-corp">
          <div class="admin-corp-name">${corp} · ${corpUnits.length} помещений</div>
          <div class="admin-stepper">
            <span class="lbl">Этажей</span>
            <span class="ctrl">
              <button data-corp="${corp}" data-act="floor-dec">−</button>
              <span class="val">${cfg.floors}</span>
              <button data-corp="${corp}" data-act="floor-inc">＋</button>
            </span>
          </div>
          <div class="admin-stepper">
            <span class="lbl">Помещений на этаже</span>
            <span class="ctrl">
              <button data-corp="${corp}" data-act="pf-dec">−</button>
              <span class="val">${cfg.perFloor}</span>
              <button data-corp="${corp}" data-act="pf-inc">＋</button>
            </span>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="admin-panel-foot">
      <button class="btn btn-sm" id="adminResetData" style="color:var(--terra-dark);">Сбросить все данные к дефолту</button>
      <span style="font-size:12px; color:var(--brown-soft); align-self:center;">
        Параметры этажности и количества помещений применяются ко всем корпусам объекта.
      </span>
    </div>
  `;

  panel.querySelectorAll('[data-act]').forEach(btn=>btn.onclick = ()=>{
    const corp = btn.dataset.corp;
    const a = btn.dataset.act;
    if(a==='floor-inc'){ setFloors(corp, cfg.floors+1); toast('Добавлен этаж'); }
    else if(a==='floor-dec'){
      if(cfg.floors<=1){ toast('Минимум 1 этаж'); return; }
      if(!confirm('Удалить верхний этаж со всеми помещениями?')) return;
      setFloors(corp, cfg.floors-1); toast('Этаж удалён');
    }
    else if(a==='pf-inc'){ setPerFloor(corp, cfg.perFloor+1); toast('Добавлено помещение в ряд'); }
    else if(a==='pf-dec'){
      if(cfg.perFloor<=1){ toast('Минимум 1 помещение в ряду'); return; }
      if(!confirm('Удалить крайнее помещение на каждом этаже?')) return;
      setPerFloor(corp, cfg.perFloor-1); toast('Помещения удалены');
    }
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
  });

  document.getElementById('adminAddCorp').onclick = ()=>{
    const name = prompt('Название нового корпуса:');
    if(!name) return;
    addCorp(name);
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
    toast('Корпус «'+name+'» добавлен');
  };

  document.getElementById('adminResetData').onclick = ()=>{
    if(!confirm('Сбросить все данные шахматки к исходному состоянию? Это удалит все ваши изменения.')) return;
    resetToDefaults();
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
    toast('Данные сброшены');
  };
}

function toggleAdminMode(){
  state.adminMode = !state.adminMode;
  document.getElementById('adminToggle').classList.toggle('admin-on', state.adminMode);
  renderAdminPanel();
  renderChess();
  toast(state.adminMode ? 'Режим администратора включён' : 'Режим продаж');
}

/* ============================================================
   ФОРМА РЕДАКТИРОВАНИЯ ПОМЕЩЕНИЯ
   ============================================================ */
function openUnitForm(id){
  const u = getUnit(id);
  if(!u) return;
  const cfg = state.buildingConfig;

  document.getElementById('unitFormId').value = id;
  document.getElementById('unitFormSub').textContent = u.kind+' · '+u.corp+' · '+u.floor+' этаж';
  document.getElementById('unitFormNum').value   = u.displayNum;
  document.getElementById('unitFormKind').value  = u.kind;
  document.getElementById('unitFormCorp').innerHTML = cfg.corps.map(c=>`<option ${c===u.corp?'selected':''}>${c}</option>`).join('');
  document.getElementById('unitFormFloor').value = u.floor;
  document.getElementById('unitFormArea').value  = u.area;
  document.getElementById('unitFormPrice').value = u.pricePerM;
  document.getElementById('unitFormStatus').innerHTML = STATUS_ORDER.map(s=>`<option value="${s}" ${s===u.status?'selected':''}>${STATUSES[s].label}</option>`).join('');
  document.getElementById('unitFormManager').innerHTML = MANAGERS.map(m=>`<option value="${m.id}" ${m.id===u.managerId?'selected':''}>${m.name}</option>`).join('');
  document.getElementById('unitFormModal').classList.add('show');
}

function closeUnitForm(){ document.getElementById('unitFormModal').classList.remove('show'); }

function initUnitForm(){
  document.getElementById('unitFormClose').onclick = closeUnitForm;
  document.getElementById('unitCancel').onclick    = closeUnitForm;
  document.getElementById('unitDelete').onclick    = ()=>{
    const id = document.getElementById('unitFormId').value;
    const u = getUnit(id);
    if(!u) return;
    if(!confirm('Удалить помещение '+u.displayNum+'?')) return;
    deleteUnit(id);
    closeUnitForm(); renderChess(); renderAside();
    toast('Помещение удалено');
  };
  document.getElementById('unitForm').onsubmit = e=>{
    e.preventDefault();
    const id = document.getElementById('unitFormId').value;
    const area  = parseFloat(document.getElementById('unitFormArea').value);
    const price = parseFloat(document.getElementById('unitFormPrice').value);
    updateUnit(id, {
      displayNum: document.getElementById('unitFormNum').value.trim(),
      kind:       document.getElementById('unitFormKind').value.trim(),
      corp:       document.getElementById('unitFormCorp').value,
      floor:      parseInt(document.getElementById('unitFormFloor').value, 10),
      area, pricePerM: price,
      total:      Math.round(area*price/1000*10)/10,
      status:     document.getElementById('unitFormStatus').value,
      managerId:  document.getElementById('unitFormManager').value,
    });
    closeUnitForm(); renderChess(); renderAside();
    toast('Изменения сохранены');
  };
}
