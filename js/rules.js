/* ============================================================
   КОНСТРУКТОР ПРАВИЛ АВТОМАТИЗАЦИИ  «ЕСЛИ … ТО …»
   Правила настраиваются пользователем без программиста и
   срабатывают на реальных событиях системы.
   ============================================================ */

/* ---------- Справочники ---------- */
const RULE_TRIGGERS = {
  unit_status:    { label:'Статус помещения изменился', kind:'event',
                    param:{ key:'to', label:'Новый статус', type:'status' } },
  price_changed:  { label:'Изменилась цена помещения',  kind:'event' },
  show_created:   { label:'Назначен показ',             kind:'event' },
  client_created: { label:'Появился новый клиент',      kind:'event' },
  unit_stale:     { label:'Помещение без движения',     kind:'schedule',
                    param:{ key:'days', label:'Дней без изменений', type:'number', def:60 } },
  task_overdue:   { label:'Задача просрочена',          kind:'schedule',
                    param:{ key:'days', label:'Дней просрочки', type:'number', def:1 } },
};

const RULE_FIELDS = {
  corp:   { label:'Корпус',            type:'corp' },
  floor:  { label:'Этаж',              type:'number' },
  area:   { label:'Площадь, м²',       type:'number' },
  price:  { label:'Стоимость, млн ₽',  type:'number' },
  status: { label:'Статус помещения',  type:'status' },
  mgr:    { label:'Менеджер',          type:'mgr' },
  source: { label:'Источник клиента',  type:'source' },
  stage:  { label:'Этап воронки',      type:'stage' },
};
const RULE_OPS = { eq:'равно', ne:'не равно', gt:'больше', lt:'меньше', gte:'не меньше', lte:'не больше' };

const RULE_ACTIONS = {
  task:    { label:'Поставить задачу менеджеру', fields:[
             { k:'text', label:'Текст задачи', type:'text', def:'Связаться с клиентом' },
             { k:'days', label:'Срок, дней',    type:'number', def:2 } ] },
  notify:  { label:'Уведомить руководителя', fields:[
             { k:'text', label:'Текст уведомления', type:'text', def:'Требуется внимание' } ] },
  message: { label:'Отправить сообщение клиенту', fields:[
             { k:'channel', label:'Канал', type:'channel', def:'whatsapp' },
             { k:'text', label:'Текст сообщения', type:'text', def:'Здравствуйте! Напоминаем о вашей заявке.' } ] },
  flag:    { label:'Пометить помещение', fields:[
             { k:'text', label:'Метка', type:'text', def:'Зависла' } ] },
};
const RULE_CHANNELS = { whatsapp:'WhatsApp', telegram:'Telegram', email:'Электронная почта' };

/* ---------- Правила по умолчанию (демонстрационные) ---------- */
function defaultRules(){
  return [
    { id:uid('r'), name:'Бронь — напомнить об оплате', enabled:true, fired:0,
      trigger:{ type:'unit_status', to:'booked' }, conditions:[],
      actions:[ { type:'task', text:'Согласовать оплату и подготовить договор', days:2 },
                { type:'message', channel:'whatsapp', text:'Здравствуйте! Квартира забронирована за вами на 3 дня.' } ] },
    { id:uid('r'), name:'Дорогая сделка — под контроль РОП', enabled:true, fired:0,
      trigger:{ type:'unit_status', to:'contract' },
      conditions:[ { field:'price', op:'gte', value:25 } ],
      actions:[ { type:'notify', text:'Крупная сделка — взять на контроль' } ] },
    { id:uid('r'), name:'Зависшие квартиры — предложить акцию', enabled:true, fired:0,
      trigger:{ type:'unit_stale', days:60 },
      conditions:[ { field:'status', op:'eq', value:'free' } ],
      actions:[ { type:'flag', text:'Зависла' },
                { type:'task', text:'Проработать скидку или включить в рассылку', days:3 } ] },
    { id:uid('r'), name:'Новый лид — связаться в тот же день', enabled:true, fired:0,
      trigger:{ type:'client_created' }, conditions:[],
      actions:[ { type:'task', text:'Первый звонок новому клиенту', days:0 } ] },
    { id:uid('r'), name:'Показ назначен — напомнить клиенту', enabled:false, fired:0,
      trigger:{ type:'show_created' }, conditions:[],
      actions:[ { type:'message', channel:'telegram', text:'Напоминаем о завтрашнем показе.' } ] },
  ];
}
function rulesData(){
  if(!state.rules || !Array.isArray(state.rules.list)) state.rules = { list: defaultRules(), log: [] };
  if(!Array.isArray(state.rules.log)) state.rules.log = [];
  return state.rules;
}
function rulesList(){ return rulesData().list; }

/* ---------- Движок ---------- */
// Достаём значение поля из контекста события
function ruleValue(field, ctx){
  const u = ctx.unit, c = ctx.client;
  switch(field){
    case 'corp':   return u ? u.corp : null;
    case 'floor':  return u ? +u.floor : null;
    case 'area':   return u ? +u.area : null;
    case 'price':  return u ? +u.total : null;
    case 'status': return u ? u.status : null;
    case 'mgr':    return ctx.mgrId || (u && u.managerId) || (c && c.mgr) || null;
    case 'source': return c ? c.source : null;
    case 'stage':  return c ? c.stage : null;
  }
  return null;
}
function ruleCondOk(cond, ctx){
  const v = ruleValue(cond.field, ctx);
  if(v === null || v === undefined) return false;
  const t = cond.value;
  const num = a => (typeof a === 'number' ? a : parseFloat(String(a).replace(',','.')));
  switch(cond.op){
    case 'eq':  return String(v) === String(t);
    case 'ne':  return String(v) !== String(t);
    case 'gt':  return num(v) >  num(t);
    case 'lt':  return num(v) <  num(t);
    case 'gte': return num(v) >= num(t);
    case 'lte': return num(v) <= num(t);
  }
  return false;
}
function ruleActionRun(a, rule, ctx){
  const u = ctx.unit, c = ctx.client;
  const who = ctx.mgrId || (u && u.managerId) || (c && c.mgr) || MANAGERS[0].id;
  const about = u ? `${u.displayNum} (${u.corp})` : (c ? c.name : '');
  switch(a.type){
    case 'task':
      taskAdd({ title: a.text + (about ? ' — ' + about : ''), managerId: who,
        due: isoDate(addDays(TODAY, +a.days || 0)), status:'planned',
        comment: 'Создано правилом «' + rule.name + '»' });
      return `задача менеджеру ${mgrName(who)}`;
    case 'notify':
      logActivity({ type:'note', icon:'alert', who,
        text: `Правило «${rule.name}»: ${a.text}${about ? ' · ' + about : ''}` });
      return 'уведомление руководителю';
    case 'message':
      // В прототипе отправка эмулируется: реальная — через провайдера рассылок
      logActivity({ type:'note', icon:'mail', who,
        text: `${RULE_CHANNELS[a.channel]||'Сообщение'} клиенту${c ? ' · ' + c.name : ''}: «${a.text}»` });
      return `сообщение (${RULE_CHANNELS[a.channel]||'—'})`;
    case 'flag':
      if(u){ u.flag = a.text; saveState(); }
      return `метка «${a.text}»`;
  }
  return '';
}
// Основная точка входа: вызывается из событий системы
function rulesRun(triggerType, ctx){
  if(typeof state === 'undefined' || !state.rules) rulesData();
  const done = [];
  rulesList().filter(r => r.enabled && r.trigger.type === triggerType).forEach(r => {
    // параметр триггера (например, конкретный статус)
    if(triggerType === 'unit_status' && r.trigger.to && ctx.to !== r.trigger.to) return;
    if(!(r.conditions||[]).every(cd => ruleCondOk(cd, ctx))) return;
    const res = (r.actions||[]).map(a => ruleActionRun(a, r, ctx)).filter(Boolean);
    r.fired = (r.fired||0) + 1;
    rulesData().log.unshift({ ts: Date.now(), rule: r.name,
      about: ctx.unit ? ctx.unit.displayNum : (ctx.client ? ctx.client.name : ''),
      result: res.join(' · ') });
    if(rulesData().log.length > 60) rulesData().log.length = 60;
    done.push(r.name);
  });
  if(done.length) saveState();
  return done;
}
// Правила «по расписанию» — запускаются вручную или при входе
function rulesRunScheduled(){
  const fired = [];
  const today = isoDate(TODAY);
  rulesList().filter(r => r.enabled && (RULE_TRIGGERS[r.trigger.type]||{}).kind === 'schedule').forEach(r => {
    if(r.trigger.type === 'unit_stale'){
      const days = +r.trigger.days || 60;
      units().forEach(u => {
        const idle = Math.floor((Date.now() - (u.updatedAt || 0)) / 86400000);
        if(idle < days) return;
        const ctx = { unit:u, mgrId:u.managerId };
        if(!(r.conditions||[]).every(cd => ruleCondOk(cd, ctx))) return;
        if(u.flag && r.actions.some(a=>a.type==='flag' && a.text===u.flag)) return; // уже помечено
        const res = r.actions.map(a => ruleActionRun(a, r, ctx)).filter(Boolean);
        r.fired = (r.fired||0)+1;
        rulesData().log.unshift({ ts:Date.now(), rule:r.name, about:u.displayNum, result:res.join(' · ') });
        fired.push(r.name);
      });
    }
    if(r.trigger.type === 'task_overdue'){
      const days = +r.trigger.days || 1;
      tasksAll().filter(t => t.status !== 'done' && t.due && t.due < today).forEach(t => {
        const late = Math.floor((new Date(today) - new Date(t.due)) / 86400000);
        if(late < days) return;
        if(t.ruleNotified) return;
        const ctx = { mgrId: t.managerId };
        if(!(r.conditions||[]).every(cd => ruleCondOk(cd, ctx))) return;
        const res = r.actions.map(a => ruleActionRun(a, r, ctx)).filter(Boolean);
        t.ruleNotified = true;
        r.fired = (r.fired||0)+1;
        rulesData().log.unshift({ ts:Date.now(), rule:r.name, about:t.title, result:res.join(' · ') });
        fired.push(r.name);
      });
    }
  });
  if(rulesData().log.length > 60) rulesData().log.length = 60;
  saveState();
  return fired;
}

/* ---------- Человекочитаемое описание ---------- */
function ruleTriggerText(r){
  const t = RULE_TRIGGERS[r.trigger.type] || {};
  let s = t.label || r.trigger.type;
  if(r.trigger.type === 'unit_status' && r.trigger.to) s += ' на «' + (STATUSES[r.trigger.to]||{}).label + '»';
  if(r.trigger.type === 'unit_stale')   s += ' более ' + (r.trigger.days||60) + ' дней';
  if(r.trigger.type === 'task_overdue') s += ' более чем на ' + (r.trigger.days||1) + ' дн.';
  return s;
}
function ruleCondText(c){
  const f = RULE_FIELDS[c.field] || {};
  let v = c.value;
  if(f.type === 'status') v = (STATUSES[v]||{}).label || v;
  if(f.type === 'mgr')    v = mgrName(v);
  return `${f.label} ${RULE_OPS[c.op]} ${v}`;
}
function ruleActionText(a){
  const d = RULE_ACTIONS[a.type] || {};
  if(a.type === 'task')    return `Задача: «${a.text}» (срок +${a.days||0} дн.)`;
  if(a.type === 'notify')  return `Уведомить руководителя: «${a.text}»`;
  if(a.type === 'message') return `${RULE_CHANNELS[a.channel]||'Сообщение'} клиенту: «${a.text}»`;
  if(a.type === 'flag')    return `Пометить помещение: «${a.text}»`;
  return d.label || a.type;
}

/* ---------- Рендер вкладки ---------- */
function renderRules(){
  const host = document.getElementById('rulesList');
  if(!host) return;
  const d = rulesData();
  const active = d.list.filter(r=>r.enabled).length;
  document.getElementById('rulesSub').textContent =
    `${d.list.length} правил · активно ${active} · сработали ${d.list.reduce((s,r)=>s+(r.fired||0),0)} раз`;

  host.innerHTML = d.list.length ? d.list.map(r=>`
    <div class="rule ${r.enabled?'':'off'}">
      <div class="rule-head">
        <label class="rule-sw"><input type="checkbox" ${r.enabled?'checked':''} data-toggle="${r.id}"><span></span></label>
        <b>${escapeHtml(r.name)}</b>
        ${r.fired ? `<span class="rule-fired">сработало ${r.fired}</span>` : ''}
        <span class="rule-kind">${(RULE_TRIGGERS[r.trigger.type]||{}).kind==='schedule'?'по расписанию':'по событию'}</span>
        <span class="rule-ctrls">
          <button class="cl-cbtn" data-edit="${r.id}" title="Изменить">${icon('edit',12)}</button>
          <button class="cl-cbtn del" data-del="${r.id}" title="Удалить">${icon('close',12)}</button>
        </span>
      </div>
      <div class="rule-body">
        <div class="rule-line"><span class="rule-tag if">ЕСЛИ</span><div>${escapeHtml(ruleTriggerText(r))}</div></div>
        ${(r.conditions||[]).map(c=>`<div class="rule-line"><span class="rule-tag and">И</span><div>${escapeHtml(ruleCondText(c))}</div></div>`).join('')}
        ${(r.actions||[]).map((a,i)=>`<div class="rule-line"><span class="rule-tag then">${i?'И':'ТО'}</span><div>${escapeHtml(ruleActionText(a))}</div></div>`).join('')}
      </div>
    </div>`).join('') : `<div class="dash-empty">Правил пока нет — создайте первое</div>`;

  // журнал
  document.getElementById('rulesLog').innerHTML = d.log.length
    ? d.log.slice(0,14).map(l=>`<div class="rule-log-item">
        <div class="ic">${icon('check',13)}</div>
        <div><b>${escapeHtml(l.rule)}</b>${l.about?` · ${escapeHtml(l.about)}`:''}
          <span>${escapeHtml(l.result||'')}</span></div>
        <div class="tm">${timeAgo(l.ts)}</div></div>`).join('')
    : `<div class="rule-log-empty">Пока ничего не срабатывало</div>`;

  host.querySelectorAll('[data-toggle]').forEach(cb=>cb.onchange=()=>{
    const r = rulesList().find(x=>x.id===cb.dataset.toggle);
    if(r){ r.enabled = cb.checked; saveState(); renderRules(); }
  });
  host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openRuleForm(b.dataset.edit));
  host.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    if(confirm('Удалить правило?')){
      state.rules.list = rulesList().filter(x=>x.id!==b.dataset.del);
      saveState(); renderRules(); toast('Правило удалено');
    }
  });
}

/* ---------- Форма правила ---------- */
let ruleDraft = null;
function openRuleForm(id){
  const src = id ? rulesList().find(r=>r.id===id) : null;
  ruleDraft = src ? JSON.parse(JSON.stringify(src))
    : { id:uid('r'), name:'', enabled:true, fired:0,
        trigger:{ type:'unit_status', to:'booked' }, conditions:[], actions:[{ type:'task', text:'Связаться с клиентом', days:2 }] };
  document.getElementById('ruleFormTitle').textContent = id ? 'Изменение правила' : 'Новое правило';
  renderRuleForm();
  document.getElementById('ruleModal').classList.add('show');
}
function valueInput(type, val, attr){
  if(type==='status') return `<select ${attr}>${STATUS_ORDER.map(s=>`<option value="${s}" ${s===val?'selected':''}>${STATUSES[s].label}</option>`).join('')}</select>`;
  if(type==='mgr')    return `<select ${attr}>${MANAGERS.map(m=>`<option value="${m.id}" ${m.id===val?'selected':''}>${m.name}</option>`).join('')}</select>`;
  if(type==='corp')   return `<select ${attr}>${state.buildingConfig.corps.map(c=>`<option ${c===val?'selected':''}>${c}</option>`).join('')}</select>`;
  if(type==='source') return `<select ${attr}>${SOURCE_OPTIONS.map(s=>`<option ${s===val?'selected':''}>${s}</option>`).join('')}</select>`;
  if(type==='stage')  return `<select ${attr}>${STAGES.map(s=>`<option ${s===val?'selected':''}>${s}</option>`).join('')}</select>`;
  if(type==='channel')return `<select ${attr}>${Object.keys(RULE_CHANNELS).map(c=>`<option value="${c}" ${c===val?'selected':''}>${RULE_CHANNELS[c]}</option>`).join('')}</select>`;
  if(type==='number') return `<input type="number" value="${val!==undefined?val:''}" ${attr}>`;
  return `<input type="text" value="${escapeHtml(val!==undefined?String(val):'')}" ${attr}>`;
}
function renderRuleForm(){
  const d = ruleDraft, T = RULE_TRIGGERS[d.trigger.type] || {};
  document.getElementById('ruleName').value = d.name || '';

  // ЕСЛИ
  document.getElementById('ruleTrigger').innerHTML = `
    <select id="rtType">${Object.keys(RULE_TRIGGERS).map(k=>`<option value="${k}" ${k===d.trigger.type?'selected':''}>${RULE_TRIGGERS[k].label}</option>`).join('')}</select>
    ${T.param ? `<span class="rule-inline">${T.param.label}</span>${valueInput(T.param.type, d.trigger[T.param.key] ?? T.param.def, 'id="rtParam"')}` : ''}`;

  // И (условия)
  document.getElementById('ruleConds').innerHTML = (d.conditions||[]).map((c,i)=>{
    const f = RULE_FIELDS[c.field] || {};
    return `<div class="rule-row">
      <select data-c="${i}" data-k="field">${Object.keys(RULE_FIELDS).map(k=>`<option value="${k}" ${k===c.field?'selected':''}>${RULE_FIELDS[k].label}</option>`).join('')}</select>
      <select data-c="${i}" data-k="op">${Object.keys(RULE_OPS).map(o=>`<option value="${o}" ${o===c.op?'selected':''}>${RULE_OPS[o]}</option>`).join('')}</select>
      ${valueInput(f.type, c.value, `data-c="${i}" data-k="value"`)}
      <button class="cl-cbtn del" data-delc="${i}">${icon('close',12)}</button>
    </div>`;
  }).join('') || `<div class="rule-hint">Условий нет — правило сработает при каждом событии</div>`;

  // ТО (действия)
  document.getElementById('ruleActs').innerHTML = (d.actions||[]).map((a,i)=>{
    const def = RULE_ACTIONS[a.type] || { fields:[] };
    return `<div class="rule-row act">
      <select data-a="${i}" data-k="type">${Object.keys(RULE_ACTIONS).map(k=>`<option value="${k}" ${k===a.type?'selected':''}>${RULE_ACTIONS[k].label}</option>`).join('')}</select>
      ${def.fields.map(f=>`<span class="rule-inline">${f.label}</span>${valueInput(f.type, a[f.k] ?? f.def, `data-a="${i}" data-k="${f.k}"`)}`).join('')}
      <button class="cl-cbtn del" data-dela="${i}">${icon('close',12)}</button>
    </div>`;
  }).join('');

  // предпросмотр
  document.getElementById('rulePreview').innerHTML = `
    <div class="rule-line"><span class="rule-tag if">ЕСЛИ</span><div>${escapeHtml(ruleTriggerText(d))}</div></div>
    ${(d.conditions||[]).map(c=>`<div class="rule-line"><span class="rule-tag and">И</span><div>${escapeHtml(ruleCondText(c))}</div></div>`).join('')}
    ${(d.actions||[]).map((a,i)=>`<div class="rule-line"><span class="rule-tag then">${i?'И':'ТО'}</span><div>${escapeHtml(ruleActionText(a))}</div></div>`).join('')}`;

  wireRuleForm();
}
function wireRuleForm(){
  const d = ruleDraft;
  document.getElementById('ruleName').oninput = e => { d.name = e.target.value; };
  const tt = document.getElementById('rtType');
  tt.onchange = ()=>{
    const T = RULE_TRIGGERS[tt.value];
    d.trigger = { type: tt.value };
    if(T.param) d.trigger[T.param.key] = T.param.def ?? (T.param.type==='status'?'booked':'');
    renderRuleForm();
  };
  const tp = document.getElementById('rtParam');
  if(tp) tp.onchange = ()=>{ d.trigger[RULE_TRIGGERS[d.trigger.type].param.key] = tp.value; renderRuleForm(); };

  document.querySelectorAll('#ruleConds [data-c]').forEach(el=>el.onchange=()=>{
    const i = +el.dataset.c, k = el.dataset.k;
    d.conditions[i][k] = el.value;
    if(k==='field'){ d.conditions[i].value = ''; }
    renderRuleForm();
  });
  document.querySelectorAll('#ruleConds [data-delc]').forEach(b=>b.onclick=()=>{
    d.conditions.splice(+b.dataset.delc,1); renderRuleForm();
  });
  document.querySelectorAll('#ruleActs [data-a]').forEach(el=>el.onchange=()=>{
    const i = +el.dataset.a, k = el.dataset.k;
    if(k==='type'){
      const def = RULE_ACTIONS[el.value];
      d.actions[i] = { type: el.value };
      def.fields.forEach(f=> d.actions[i][f.k] = f.def);
    } else d.actions[i][k] = el.value;
    renderRuleForm();
  });
  document.querySelectorAll('#ruleActs [data-dela]').forEach(b=>b.onclick=()=>{
    if(d.actions.length<=1){ toast('Нужно хотя бы одно действие'); return; }
    d.actions.splice(+b.dataset.dela,1); renderRuleForm();
  });
}
function initRules(){
  const modal = document.getElementById('ruleModal');
  document.getElementById('ruleClose').onclick  = ()=>modal.classList.remove('show');
  document.getElementById('ruleCancel').onclick = ()=>modal.classList.remove('show');
  document.getElementById('ruleAddCond').onclick = ()=>{
    ruleDraft.conditions.push({ field:'price', op:'gte', value:10 }); renderRuleForm();
  };
  document.getElementById('ruleAddAct').onclick = ()=>{
    ruleDraft.actions.push({ type:'notify', text:'Требуется внимание' }); renderRuleForm();
  };
  document.getElementById('ruleSave').onclick = ()=>{
    if(!ruleDraft.name.trim()){ toast('Укажите название правила'); return; }
    const i = rulesList().findIndex(r=>r.id===ruleDraft.id);
    if(i>=0) rulesList()[i] = ruleDraft; else rulesList().push(ruleDraft);
    saveState(); modal.classList.remove('show'); renderRules();
    toast('Правило сохранено');
  };
  document.getElementById('rulesNew').onclick   = ()=>openRuleForm(null);
  document.getElementById('rulesCheck').onclick = ()=>{
    const f = rulesRunScheduled();
    renderRules(); if(typeof refreshLive==='function') refreshLive();
    toast(f.length ? `Сработало правил: ${f.length}` : 'Подходящих объектов не найдено');
  };
  document.getElementById('rulesReset').onclick = ()=>{
    if(confirm('Вернуть набор правил по умолчанию?')){
      state.rules = { list: defaultRules(), log: [] }; saveState(); renderRules(); toast('Правила сброшены');
    }
  };
}
