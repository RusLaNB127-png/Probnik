/* ============================================================
   СОСТОЯНИЕ + УТИЛИТЫ
   Глобальное состояние, persistence в localStorage,
   общие функции для всех вкладок.
   ============================================================ */

// «Сегодня» в демо-режиме: 22 июня 2026 (так задумано во всех тестовых данных).
// При подключении к реальному бэкенду — заменить на new Date().
const TODAY = new Date('2026-06-22T10:00:00');

// Детерминированный псевдослучайный генератор (стабильная шахматка по seed)
function makeRng(seed){
  let s = seed;
  return ()=>{ s = (s*1103515245 + 12345) & 0x7fffffff; return s/0x7fffffff; };
}

// Уникальный id (для новых сущностей)
function uid(prefix='id'){
  return prefix+'-'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
}

// ISO-дата YYYY-MM-DD
function isoDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// Прибавить дни
function addDays(date, n){
  const d = new Date(date); d.setDate(d.getDate()+n); return d;
}

// Удобный форматтер даты в русской локали
function fmtDateRu(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return d+' '+months[m-1]+' '+y;
}

// ---------- Генерация помещений ----------
function genUnits(buildingConfig){
  const b = buildingConfig;
  const rng = makeRng(b.seed);
  const units = [];
  b.corps.forEach((corp, ci)=>{
    for(let f=b.floors; f>=1; f--){
      for(let pos=0; pos<b.perFloor; pos++){
        const area = +(34 + Math.round(rng()*78)).toFixed(0);
        const pricePerM = Math.round((b.basePrice + (f*1.4) + rng()*40));
        const status = STATUS_WEIGHT[Math.floor(rng()*STATUS_WEIGHT.length)];
        const mgr = MANAGERS[Math.floor(rng()*MANAGERS.length)];
        const hasClient = (status!=='free' && status!=='unavailable') ? rng()>0.25 : false;
        units.push({
          id:           uid('u'),
          buildingId:   b.id,
          corp,
          floor:        f,
          position:     pos,
          displayNum:   '№'+(b.startNum + units.length),
          area,
          pricePerM,                                  // тыс. ₽/м²
          total:        Math.round(area*pricePerM/1000*10)/10,  // млн ₽
          status,
          managerId:    mgr.id,
          clientId:     hasClient ? CLIENTS[Math.floor(rng()*CLIENTS.length)].id : null,
          kind:         b.kind,
          favorite:     false,
          createdAt:    Date.now(),
          updatedAt:    Date.now(),
        });
      }
    }
  });
  return units;
}

// ---------- Генерация показов (на основе DEFAULT_SHOWS_SEED + сегодняшней даты) ----------
function genShows(unitsList){
  return DEFAULT_SHOWS_SEED.map(s=>{
    const u = unitsList[s.unitIdx] || unitsList[0];
    return {
      id:        uid('sh'),
      clientId:  s.clientId,
      unitId:    u ? u.id : null,
      managerId: s.managerId,
      date:      isoDate(addDays(TODAY, s.dayOffset)),
      time:      s.time,
      status:    s.status,
      comment:   s.comment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });
}

// ---------- Глобальное состояние ----------
const state = {
  building:        'italika',         // мульти-объектность отключена; константа
  buildingConfig:  null,              // редактируемая копия конфига объекта
  unitsList:       [],                // массив помещений (плоский, готов к API)
  shows:           [],                // массив показов
  favorites:       new Set(),         // id избранных помещений
  selectedUnitId:  null,
  activeClientId:  'c1',
  filters:         { corp:'', floor:'', status:'', manager:'', priceMin:'', priceMax:'', areaMin:'', areaMax:'', favoritesOnly:false, query:'' },
  adminMode:       false,
  calendarDate:    isoDate(TODAY),    // выбранная дата в большом календаре
  calendarMonth:   { y: TODAY.getFullYear(), m: TODAY.getMonth() },
  // совместимость со старым кодом других вкладок
  units:           {},
};

// ---------- Persistence ----------
function saveState(){
  try{
    const snapshot = {
      buildingConfig: state.buildingConfig,
      unitsList:      state.unitsList,
      shows:          state.shows,
      favorites:      [...state.favorites],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }catch(err){
    console.warn('Не удалось сохранить состояние:', err);
  }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data.buildingConfig || !data.unitsList) return false;
    state.buildingConfig = data.buildingConfig;
    state.unitsList      = data.unitsList;
    state.shows          = data.shows || [];
    state.favorites      = new Set(data.favorites || []);
    return true;
  }catch(err){
    console.warn('Не удалось загрузить состояние:', err);
    return false;
  }
}

function resetToDefaults(){
  state.buildingConfig = JSON.parse(JSON.stringify(DEFAULT_BUILDING));
  state.unitsList      = genUnits(state.buildingConfig);
  state.shows          = genShows(state.unitsList);
  state.favorites      = new Set();
  saveState();
}

// При старте: загружаем сохранённое или генерируем дефолт
function initState(){
  if(!loadState()) resetToDefaults();
  // совместимость со старым кодом
  state.units[state.building] = state.unitsList;
}

// ---------- Доступ к данным ----------
function units(){ return state.unitsList; }
function getUnit(id){ return state.unitsList.find(u=>u.id===id); }
function getClient(id){ return CLIENTS.find(c=>c.id===id); }
function mgrName(id){ return (MANAGERS.find(m=>m.id===id)||{}).name||'—'; }
function mgrShort(id){ return (MANAGERS.find(m=>m.id===id)||{}).short||'—'; }
function fmtMoney(mln){ return mln.toLocaleString('ru-RU',{maximumFractionDigits:1})+' млн ₽'; }

// Поиск клиента по имени (для legacy unit.client → clientId)
function findClientByName(name){
  if(!name) return null;
  return CLIENTS.find(c=>c.name===name) || null;
}

// ---------- Мутации шахматки ----------
function updateUnit(id, patch){
  const u = getUnit(id);
  if(!u) return;
  Object.assign(u, patch, { updatedAt: Date.now() });
  saveState();
}

function deleteUnit(id){
  const i = state.unitsList.findIndex(u=>u.id===id);
  if(i<0) return;
  state.unitsList.splice(i,1);
  state.favorites.delete(id);
  state.shows = state.shows.filter(s=>s.unitId!==id);
  saveState();
}

function toggleFavorite(id){
  if(state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveState();
}

// Изменение этажности корпуса
function setFloors(corp, newFloors){
  const cfg = state.buildingConfig;
  const oldFloors = cfg.floors;
  if(newFloors === oldFloors) return;

  if(newFloors > oldFloors){
    // Добавляем новые верхние этажи
    const rng = makeRng(cfg.seed + Date.now()%1000);
    for(let f = oldFloors+1; f<=newFloors; f++){
      for(let pos=0; pos<cfg.perFloor; pos++){
        const area = +(34 + Math.round(rng()*78)).toFixed(0);
        const pricePerM = Math.round((cfg.basePrice + (f*1.4) + rng()*40));
        state.unitsList.push({
          id: uid('u'), buildingId: cfg.id, corp, floor:f, position:pos,
          displayNum: '№'+(state.unitsList.length+1),
          area, pricePerM, total: Math.round(area*pricePerM/1000*10)/10,
          status:'free', managerId: MANAGERS[0].id, clientId: null,
          kind: cfg.kind, favorite:false,
          createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    }
  } else {
    // Удаляем верхние этажи (только в этом корпусе)
    state.unitsList = state.unitsList.filter(u => !(u.corp===corp && u.floor>newFloors));
  }
  cfg.floors = newFloors;
  saveState();
}

// Изменение количества помещений на этаже
function setPerFloor(corp, newPerFloor){
  const cfg = state.buildingConfig;
  const oldPerFloor = cfg.perFloor;
  if(newPerFloor === oldPerFloor) return;

  if(newPerFloor > oldPerFloor){
    const rng = makeRng(cfg.seed + Date.now()%1000);
    for(let f=1; f<=cfg.floors; f++){
      for(let pos=oldPerFloor; pos<newPerFloor; pos++){
        const area = +(34 + Math.round(rng()*78)).toFixed(0);
        const pricePerM = Math.round((cfg.basePrice + (f*1.4) + rng()*40));
        state.unitsList.push({
          id: uid('u'), buildingId: cfg.id, corp, floor:f, position:pos,
          displayNum: '№'+(state.unitsList.length+1),
          area, pricePerM, total: Math.round(area*pricePerM/1000*10)/10,
          status:'free', managerId: MANAGERS[0].id, clientId: null,
          kind: cfg.kind, favorite:false,
          createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    }
  } else {
    state.unitsList = state.unitsList.filter(u => !(u.corp===corp && u.position>=newPerFloor));
  }
  cfg.perFloor = newPerFloor;
  saveState();
}

function addCorp(name){
  const cfg = state.buildingConfig;
  if(cfg.corps.includes(name)) return;
  cfg.corps.push(name);
  const rng = makeRng(cfg.seed + Date.now()%1000);
  for(let f=cfg.floors; f>=1; f--){
    for(let pos=0; pos<cfg.perFloor; pos++){
      const area = +(34 + Math.round(rng()*78)).toFixed(0);
      const pricePerM = Math.round((cfg.basePrice + (f*1.4) + rng()*40));
      state.unitsList.push({
        id: uid('u'), buildingId: cfg.id, corp:name, floor:f, position:pos,
        displayNum: '№'+(state.unitsList.length+1),
        area, pricePerM, total: Math.round(area*pricePerM/1000*10)/10,
        status:'free', managerId: MANAGERS[0].id, clientId: null,
        kind: cfg.kind, favorite:false,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
  }
  saveState();
}

// ---------- Мутации показов ----------
function createShow(data){
  const show = {
    id: uid('sh'),
    clientId:  data.clientId,
    unitId:    data.unitId || null,
    managerId: data.managerId,
    date:      data.date,
    time:      data.time,
    status:    data.status || 'planned',
    comment:   data.comment || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.shows.push(show);
  saveState();
  return show;
}

function updateShow(id, patch){
  const s = state.shows.find(x=>x.id===id);
  if(!s) return;
  Object.assign(s, patch, { updatedAt: Date.now() });
  saveState();
}

function deleteShow(id){
  const i = state.shows.findIndex(s=>s.id===id);
  if(i<0) return;
  state.shows.splice(i,1);
  saveState();
}

function showsOnDate(iso){
  return state.shows
    .filter(s=>s.date===iso)
    .sort((a,b)=>a.time.localeCompare(b.time));
}

function showsInMonth(y,m){
  const prefix = y+'-'+String(m+1).padStart(2,'0')+'-';
  return state.shows.filter(s=>s.date.startsWith(prefix));
}

// ---------- KPI карточка (для воронки и дашборда) ----------
function kpi(label,val,trend,note){
  return `<div class="kpi"><div class="label">${label}</div><div class="val">${val}</div><div class="trend ${trend}">${trend==='up'?'▲':'▼'} ${note}</div></div>`;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = '<span style="color:var(--st-booked)">✓</span> '+msg;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}
