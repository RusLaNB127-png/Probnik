/* ============================================================
   КАЛЕНДАРЬ ПОКАЗОВ — ПОЛНОЭКРАННЫЙ + ФОРМА ПОКАЗА
   ============================================================ */

const CAL_HOUR_START = 8;
const CAL_HOUR_END   = 21;

// ---------- Открытие/закрытие ----------
function openCalendar(){
  const sel = new Date(state.calendarDate+'T00:00:00');
  state.calendarMonth = { y: sel.getFullYear(), m: sel.getMonth() };
  renderCalendar();
  document.getElementById('calModal').classList.add('show');
}
function closeCalendar(){
  document.getElementById('calModal').classList.remove('show');
}

function openCalendarOnShow(showId){
  const s = state.shows.find(x=>x.id===showId);
  if(!s) return;
  state.calendarDate = s.date;
  const d = new Date(s.date+'T00:00:00');
  state.calendarMonth = { y: d.getFullYear(), m: d.getMonth() };
  openCalendar();
}

// ---------- Хедер launcher в шапке ----------
function renderCalLauncher(){
  const today = isoDate(TODAY);
  const todayShows = showsOnDate(today).filter(s=>s.status!=='cancelled');
  document.getElementById('calLauncherDot').textContent = todayShows.length;
  if(!todayShows.length){
    document.getElementById('calLauncherSub').textContent = 'Сегодня показов нет';
    return;
  }
  // ближайший показ сегодня (не прошедший)
  const nowHm = TODAY.getHours()*60 + TODAY.getMinutes();
  const upcoming = todayShows.find(s=>{
    const [h,mi] = s.time.split(':').map(Number);
    return h*60+mi >= nowHm;
  }) || todayShows[0];
  document.getElementById('calLauncherSub').textContent = `Сегодня ${todayShows.length} · ближайший ${upcoming.time}`;
}

// ---------- Главный рендер ----------
function renderCalendar(){
  renderCalMini();
  renderCalStats();
  renderCalDay();
  const monthLabel = new Date(state.calendarMonth.y, state.calendarMonth.m, 1)
    .toLocaleString('ru-RU',{month:'long', year:'numeric'});
  document.getElementById('calShellSub').textContent =
    'Объект: '+state.buildingConfig.name+' · '+monthLabel;
}

// ---------- Мини-месяц ----------
function renderCalMini(){
  const { y, m } = state.calendarMonth;
  const monthLabel = new Date(y, m, 1).toLocaleString('ru-RU',{month:'long', year:'numeric'});
  document.getElementById('calMiniTitle').textContent = monthLabel;

  const firstDay = new Date(y, m, 1);
  // День недели: переводим в 0=Пн ... 6=Вс
  let firstDow = firstDay.getDay() - 1; if(firstDow<0) firstDow = 6;
  const daysInMonth = new Date(y, m+1, 0).getDate();

  const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  let html = dows.map(d=>`<div class="cal-mini-dow">${d}</div>`).join('');
  for(let i=0;i<firstDow;i++) html += `<div class="cal-mini-day empty"></div>`;

  const todayIso = isoDate(TODAY);
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasShows = state.shows.some(s=>s.date===iso && s.status!=='cancelled');
    const cls = [
      'cal-mini-day',
      iso===todayIso ? 'today':'',
      iso===state.calendarDate ? 'selected':'',
      hasShows ? 'has-shows':'',
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-iso="${iso}">${d}</div>`;
  }
  document.getElementById('calMiniGrid').innerHTML = html;

  document.getElementById('calMiniGrid').querySelectorAll('.cal-mini-day:not(.empty)').forEach(el=>{
    el.onclick = ()=>{ state.calendarDate = el.dataset.iso; renderCalendar(); };
  });
}

// ---------- Статистика ----------
function renderCalStats(){
  const today = isoDate(TODAY);
  const todayShows = showsOnDate(today).filter(s=>s.status!=='cancelled');
  const weekShows = state.shows.filter(s=>{
    if(s.status==='cancelled') return false;
    const d = new Date(s.date+'T00:00:00');
    const diff = (d - new Date(today+'T00:00:00')) / 86400000;
    return diff >= 0 && diff < 7;
  });
  const cancelled = state.shows.filter(s=>s.status==='cancelled' && s.date>=today).length;

  // ближайший показ
  const nowHm = TODAY.getHours()*60 + TODAY.getMinutes();
  let next = null;
  const futureSorted = state.shows
    .filter(s=>s.status!=='cancelled' && s.status!=='completed')
    .filter(s=>{
      if(s.date>today) return true;
      if(s.date<today) return false;
      const [h,mi] = s.time.split(':').map(Number);
      return h*60+mi >= nowHm;
    })
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  next = futureSorted[0];

  let nextHtml = '';
  if(next){
    const client = getClient(next.clientId);
    const u = getUnit(next.unitId);
    nextHtml = `
      <div class="cal-stat-next">
        <div class="lbl ic-inline">${icon('clock',12)} Ближайший показ</div>
        <div class="val">${next.time} · ${client?client.name:'Клиент'}</div>
        <div class="meta">${fmtDateRu(next.date)}${u?' · '+u.displayNum:''} · ${mgrShort(next.managerId)}</div>
      </div>`;
  }

  document.getElementById('calStats').innerHTML = `
    ${nextHtml}
    <div class="cal-stat">
      <div class="cal-stat-ic">${icon('clock',16)}</div>
      <div class="cal-stat-body">
        <div class="cal-stat-label">Сегодня</div>
        <div class="cal-stat-value">${todayShows.length} ${declOf(todayShows.length,['показ','показа','показов'])}</div>
      </div>
    </div>
    <div class="cal-stat">
      <div class="cal-stat-ic">${icon('calendar',16)}</div>
      <div class="cal-stat-body">
        <div class="cal-stat-label">На неделю</div>
        <div class="cal-stat-value">${weekShows.length} ${declOf(weekShows.length,['показ','показа','показов'])}</div>
      </div>
    </div>
    <div class="cal-stat">
      <div class="cal-stat-ic" style="color:var(--terra-dark);">${icon('close',16)}</div>
      <div class="cal-stat-body">
        <div class="cal-stat-label">Отмен в ближайшие дни</div>
        <div class="cal-stat-value ${cancelled?'warn':'muted'}">${cancelled}</div>
      </div>
    </div>
  `;
}

function declOf(n, forms){
  const a = Math.abs(n)%100;
  const b = a%10;
  if(a>10 && a<20) return forms[2];
  if(b>1 && b<5) return forms[1];
  if(b===1) return forms[0];
  return forms[2];
}

// ---------- Дневной режим ----------
function renderCalDay(){
  const iso = state.calendarDate;
  const d = new Date(iso+'T00:00:00');
  const dateLabel = d.toLocaleString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('calDayDate').textContent =
    dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1);

  const todayShows = showsOnDate(iso);
  const active = todayShows.filter(s=>s.status!=='cancelled').length;
  const cancelled = todayShows.length - active;
  document.getElementById('calDayMeta').textContent =
    todayShows.length
      ? `${active} активных${cancelled?', '+cancelled+' отменено':''}`
      : 'Показов нет';

  const grid = document.getElementById('calDayGrid');
  if(!todayShows.length){
    grid.innerHTML = `
      <div class="cal-day-empty">
        <div class="big">Показов на этот день нет</div>
        <div>Нажмите «Создать показ», чтобы назначить встречу с клиентом.</div>
      </div>`;
    return;
  }

  // По часам
  const byHour = {};
  for(let h=CAL_HOUR_START; h<=CAL_HOUR_END; h++) byHour[h] = [];
  todayShows.forEach(s=>{
    const h = parseInt(s.time.split(':')[0], 10);
    if(h<CAL_HOUR_START) byHour[CAL_HOUR_START].push(s);
    else if(h>CAL_HOUR_END) byHour[CAL_HOUR_END].push(s);
    else byHour[h].push(s);
  });

  let html = '';
  for(let h=CAL_HOUR_START; h<=CAL_HOUR_END; h++){
    const items = byHour[h].sort((a,b)=>a.time.localeCompare(b.time));
    html += `<div class="cal-day-row">
      <div class="cal-day-hour">${String(h).padStart(2,'0')}:00</div>
      <div class="cal-day-slot">${items.map(renderEvent).join('')}</div>
    </div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-event').forEach(el=>{
    el.onclick = ()=> openShowForm(el.dataset.id);
  });
}

function renderEvent(s){
  const c = getClient(s.clientId);
  const u = getUnit(s.unitId);
  const ss = SHOW_STATUSES[s.status];
  return `<div class="cal-event ${s.status==='cancelled'?'cancelled':''}"
                style="background:linear-gradient(135deg, ${ss.color}, ${shade(ss.color,-10)})"
                data-id="${s.id}">
    <span class="ev-status">${ss.label}</span>
    <div class="ev-time">${s.time}</div>
    <div class="ev-title">${c ? c.name : 'Клиент'}</div>
    <div class="ev-meta">${u ? u.displayNum+' · '+u.kind : 'Помещение не указано'} · ${mgrName(s.managerId)}</div>
    ${s.comment ? `<div class="ev-comment">«${s.comment}»</div>` : ''}
  </div>`;
}

// небольшое затемнение цвета для градиента
function shade(hex, pct){
  if(hex.startsWith('var(')) return hex;
  const m = hex.replace('#','');
  const num = parseInt(m,16);
  let r = (num>>16) + Math.round(255*pct/100);
  let g = ((num>>8)&0xff) + Math.round(255*pct/100);
  let b = (num&0xff) + Math.round(255*pct/100);
  r = Math.max(0,Math.min(255,r));
  g = Math.max(0,Math.min(255,g));
  b = Math.max(0,Math.min(255,b));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

// ---------- Навигация ----------
function calShiftMonth(delta){
  let { y, m } = state.calendarMonth;
  m += delta;
  if(m<0){ m=11; y--; }
  if(m>11){ m=0; y++; }
  state.calendarMonth = { y, m };
  renderCalMini();
}

function calShiftDay(delta){
  const d = new Date(state.calendarDate+'T00:00:00');
  d.setDate(d.getDate()+delta);
  state.calendarDate = isoDate(d);
  state.calendarMonth = { y: d.getFullYear(), m: d.getMonth() };
  renderCalendar();
}

// ---------- Инициализация ----------
function initCalendar(){
  document.getElementById('calBtn').onclick      = openCalendar;
  document.getElementById('calClose').onclick    = closeCalendar;
  document.getElementById('calModal').onclick    = e=>{ if(e.target.id==='calModal') closeCalendar(); };
  document.getElementById('calPrevMonth').onclick= ()=>calShiftMonth(-1);
  document.getElementById('calNextMonth').onclick= ()=>calShiftMonth(1);
  document.getElementById('calPrevDay').onclick  = ()=>calShiftDay(-1);
  document.getElementById('calNextDay').onclick  = ()=>calShiftDay(1);
  document.getElementById('calGoToday').onclick  = ()=>{
    state.calendarDate = isoDate(TODAY);
    state.calendarMonth = { y: TODAY.getFullYear(), m: TODAY.getMonth() };
    renderCalendar();
  };
  document.getElementById('calGoTomorrow').onclick = ()=>{
    const t = addDays(TODAY, 1);
    state.calendarDate = isoDate(t);
    state.calendarMonth = { y: t.getFullYear(), m: t.getMonth() };
    renderCalendar();
  };
  document.getElementById('calGoWeek').onclick = ()=>{
    state.calendarDate = isoDate(TODAY);
    state.calendarMonth = { y: TODAY.getFullYear(), m: TODAY.getMonth() };
    renderCalendar();
  };
  document.getElementById('calNewBtn').onclick = ()=>openShowForm(null);
  initShowForm();
}

/* ============================================================
   ФОРМА ПОКАЗА
   ============================================================ */
function openShowForm(showId){
  document.getElementById('showFormTitle').textContent = showId ? 'Редактирование показа' : 'Новый показ';
  document.getElementById('showId').value = showId || '';
  document.getElementById('showDelete').style.display = showId ? 'inline-flex' : 'none';

  // селекты
  document.getElementById('showClient').innerHTML =
    `<option value="">— выберите —</option>`+
    CLIENTS.map(c=>`<option value="${c.id}">${c.name} · ${c.phone}</option>`).join('');

  document.getElementById('showUnit').innerHTML =
    `<option value="">— без помещения —</option>`+
    units().slice()
      .sort((a,b)=>a.floor-b.floor || a.position-b.position)
      .map(u=>`<option value="${u.id}">${u.displayNum} · ${u.corp} · ${u.floor} эт. · ${u.area} м²</option>`).join('');

  document.getElementById('showManager').innerHTML =
    MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');

  document.getElementById('showStatus').innerHTML =
    SHOW_STATUS_ORDER.map(s=>`<option value="${s}">${SHOW_STATUSES[s].label}</option>`).join('');

  if(showId){
    const s = state.shows.find(x=>x.id===showId);
    if(s){
      document.getElementById('showClient').value  = s.clientId;
      document.getElementById('showUnit').value    = s.unitId || '';
      document.getElementById('showDate').value    = s.date;
      document.getElementById('showTime').value    = s.time;
      document.getElementById('showManager').value = s.managerId;
      document.getElementById('showStatus').value  = s.status;
      document.getElementById('showComment').value = s.comment || '';
    }
  } else {
    document.getElementById('showClient').value  = '';
    document.getElementById('showUnit').value    = '';
    document.getElementById('showDate').value    = state.calendarDate || isoDate(TODAY);
    document.getElementById('showTime').value    = '11:00';
    document.getElementById('showManager').value = MANAGERS[0].id;
    document.getElementById('showStatus').value  = 'planned';
    document.getElementById('showComment').value = '';
  }
  document.getElementById('showFormModal').classList.add('show');
}

function openShowFormForUnit(unitId){
  openShowForm(null);
  document.getElementById('showUnit').value = unitId;
  const u = getUnit(unitId);
  if(u && u.clientId) document.getElementById('showClient').value = u.clientId;
  if(u && u.managerId) document.getElementById('showManager').value = u.managerId;
}

function closeShowForm(){ document.getElementById('showFormModal').classList.remove('show'); }

function initShowForm(){
  document.getElementById('showFormClose').onclick = closeShowForm;
  document.getElementById('showCancel').onclick    = closeShowForm;
  document.getElementById('showFormModal').onclick = e=>{
    if(e.target.id==='showFormModal') closeShowForm();
  };
  document.getElementById('showDelete').onclick = ()=>{
    const id = document.getElementById('showId').value;
    if(!id) return;
    if(!confirm('Удалить показ?')) return;
    deleteShow(id);
    closeShowForm();
    renderCalendar(); renderCalLauncher(); renderAside();
    toast('Показ удалён');
  };
  document.getElementById('showForm').onsubmit = e=>{
    e.preventDefault();
    const id = document.getElementById('showId').value;
    const data = {
      clientId:  document.getElementById('showClient').value,
      unitId:    document.getElementById('showUnit').value || null,
      managerId: document.getElementById('showManager').value,
      date:      document.getElementById('showDate').value,
      time:      document.getElementById('showTime').value,
      status:    document.getElementById('showStatus').value,
      comment:   document.getElementById('showComment').value.trim(),
    };
    if(!data.clientId){ toast('Выберите клиента'); return; }
    if(!data.date || !data.time){ toast('Укажите дату и время'); return; }

    if(id){
      updateShow(id, data);
      toast('Показ обновлён');
    } else {
      const s = createShow(data);
      state.calendarDate = s.date;
      state.calendarMonth = { y: parseInt(s.date.slice(0,4),10), m: parseInt(s.date.slice(5,7),10)-1 };
      toast('Показ создан');
    }
    closeShowForm();
    renderCalendar(); renderCalLauncher(); renderAside();
  };
}
