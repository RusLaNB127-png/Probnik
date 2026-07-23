/* ============================================================
   ВКЛАДКА «ПРОФИЛЬ КЛИЕНТА»
   Центр работы с клиентом: помещения, показы, сделки,
   задачи, документы, история. Все поля редактируемые,
   все кнопки рабочие.
   ============================================================ */

function stageColor(stage){
  const i = STAGES.indexOf(stage);
  return `hsl(${18 + i*4}, ${40+i*3}%, ${62-i*3}%)`;
}

// ---------- Фильтрация списка ----------
function filteredClients(){
  const f = state.clientFilters;
  let arr = clients().slice();
  // Права: менеджер видит только своих клиентов
  if(typeof can==='function' && !can('allClients') && typeof role==='function' && role()==='manager'){
    arr = arr.filter(c => c.mgr === currentUserId());
  }
  if(f.query){
    const q = f.query.toLowerCase();
    arr = arr.filter(c =>
      (c.name||'').toLowerCase().includes(q) ||
      (c.phone||'').replace(/\s/g,'').includes(q.replace(/\s/g,'')) ||
      (c.email||'').toLowerCase().includes(q)
    );
  }
  if(f.mgr)      arr = arr.filter(c => c.mgr === f.mgr);
  if(f.stage)    arr = arr.filter(c => c.stage === f.stage);
  if(f.source)   arr = arr.filter(c => c.source === f.source);
  if(f.priority) arr = arr.filter(c => c.priority === f.priority);
  return arr;
}

// ---------- Список клиентов ----------
function renderClientList(){
  const list = filteredClients();
  // Если активный клиент не входит в видимый список — переключаемся на первого
  if(list.length && !list.some(c=>c.id===state.activeClientId)){
    state.activeClientId = list[0].id;
    if(typeof renderClientCard==='function') renderClientCard();
  }
  document.getElementById('clientCount').textContent = list.length+' из '+clients().length;
  const el = document.getElementById('clientList');
  if(!list.length){
    el.innerHTML = `<div class="client-list-empty">Никого не найдено по фильтру</div>`;
    return;
  }
  el.innerHTML = list.map(c=>{
    const p = PRIORITIES[c.priority] || PRIORITIES.medium;
    return `<div class="client-item ${c.id===state.activeClientId?'active':''}" data-id="${c.id}">
      <div class="avatar">${initials(c.name)}</div>
      <div class="meta">
        <b>${c.name}</b>
        <span>${c.stage} · ${mgrShort(c.mgr)}${c.targetObject?' · '+c.targetObject:''}</span>
      </div>
      <span class="priority-dot" style="background:${p.color}" title="Приоритет: ${p.label}"></span>
    </div>`;
  }).join('');
  el.querySelectorAll('.client-item').forEach(item=>item.onclick=()=>{
    state.activeClientId = item.dataset.id;
    state.clientCardTab = 'overview';
    renderClientList(); renderClientCard();
  });
}

function initials(name){
  if(!name) return '—';
  return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

// ---------- Фильтры списка ----------
function initClientFilters(){
  const mgrSel = document.getElementById('clFilterMgr');
  mgrSel.innerHTML = '<option value="">Все менеджеры</option>'+
    MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('clFilterStage').innerHTML =
    '<option value="">Все этапы воронки</option>'+STAGES.map(s=>`<option value="${s}">${s}</option>`).join('');
  document.getElementById('clFilterSource').innerHTML =
    '<option value="">Все источники</option>'+SOURCE_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('');
  document.getElementById('clFilterPriority').innerHTML =
    '<option value="">Любой приоритет</option>'+PRIORITY_ORDER.map(p=>`<option value="${p}">${PRIORITIES[p].label}</option>`).join('');

  const map = { clFilterQuery:'query', clFilterMgr:'mgr', clFilterStage:'stage', clFilterSource:'source', clFilterPriority:'priority' };
  Object.entries(map).forEach(([id,key])=>{
    const el = document.getElementById(id);
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      state.clientFilters[key] = el.value;
      renderClientList();
    });
  });
  document.getElementById('clFilterReset').onclick = ()=>{
    state.clientFilters = { query:'', mgr:'', stage:'', source:'', priority:'' };
    document.getElementById('clFilterQuery').value = '';
    ['clFilterMgr','clFilterStage','clFilterSource','clFilterPriority'].forEach(id=>document.getElementById(id).value='');
    renderClientList();
  };
}

// ---------- Карточка клиента ----------
function renderClientCard(){
  const c = getClient(state.activeClientId);
  const cardEl = document.getElementById('clientCard');
  if(!c){
    cardEl.innerHTML = `<div class="client-card" style="padding:40px; text-align:center; color:var(--brown-soft);">
      Выберите клиента из списка или создайте нового.
    </div>`;
    return;
  }
  const p = PRIORITIES[c.priority] || PRIORITIES.medium;

  const segs = unitsForClient(c.id);
  const tasksOpen = (c.tasks||[]).filter(t=>!t.done).length;
  const docs = (c.documents||[]).length;
  const showsCount = state.shows.filter(s=>s.clientId===c.id).length;
  const interactionsCount = (c.interactions||[]).length;
  const unitsTotal = segs.owned.length + segs.booked.length + segs.shown.length + segs.favorite.length;

  cardEl.innerHTML = `
    <div class="client-card">
      <!-- Шапка -->
      <div class="cc-head">
        <div class="avatar">${initials(c.name)}</div>
        <div class="cc-head-main">
          <h3>${c.name}
            <span class="priority-tag" style="background:${p.color}22; color:${p.color};"><span class="pdot" style="background:${p.color}"></span>${p.label} приоритет</span>
          </h3>
          <div class="sub">${c.phone||'—'}${c.email?' · '+c.email:''} · ${c.city||'—'} · источник: ${c.source}</div>
        </div>
        <div class="cc-head-actions">
          <span class="stage-tag" style="background:var(--terra); color:#fff; padding:6px 12px; font-size:12px;">${c.stage}</span>
          <button class="btn btn-sm" id="ccAssignShow" class="ic-inline">${icon('plus',14)} Назначить показ</button>
          <button class="btn btn-sm" id="ccEdit" class="ic-inline">${icon('edit',14)} Редактировать</button>
        </div>
      </div>

      <!-- Внутренние вкладки -->
      <div class="cc-tabs">
        <button class="cc-tab ${state.clientCardTab==='overview'?'active':''}" data-tab="overview">Обзор</button>
        <button class="cc-tab ${state.clientCardTab==='units'?'active':''}" data-tab="units">Помещения <span class="cc-tab-count">${unitsTotal}</span></button>
        <button class="cc-tab ${state.clientCardTab==='shows'?'active':''}" data-tab="shows">Показы <span class="cc-tab-count">${showsCount}</span></button>
        <button class="cc-tab ${state.clientCardTab==='tasks'?'active':''}" data-tab="tasks">Задачи <span class="cc-tab-count">${tasksOpen}</span></button>
        <button class="cc-tab ${state.clientCardTab==='docs'?'active':''}" data-tab="docs">Документы <span class="cc-tab-count">${docs}</span></button>
        <button class="cc-tab ${state.clientCardTab==='timeline'?'active':''}" data-tab="timeline">История <span class="cc-tab-count">${interactionsCount}</span></button>
      </div>

      <!-- Контент вкладок -->
      <div class="cc-pane" id="ccPane"></div>
    </div>`;

  // Привязка табов
  cardEl.querySelectorAll('.cc-tab').forEach(t=>t.onclick = ()=>{
    state.clientCardTab = t.dataset.tab;
    renderClientCard();
  });

  // Кнопки шапки
  document.getElementById('ccEdit').onclick       = ()=>openClientForm(c.id);
  document.getElementById('ccAssignShow').onclick = ()=>{
    openShowForm(null);
    document.getElementById('showClient').value  = c.id;
    document.getElementById('showManager').value = c.mgr;
  };

  // Рендер контента вкладки
  const pane = document.getElementById('ccPane');
  if(state.clientCardTab==='overview') renderTabOverview(pane, c);
  else if(state.clientCardTab==='units') renderTabUnits(pane, c, segs);
  else if(state.clientCardTab==='shows') renderTabShows(pane, c);
  else if(state.clientCardTab==='tasks') renderTabTasks(pane, c);
  else if(state.clientCardTab==='docs') renderTabDocs(pane, c);
  else if(state.clientCardTab==='timeline') renderTabTimeline(pane, c);
}

/* ============================================================
   ВКЛАДКА: ОБЗОР (только просмотр; редактирование — через кнопку ✎)
   ============================================================ */
function renderTabOverview(pane, c){
  const priorityLabel = (PRIORITIES[c.priority]||{}).label || '—';

  pane.innerHTML = `
    <div class="cc-block-title">Основная информация</div>
    <div class="cc-fields">
      <div class="cc-field"><span class="k">ФИО</span><div class="v ro">${esc(c.name)||'—'}</div></div>
      <div class="cc-field"><span class="k">Дата рождения</span><div class="v ro">${c.dob?fmtDateRu(c.dob):'—'}</div></div>
      <div class="cc-field"><span class="k">Город</span><div class="v ro">${esc(c.city)||'—'}</div></div>
      <div class="cc-field"><span class="k">Телефон</span><div class="v ro">${esc(c.phone)||'—'}</div></div>
      <div class="cc-field"><span class="k">Доп. телефон</span><div class="v ro">${esc(c.phone2)||'—'}</div></div>
      <div class="cc-field"><span class="k">E-mail</span><div class="v ro">${esc(c.email)||'—'}</div></div>
      <div class="cc-field"><span class="k">Гражданство</span><div class="v ro">${esc(c.citizenship)||'—'}</div></div>
    </div>

    <div class="cc-block-title">Информация о покупке</div>
    <div class="cc-fields">
      <div class="cc-field"><span class="k">Бюджет</span><div class="v ro">${esc(c.budget)||'—'}</div></div>
      <div class="cc-field"><span class="k">Цель покупки</span><div class="v ro">${esc(c.goal)||'—'}</div></div>
      <div class="cc-field"><span class="k">Тип помещения</span><div class="v ro">${esc(c.propertyKind)||'—'}</div></div>
      <div class="cc-field cc-field-2"><span class="k">Интересующий объект</span><div class="v ro">${esc(c.targetObject)||'—'}</div></div>
      <div class="cc-field"><span class="k">Желаемая площадь</span><div class="v ro">${esc(c.areaPref)||'—'}</div></div>
      <div class="cc-field"><span class="k">Предпочтительный этаж</span><div class="v ro">${esc(c.floorPref)||'—'}</div></div>
      <div class="cc-field"><span class="k">Предпочтительный вид</span><div class="v ro">${esc(c.viewPref)||'—'}</div></div>
    </div>

    <div class="cc-block-title">Работа отдела продаж</div>
    <div class="cc-fields">
      <div class="cc-field"><span class="k">Источник лида</span><div class="v ro">${esc(c.source)||'—'}</div></div>
      <div class="cc-field"><span class="k">Ответственный менеджер</span><div class="v ro">${esc(mgrName(c.mgr))}</div></div>
      <div class="cc-field"><span class="k">Стадия воронки</span><div class="v ro">${esc(c.stage)||'—'}</div></div>
      <div class="cc-field"><span class="k">Приоритет клиента</span><div class="v ro">${esc(priorityLabel)}</div></div>
      <div class="cc-field"><span class="k">Дата следующего контакта</span><div class="v ro">${c.nextContact?fmtDateRu(c.nextContact):'—'}</div></div>
    </div>

    <div class="cc-block-title">Заметки и пожелания</div>
    <div class="cc-fields">
      <div class="cc-field cc-field-full"><span class="k">Комментарий менеджера</span><div class="v ro multi">${esc(c.note)||'—'}</div></div>
      <div class="cc-field cc-field-full"><span class="k">Пожелания клиента</span><div class="v ro multi">${esc(c.wishes)||'—'}</div></div>
      <div class="cc-field cc-field-full"><span class="k">Возражения клиента</span><div class="v ro multi">${esc(c.objections)||'—'}</div></div>
      <div class="cc-field cc-field-full"><span class="k">Причины отказа (если есть)</span><div class="v ro multi">${esc(c.refusalReason)||'—'}</div></div>
    </div>

    <div class="cc-block-title">Контактные лица <button class="btn btn-sm" id="ccAddContact" style="margin-left:auto;">＋ Добавить</button></div>
    <div id="ccContacts">${renderContacts(c)}</div>

    <div class="cc-block-title">История смены менеджеров</div>
    <div>${renderMgrHistory(c)}</div>

    <div style="margin-top:24px; display:flex; gap:10px; padding-top:16px; border-top:1px dashed var(--line);">
      <button class="btn" id="ccComment" class="ic-inline">${icon('plus',14)} Добавить комментарий в историю</button>
      <button class="btn" id="ccCall" class="ic-inline">${icon('phone',14)} Зафиксировать звонок</button>
      <button class="btn" style="color:var(--terra-dark); border-color:var(--terra-dark); margin-left:auto;" id="ccDelete">Удалить клиента</button>
    </div>
  `;

  document.getElementById('ccAddContact').onclick = ()=>openContactForm(c.id);
  document.querySelectorAll('[data-contact-del]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить контактное лицо?')) return;
    deleteContact(c.id, b.dataset.contactDel);
    renderClientCard();
    toast('Контакт удалён');
  });

  document.getElementById('ccComment').onclick = ()=>{
    const text = prompt('Комментарий менеджера:');
    if(!text) return;
    logInteraction(c.id, 'comment', text);
    renderClientCard();
    toast('Комментарий добавлен');
  };
  document.getElementById('ccCall').onclick = ()=>{
    const text = prompt('Описание звонка (тема, длительность, итоги):');
    if(!text) return;
    logInteraction(c.id, 'call', text);
    renderClientCard();
    toast('Звонок зафиксирован');
  };
  document.getElementById('ccDelete').onclick = ()=>{
    if(!confirm(`Удалить клиента ${c.name}? Связанные показы и привязки будут удалены.`)) return;
    deleteClient(c.id);
    state.activeClientId = (clients()[0]||{}).id || null;
    renderClientList(); renderClientCard();
    toast('Клиент удалён');
  };
}

function renderContacts(c){
  const list = c.contacts || [];
  if(!list.length){
    return `<div class="unit-empty">Контактные лица не добавлены</div>`;
  }
  return list.map(ct=>`
    <div class="contact-card">
      <div class="avatar">${initials(ct.name)}</div>
      <div class="ct-meta">
        <div class="ct-name">${esc(ct.name)} ${ct.role?'· <span style="color:var(--brown-soft); font-weight:400;">'+esc(ct.role)+'</span>':''}</div>
        <div class="ct-sub">${esc(ct.phone)||'—'}${ct.email?' · '+esc(ct.email):''}</div>
      </div>
      <button class="btn btn-sm" data-contact-del="${ct.id}" style="color:var(--terra-dark);">Удалить</button>
    </div>
  `).join('');
}

function renderMgrHistory(c){
  const hist = c.managerHistory || [];
  if(!hist.length) return `<div class="unit-empty">История смены менеджеров пуста</div>`;
  return hist.slice().reverse().map((h, idx)=>{
    const m = MANAGERS.find(x=>x.id===h.managerId);
    const isCurrent = idx === 0 && h.to === null;
    return `<div class="mgr-history-row">
      <div class="avatar">${m?m.short:'—'}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600;">${m?m.name:'—'} ${isCurrent?'<span class="mh-current">сейчас</span>':''}</div>
        <div class="mh-period">${h.from || '—'} → ${h.to || 'настоящее время'}</div>
        ${h.reason?`<div class="mh-reason">«${esc(h.reason)}»</div>`:''}
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   ВКЛАДКА: ПОМЕЩЕНИЯ (просмотрено / избранное / бронь / куплено)
   ============================================================ */
function renderTabUnits(pane, c, segs){
  // активный сегмент в state — используем local, по умолчанию favorite
  if(!c._unitSeg) c._unitSeg = 'favorite';

  const seg = c._unitSeg;
  const segData = {
    shown:    { label:'Просмотрено', items:segs.shown    },
    favorite: { label:'Избранное',   items:segs.favorite },
    booked:   { label:'Бронь',       items:segs.booked   },
    owned:    { label:'Куплено',     items:segs.owned    },
  };

  pane.innerHTML = `
    <div class="unit-segments">
      ${Object.entries(segData).map(([k,v])=>`
        <button class="unit-segment ${seg===k?'active':''}" data-seg="${k}">
          <div class="seg-label">${v.label}</div>
          <div class="seg-value">${v.items.length}</div>
        </button>`).join('')}
    </div>

    <div style="display:flex; align-items:center; margin-bottom:12px; gap:10px;">
      <div class="cc-block-title" style="margin:0;">${segData[seg].label} — ${segData[seg].items.length}</div>
      <button class="btn btn-sm" style="margin-left:auto;" id="addToFavBtn" class="ic-inline">${icon('plus',14)} Добавить в избранное</button>
    </div>

    <div id="unitsList">${renderUnitsList(segData[seg].items, c, seg)}</div>
  `;

  pane.querySelectorAll('.unit-segment').forEach(b=>b.onclick = ()=>{
    c._unitSeg = b.dataset.seg;
    renderClientCard();
  });

  document.getElementById('addToFavBtn').onclick = ()=>openPickUnit(c.id);

  pane.querySelectorAll('[data-go-unit]').forEach(b=>b.onclick=()=>{
    goUnit(b.dataset.goUnit);
  });
  pane.querySelectorAll('[data-book-unit]').forEach(b=>b.onclick=()=>{
    const u = getUnit(b.dataset.bookUnit);
    if(!u) return;
    updateUnit(u.id, { status:'booked', clientId: c.id });
    logInteraction(c.id, 'booking', `Забронировано ${u.displayNum}`);
    renderClientCard();
    toast(`${u.displayNum} забронировано за клиентом`);
  });
  pane.querySelectorAll('[data-show-unit]').forEach(b=>b.onclick=()=>{
    const unitId = b.dataset.showUnit;
    openShowForm(null);
    document.getElementById('showClient').value  = c.id;
    document.getElementById('showUnit').value    = unitId;
    document.getElementById('showManager').value = c.mgr;
  });
  pane.querySelectorAll('[data-deal-unit]').forEach(b=>b.onclick=()=>{
    const u = getUnit(b.dataset.dealUnit);
    if(!u) return;
    if(!confirm(`Открыть сделку по ${u.displayNum}?`)) return;
    updateUnit(u.id, { status:'contract', clientId: c.id });
    updateClient(c.id, { stage:'Договор' });
    logInteraction(c.id, 'deal', `Открыта сделка по ${u.displayNum}`);
    renderClientList(); renderClientCard();
    toast(`Сделка открыта по ${u.displayNum}`);
  });
  pane.querySelectorAll('[data-unfav-unit]').forEach(b=>b.onclick=()=>{
    toggleClientFavorite(c.id, b.dataset.unfavUnit);
    renderClientCard();
    toast('Удалено из избранного');
  });
}

function renderUnitsList(items, c, seg){
  if(!items.length){
    return `<div class="unit-empty">Нет помещений в этом разделе</div>`;
  }
  return items.map(u=>{
    const st = STATUSES[u.status];
    const inFav = (c.favoriteUnitIds||[]).includes(u.id);
    return `<div class="unit-card-mini">
      <div class="ucm-status" style="background:${st.color}" title="${st.label}"></div>
      <div class="ucm-num">${u.displayNum}</div>
      <div class="ucm-meta">
        <b>${u.kind} · ${u.area} м² · ${u.floor} эт.</b>
        ${u.corp} · ${u.pricePerM} тыс. ₽/м² · ${fmtMoney(u.total)} · ${st.label}
      </div>
      <div class="ucm-actions">
        <button class="btn btn-sm" data-show-unit="${u.id}" class="ic-inline">${icon('plus',13)} Показ</button>
        ${u.status!=='booked' && u.status!=='sold' ? `<button class="btn btn-sm" data-book-unit="${u.id}">Бронь</button>` : ''}
        ${u.status==='booked' ? `<button class="btn btn-sm" data-deal-unit="${u.id}">Сделка</button>` : ''}
        <button class="btn btn-sm" data-go-unit="${u.id}">${icon('arrowRight',13)} В шахматке</button>
        ${seg==='favorite' && inFav ? `<button class="btn btn-sm" data-unfav-unit="${u.id}" style="color:var(--terra-dark);">${iconStar(true,13)} Убрать</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   ВКЛАДКА: ПОКАЗЫ
   ============================================================ */
function renderTabShows(pane, c){
  const list = state.shows
    .filter(s=>s.clientId===c.id)
    .sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));

  const upcoming = list.filter(s=>{
    if(s.status==='cancelled' || s.status==='completed') return false;
    return s.date >= isoDate(TODAY);
  });
  const nextShow = upcoming.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];

  pane.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <div class="cc-block-title" style="margin:0;">Показы клиента — ${list.length}</div>
      <button class="btn btn-sm btn-primary" style="margin-left:auto;" id="addShowBtn" class="ic-inline">${icon('plus',14)} Назначить показ</button>
    </div>

    ${nextShow ? `<div style="background:linear-gradient(135deg, var(--terra), var(--terra-dark)); color:#fff; border-radius:11px; padding:14px 16px; margin-bottom:16px;">
      <div class="ic-inline" style="font-size:11px; opacity:.85; text-transform:uppercase; letter-spacing:.05em;">${icon('clock',12)} Ближайший показ</div>
      <div style="font-family:Georgia,serif; font-size:18px; font-weight:600; margin-top:3px;">
        ${fmtDateRu(nextShow.date)} · ${nextShow.time}${getUnit(nextShow.unitId)?' · '+getUnit(nextShow.unitId).displayNum:''}
      </div>
      <div style="font-size:12.5px; opacity:.92; margin-top:3px;">${mgrName(nextShow.managerId)} · ${SHOW_STATUSES[nextShow.status].label}</div>
      ${nextShow.comment?`<div style="font-size:12.5px; opacity:.85; margin-top:4px; font-style:italic;">«${esc(nextShow.comment)}»</div>`:''}
    </div>`:''}

    ${list.length ? list.map(s=>{
      const u = getUnit(s.unitId);
      const ss = SHOW_STATUSES[s.status];
      return `<div class="unit-card-mini">
        <div class="ucm-status" style="background:${ss.color}" title="${ss.label}"></div>
        <div class="ucm-num" style="min-width:90px;">${s.time}</div>
        <div class="ucm-meta">
          <b>${fmtDateRu(s.date)} · ${ss.label}</b>
          ${u?u.displayNum+' · '+u.kind+' · '+u.corp:'Помещение не указано'} · ${mgrName(s.managerId)}
          ${s.comment?'<div style="font-style:italic; margin-top:3px;">«'+esc(s.comment)+'»</div>':''}
        </div>
        <div class="ucm-actions">
          <button class="btn btn-sm" data-show-edit="${s.id}" class="ic-inline">${icon('edit',13)} Изменить</button>
          ${u?`<button class="btn btn-sm" data-go-unit="${u.id}">${icon('arrowRight',13)} Помещение</button>`:''}
          <button class="btn btn-sm" data-show-cal="${s.id}">→ В календарь</button>
        </div>
      </div>`;
    }).join('') : `<div class="unit-empty">Показов не было</div>`}
  `;

  document.getElementById('addShowBtn').onclick = ()=>{
    openShowForm(null);
    document.getElementById('showClient').value  = c.id;
    document.getElementById('showManager').value = c.mgr;
  };
  pane.querySelectorAll('[data-show-edit]').forEach(b=>b.onclick=()=>openShowForm(b.dataset.showEdit));
  pane.querySelectorAll('[data-show-cal]').forEach(b=>b.onclick=()=>openCalendarOnShow(b.dataset.showCal));
  pane.querySelectorAll('[data-go-unit]').forEach(b=>b.onclick=()=>goUnit(b.dataset.goUnit));
}

/* ============================================================
   ВКЛАДКА: ЗАДАЧИ
   ============================================================ */
function renderTabTasks(pane, c){
  const tasks = (c.tasks||[]).slice().sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate||'').localeCompare(b.dueDate||'');
  });
  const todayIso = isoDate(TODAY);

  pane.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <div class="cc-block-title" style="margin:0;">Задачи — ${tasks.filter(t=>!t.done).length} активных</div>
      <button class="btn btn-sm btn-primary" style="margin-left:auto;" id="addTaskBtn" class="ic-inline">${icon('plus',14)} Создать задачу</button>
    </div>
    ${tasks.length ? tasks.map(t=>{
      const overdue = !t.done && t.dueDate && t.dueDate < todayIso;
      return `<div class="task-card ${t.done?'done':''} ${overdue?'overdue':''}">
        <input type="checkbox" data-task-toggle="${t.id}" ${t.done?'checked':''}>
        <div style="flex:1; min-width:0;">
          <div class="tk-title">${esc(t.title)}</div>
          <div class="tk-meta ${overdue?'overdue':''}">
            ${t.dueDate?'Срок: '+fmtDateRu(t.dueDate):''} · ${mgrName(t.assigneeId)}${overdue?' · ПРОСРОЧЕНО':''}
          </div>
        </div>
        <div class="tk-actions">
          <button data-task-edit="${t.id}" title="Изменить">${icon('edit',12)}</button>
          <button data-task-postpone="${t.id}" title="Перенести на завтра">${icon('arrowRight',12)}</button>
          <button data-task-del="${t.id}" title="Удалить">${icon('close',12)}</button>
        </div>
      </div>`;
    }).join('') : `<div class="unit-empty">Задач нет</div>`}
  `;

  document.getElementById('addTaskBtn').onclick = ()=>openTaskForm(c.id, null);
  pane.querySelectorAll('[data-task-toggle]').forEach(cb=>cb.onchange=()=>{
    updateTask(c.id, cb.dataset.taskToggle, { done: cb.checked });
    renderClientCard();
    toast(cb.checked ? 'Задача выполнена' : 'Задача восстановлена');
  });
  pane.querySelectorAll('[data-task-edit]').forEach(b=>b.onclick=()=>openTaskForm(c.id, b.dataset.taskEdit));
  pane.querySelectorAll('[data-task-postpone]').forEach(b=>b.onclick=()=>{
    const t = (c.tasks||[]).find(x=>x.id===b.dataset.taskPostpone);
    if(!t) return;
    const d = t.dueDate ? new Date(t.dueDate+'T00:00:00') : new Date(TODAY);
    d.setDate(d.getDate()+1);
    updateTask(c.id, t.id, { dueDate: isoDate(d) });
    renderClientCard();
    toast('Срок перенесён на следующий день');
  });
  pane.querySelectorAll('[data-task-del]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить задачу?')) return;
    deleteTask(c.id, b.dataset.taskDel);
    renderClientCard();
    toast('Задача удалена');
  });
}

/* ============================================================
   ВКЛАДКА: ДОКУМЕНТЫ
   ============================================================ */
function renderTabDocs(pane, c){
  const docs = c.documents || [];
  pane.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <div class="cc-block-title" style="margin:0;">Документы — ${docs.length}</div>
      <button class="btn btn-sm btn-primary" style="margin-left:auto;" id="addDocBtn" class="ic-inline">${icon('plus',14)} Прикрепить документ</button>
    </div>
    ${docs.length ? docs.map(d=>`
      <div class="doc-card">
        <div class="doc-ic">PDF</div>
        <div class="doc-meta">
          <div class="doc-name">${esc(d.name)}</div>
          <div class="doc-sub">${esc(d.type)} · ${d.addedAt} · ${esc(d.size)}</div>
        </div>
        <button data-doc-del="${d.id}">Удалить</button>
      </div>
    `).join('') : `<div class="unit-empty">Документы не загружены</div>`}
  `;

  document.getElementById('addDocBtn').onclick = ()=>openDocForm(c.id);
  pane.querySelectorAll('[data-doc-del]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить документ?')) return;
    deleteDocument(c.id, b.dataset.docDel);
    renderClientCard();
    toast('Документ удалён');
  });
}

/* ============================================================
   ВКЛАДКА: ИСТОРИЯ ВЗАИМОДЕЙСТВИЯ (timeline)
   ============================================================ */
function renderTabTimeline(pane, c){
  const events = (c.interactions||[]).slice().sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  pane.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <div class="cc-block-title" style="margin:0;">История взаимодействия — ${events.length} событий</div>
    </div>
    ${events.length ? `<div class="timeline">${events.map(ev=>{
      const t = INTERACTION_TYPES[ev.type] || { label:ev.type, icon:'•', color:'#7A6354' };
      return `<div class="tl-event">
        <div class="tl-time">${ev.at || ''}</div>
        <div class="tl-text"><span class="tl-type" style="background:${t.color}22; color:${t.color};">${icon(t.icon,13)} ${t.label}</span>${esc(ev.text)}</div>
      </div>`;
    }).join('')}</div>` : `<div class="unit-empty">История пуста</div>`}
  `;
}

/* ============================================================
   ФОРМА: СОЗДАНИЕ / РЕДАКТИРОВАНИЕ КЛИЕНТА
   Вспомогательные поля: бюджет в млн ₽, площадь в м²,
   этажи диапазоном, вид/тип/гражданство — селектами.
   ============================================================ */
const CITIZENSHIP_OPTIONS = ['РФ','Республика Беларусь','Казахстан','Армения','Узбекистан','Киргизия','Другое'];
const PROPKIND_OPTIONS    = ['Квартира','Апартамент','Пентхаус','Коммерческое помещение'];

// Достаём числа из сохранённой строки: «до 14 млн ₽» → [14], «50–70 м²» → [50,70]
function numsFrom(s){
  return (String(s||'').match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFloat(x.replace(',','.')));
}
// Заполняет селект; если текущее значение нестандартное — добавляет его, чтобы не потерять
function fillSelect(el, options, current, emptyLabel){
  const opts = [...options];
  if(current && !opts.includes(current)) opts.unshift(current);
  el.innerHTML = (emptyLabel ? `<option value="">${emptyLabel}</option>` : '')
    + opts.map(o=>`<option>${o}</option>`).join('');
  el.value = current || (emptyLabel ? '' : opts[0]);
}

function openClientForm(clientId){
  const isEdit = !!clientId;
  document.getElementById('clientFormTitle').textContent = isEdit ? 'Редактирование клиента' : 'Добавление клиента';
  document.getElementById('clientFormId').value = clientId || '';
  document.getElementById('clDelete').style.display = isEdit ? 'inline-flex' : 'none';

  document.getElementById('clGoal').innerHTML     = GOAL_OPTIONS.map(g=>`<option>${g}</option>`).join('');
  document.getElementById('clSource').innerHTML   = SOURCE_OPTIONS.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('clMgr').innerHTML      = MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('clStage').innerHTML    = STAGES.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('clPriority').innerHTML = PRIORITY_ORDER.map(p=>`<option value="${p}">${PRIORITIES[p].label}</option>`).join('');

  // Простые текстовые поля (структурные — ниже отдельно)
  const fields = ['name','dob','phone','phone2','email','city','goal','source','mgr','stage','priority','note','wishes','objections'];
  const c = isEdit ? getClient(clientId) : null;

  fields.forEach(f=>{
    const el = document.getElementById('cl'+f.charAt(0).toUpperCase()+f.slice(1));
    if(el) el.value = c ? (c[f] || '') : '';
  });
  document.getElementById('clTarget').value      = c ? (c.targetObject || '')  : '';
  document.getElementById('clRefusal').value     = c ? (c.refusalReason || '') : '';
  document.getElementById('clNextContact').value = c ? (c.nextContact || '')   : '';

  // — Вспомогательные поля с единицами —
  // Бюджет: число в млн ₽
  const [budgetM] = numsFrom(c && c.budget);
  document.getElementById('clBudget').value = budgetM != null ? budgetM : '';
  // Площадь: диапазон в м²
  const areaN = numsFrom(c && c.areaPref);
  document.getElementById('clAreaMin').value = areaN[0] != null ? areaN[0] : '';
  document.getElementById('clAreaMax').value = areaN[1] != null ? areaN[1] : (areaN.length===1 && /до/.test((c&&c.areaPref)||'') ? areaN[0] : '');
  if(areaN.length===1 && /до/.test((c&&c.areaPref)||'')) document.getElementById('clAreaMin').value = '';
  // Этажи: диапазон
  const flN = numsFrom(c && c.floorPref);
  document.getElementById('clFloorMin').value = flN[0] != null ? flN[0] : '';
  document.getElementById('clFloorMax').value = flN[1] != null ? flN[1] : '';
  // Селекты: гражданство, тип помещения, предпочтительный вид
  fillSelect(document.getElementById('clCitizenship'), CITIZENSHIP_OPTIONS, (c && c.citizenship) || 'РФ');
  fillSelect(document.getElementById('clPropKind'),    PROPKIND_OPTIONS,    (c && c.propertyKind) || '', '— не выбран —');
  fillSelect(document.getElementById('clViewPref'),
    VIEW_CATEGORIES.map(v=>v.label).concat('Не принципиально'),
    (c && c.viewPref) || '', '— не выбран —');

  if(!isEdit){
    document.getElementById('clGoal').value     = 'Проживание';
    document.getElementById('clSource').value   = 'Сайт';
    document.getElementById('clMgr').value      = MANAGERS[0].id;
    document.getElementById('clStage').value    = 'Новый лид';
    document.getElementById('clPriority').value = 'medium';
    document.getElementById('clTarget').value   = state.buildingConfig.name || '';
  }

  document.getElementById('clientFormModal').classList.add('show');
}

function closeClientForm(){ document.getElementById('clientFormModal').classList.remove('show'); }

function initClientForm(){
  document.getElementById('clientFormClose').onclick = closeClientForm;
  document.getElementById('clCancel').onclick        = closeClientForm;
  document.getElementById('clDelete').onclick        = ()=>{
    const id = document.getElementById('clientFormId').value;
    if(!id) return;
    const c = getClient(id);
    if(!confirm(`Удалить клиента ${c.name}?`)) return;
    deleteClient(id);
    state.activeClientId = (clients()[0]||{}).id || null;
    closeClientForm(); renderClientList(); renderClientCard();
    toast('Клиент удалён');
  };

  // Телефон: при фокусе на пустом поле подставляем «+7 »,
  // задвоенный префикс (автозаполнение поверх подстановки) схлопываем
  const normPhone = v=>{
    v = v.trim();
    while(/^\+7\s*\+7/.test(v)) v = v.replace(/^\+7\s*/, '');
    return v;
  };
  ['clPhone','clPhone2'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('focus', ()=>{ if(!el.value.trim()) el.value = '+7 '; });
    el.addEventListener('blur',  ()=>{
      if(el.value.trim()==='+7') el.value = '';
      else el.value = normPhone(el.value);
    });
  });

  document.getElementById('clientForm').onsubmit = e=>{
    e.preventDefault();

    // Собираем читаемые строки из структурных полей
    const budgetM  = document.getElementById('clBudget').value;
    const areaMin  = document.getElementById('clAreaMin').value;
    const areaMax  = document.getElementById('clAreaMax').value;
    const floorMin = document.getElementById('clFloorMin').value;
    const floorMax = document.getElementById('clFloorMax').value;
    const range = (min, max, unit)=>{
      if(min && max) return `${min}–${max}${unit}`;
      if(min) return `от ${min}${unit}`;
      if(max) return `до ${max}${unit}`;
      return '';
    };

    const data = {
      name:         document.getElementById('clName').value.trim(),
      dob:          document.getElementById('clDob').value,
      phone:        normPhone(document.getElementById('clPhone').value),
      phone2:       normPhone(document.getElementById('clPhone2').value),
      email:        document.getElementById('clEmail').value.trim(),
      city:         document.getElementById('clCity').value.trim(),
      citizenship:  document.getElementById('clCitizenship').value,
      budget:       budgetM ? `до ${budgetM} млн ₽` : '',
      goal:         document.getElementById('clGoal').value,
      targetObject: document.getElementById('clTarget').value.trim(),
      propertyKind: document.getElementById('clPropKind').value,
      areaPref:     range(areaMin, areaMax, ' м²'),
      floorPref:    range(floorMin, floorMax, ''),
      viewPref:     document.getElementById('clViewPref').value,
      source:       document.getElementById('clSource').value,
      mgr:          document.getElementById('clMgr').value,
      stage:        document.getElementById('clStage').value,
      priority:     document.getElementById('clPriority').value,
      nextContact:  document.getElementById('clNextContact').value,
      note:         document.getElementById('clNote').value.trim(),
      wishes:       document.getElementById('clWishes').value.trim(),
      objections:   document.getElementById('clObjections').value.trim(),
      refusalReason:document.getElementById('clRefusal').value.trim(),
    };
    if(!data.name){ toast('Укажите ФИО'); return; }
    if(!data.phone){ toast('Укажите телефон'); return; }

    const id = document.getElementById('clientFormId').value;
    if(id){
      updateClient(id, data);
      toast('Изменения сохранены');
    } else {
      const c = createClient(data);
      state.activeClientId = c.id;
      toast('Клиент добавлен');
    }
    closeClientForm(); renderClientList(); renderClientCard();
  };
}

/* ============================================================
   ФОРМА: ЗАДАЧА
   ============================================================ */
function openTaskForm(clientId, taskId){
  const c = getClient(clientId);
  if(!c) return;
  const isEdit = !!taskId;
  document.getElementById('taskFormTitle').textContent = isEdit ? 'Редактирование задачи' : 'Новая задача';
  document.getElementById('taskFormSub').textContent   = 'Клиент: '+c.name;
  document.getElementById('taskClientId').value        = clientId;
  document.getElementById('taskId').value              = taskId || '';
  document.getElementById('taskAssignee').innerHTML    = MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('taskDelete').style.display  = isEdit ? 'inline-flex' : 'none';

  if(isEdit){
    const t = (c.tasks||[]).find(x=>x.id===taskId);
    if(t){
      document.getElementById('taskTitle').value    = t.title;
      document.getElementById('taskAssignee').value = t.assigneeId;
      document.getElementById('taskDue').value      = t.dueDate;
    }
  } else {
    document.getElementById('taskTitle').value    = '';
    document.getElementById('taskAssignee').value = c.mgr;
    document.getElementById('taskDue').value      = isoDate(addDays(TODAY, 1));
  }
  document.getElementById('taskFormModal').classList.add('show');
}
function closeTaskForm(){ document.getElementById('taskFormModal').classList.remove('show'); }

function initTaskForm(){
  document.getElementById('taskFormClose').onclick = closeTaskForm;
  document.getElementById('taskCancel').onclick    = closeTaskForm;
  document.getElementById('taskDelete').onclick    = ()=>{
    const cid = document.getElementById('taskClientId').value;
    const tid = document.getElementById('taskId').value;
    if(!tid) return;
    if(!confirm('Удалить задачу?')) return;
    deleteTask(cid, tid);
    closeTaskForm(); renderClientCard();
    toast('Задача удалена');
  };
  document.getElementById('taskForm').onsubmit = e=>{
    e.preventDefault();
    const cid = document.getElementById('taskClientId').value;
    const tid = document.getElementById('taskId').value;
    const data = {
      title:      document.getElementById('taskTitle').value.trim(),
      assigneeId: document.getElementById('taskAssignee').value,
      dueDate:    document.getElementById('taskDue').value,
    };
    if(!data.title){ toast('Опишите задачу'); return; }
    if(tid){
      updateTask(cid, tid, data);
      toast('Задача обновлена');
    } else {
      createTask(cid, data);
      toast('Задача создана');
    }
    closeTaskForm(); renderClientCard();
  };
}

/* ============================================================
   ФОРМА: ДОКУМЕНТ
   ============================================================ */
function openDocForm(clientId){
  const c = getClient(clientId);
  if(!c) return;
  document.getElementById('docFormSub').textContent = 'Клиент: '+c.name;
  document.getElementById('docClientId').value      = clientId;
  document.getElementById('docFile').value = '';
  document.getElementById('docName').value = '';
  document.getElementById('docType').value = 'Договор';
  document.getElementById('docFormModal').classList.add('show');
}
function closeDocForm(){ document.getElementById('docFormModal').classList.remove('show'); }
function initDocForm(){
  document.getElementById('docFormClose').onclick = closeDocForm;
  document.getElementById('docCancel').onclick    = closeDocForm;
  document.getElementById('docFile').onchange = e=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!document.getElementById('docName').value) document.getElementById('docName').value = file.name;
  };
  document.getElementById('docForm').onsubmit = e=>{
    e.preventDefault();
    const file = document.getElementById('docFile').files[0];
    const cid = document.getElementById('docClientId').value;
    const name = document.getElementById('docName').value.trim() || (file ? file.name : 'document.pdf');
    const size = file ? formatBytes(file.size) : '—';
    addDocument(cid, {
      name,
      type: document.getElementById('docType').value,
      size,
    });
    closeDocForm(); renderClientCard();
    toast('Документ прикреплён');
  };
}
function formatBytes(b){
  if(b<1024) return b+' Б';
  if(b<1024*1024) return Math.round(b/1024)+' КБ';
  return (b/1024/1024).toFixed(1)+' МБ';
}

/* ============================================================
   ФОРМА: КОНТАКТНОЕ ЛИЦО
   ============================================================ */
function openContactForm(clientId){
  const c = getClient(clientId);
  if(!c) return;
  document.getElementById('contactFormSub').textContent = 'Клиент: '+c.name;
  document.getElementById('contactClientId').value      = clientId;
  ['contactName','contactRole','contactPhone','contactEmail'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('contactFormModal').classList.add('show');
}
function closeContactForm(){ document.getElementById('contactFormModal').classList.remove('show'); }
function initContactForm(){
  document.getElementById('contactFormClose').onclick = closeContactForm;
  document.getElementById('contactCancel').onclick    = closeContactForm;
  document.getElementById('contactForm').onsubmit = e=>{
    e.preventDefault();
    const cid = document.getElementById('contactClientId').value;
    const data = {
      name:  document.getElementById('contactName').value.trim(),
      role:  document.getElementById('contactRole').value.trim(),
      phone: document.getElementById('contactPhone').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
    };
    if(!data.name){ toast('Укажите ФИО контактного лица'); return; }
    addContact(cid, data);
    closeContactForm(); renderClientCard();
    toast('Контактное лицо добавлено');
  };
}

/* ============================================================
   ПОДБОР ПОМЕЩЕНИЯ В ИЗБРАННОЕ
   ============================================================ */
function openPickUnit(clientId){
  const c = getClient(clientId);
  if(!c) return;
  document.getElementById('pickClientId').value = clientId;
  document.getElementById('pickUnitSub').textContent = 'Клиент: '+c.name;
  document.getElementById('pickUnitQuery').value = '';
  renderPickList('');
  document.getElementById('pickUnitModal').classList.add('show');
}
function closePickUnit(){ document.getElementById('pickUnitModal').classList.remove('show'); }
function renderPickList(query){
  const cid = document.getElementById('pickClientId').value;
  const c = getClient(cid);
  if(!c) return;
  const favSet = new Set(c.favoriteUnitIds||[]);
  const q = (query||'').toLowerCase();
  let list = units().slice();
  if(q){
    list = list.filter(u =>
      u.displayNum.toLowerCase().includes(q) ||
      u.corp.toLowerCase().includes(q) ||
      (''+u.floor).includes(q) ||
      (''+u.area).includes(q)
    );
  }
  list = list.sort((a,b)=>a.floor-b.floor || a.position-b.position).slice(0, 60);
  const el = document.getElementById('pickUnitList');
  el.innerHTML = list.map(u=>{
    const inFav = favSet.has(u.id);
    return `<div class="pick-unit-item" data-pick="${u.id}">
      <div class="pu-st" style="background:${STATUSES[u.status].color}"></div>
      <div class="pu-num">${u.displayNum}</div>
      <div class="pu-meta"><b>${u.kind} · ${u.area} м²</b>${u.corp} · ${u.floor} эт. · ${STATUSES[u.status].label}</div>
      <button class="btn btn-sm" style="${inFav?'border-color:var(--terra); color:var(--terra);':''}">${iconStar(inFav,13)} ${inFav?'В избранном':'Добавить'}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.pick-unit-item').forEach(it=>it.onclick=()=>{
    toggleClientFavorite(cid, it.dataset.pick);
    renderPickList(document.getElementById('pickUnitQuery').value);
    renderClientCard();
  });
}
function initPickUnit(){
  document.getElementById('pickUnitClose').onclick = closePickUnit;
  document.getElementById('pickUnitQuery').addEventListener('input', e=>{
    renderPickList(e.target.value);
  });
  document.getElementById('pickUnitModal').onclick = e=>{
    if(e.target.id==='pickUnitModal') closePickUnit();
  };
}

/* ============================================================
   ХЕЛПЕРЫ
   ============================================================ */
function esc(s){
  if(s===undefined || s===null) return '';
  return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ВКЛАДКИ
   ============================================================ */
function initClientsTab(){
  initClientFilters();
  initClientForm();
  initTaskForm();
  initDocForm();
  initContactForm();
  initPickUnit();
}
