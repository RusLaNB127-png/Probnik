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

/* ---------- Уведомления ---------- */
function renderNotifs(){
  document.getElementById('notifBadge').textContent = NOTIFS.length;
  document.getElementById('notifList').innerHTML = NOTIFS.map(([t,d])=>`
    <div class="notif-item"><div class="ic">!</div><div class="nb"><b>${t}</b><span>${d}</span></div></div>`).join('');
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
  renderNotifs();
  initCalendar();
  initUnitForm();
  initLightbox();
  initDashEdit();
  renderCalLauncher();
}
init();
