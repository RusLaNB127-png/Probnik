/* ============================================================
   ПРИЛОЖЕНИЕ: переключение объектов, вкладки, поиск,
   уведомления, календарь, инициализация.
   ============================================================ */

/* ---------- Переключатель объектов в шапке ---------- */
function renderObjSwitch(){
  const wrap = document.getElementById('objSwitch');
  wrap.innerHTML = Object.entries(BUILDINGS).map(([k,b])=>
    `<button class="${k===state.building?'active':''}" data-obj="${k}">${b.short}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    state.building = btn.dataset.obj;
    state.filters = { corp:'', floor:'', status:'', manager:'', priceMin:'', priceMax:'', areaMin:'', areaMax:'' };
    renderObjSwitch(); buildFilters(); renderChess(); renderAside(); renderDashboard(); renderFunnel();
    toast('Объект: '+BUILDINGS[state.building].name);
  });
}

/* ---------- Вкладки ---------- */
document.getElementById('tabs').querySelectorAll('.tab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-'+tab.dataset.view).classList.add('active');
  };
});

/* ---------- Создать клиента (заглушка) ---------- */
document.getElementById('newClientBtn').onclick = ()=>toast('Открыта форма создания клиента');

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

/* ---------- Календарь показов ---------- */
function renderCalendar(){
  // Июнь 2026: 1 июня — понедельник (firstDow=0), 30 дней, сегодня 22-е
  const firstDow=0, days=30, today=22;
  const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  let html = dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<firstDow;i++) html += `<div class="cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const ev = SHOW_EVENTS[d]||[];
    html += `<div class="cal-day ${d===today?'today':''}"><div class="dn">${d}</div>
      ${ev.map(([t,c])=>`<div class="cal-event ${c}">${t}</div>`).join('')}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}
function openCal(){
  renderCalendar();
  document.getElementById('calModal').classList.add('show');
}
document.getElementById('calBtn').onclick = openCal;
document.getElementById('calBtn2').onclick = openCal;
document.getElementById('calClose').onclick = ()=>document.getElementById('calModal').classList.remove('show');
document.getElementById('calModal').onclick = (e)=>{
  if(e.target.id==='calModal') document.getElementById('calModal').classList.remove('show');
};

/* ---------- Глобальный поиск ---------- */
const search = document.getElementById('globalSearch');
const results = document.getElementById('searchResults');
search.addEventListener('input',()=>{
  const q = search.value.trim().toLowerCase();
  if(!q){ results.classList.remove('show'); return; }
  const found = [];
  CLIENTS.forEach(c=>{
    if(c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,'')))
      found.push({kind:'Клиент', label:c.name, sub:c.phone+' · '+c.object, action:()=>goClient(c.id)});
  });
  Object.keys(BUILDINGS).forEach(bk=>{
    if(!state.units[bk]) state.units[bk] = genUnits(bk);
    state.units[bk].forEach(u=>{
      if(u.displayNum.toLowerCase().includes(q) || (''+u.area).includes(q))
        found.push({kind:'Помещение', label:u.displayNum+' · '+BUILDINGS[bk].short, sub:u.area+' м² · '+STATUSES[u.status].label, action:()=>goUnit(bk,u.id)});
    });
  });
  const top = found.slice(0,8);
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
function goUnit(bk,id){
  if(state.building!==bk){
    state.building = bk;
    renderObjSwitch(); buildFilters(); renderChess(); renderAside(); renderDashboard(); renderFunnel();
  }
  document.querySelector('.tab[data-view="chess"]').click();
  openPanel(id);
}

/* ---------- ESC закрывает всё ---------- */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    closePanel();
    document.getElementById('calModal').classList.remove('show');
    document.getElementById('notifPop').classList.remove('show');
  }
});

/* ---------- Инициализация ---------- */
function init(){
  renderObjSwitch();
  buildLegend();
  buildFilters();
  bindFilters();
  renderChess();
  renderAside();
  renderClientList();
  renderClientCard();
  renderFunnel();
  renderDashboard();
  renderNotifs();
}
init();
