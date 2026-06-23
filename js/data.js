/* ============================================================
   ДАННЫЕ (тестовые)
   Структура подготовлена для миграции на бэкенд:
   - каждая сущность имеет id, createdAt, updatedAt
   - связи между сущностями через id (clientId, unitId, managerId)
   - конфигурация шахматки редактируема и сохраняется в localStorage
   ============================================================ */

// Ключ хранилища в localStorage. Меняем при breaking-изменениях схемы.
const STORAGE_KEY = 'terra-crm-v1';

// ---------- Статусы помещений ----------
const STATUSES = {
  free:        { label:'Свободно',       color:'var(--st-free)' },
  booked:      { label:'Забронировано',  color:'var(--st-booked)' },
  show:        { label:'Показ назначен', color:'var(--st-show)' },
  contract:    { label:'Договор',        color:'var(--st-contract)' },
  sold:        { label:'Продано',        color:'var(--st-sold)' },
  unavailable: { label:'Недоступно',     color:'var(--st-unavail)' },
};
const STATUS_ORDER = ['free','booked','show','contract','sold','unavailable'];
const STATUS_WEIGHT = ['free','free','free','free','booked','booked','show','contract','sold','sold','unavailable'];

// ---------- Статусы показов ----------
const SHOW_STATUSES = {
  planned:   { label:'Запланирован', color:'#6B92BC' },
  confirmed: { label:'Подтверждён',  color:'#7C9B6E' },
  completed: { label:'Состоялся',    color:'#7A4A36' },
  cancelled: { label:'Отменён',      color:'#B7AB9B' },
};
const SHOW_STATUS_ORDER = ['planned','confirmed','completed','cancelled'];

// ---------- Менеджеры ----------
const MANAGERS = [
  { id:'m1', name:'Игорь Васнецов',  short:'ИВ' },
  { id:'m2', name:'Марина Дёмина',   short:'МД' },
  { id:'m3', name:'Олег Кравцов',    short:'ОК' },
  { id:'m4', name:'Полина Адова',    short:'ПА' },
];

// ---------- Конфигурация объекта ----------
// Дефолт; в рантайме копируется в state.buildingConfig и может редактироваться.
// Каждый корпус хранит собственную этажность и количество помещений на этаже.
const DEFAULT_BUILDING = {
  id:      'italika',
  name:    'ЖК «Италика»',
  short:   'Италика',
  seed:    101,
  corps:   ['Корпус A','Корпус B'],
  corpsConfig: {
    'Корпус A': { floors: 16, perFloor: 6 },
    'Корпус B': { floors: 14, perFloor: 5 },
  },
  basePrice:285,
  kind:    'Квартира',
  startNum:1,
};

// ---------- Виды из окна ----------
const VIEW_DIRECTIONS = ['Север','Северо-восток','Восток','Юго-восток','Юг','Юго-запад','Запад','Северо-запад'];
const VIEW_CATEGORIES = [
  { id:'sea',     label:'Море',           icon:'🌊', color:'#6B92BC' },
  { id:'mount',   label:'Горы',           icon:'⛰', color:'#7A6354' },
  { id:'pool',    label:'Бассейн',        icon:'💧', color:'#7CB4C9' },
  { id:'park',    label:'Парковая зона',  icon:'🌳', color:'#7C9B6E' },
  { id:'court',   label:'Двор',           icon:'🏡', color:'#B7AB9B' },
  { id:'city',    label:'Город',          icon:'🏙', color:'#A89485' },
  { id:'inner',   label:'Внутренний двор',icon:'◇', color:'#C8B89A' },
  { id:'corp',    label:'Соседний корпус',icon:'⊟', color:'#9C8E80' },
];

// ---------- Источники лидов ----------
const SOURCE_OPTIONS = ['Сайт','Звонок','Авито','Я.Директ','Рекомендация','Соцсети','Агентство','Реклама','Другое'];

// ---------- Цели покупки ----------
const GOAL_OPTIONS = ['Проживание','Инвестиции','Сдача в аренду','Перепродажа','Другое'];

// ---------- Приоритет клиента ----------
const PRIORITIES = {
  high:   { label:'Высокий', color:'#C2683E' },
  medium: { label:'Средний', color:'#E0A458' },
  low:    { label:'Низкий',  color:'#B7AB9B' },
};
const PRIORITY_ORDER = ['high','medium','low'];

// ---------- Типы событий timeline ----------
const INTERACTION_TYPES = {
  created:          { label:'Создан клиент',          icon:'＋', color:'#7C9B6E' },
  call:             { label:'Звонок',                 icon:'☎',  color:'#6B92BC' },
  meeting:          { label:'Встреча',                icon:'☕', color:'#E0A458' },
  show:             { label:'Показ',                  icon:'👁', color:'#6B92BC' },
  booking:          { label:'Бронирование',           icon:'⌂',  color:'#E0A458' },
  deal:             { label:'Сделка',                 icon:'✎',  color:'#C2683E' },
  status_change:    { label:'Изменён статус',         icon:'⟳',  color:'#7A6354' },
  comment:          { label:'Комментарий',            icon:'✉',  color:'#7A6354' },
  document_added:   { label:'Документ добавлен',      icon:'📄', color:'#7A6354' },
  task_created:     { label:'Задача создана',         icon:'✓',  color:'#6B92BC' },
  task_completed:   { label:'Задача выполнена',       icon:'✓',  color:'#7C9B6E' },
  manager_changed:  { label:'Смена менеджера',        icon:'⇄',  color:'#E0A458' },
  favorite_added:   { label:'В избранное',            icon:'★',  color:'#E0A458' },
};

// ---------- Стадии сделки ----------
const STAGES = ['Новый лид','Квалифицирован','Показ назначен','Показ проведен','Бронь','Договор','Оплата','Сделка закрыта'];

// ---------- Клиенты (расширенная структура, готова к API) ----------
const DEFAULT_CLIENTS = [
  { id:'c1', name:'Сергей Морозов',
    dob:'1985-03-14', phone:'+7 916 240-18-77', phone2:'', email:'morozov.s@mail.ru',
    city:'Москва', citizenship:'РФ',
    budget:'до 14 млн ₽', goal:'Проживание',
    targetObject:'ЖК «Италика», 2-комн.', propertyKind:'Квартира',
    areaPref:'55–70 м²', floorPref:'4–10', viewPref:'Парк',
    source:'Авито',
    mgr:'m1', stage:'Бронь', priority:'high',
    nextContact:'2026-06-23',
    note:'Решение принимает с супругой. Важна школа рядом.',
    wishes:'Балкон, кухня от 10 м², светлая отделка.',
    objections:'Сомневается в сроках сдачи — нужны гарантии.',
    refusalReason:'',
    favoriteUnitIds:[],
    contacts:[{id:'ct-1', name:'Анна Морозова', role:'Супруга', phone:'+7 916 240-19-22', email:''}],
    managerHistory:[{managerId:'m1', from:'2026-06-09', to:null, reason:'Первичное закрепление'}],
    documents:[
      {id:'d-1', name:'Паспорт.pdf', type:'Паспорт', addedAt:'2026-06-12', size:'1.4 МБ'},
      {id:'d-2', name:'Согласие_на_обработку.pdf', type:'Анкета', addedAt:'2026-06-09', size:'380 КБ'},
    ],
    tasks:[
      {id:'t-1', title:'Подготовить договор брони', assigneeId:'m1', dueDate:'2026-06-23', done:false, createdAt:'2026-06-18'},
      {id:'t-2', title:'Согласовать скидку с РОП',   assigneeId:'m1', dueDate:'2026-06-19', done:false, createdAt:'2026-06-17'},
    ],
    interactions:[
      {id:'i-1', type:'created', at:'2026-06-09 11:30', text:'Лид с Авито', refId:null, refType:null},
      {id:'i-2', type:'call',    at:'2026-06-09 12:05', text:'Первичный звонок, 14 мин. Заинтересован в 2-комн.', refId:null, refType:null},
      {id:'i-3', type:'show',    at:'2026-06-14 15:00', text:'Показ корпуса A, понравился вид', refId:null, refType:'show'},
      {id:'i-4', type:'call',    at:'2026-06-18 10:42', text:'Перезвонил, готов вносить бронь', refId:null, refType:null},
      {id:'i-5', type:'status_change', at:'2026-06-18 10:44', text:'Статус: Квалифицирован → Бронь', refId:null, refType:null},
    ],
    createdAt:'2026-06-09', updatedAt:'2026-06-18' },

  { id:'c2', name:'Елена Гаврилова',
    dob:'1979-11-02', phone:'+7 903 551-09-32', phone2:'', email:'e.gavrilova@gmail.com',
    city:'Санкт-Петербург', citizenship:'РФ',
    budget:'до 22 млн ₽', goal:'Инвестиции',
    targetObject:'ЖК «Италика», апартаменты', propertyKind:'Апартамент',
    areaPref:'40–60 м²', floorPref:'6–12', viewPref:'Море',
    source:'Сайт',
    mgr:'m2', stage:'Показ проведен', priority:'high',
    nextContact:'2026-06-23',
    note:'Сравнивает с конкурентом в Ялте. Чувствительна к цифрам ROI.',
    wishes:'Готовая мебель, управление сдачей под ключ.',
    objections:'Доходность ниже ожидаемой по её расчёту.',
    refusalReason:'',
    favoriteUnitIds:[],
    contacts:[],
    managerHistory:[{managerId:'m2', from:'2026-06-12', to:null, reason:'Назначение по заявке с сайта'}],
    documents:[],
    tasks:[
      {id:'t-3', title:'Прислать модель доходности от сдачи', assigneeId:'m2', dueDate:'2026-06-22', done:false, createdAt:'2026-06-17'},
    ],
    interactions:[
      {id:'i-6', type:'created', at:'2026-06-12 09:15', text:'Заявка с сайта', refId:null, refType:null},
      {id:'i-7', type:'show',    at:'2026-06-17 14:30', text:'Показ онлайн, просит расчёт доходности', refId:null, refType:'show'},
    ],
    createdAt:'2026-06-12', updatedAt:'2026-06-17' },

  { id:'c3', name:'Дмитрий Котов',
    dob:'1991-07-25', phone:'+7 925 778-44-10', phone2:'', email:'kotov.dm@yandex.ru',
    city:'Краснодар', citizenship:'РФ',
    budget:'до 9 млн ₽', goal:'Сдача в аренду',
    targetObject:'ЖК «Италика», 1-комн.', propertyKind:'Квартира',
    areaPref:'30–45 м²', floorPref:'3–8', viewPref:'Не принципиально',
    source:'Я.Директ',
    mgr:'m3', stage:'Квалифицирован', priority:'medium',
    nextContact:'2026-06-24',
    note:'Бюджет ограничен, важна рассрочка от застройщика.',
    wishes:'Рассрочка 0% на максимальный срок.',
    objections:'Цена выше его ожиданий по рынку.',
    refusalReason:'',
    favoriteUnitIds:[],
    contacts:[],
    managerHistory:[{managerId:'m3', from:'2026-06-15', to:null, reason:'Заявка с Я.Директ'}],
    documents:[],
    tasks:[
      {id:'t-4', title:'Назначить показ', assigneeId:'m3', dueDate:'2026-06-24', done:false, createdAt:'2026-06-16'},
    ],
    interactions:[
      {id:'i-8',  type:'created', at:'2026-06-15 18:20', text:'Заявка с Я.Директ', refId:null, refType:null},
      {id:'i-9',  type:'call',    at:'2026-06-16 11:00', text:'Уточнял условия рассрочки', refId:null, refType:null},
    ],
    createdAt:'2026-06-15', updatedAt:'2026-06-16' },

  { id:'c4', name:'Анастасия Лунёва',
    dob:'1988-09-08', phone:'+7 911 302-66-21', phone2:'', email:'anastasia.luneva@bk.ru',
    city:'Москва', citizenship:'РФ',
    budget:'до 17 млн ₽', goal:'Проживание',
    targetObject:'ЖК «Италика», 2-комн.', propertyKind:'Квартира',
    areaPref:'60–80 м²', floorPref:'5–14', viewPref:'Парк',
    source:'Рекомендация',
    mgr:'m1', stage:'Договор', priority:'high',
    nextContact:'2026-06-25',
    note:'Пришла по рекомендации соседа. Лояльна, торг минимальный.',
    wishes:'Заехать после Нового года.',
    objections:'',
    refusalReason:'',
    favoriteUnitIds:[],
    contacts:[],
    managerHistory:[{managerId:'m1', from:'2026-06-10', to:null, reason:'Рекомендация'}],
    documents:[
      {id:'d-3', name:'Договор_бронирования.pdf', type:'Договор', addedAt:'2026-06-19', size:'2.1 МБ'},
    ],
    tasks:[
      {id:'t-5', title:'Собрать пакет документов для ДДУ', assigneeId:'m1', dueDate:'2026-06-25', done:false, createdAt:'2026-06-19'},
    ],
    interactions:[
      {id:'i-10', type:'created', at:'2026-06-10 10:00', text:'Пришла по рекомендации', refId:null, refType:null},
      {id:'i-11', type:'show',    at:'2026-06-13 16:00', text:'Повторный показ с дизайнером', refId:null, refType:'show'},
      {id:'i-12', type:'booking', at:'2026-06-19 11:00', text:'Подписала договор брони', refId:null, refType:null},
    ],
    createdAt:'2026-06-10', updatedAt:'2026-06-19' },

  { id:'c5', name:'Руслан Бек',
    dob:'1982-01-19', phone:'+7 962 014-88-05', phone2:'', email:'',
    city:'Москва', citizenship:'РФ',
    budget:'до 30 млн ₽', goal:'Инвестиции',
    targetObject:'ЖК «Италика», премиум', propertyKind:'Апартамент',
    areaPref:'70–110 м²', floorPref:'10+', viewPref:'Море',
    source:'Авито',
    mgr:'m4', stage:'Новый лид', priority:'high',
    nextContact:'2026-06-22',
    note:'Высокий бюджет, премиум-сегмент. Реагировать быстро.',
    wishes:'Видовые верхние этажи.',
    objections:'',
    refusalReason:'',
    favoriteUnitIds:[],
    contacts:[],
    managerHistory:[{managerId:'m4', from:'2026-06-20', to:null, reason:'Закрепление по бюджету'}],
    documents:[],
    tasks:[
      {id:'t-6', title:'Первый дозвон', assigneeId:'m4', dueDate:'2026-06-21', done:false, createdAt:'2026-06-20'},
    ],
    interactions:[
      {id:'i-13', type:'created', at:'2026-06-20 16:40', text:'Заявка с Авито', refId:null, refType:null},
    ],
    createdAt:'2026-06-20', updatedAt:'2026-06-20' },
];

// Совместимость со старым кодом
const CLIENTS = DEFAULT_CLIENTS;

// ---------- Совместимость с другими вкладками ----------
// Воронка/дашборд используют BUILDINGS как объект ключ→конфиг.
// Оставляем один реальный объект.
const BUILDINGS = { italika: DEFAULT_BUILDING };
const CLIENT_NAMES = CLIENTS.map(c=>c.name);

// ---------- Данные воронки (для совместимости) ----------
const FUNNEL_DATA = [
  ['Новый лид',420], ['Квалифицирован',286], ['Показ назначен',198],
  ['Показ проведен',151], ['Бронь',97], ['Договор',64], ['Оплата',48], ['Сделка закрыта',41],
];
const SOURCES = [['Авито',34],['Сайт застройщика',24],['Я.Директ',18],['Рекомендации',13],['Соцсети',11]];
const REFUSALS = [['Не устроила цена',38],['Выбрал конкурента',22],['Передумал покупать',16],['Не одобрили ипотеку',14],['Не дозвонились',10]];
const MGR_EFF = [['Игорь Васнецов',14.2],['Марина Дёмина',11.8],['Олег Кравцов',9.4],['Полина Адова',12.6]];
const WEEKLY = [['Нед 1',18,9],['Нед 2',22,12],['Нед 3',16,15],['Нед 4',27,21]];

// ---------- Дашборд РОП ----------
const DASH = {
  plan: 180,
  managers: [
    { id:'m1', name:'Игорь Васнецов', plan:50, fact:47, books:6, conv:14.2, rating:4.8 },
    { id:'m4', name:'Полина Адова',   plan:45, fact:41, books:5, conv:12.6, rating:4.6 },
    { id:'m2', name:'Марина Дёмина',  plan:45, fact:38, books:4, conv:11.8, rating:4.3 },
    { id:'m3', name:'Олег Кравцов',   plan:40, fact:26, books:3, conv:9.4,  rating:3.9 },
  ],
  overdue: 7,
  hot: [
    ['Анастасия Лунёва','ЖК «Италика», №88 · договор','hot','95%'],
    ['Сергей Морозов','ЖК «Италика», №142 · бронь','hot','82%'],
    ['Елена Гаврилова','Гаспра, №7 · показ проведён','warn','64%'],
  ],
  problems: [
    ['Руслан Бек','Премиум-лид без касания 2 дня','Нет первого звонка'],
    ['Олег Кравцов','3 сделки зависли на этапе показа','Низкая конверсия'],
    ['Гаспра, №14','Бронь без оплаты 11 дней','Риск срыва брони'],
  ],
  log: [
    ['10:42','Игорь В.','Перевёл №142 в статус «Бронь»','book'],
    ['10:18','Марина Д.','Назначила показ Гаспра, №7','show'],
    ['09:55','Полина А.','Создала сделку по №88','deal'],
    ['09:30','Олег К.','Добавил комментарий к лиду Д. Котов','note'],
    ['09:12','Игорь В.','Звонок 8 мин — С. Морозов','call'],
    ['08:50','Марина Д.','Новый лид с сайта закреплён','lead'],
  ],
  planFact: [['ЖК «Италика»',90,84],['Отели Кабардинка',55,41],['Гаспра',35,27]],
  aiRecs: [
    ['Проседает этап «Показ → Бронь»','Конверсия 64% против 78% месяцем ранее. Усильте скрипт закрытия после показа и подключите бронь со скидкой 48 часов.'],
    ['Дожать 3 горячих клиента','Лунёва, Морозов и Гаврилова суммарно дают ~28 млн ₽. Назначьте контроль звонков сегодня — вероятность закрытия в неделю высокая.'],
    ['Зависают апартаменты Кабардинки','12 юнитов на 5–7 этажах без движения 3 недели. Предложите пакет «рассрочка 0%» и таргет на инвесторов.'],
  ],
};

// ---------- Уведомления ----------
const NOTIFS = [
  ['Просрочена задача','Руслан Бек — первый дозвон не выполнен'],
  ['Просрочена задача','Согласовать скидку по №142 с РОП'],
  ['Бронь без оплаты','Гаспра, №14 — 11 дней без движения'],
];

// ---------- Тестовые показы ----------
// unitId здесь — null; на init свяжем с конкретными помещениями по индексу.
// Дата — текущий месяц (см. utils.js: SHOWS_SEED_DATE).
const DEFAULT_SHOWS_SEED = [
  { clientId:'c1', unitIdx:0,   managerId:'m1', dayOffset:0, time:'11:00', status:'confirmed', comment:'Показ корпуса A, повторный с супругой' },
  { clientId:'c2', unitIdx:6,   managerId:'m2', dayOffset:0, time:'14:30', status:'planned',   comment:'Онлайн-показ + расчёт доходности' },
  { clientId:'c3', unitIdx:12,  managerId:'m3', dayOffset:1, time:'10:00', status:'planned',   comment:'Показ с обсуждением рассрочки' },
  { clientId:'c4', unitIdx:3,   managerId:'m1', dayOffset:1, time:'16:00', status:'confirmed', comment:'Финальный показ перед сделкой' },
  { clientId:'c5', unitIdx:18,  managerId:'m4', dayOffset:2, time:'12:00', status:'planned',   comment:'Премиум-клиент, дать чек-лист преимуществ' },
  { clientId:'c1', unitIdx:24,  managerId:'m1', dayOffset:3, time:'13:00', status:'planned',   comment:'Альтернативный вариант на 7 этаже' },
  { clientId:'c2', unitIdx:9,   managerId:'m2', dayOffset:3, time:'15:00', status:'planned',   comment:'Очный показ' },
  { clientId:'c3', unitIdx:30,  managerId:'m3', dayOffset:5, time:'17:30', status:'cancelled', comment:'Клиент перенёс на следующую неделю' },
  { clientId:'c4', unitIdx:3,   managerId:'m1', dayOffset:-1, time:'11:30', status:'completed',comment:'Показ прошёл, готовим договор' },
  { clientId:'c5', unitIdx:18,  managerId:'m4', dayOffset:7, time:'10:30', status:'planned',   comment:'Группа инвесторов' },
  { clientId:'c1', unitIdx:0,   managerId:'m1', dayOffset:0, time:'18:00', status:'planned',   comment:'Дополнительный осмотр вечером' },
];
