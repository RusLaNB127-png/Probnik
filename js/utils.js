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
          // Разное время последнего изменения — как в реальной базе:
          // часть помещений давно без движения (нужно для правил «зависла»)
          updatedAt:    Date.now() - Math.floor(rng()*150)*86400000,
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
  ensurePriceHistory(u);
  return u;
}

// ---------- История цены помещения (для аналитики динамики цен) ----------
// Если истории нет — синтезируем правдоподобный рост к текущей цене за 6 месяцев.
function ensurePriceHistory(u){
  if(Array.isArray(u.priceHistory) && u.priceHistory.length) return u.priceHistory;
  const cur = +u.pricePerM || 0;
  const seed = String(u.id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const pts = [];
  const months = 6;
  for(let i=months-1; i>=0; i--){
    const base = 1 - i*0.021;                    // рост ~2.1%/мес к текущей
    const jitter = ((seed % 7) - 3) * 0.003;     // ±0.9% индивидуально
    const d = addDays(TODAY, -i*30);
    pts.push({ date: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)),
               pricePerM: Math.max(1, Math.round(cur*(base + (i? jitter:0)))) });
  }
  pts[pts.length-1].pricePerM = cur;             // последняя точка = текущая цена
  u.priceHistory = pts;
  return pts;
}
function pushPriceHistory(u, newPrice){
  ensurePriceHistory(u);
  u.priceHistory.push({ date: isoDate(TODAY), pricePerM: Math.round(newPrice) });
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
  filters:         { corp:'', floor:'', status:'', manager:'', view:'', priceMin:'', priceMax:'', areaMin:'', areaMax:'', favoritesOnly:false, query:'' },
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
  dash:            null,              // данные дашборда РОП (редактируемые, в базе)
  checklist:       null,             // чек-лист ОП: { tasks:[...] } (в базе)
  currentUser:     'rop',            // активная учётная запись (роль)
  activity:        [],               // живой журнал действий (авто-события)
  auth:            { users:null, sessionUid:null },  // учётные записи + сессия
  mortgage:        null,             // программы ипотеки (в базе)
  rules:           null,             // правила автоматизации (в базе)
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
      dash:           state.dash,
      checklist:      state.checklist,
      currentUser:    state.currentUser,
      activity:       state.activity,
      auth:           { users: state.auth.users },
      mortgage:       state.mortgage,
      rules:          state.rules,
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
    state.dash           = normalizeDash(data.dash);
    state.checklist      = normalizeChecklist(data.checklist);
    state.currentUser    = data.currentUser || 'rop';
    state.activity       = Array.isArray(data.activity) ? data.activity : [];
    state.auth           = normalizeAuth(data.auth);
    state.mortgage       = (data.mortgage && Array.isArray(data.mortgage.programs)) ? data.mortgage : null;
    state.rules          = (data.rules && Array.isArray(data.rules.list)) ? data.rules : null;
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
  state.dash           = emptyDash();
  state.checklist      = defaultChecklist();
  state.activity       = [];
  state.auth           = normalizeAuth(null);
  state.mortgage       = null;
  state.rules          = null;
  saveState();
}

/* ============================================================
   ЧЕК-ЛИСТ ОП — задачи со статусами (в базе).
   Каждая задача закреплена за сотрудником (ответственным).
   ============================================================ */
function defaultTasks(){
  return DEFAULT_TASKS_SEED.map(t=>({
    id:        uid('tsk'),
    title:     t.title,
    due:       isoDate(addDays(TODAY, t.dayOffset)),
    managerId: t.managerId,
    status:    t.status || 'planned',
    comment:   t.comment || '',
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
}
function defaultChecklist(){ return { tasks: defaultTasks() }; }
function normalizeChecklist(c){
  // Новый формат — { tasks:[...] }. Старый (sections/progress) отбрасываем.
  if(c && Array.isArray(c.tasks)) return { tasks: c.tasks };
  return defaultChecklist();
}
function checklistData(){
  if(!state.checklist || !Array.isArray(state.checklist.tasks)) state.checklist = defaultChecklist();
  return state.checklist;
}
function tasksAll(){ return checklistData().tasks; }
function tasksFor(mgrId){ return tasksAll().filter(t=>t.managerId===mgrId); }
function taskStats(mgrId){
  const arr = tasksFor(mgrId);
  const by = s => arr.filter(t=>t.status===s).length;
  const today = isoDate(TODAY);
  const overdue = arr.filter(t=>t.status!=='done' && t.due && t.due < today).length;
  return {
    total: arr.length, done: by('done'), inProgress: by('in_progress'),
    planned: by('planned'), failed: by('failed'), overdue,
    pct: arr.length ? Math.round(by('done')/arr.length*100) : 0,
  };
}
function taskAdd(data){
  const t = {
    id: uid('tsk'),
    title: data.title || 'Новая задача',
    due: data.due || '',
    managerId: data.managerId || MANAGERS[0].id,
    status: data.status || 'planned',
    comment: data.comment || '',
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  tasksAll().push(t); saveState(); return t;
}
function taskUpdate(id, patch){
  const t = tasksAll().find(x=>x.id===id);
  if(t){
    const wasDone = t.status==='done';
    Object.assign(t, patch); t.updatedAt = Date.now();
    if(patch.status==='done' && !wasDone){
      logActivity({ type:'task', icon:'check', text:'Задача выполнена: '+t.title, who:t.managerId });
    }
  }
  saveState();
}
function taskRemove(id){
  const a = tasksAll(); const i = a.findIndex(x=>x.id===id);
  if(i>=0) a.splice(i,1); saveState();
}
function checklistLoadDefault(){ state.checklist = defaultChecklist(); saveState(); }
function checklistClear(){ state.checklist = { tasks: [] }; saveState(); }

/* ---------- Текущая учётная запись (роль) ---------- */
function currentUserId(){ return state.currentUser || 'rop'; }
function currentUser(){ return getUser(currentUserId()); }
function isRop(){ return currentUserId() === 'rop'; }
function canManageTasks(){ return isRop() || state.adminMode; }
function setCurrentUser(id){ state.currentUser = id; saveState(); }

/* ============================================================
   ЖИВОЙ ЖУРНАЛ ДЕЙСТВИЙ + АВТОЗАДАЧИ
   Центральные события (бронь, показ, сделка, новый клиент,
   выполненная задача) пишутся в state.activity и порождают
   автозадачи в чек-листе ответственного менеджера.
   ============================================================ */
function logActivity(ev){
  if(!Array.isArray(state.activity)) state.activity = [];
  state.activity.unshift({
    id:   uid('act'),
    ts:   Date.now(),
    type: ev.type || 'note',
    icon: ev.icon || 'doc',
    text: ev.text || '',
    who:  ev.who || '',
  });
  if(state.activity.length > 80) state.activity.length = 80;
  saveState();
  if(typeof refreshLive === 'function') refreshLive();
}
// Автозадача с защитой от дублей по ключу источника
function autoTask(srcKey, data){
  if(!srcKey) return;
  if(tasksAll().some(t=>t.srcKey===srcKey)) return;
  const t = taskAdd(data);
  t.srcKey = srcKey;
  saveState();
  return t;
}
// Относительное время («5 мин назад», «2 ч назад», дата)
function timeAgo(ts){
  const diff = Math.max(0, Date.now()-ts), min = Math.floor(diff/60000);
  if(min < 1)  return 'только что';
  if(min < 60) return min+' мин назад';
  const h = Math.floor(min/60);
  if(h < 24)   return h+' ч назад';
  const d = new Date(ts);
  return isoDate(d).split('-').reverse().slice(0,2).join('.');
}
// Реакция на смену статуса помещения
function onUnitStatusChange(u, from, to){
  const label = (STATUSES[to]||{}).label || to;
  const icons = { booked:'clock', contract:'doc', sold:'check', free:'home', show:'eye', unavailable:'close' };
  logActivity({ type:'status', icon: icons[to]||'home',
    text: `${u.displayNum} · ${u.corp}: статус «${label}»`, who: u.managerId });
  if(to==='booked')
    autoTask('book:'+u.id, { title:`Оформить договор — ${u.displayNum} (${u.corp})`,
      managerId:u.managerId, due: isoDate(addDays(TODAY,3)), status:'planned',
      comment:'Автозадача: помещение забронировано' });
  if(to==='contract')
    autoTask('deal:'+u.id, { title:`Собрать документы — ${u.displayNum} (${u.corp})`,
      managerId:u.managerId, due: isoDate(addDays(TODAY,2)), status:'planned',
      comment:'Автозадача: оформление сделки' });
  if(typeof rulesRun === 'function') rulesRun('unit_status', { unit:u, mgrId:u.managerId, to });
}

/* ============================================================
   ДАШБОРД РОП — данные в базе, редактируемые в админ-режиме
   ============================================================ */
function emptyDash(){
  return { plan:0, overdue:0, period:'', managers:[], hot:[], problems:[], planFact:[], aiRecs:[], log:[] };
}
function normalizeDash(d){
  const base = emptyDash();
  if(!d || typeof d!=='object') return base;
  const arr = x => Array.isArray(x) ? x : [];
  return {
    plan:     +d.plan || 0,
    overdue:  +d.overdue || 0,
    period:   d.period || '',
    managers: arr(d.managers),
    hot:      arr(d.hot),
    problems: arr(d.problems),
    planFact: arr(d.planFact),
    aiRecs:   arr(d.aiRecs),
    log:      arr(d.log),
  };
}
function dashData(){ if(!state.dash) state.dash = emptyDash(); return state.dash; }
function dashSetField(k, v){ dashData()[k] = v; saveState(); }
function dashAdd(section, item){ item.id = uid('d'); dashData()[section].push(item); saveState(); return item; }
function dashUpdate(section, id, patch){
  const it = dashData()[section].find(x=>x.id===id);
  if(it) Object.assign(it, patch);
  saveState();
}
function dashRemove(section, id){
  const a = dashData()[section];
  const i = a.findIndex(x=>x.id===id);
  if(i>=0) a.splice(i, 1);
  saveState();
}
function dashClear(){ state.dash = emptyDash(); saveState(); }
// Демонстрационный набор из встроенного DASH — для кнопки «Загрузить пример»
function demoDash(){
  return {
    plan: DASH.plan, overdue: DASH.overdue, period: 'июнь 2026',
    managers: DASH.managers.map(m=>({ id:uid('d'), name:m.name, plan:m.plan, fact:m.fact, books:m.books, conv:m.conv, rating:m.rating })),
    hot:      DASH.hot.map(([name,object,level,prob])=>({ id:uid('d'), name, object, level, prob })),
    problems: DASH.problems.map(([name,desc,tag])=>({ id:uid('d'), name, desc, tag })),
    planFact: DASH.planFact.map(([name,plan,fact])=>({ id:uid('d'), name, plan, fact })),
    aiRecs:   DASH.aiRecs.map(([title,text])=>({ id:uid('d'), title, text })),
    log:      DASH.log.map(([time,who,action,icon])=>({ id:uid('d'), time, who, action, icon })),
  };
}
function dashLoadDemo(){ state.dash = demoDash(); saveState(); }

// При старте: загружаем сохранённое или генерируем дефолт
function initState(){
  if(!loadState()) resetToDefaults();
  if(!state.auth || !Array.isArray(state.auth.users)) state.auth = normalizeAuth(null);
  syncManagersFromAuth();               // дозаписать в MANAGERS добавленных сотрудников
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
  logActivity({ type:'lead', icon:'user', text:'Новый клиент: '+client.name+' · '+client.source, who: client.mgr });
  if(typeof rulesRun === 'function') rulesRun('client_created', { client, mgrId: client.mgr });
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
  const prevStatus = u.status, prevPrice = +u.pricePerM;
  Object.assign(u, patch, { updatedAt: Date.now() });
  if(patch.pricePerM != null && +patch.pricePerM !== prevPrice){
    pushPriceHistory(u, +patch.pricePerM);
    logActivity({ type:'price', icon:'swap',
      text:`${u.displayNum} · ${u.corp}: цена м² ${prevPrice.toLocaleString('ru-RU')} → ${(+patch.pricePerM).toLocaleString('ru-RU')} ₽`,
      who: u.managerId });
    if(typeof rulesRun === 'function') rulesRun('price_changed', { unit:u, mgrId:u.managerId });
  }
  saveState();
  if(patch.status && patch.status !== prevStatus) onUnitStatusChange(u, prevStatus, patch.status);
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
  const cl = getClient(show.clientId), un = getUnit(show.unitId);
  logActivity({ type:'show', icon:'eye',
    text:`Назначен показ${cl?' · '+cl.name:''}${un?' · '+un.displayNum:''} на ${fmtDateRu(show.date)} ${show.time||''}`.trim(),
    who: show.managerId });
  autoTask('show:'+show.id, {
    title:`Провести показ${cl?' — '+cl.name:''}${un?' ('+un.displayNum+')':''}`,
    managerId: show.managerId, due: show.date, status:'planned',
    comment:'Автозадача: назначен показ' + (show.time?' в '+show.time:'') });
  if(typeof rulesRun === 'function') rulesRun('show_created', { unit:un, client:cl, mgrId:show.managerId });
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

/* ============================================================
   ЕДИНЫЙ НАБОР МОНОХРОМНЫХ ЛИНЕЙНЫХ ИКОНОК
   Все иконки — currentColor, штриховые, единая толщина.
   icon('name')          → инлайн-SVG для HTML
   iconInSvg('name',x,y) → вложенный SVG (для планов/чертежей)
   ============================================================ */
const ICON_PATHS = {
  plus:      '<path d="M12 5v14M5 12h14"/>',
  close:     '<path d="M6 6l12 12M18 6L6 18"/>',
  edit:      '<path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3Z"/><path d="M14 7l3 3"/>',
  check:     '<path d="M20 6L9 17l-5-5"/>',
  star:      '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z"/>',
  arrowRight:'<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowUp:   '<path d="M12 19V6M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v13M6 13l6 6 6-6"/>',
  calendar:  '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  user:      '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-3.8 3.7-5.6 7.5-5.6s6.8 1.8 7.5 5.6"/>',
  users:     '<circle cx="9" cy="8" r="3.2"/><path d="M2.6 19.5c.6-3.3 3-4.9 6.4-4.9s5.8 1.6 6.4 4.9"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M18 14.6c2.6.4 4.2 1.9 4.7 4.6"/>',
  home:      '<path d="M4 11l8-6.5L20 11"/><path d="M6 9.7V20h12V9.7"/>',
  phone:     '<path d="M5.5 4h3.2l1.6 4-2.1 1.5a11 11 0 0 0 4.8 4.8L15.5 12l4 1.6v3.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4Z"/>',
  eye:       '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  mail:      '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 5.5L20 7"/>',
  monitor:   '<rect x="3" y="4.5" width="18" height="11.5" rx="2"/><path d="M8.5 20h7M12 16v4"/>',
  ruler:     '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  gear:      '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  camera:    '<path d="M4 8.5h3l1.7-2h6.6l1.7 2H20a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="13.5" r="3.3"/>',
  grid:      '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17M12 3.5v17"/>',
  compass:   '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8Z"/>',
  flame:     '<path d="M12 3c.5 3 3.5 4 3.5 7.5a3.5 3.5 0 0 1-7 0c0-1.3.6-2.2 1.2-2.8.2 1 .8 1.5 1.5 1.7.3-2 .8-4 .8-6.4Z"/>',
  alert:     '<path d="M12 4l8.5 15H3.5Z"/><path d="M12 10.5v4M12 17.5h.01"/>',
  sparkle:   '<path d="M12 3.5l1.7 4.8L18.5 10l-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7Z"/>',
  clock:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  doc:       '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>',
  swap:      '<path d="M7 8h13M7 8l3-3M7 8l3 3M17 16H4M17 16l-3-3M17 16l-3 3"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3.5v1"/><path d="M8.5 12.5l2 2 4-4.2"/>',
  download:  '<path d="M12 3v12M12 15l-4.5-4.5M12 15l4.5-4.5"/><path d="M4 20h16"/>',
  // Виды из окна (монохром)
  waves:     '<path d="M3 8c1.5-1.8 3.5-1.8 5 0s3.5 1.8 5 0 3.5-1.8 5 0M3 13c1.5-1.8 3.5-1.8 5 0s3.5 1.8 5 0 3.5-1.8 5 0M3 18c1.5-1.8 3.5-1.8 5 0s3.5 1.8 5 0 3.5-1.8 5 0"/>',
  mountain:  '<path d="M3 19l6-11 4 6.5 2.5-3.5L21 19Z"/>',
  droplet:   '<path d="M12 3.5s6 6 6 9.5a6 6 0 0 1-12 0c0-3.5 6-9.5 6-9.5Z"/>',
  tree:      '<path d="M12 4l4.5 7h-3l3 4.5H7.5l3-4.5h-3Z"/><path d="M12 15.5V21"/>',
  city:      '<path d="M3 21V9l6-3v15M9 21V4l6 3v14M15 21V10l6 3v8M2 21h20"/>',
  diamond:   '<path d="M12 3l8.5 9L12 21 3.5 12Z"/>',
  building2: '<rect x="3" y="8" width="7" height="12" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/><path d="M5.5 11h2M5.5 14h2M15.5 7h3M15.5 11h3M15.5 15h3"/>',
};
// Категория вида → имя иконки
const VIEW_ICON = { sea:'waves', mount:'mountain', pool:'droplet', park:'tree', court:'home', city:'city', inner:'diamond', corp:'building2' };
// Тип записи журнала → имя иконки
const LOG_ICON = { book:'home', show:'eye', deal:'edit', note:'mail', call:'phone', lead:'plus' };

function icon(name, size=16, cls=''){
  const p = ICON_PATHS[name];
  if(!p) return '';
  return `<svg class="licon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function iconStar(filled, size=16){
  const p = ICON_PATHS.star;
  return `<svg class="licon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
// Вложенный SVG для использования внутри другого <svg> (планы этажей)
function iconInSvg(name, x, y, size=16, stroke='currentColor'){
  const p = ICON_PATHS[name];
  if(!p) return '';
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

// ---------- KPI карточка (для воронки и дашборда) ----------
function kpi(label,val,trend,note){
  return `<div class="kpi"><div class="label">${label}</div><div class="val">${val}</div><div class="trend ${trend}">${icon(trend==='up'?'arrowUp':'arrowDown',12)} ${note}</div></div>`;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = icon('check',15)+' '+msg;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ============================================================
   ВЫГРУЗКА В EXCEL (.xlsx) — без внешних библиотек.
   Собираем валидный OOXML-архив (ZIP, метод store) вручную,
   чтобы работало офлайн в собранном HTML.
   ============================================================ */
function _crc32(u8){
  let crc = ~0;
  for(let i=0;i<u8.length;i++){
    crc ^= u8[i];
    for(let j=0;j<8;j++) crc = (crc>>>1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}
function _zipStore(files){
  const enc = new TextEncoder();
  const u16 = v => [v&255,(v>>>8)&255];
  const u32 = v => [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  const parts = [], central = [];
  let offset = 0;
  files.forEach(f=>{
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = _crc32(data), size = data.length;
    const local = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(name.length), u16(0)
    ));
    parts.push(local, name, data);
    central.push(new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset)
    )), name);
    offset += local.length + name.length + size;
  });
  let cenSize = 0; central.forEach(c=>cenSize += c.length);
  const eocd = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cenSize), u32(offset), u16(0)
  ));
  return new Blob([...parts, ...central, eocd],
    { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// rows: массив массивов; первая строка — заголовок (жирный)
function buildXlsx(sheetName, rows){
  const enc = new TextEncoder();
  const xmlEsc = s => String(s==null?'':s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const colLetter = n => { let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26);} return s; };
  const safeSheet = (sheetName||'Лист').replace(/[:\\\/?*\[\]]/g,' ').slice(0,31) || 'Лист';

  const body = rows.map((row, ri)=>{
    const cells = row.map((val, ci)=>{
      const ref = colLetter(ci)+(ri+1);
      const st = ri===0 ? ' s="1"' : '';
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`;
    }).join('');
    return `<row r="${ri+1}">${cells}</row>`;
  }).join('');
  const cols = `<cols><col min="1" max="1" width="5"/><col min="2" max="2" width="46"/><col min="3" max="3" width="16"/><col min="4" max="4" width="22"/><col min="5" max="5" width="18"/><col min="6" max="6" width="44"/></cols>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(safeSheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

  const e = s => enc.encode(s);
  return _zipStore([
    { name:'[Content_Types].xml',        data:e(contentTypes) },
    { name:'_rels/.rels',                data:e(rels) },
    { name:'xl/workbook.xml',            data:e(workbook) },
    { name:'xl/_rels/workbook.xml.rels', data:e(wbRels) },
    { name:'xl/styles.xml',              data:e(styles) },
    { name:'xl/worksheets/sheet1.xml',   data:e(sheet) },
  ]);
}
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 120);
}
function sanitizeFilename(name){
  return String(name||'файл').replace(/[\/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').trim() || 'файл';
}

/* ============================================================
   АВТОРИЗАЦИЯ (демо-контур: клиентская, не защита от взлома).
   Пароли — SHA-256 (синхронно, работает и на file://).
   Структура готова к замене на реальный API.
   ============================================================ */

// Компактный SHA-256 (Geraint Luff), работает без crypto.subtle
function sha256(ascii){
  function rightRotate(v,a){ return (v>>>a)|(v<<(32-a)); }
  var mathPow=Math.pow, maxWord=mathPow(2,32), i, j, result='';
  var words=[], asciiBitLength=ascii.length*8;
  var hash=sha256.h=sha256.h||[], k=sha256.k=sha256.k||[], primeCounter=k.length;
  var isComposite={};
  for(var candidate=2; primeCounter<64; candidate++){
    if(!isComposite[candidate]){
      for(i=0;i<313;i+=candidate){ isComposite[i]=candidate; }
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64-56) ascii+='\x00';
  for(i=0;i<ascii.length;i++){
    j=ascii.charCodeAt(i);
    if(j>>8) return;
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words.length]=((asciiBitLength/maxWord)|0);
  words[words.length]=(asciiBitLength);
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16), oldHash=hash;
    hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15], w2=w[i-2];
      var a=hash[0], e=hash[4];
      var temp1=hash[7]
        +(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))
        +((e&hash[5])^((~e)&hash[6]))+k[i]
        +(w[i]=(i<16)?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))
          +w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0);
      var temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))
        +((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
    }
    for(i=0;i<8;i++){ hash[i]=(hash[i]+oldHash[i])|0; }
  }
  for(i=0;i<8;i++){
    for(j=3;j+1;j--){
      var b=(hash[i]>>(j*8))&255;
      result+=((b<16)?0:'')+b.toString(16);
    }
  }
  return result;
}
function hashPassword(pw){
  const bytes=new TextEncoder().encode('italika-salt::'+pw);
  let bin=''; for(const b of bytes) bin+=String.fromCharCode(b);
  return sha256(bin);
}
function mkShort(name){ return String(name||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase(); }

const DEFAULT_PW = 'italika';
const ROLE_PERMS = {
  rop:     { dashboard:true,  analytics:true, admin:true,  allClients:true,  manageUsers:true  },
  manager: { dashboard:false, analytics:true, admin:false, allClients:false, manageUsers:false },
};

function defaultAccounts(){
  const h = hashPassword(DEFAULT_PW);
  const list = [{ uid:'rop', name:ROP_USER.name, email:'rop@italika.ru', role:'rop', mgrId:null, active:true, hash:h }];
  MANAGERS.forEach(m=> list.push({ uid:m.id, name:m.name, email:m.email||(m.id+'@italika.ru'), role:'manager', mgrId:m.id, active:true, hash:h }));
  return list;
}
function normalizeAuth(a){
  if(a && Array.isArray(a.users) && a.users.length) return { users:a.users };
  return { users: defaultAccounts() };
}
// Дозаписать в MANAGERS сотрудников, добавленных РОП-ом (из аккаунтов)
function syncManagersFromAuth(){
  (state.auth.users||[]).filter(u=>u.role==='manager').forEach(u=>{
    if(!MANAGERS.find(m=>m.id===u.mgrId))
      MANAGERS.push({ id:u.mgrId, name:u.name, short:mkShort(u.name), phone:'', email:u.email });
  });
}
function account(uid){ return (state.auth.users||[]).find(u=>u.uid===uid); }
function authUser(){ return account(state.auth && state.auth.sessionUid); }
function role(){ const u=authUser(); return u ? u.role : null; }
function can(perm){ const r=role(); return r ? !!(ROLE_PERMS[r]||{})[perm] : false; }

// Сессия (отдельно от основной базы; «запомнить меня» → localStorage, иначе sessionStorage)
const SESSION_KEY='terra-session';
function loadSessionUid(){ try{ return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || null; }catch(e){ return null; } }
function saveSessionUid(uid, remember){
  try{ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    (remember?localStorage:sessionStorage).setItem(SESSION_KEY, uid); }catch(e){}
}
function clearSessionUid(){ try{ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }catch(e){} }

function login(email, pw, remember){
  const acc = (state.auth.users||[]).find(u=>u.email.toLowerCase()===String(email||'').trim().toLowerCase());
  if(!acc)          return { ok:false, msg:'Пользователь с таким e-mail не найден' };
  if(!acc.active)   return { ok:false, msg:'Учётная запись отключена' };
  if(acc.hash !== hashPassword(pw)) return { ok:false, msg:'Неверный пароль' };
  state.auth.sessionUid = acc.uid;
  state.currentUser = acc.uid;
  saveSessionUid(acc.uid, remember);
  return { ok:true, acc };
}
function logout(){ state.auth.sessionUid=null; clearSessionUid(); }

// Управление учётными записями (РОП)
function userSetPassword(uid, pw){ const a=account(uid); if(a){ a.hash=hashPassword(pw||DEFAULT_PW); saveState(); } }
function userSetActive(uid, active){ const a=account(uid); if(a && a.uid!=='rop'){ a.active=!!active; saveState(); } }
function userAddManager(name, email, pw){
  const id = 'm'+Date.now().toString(36).slice(-5);
  MANAGERS.push({ id, name, short:mkShort(name), phone:'', email });
  state.auth.users.push({ uid:id, name, email, role:'manager', mgrId:id, active:true, hash:hashPassword(pw||DEFAULT_PW) });
  saveState();
  return id;
}
