/* ============================================================
   ПРИЛОЖЕНИЕ: вкладки, поиск, уведомления, инициализация.
   Календарь вынесен в calendar.js, шахматка — в chess.js.
   ============================================================ */

/* ---------- Вкладки ---------- */
document.getElementById('tabs').querySelectorAll('.tab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-'+tab.dataset.view).classList.add('active');
  };
});

/* ---------- Создать клиента ---------- */
document.getElementById('newClientBtn').onclick = ()=>openClientForm(null);

/* ---------- Закрытие боковой панели по клику на затемнение ---------- */
document.getElementById('scrim').onclick = closePanel;

/* ---------- Уведомления (динамические, по роли) ---------- */
function renderNotifs(){
  const rop = isRop(), uid = currentUserId();
  const today = isoDate(TODAY), tomorrow = isoDate(addDays(TODAY,1));
  const items = [];

  // Показы сегодня и завтра
  state.shows.filter(s=>s.status==='planned' && (rop || s.managerId===uid)).forEach(s=>{
    if(s.date===today || s.date===tomorrow){
      const c = getClient(s.clientId), u = getUnit(s.unitId);
      items.push({ icon:'eye', when:s.date+'0',
        title:(s.date===today?'Показ сегодня':'Показ завтра')+(s.time?' · '+s.time:''),
        sub:(c?c.name:'—')+(u?' · '+u.displayNum:'')+(rop?' · '+mgrName(s.managerId):'') });
    }
  });
  // Задачи: просроченные и на сегодня
  tasksAll().filter(t=>t.status!=='done' && t.due && (rop || t.managerId===uid)).forEach(t=>{
    if(t.due < today) items.push({ icon:'alert', when:t.due+'0', overdue:true,
      title:'Просрочена задача', sub:t.title+(rop?' · '+mgrName(t.managerId):'') });
    else if(t.due===today) items.push({ icon:'clock', when:t.due+'1',
      title:'Задача на сегодня', sub:t.title+(rop?' · '+mgrName(t.managerId):'') });
  });
  items.sort((a,b)=> a.when<b.when?-1 : a.when>b.when?1 : 0);

  const badge = document.getElementById('notifBadge');
  badge.textContent = items.length;
  badge.style.display = items.length ? '' : 'none';
  document.getElementById('notifList').innerHTML = items.length
    ? items.map(n=>`<div class="notif-item"><div class="ic ${n.overdue?'ic-over':''}">${icon(n.icon,15)}</div>
        <div class="nb"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.sub)}</span></div></div>`).join('')
    : `<div class="notif-empty">Нет новых уведомлений</div>`;
}

// Обновить «живые» блоки после события (журнал, задачи, уведомления)
function refreshLive(){
  if(typeof renderDashboard === 'function') renderDashboard();
  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalytics === 'function') renderAnalytics();
  renderNotifs();
}
document.getElementById('notifBtn').onclick = (e)=>{
  e.stopPropagation();
  document.getElementById('notifPop').classList.toggle('show');
};
document.addEventListener('click',(e)=>{
  if(!e.target.closest('#notifPop') && !e.target.closest('#notifBtn'))
    document.getElementById('notifPop').classList.remove('show');
});

/* ---------- Админ-режим ---------- */
document.getElementById('adminToggle').onclick = toggleAdminMode;

/* ---------- Глобальный поиск ---------- */
const search = document.getElementById('globalSearch');
const results = document.getElementById('searchResults');
search.addEventListener('input',()=>{
  const q = search.value.trim().toLowerCase();
  if(!q){ results.classList.remove('show'); return; }
  const found = [];

  // клиенты
  clients().forEach(c=>{
    if((c.name||'').toLowerCase().includes(q) || (c.phone||'').replace(/\s/g,'').includes(q.replace(/\s/g,'')))
      found.push({kind:'Клиент', label:c.name, sub:(c.phone||'—')+' · '+(c.targetObject||'—'), action:()=>goClient(c.id)});
  });

  // помещения
  units().forEach(u=>{
    if(u.displayNum.toLowerCase().includes(q) || (''+u.area).includes(q))
      found.push({
        kind:'Помещение',
        label:u.displayNum+' · '+u.corp,
        sub:u.area+' м² · '+STATUSES[u.status].label,
        action:()=>goUnit(u.id)
      });
  });

  // показы
  state.shows.forEach(s=>{
    const c = getClient(s.clientId);
    if(c && (c.name||'').toLowerCase().includes(q)){
      const u = getUnit(s.unitId);
      found.push({
        kind:'Показ',
        label:c.name+' · '+s.time,
        sub:fmtDateRu(s.date)+(u?' · '+u.displayNum:'')+' · '+SHOW_STATUSES[s.status].label,
        action:()=>openCalendarOnShow(s.id),
      });
    }
  });

  const top = found.slice(0,10);
  results.innerHTML = top.length
    ? top.map((r,i)=>`<div class="sr-item" data-i="${i}"><span class="sr-kind">${r.kind}</span><div><b style="font-size:13px;">${r.label}</b><div style="font-size:12px;color:var(--brown-soft)">${r.sub}</div></div></div>`).join('')
    : `<div class="sr-empty">Ничего не найдено по запросу «${search.value}»</div>`;
  results.classList.add('show');
  results.querySelectorAll('.sr-item').forEach(el=>el.onclick=()=>{
    top[+el.dataset.i].action();
    results.classList.remove('show'); search.value='';
  });
});
document.addEventListener('click',(e)=>{
  if(!e.target.closest('.search-wrap')) results.classList.remove('show');
});

function goClient(id){
  document.querySelector('.tab[data-view="clients"]').click();
  state.activeClientId = id;
  renderClientList(); renderClientCard();
}

function goUnit(id){
  document.querySelector('.tab[data-view="chess"]').click();
  openPanel(id);
}

// Перейти к клиентам выбранного менеджера (фильтр по менеджеру)
function goManager(managerId){
  document.querySelector('.tab[data-view="clients"]').click();
  state.clientFilters.mgr = managerId;
  const sel = document.getElementById('clFilterMgr');
  if(sel) sel.value = managerId;
  renderClientList();
  const first = clients().find(c=>c.mgr===managerId);
  if(first){ state.activeClientId = first.id; renderClientCard(); }
  toast('Клиенты менеджера: '+mgrName(managerId));
}

/* ---------- ESC закрывает всё ---------- */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    closePanel();
    document.querySelectorAll('.cal-modal.show, .form-modal.show').forEach(el=>el.classList.remove('show'));
    document.getElementById('notifPop').classList.remove('show');
  }
});

/* ---------- Инициализация ---------- */
function init(){
  initState();
  buildLegend();
  buildFilters();
  bindFilters();
  bindViewSwitch();
  renderAdminPanel();
  renderChess();
  renderAside();
  initClientsTab();
  renderClientList();
  renderClientCard();
  renderFunnel();
  renderDashboard();
  renderChecklist();
  renderAnalytics();
  renderNotifs();
  initCalendar();
  initUnitForm();
  initLightbox();
  initDashEdit();
  initTaskModal();
  initUserSwitch();
  initKP();
  initAuth();
  renderCalLauncher();
}
init();

/* ---------- Учётная запись: профиль + выход ---------- */
function renderUserSwitch(){
  const acc = (typeof authUser==='function' && authUser()) || { name:'—', email:'', role:null };
  const short = mkShort(acc.name);
  const isRopRole = acc.role==='rop';
  document.getElementById('userAvatar').textContent = short;
  document.getElementById('userName').textContent = acc.name;
  document.getElementById('userRole').textContent = isRopRole ? 'Руководитель ОП' : 'Менеджер ОП';
  const menu = document.getElementById('userMenu');
  menu.innerHTML = `
    <div class="user-menu-head">
      <span class="avatar">${short}</span>
      <div class="um-meta"><b>${escapeHtml(acc.name)}</b><span>${escapeHtml(acc.email||'')}</span></div>
    </div>
    ${isRopRole ? `<button class="user-menu-item" id="umUsers">${icon('users',16)} Учётные записи</button>` : ''}
    <button class="user-menu-item" id="umLogout">${icon('arrowRight',16)} Выйти</button>`;
  const uu = document.getElementById('umUsers'); if(uu) uu.onclick = openUsersModal;
  const lo = document.getElementById('umLogout'); if(lo) lo.onclick = doLogout;
}
function initUserSwitch(){
  const btn = document.getElementById('userBtn');
  const menu = document.getElementById('userMenu');
  btn.onclick = (e)=>{ e.stopPropagation(); menu.classList.toggle('show'); };
  document.addEventListener('click', e=>{
    if(!e.target.closest('.user-switch')) menu.classList.remove('show');
  });
}
