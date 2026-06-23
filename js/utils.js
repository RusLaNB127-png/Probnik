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

// ---------- Корпус: его собственная конфигурация ----------
function corpCfg(buildingConfig, corp){
  if(!buildingConfig.corpsConfig) buildingConfig.corpsConfig = {};
  if(!buildingConfig.corpsConfig[corp]){
    buildingConfig.corpsConfig[corp] = {
      floors:   buildingConfig.floors   || 16,
      perFloor: buildingConfig.perFloor || 6,
    };
  }
  return buildingConfig.corpsConfig[corp];
}

// ---------- Дефолтный «вид из окна» для генерации ----------
function defaultViewForUnit(corp, floor, pos, perFloor, rng){
  // Чтобы окна имели разные виды — берём по позиции
  const dirs = VIEW_DIRECTIONS;
  const cats = VIEW_CATEGORIES;
  const dir  = dirs[(pos + Math.floor(floor/2)) % dirs.length];
  const cat  = cats[Math.floor(rng()*cats.length)];
  return {
    direction:   dir,
    category:    cat.id,
    description: '',
    comment:     '',
    photos:      [],   // [{ id, url, isMain }]
  };
}

// ---------- Генерация помещений ----------
function genUnits(buildingConfig){
  const b = buildingConfig;
  const rng = makeRng(b.seed);
  const units = [];
  b.corps.forEach((corp, ci)=>{
    const ccfg = corpCfg(b, corp);
    for(let f=ccfg.floors; f>=1; f--){
      for(let pos=0; pos<ccfg.perFloor; pos++){
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
          view:         defaultViewForUnit(corp, f, pos, ccfg.perFloor, rng),
          plans:        [],     // [{ id, url, title }]
          photos:       [],     // [{ id, url, isMain }]
          createdAt:    Date.now(),
          updatedAt:    Date.now(),
        });
      }
    }
  });
  return units;
}

// ---------- Миграция помещения (для старых сохранений) ----------
function migrateUnit(u){
  if(!u.view){
    u.view = { direction:'', category:'', description:'', comment:'', photos:[] };
  }
  if(!Array.isArray(u.view.photos)) u.view.photos = [];
  if(!Array.isArray(u.plans))  u.plans  = [];
  if(!Array.isArray(u.photos)) u.photos = [];
  return u;
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
  clients:         [],                // массив клиентов (расширенная структура)
  favorites:       new Set(),         // id избранных помещений (общий чек)
  selectedUnitId:  null,
  activeClientId:  'c1',
  filters:         { corp:'', floor:'', status:'', manager:'', priceMin:'', priceMax:'', areaMin:'', areaMax:'', favoritesOnly:false, query:'' },
  clientFilters:   { query:'', mgr:'', stage:'', source:'', priority:'' },
  clientCardTab:   'overview',        // overview | units | shows | tasks | docs | timeline
  adminMode:       false,
  // Шахматка: режим отображения
  chessView:       'grid',            // grid | floor | facade
  floorViewCorp:   '',                // выбранный корпус для режима «Интерактивный этаж»
  floorViewFloor:  null,              // выбранный этаж
  facadeCorp:      '',                // выбранный корпус для режима «Вид корпуса»
  presentationMode:false,             // презентационный режим карточки
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
      clients:        state.clients,
      favorites:      [...state.favorites],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }catch(err){
    console.warn('Не удалось сохранить состояние:', err);
  }
}

function migrateClient(c){
  // Дополняем недостающие поля для совместимости со старыми сохранениями
  const defaults = {
    dob:'', phone2:'', email:'', city:'', citizenship:'РФ',
    propertyKind:'', areaPref:'', floorPref:'', viewPref:'',
    targetObject: c.object || '', priority: 'medium', nextContact:'',
    wishes:'', objections:'', refusalReason:'',
    favoriteUnitIds:[], contacts:[], managerHistory:[], documents:[],
    tasks:[], interactions:[],
    createdAt: isoDate(TODAY), updatedAt: Date.now(),
  };
  Object.keys(defaults).forEach(k=>{ if(c[k]===undefined) c[k] = defaults[k]; });

  // Старый формат tasks: [[title, due, overdue]] → новый массив объектов
  if(Array.isArray(c.tasks) && c.tasks.length && Array.isArray(c.tasks[0])){
    c.tasks = c.tasks.map(([title,due,od])=>({
      id: uid('t'), title, assigneeId: c.mgr,
      dueDate: od ? isoDate(addDays(TODAY,-1)) : isoDate(addDays(TODAY,1)),
      done: false, createdAt: isoDate(TODAY),
    }));
  }
  // Старые comms → interactions
  if(Array.isArray(c.comms) && c.comms.length && (!c.interactions || !c.interactions.length)){
    c.interactions = c.comms.map(([t,d])=>({
      id: uid('i'), type:'comment', at:t, text:d, refId:null, refType:null,
    }));
  }
  if(!c.managerHistory || !c.managerHistory.length){
    c.managerHistory = [{managerId: c.mgr, from: c.createdAt || isoDate(TODAY), to:null, reason:'Первичное закрепление'}];
  }
  return c;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data.buildingConfig || !data.unitsList) return false;
    state.buildingConfig = data.buildingConfig;
    // Миграция корпусной конфигурации (если её ещё нет — собираем из верхнеуровневых floors/perFloor)
    if(!state.buildingConfig.corpsConfig){
      state.buildingConfig.corpsConfig = {};
    }
    state.buildingConfig.corps.forEach(c=>corpCfg(state.buildingConfig, c));
    state.unitsList      = (data.unitsList || []).map(migrateUnit);
    state.shows          = data.shows || [];
    state.clients        = (data.clients && data.clients.length ? data.clients : JSON.parse(JSON.stringify(DEFAULT_CLIENTS))).map(migrateClient);
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
  state.clients        = JSON.parse(JSON.stringify(DEFAULT_CLIENTS));
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
function clients(){ return state.clients; }
function getClient(id){ return state.clients.find(c=>c.id===id); }
function mgrName(id){ return (MANAGERS.find(m=>m.id===id)||{}).name||'—'; }
function mgrShort(id){ return (MANAGERS.find(m=>m.id===id)||{}).short||'—'; }
function fmtMoney(mln){ return mln.toLocaleString('ru-RU',{maximumFractionDigits:1})+' млн ₽'; }

// Поиск клиента по имени (для legacy unit.client → clientId)
function findClientByName(name){
  if(!name) return null;
  return state.clients.find(c=>c.name===name) || null;
}

// ---------- Хелпер: «сейчас» в формате YYYY-MM-DD HH:MM ----------
function nowStamp(){
  const d = TODAY;
  return isoDate(d)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

// ---------- Логирование событий timeline клиента ----------
function logInteraction(clientId, type, text, refType=null, refId=null){
  const c = getClient(clientId);
  if(!c) return;
  if(!c.interactions) c.interactions = [];
  c.interactions.push({
    id: uid('i'),
    type, text,
    at: nowStamp(),
    refType, refId,
  });
  c.updatedAt = Date.now();
  saveState();
}

// ---------- CRUD клиентов ----------
function createClient(data){
  const client = {
    id:           uid('c'),
    name:         data.name || 'Без имени',
    dob:          data.dob || '',
    phone:        data.phone || '',
    phone2:       data.phone2 || '',
    email:        data.email || '',
    city:         data.city || '',
    citizenship:  data.citizenship || '',
    budget:       data.budget || '',
    goal:         data.goal || 'Проживание',
    targetObject: data.targetObject || '',
    propertyKind: data.propertyKind || '',
    areaPref:     data.areaPref || '',
    floorPref:    data.floorPref || '',
    viewPref:     data.viewPref || '',
    source:       data.source || 'Сайт',
    mgr:          data.mgr || MANAGERS[0].id,
    stage:        data.stage || 'Новый лид',
    priority:     data.priority || 'medium',
    nextContact:  data.nextContact || '',
    note:         data.note || '',
    wishes:       data.wishes || '',
    objections:   data.objections || '',
    refusalReason:data.refusalReason || '',
    favoriteUnitIds: [],
    contacts:        [],
    managerHistory:  [{managerId: data.mgr || MANAGERS[0].id, from: isoDate(TODAY), to: null, reason:'Создание клиента'}],
    documents:       [],
    tasks:           [],
    interactions:    [],
    createdAt:    isoDate(TODAY),
    updatedAt:    Date.now(),
  };
  state.clients.push(client);
  logInteraction(client.id, 'created', 'Создан клиент · источник: '+client.source);
  saveState();
  return client;
}

function updateClient(id, patch){
  const c = getClient(id);
  if(!c) return;
  // Отслеживаем смену стадии и менеджера
  if(patch.stage && patch.stage !== c.stage){
    logInteraction(id, 'status_change', `Статус: ${c.stage} → ${patch.stage}`);
  }
  if(patch.mgr && patch.mgr !== c.mgr){
    const fromName = mgrName(c.mgr), toName = mgrName(patch.mgr);
    if(!c.managerHistory) c.managerHistory = [];
    const last = c.managerHistory[c.managerHistory.length-1];
    if(last) last.to = isoDate(TODAY);
    c.managerHistory.push({managerId: patch.mgr, from: isoDate(TODAY), to: null, reason: patch.managerReason || 'Смена менеджера'});
    logInteraction(id, 'manager_changed', `Менеджер: ${fromName} → ${toName}`);
  }
  delete patch.managerReason;
  Object.assign(c, patch, { updatedAt: Date.now() });
  saveState();
}

function deleteClient(id){
  const i = state.clients.findIndex(c=>c.id===id);
  if(i<0) return;
  state.clients.splice(i,1);
  // Развязываем помещения
  state.unitsList.forEach(u=>{ if(u.clientId===id) u.clientId = null; });
  // Удаляем показы клиента
  state.shows = state.shows.filter(s=>s.clientId!==id);
  saveState();
}

// ---------- Задачи ----------
function createTask(clientId, data){
  const c = getClient(clientId);
  if(!c) return;
  if(!c.tasks) c.tasks = [];
  const task = {
    id: uid('t'),
    title: data.title || 'Новая задача',
    assigneeId: data.assigneeId || c.mgr,
    dueDate: data.dueDate || isoDate(TODAY),
    done: false,
    createdAt: isoDate(TODAY),
  };
  c.tasks.push(task);
  logInteraction(clientId, 'task_created', 'Задача: '+task.title);
  saveState();
  return task;
}

function updateTask(clientId, taskId, patch){
  const c = getClient(clientId);
  if(!c || !c.tasks) return;
  const t = c.tasks.find(x=>x.id===taskId);
  if(!t) return;
  const wasDone = t.done;
  Object.assign(t, patch);
  if(!wasDone && t.done) logInteraction(clientId, 'task_completed', 'Выполнена задача: '+t.title);
  saveState();
}

function deleteTask(clientId, taskId){
  const c = getClient(clientId);
  if(!c || !c.tasks) return;
  c.tasks = c.tasks.filter(t=>t.id!==taskId);
  saveState();
}

// ---------- Документы ----------
function addDocument(clientId, data){
  const c = getClient(clientId);
  if(!c) return;
  if(!c.documents) c.documents = [];
  const doc = {
    id: uid('d'),
    name: data.name || 'document.pdf',
    type: data.type || 'Документ',
    addedAt: isoDate(TODAY),
    size: data.size || '—',
  };
  c.documents.push(doc);
  logInteraction(clientId, 'document_added', 'Добавлен документ: '+doc.name);
  saveState();
  return doc;
}

function deleteDocument(clientId, docId){
  const c = getClient(clientId);
  if(!c || !c.documents) return;
  c.documents = c.documents.filter(d=>d.id!==docId);
  saveState();
}

// ---------- Контактные лица ----------
function addContact(clientId, data){
  const c = getClient(clientId);
  if(!c) return;
  if(!c.contacts) c.contacts = [];
  const contact = {
    id: uid('ct'),
    name: data.name || '',
    role: data.role || '',
    phone: data.phone || '',
    email: data.email || '',
  };
  c.contacts.push(contact);
  saveState();
  return contact;
}

function deleteContact(clientId, contactId){
  const c = getClient(clientId);
  if(!c || !c.contacts) return;
  c.contacts = c.contacts.filter(ct=>ct.id!==contactId);
  saveState();
}

// ---------- Избранные помещения клиента ----------
function toggleClientFavorite(clientId, unitId){
  const c = getClient(clientId);
  if(!c) return;
  if(!c.favoriteUnitIds) c.favoriteUnitIds = [];
  const i = c.favoriteUnitIds.indexOf(unitId);
  if(i>=0){
    c.favoriteUnitIds.splice(i,1);
  } else {
    c.favoriteUnitIds.push(unitId);
    const u = getUnit(unitId);
    if(u) logInteraction(clientId, 'favorite_added', 'Добавлено в избранное: '+u.displayNum);
  }
  saveState();
}

// Подборки помещений по клиенту
function unitsForClient(clientId){
  return {
    owned:    state.unitsList.filter(u=>u.clientId===clientId && (u.status==='sold' || u.status==='contract')),
    booked:   state.unitsList.filter(u=>u.clientId===clientId && u.status==='booked'),
    shown:    state.unitsList.filter(u=>{
      // помещения по которым были показы (любой статус показа)
      return state.shows.some(s=>s.clientId===clientId && s.unitId===u.id);
    }),
    favorite: state.unitsList.filter(u=>{
      const c = getClient(clientId);
      return c && c.favoriteUnitIds && c.favoriteUnitIds.includes(u.id);
    }),
  };
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

// Внутренний помощник: создать одно помещение с правильным дефолтом вида
function makeUnit(cfg, corp, floor, pos, rng){
  const area = +(34 + Math.round(rng()*78)).toFixed(0);
  const pricePerM = Math.round((cfg.basePrice + (floor*1.4) + rng()*40));
  const ccfg = corpCfg(cfg, corp);
  return {
    id: uid('u'), buildingId: cfg.id, corp, floor, position:pos,
    displayNum: '№'+(state.unitsList.length+1),
    area, pricePerM, total: Math.round(area*pricePerM/1000*10)/10,
    status:'free', managerId: MANAGERS[0].id, clientId: null,
    kind: cfg.kind, favorite:false,
    view:   defaultViewForUnit(corp, floor, pos, ccfg.perFloor, rng),
    plans:  [], photos: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

// Изменение этажности конкретного корпуса (не затрагивает остальные).
function setFloors(corp, newFloors){
  const cfg = state.buildingConfig;
  const ccfg = corpCfg(cfg, corp);
  const oldFloors = ccfg.floors;
  if(newFloors === oldFloors) return;

  if(newFloors > oldFloors){
    const rng = makeRng(cfg.seed + Date.now()%1000 + corp.length);
    for(let f = oldFloors+1; f<=newFloors; f++){
      for(let pos=0; pos<ccfg.perFloor; pos++){
        state.unitsList.push(makeUnit(cfg, corp, f, pos, rng));
      }
    }
  } else {
    state.unitsList = state.unitsList.filter(u => !(u.corp===corp && u.floor>newFloors));
  }
  ccfg.floors = newFloors;
  saveState();
}

// Изменение количества помещений на этаже — только в выбранном корпусе.
function setPerFloor(corp, newPerFloor){
  const cfg = state.buildingConfig;
  const ccfg = corpCfg(cfg, corp);
  const oldPerFloor = ccfg.perFloor;
  if(newPerFloor === oldPerFloor) return;

  if(newPerFloor > oldPerFloor){
    const rng = makeRng(cfg.seed + Date.now()%1000 + corp.length);
    for(let f=1; f<=ccfg.floors; f++){
      for(let pos=oldPerFloor; pos<newPerFloor; pos++){
        state.unitsList.push(makeUnit(cfg, corp, f, pos, rng));
      }
    }
  } else {
    state.unitsList = state.unitsList.filter(u => !(u.corp===corp && u.position>=newPerFloor));
  }
  ccfg.perFloor = newPerFloor;
  saveState();
}

function addCorp(name){
  const cfg = state.buildingConfig;
  if(cfg.corps.includes(name)) return;
  cfg.corps.push(name);
  // Новый корпус получает дефолтную конфигурацию, независимую от других
  cfg.corpsConfig[name] = { floors: 12, perFloor: 6 };
  const ccfg = cfg.corpsConfig[name];
  const rng = makeRng(cfg.seed + Date.now()%1000 + name.length);
  for(let f=ccfg.floors; f>=1; f--){
    for(let pos=0; pos<ccfg.perFloor; pos++){
      state.unitsList.push(makeUnit(cfg, name, f, pos, rng));
    }
  }
  saveState();
}

// Удалить корпус целиком (со всеми помещениями)
function removeCorp(name){
  const cfg = state.buildingConfig;
  const i = cfg.corps.indexOf(name);
  if(i<0) return;
  cfg.corps.splice(i,1);
  delete cfg.corpsConfig[name];
  state.unitsList = state.unitsList.filter(u => u.corp!==name);
  saveState();
}

// ---------- Фотографии: добавление/удаление/назначение основной ----------
function addUnitViewPhoto(unitId, url){
  const u = getUnit(unitId); if(!u || !url) return;
  if(!u.view) u.view = { direction:'', category:'', description:'', comment:'', photos:[] };
  const isMain = !u.view.photos.some(p=>p.isMain);
  u.view.photos.push({ id: uid('vp'), url, isMain });
  u.updatedAt = Date.now();
  saveState();
}
function removeUnitViewPhoto(unitId, photoId){
  const u = getUnit(unitId); if(!u || !u.view) return;
  const removed = u.view.photos.find(p=>p.id===photoId);
  u.view.photos = u.view.photos.filter(p=>p.id!==photoId);
  if(removed && removed.isMain && u.view.photos.length){
    u.view.photos[0].isMain = true;
  }
  saveState();
}
function setMainViewPhoto(unitId, photoId){
  const u = getUnit(unitId); if(!u || !u.view) return;
  u.view.photos.forEach(p=>p.isMain = (p.id===photoId));
  saveState();
}
function addUnitPlan(unitId, url, title){
  const u = getUnit(unitId); if(!u || !url) return;
  u.plans.push({ id: uid('pl'), url, title: title || ('Планировка '+(u.plans.length+1)) });
  saveState();
}
function removeUnitPlan(unitId, planId){
  const u = getUnit(unitId); if(!u) return;
  u.plans = u.plans.filter(p=>p.id!==planId);
  saveState();
}
function updateUnitView(unitId, patch){
  const u = getUnit(unitId); if(!u) return;
  if(!u.view) u.view = { direction:'', category:'', description:'', comment:'', photos:[] };
  Object.assign(u.view, patch);
  u.updatedAt = Date.now();
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
