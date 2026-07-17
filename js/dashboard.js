/* ============================================================
   ВКЛАДКА «ДАШБОРД РОП»
   Данные живут в state.dash (в базе). В режиме администратора
   (шестерёнка) доступно редактирование всех блоков.
   ============================================================ */


// Схемы форм редактирования блоков дашборда
const DASH_SCHEMAS = {
  managers: { title:'менеджера', fields:[
    { k:'name',   label:'Имя менеджера', type:'text', req:true },
    { k:'plan',   label:'План, млн ₽',   type:'number' },
    { k:'fact',   label:'Факт, млн ₽',   type:'number' },
    { k:'books',  label:'Броней',        type:'number' },
    { k:'conv',   label:'Конверсия, %',  type:'number', step:'0.1' },
    { k:'rating', label:'Рейтинг (0–5)', type:'number', step:'0.1' },
  ]},
  hot: { title:'горячего клиента', fields:[
    { k:'name',   label:'Имя клиента', type:'text', req:true },
    { k:'object', label:'Объект и статус (напр. ЖК «Италика», №88 · договор)', type:'text' },
    { k:'level',  label:'Уровень', type:'select', options:[['hot','Высокий'],['warn','Средний'],['ok','Низкий']] },
    { k:'prob',   label:'Вероятность (напр. 82%)', type:'text' },
  ]},
  problems: { title:'проблемную сделку', fields:[
    { k:'name', label:'Клиент или объект', type:'text', req:true },
    { k:'desc', label:'В чём проблема',    type:'text' },
    { k:'tag',  label:'Метка (напр. Риск срыва брони)', type:'text' },
  ]},
  planFact: { title:'объект (план-факт)', fields:[
    { k:'name', label:'Название объекта', type:'text', req:true },
    { k:'plan', label:'План, млн ₽',      type:'number' },
    { k:'fact', label:'Факт, млн ₽',      type:'number' },
  ]},
  aiRecs: { title:'рекомендацию', fields:[
    { k:'title', label:'Заголовок',           type:'text', req:true },
    { k:'text',  label:'Текст рекомендации',  type:'textarea' },
  ]},
  log: { title:'запись журнала', fields:[
    { k:'time',   label:'Время (напр. 10:42)', type:'text' },
    { k:'who',    label:'Кто',      type:'text', req:true },
    { k:'action', label:'Действие', type:'text' },
    { k:'icon',   label:'Тип', type:'select', options:[
      ['book','Бронь'],['show','Показ'],['deal','Сделка'],
      ['note','Заметка'],['call','Звонок'],['lead','Лид']] },
  ]},
};

function renderDashboard(){
  const d = dashData();
  const admin = state.adminMode;

  document.getElementById('dashSub').textContent =
    'Управленческая сводка · '+BUILDINGS[state.building].name+(d.period ? ' · '+d.period : '');

  const fact = d.managers.reduce((s,m)=>s+(+m.fact||0), 0);
  const planSum = d.managers.reduce((s,m)=>s+(+m.plan||0), 0);
  const plan = d.plan || planSum;
  const pct = plan>0 ? Math.round(fact/plan*100) : 0;
  const booksTotal = d.managers.reduce((s,m)=>s+(+m.books||0), 0);
  const forecast = Math.round(fact*1.18);

  // ---- Панель администратора ----
  const bar = document.getElementById('dashAdminBar');
  if(admin){
    bar.style.display = 'block';
    bar.innerHTML = `
      <div class="dash-admin-head">
        <h4 class="ic-inline">${icon('gear',15)} Редактирование дашборда <span class="badge-admin">Админ</span></h4>
        <div class="dash-admin-actions">
          <button class="btn btn-sm" id="dashDemoBtn">Загрузить пример</button>
          <button class="btn btn-sm" id="dashClearBtn" style="color:var(--terra-dark);border-color:var(--terra-dark);">Очистить всё</button>
        </div>
      </div>
      <div class="dash-admin-fields">
        <label>План продаж, млн ₽<input type="number" id="dashPlan" value="${d.plan||''}" placeholder="напр. 180"></label>
        <label>Просроченные задачи<input type="number" id="dashOverdue" value="${d.overdue||''}" placeholder="напр. 7"></label>
        <label>Период<input type="text" id="dashPeriod" value="${escapeHtml(d.period)}" placeholder="напр. июнь 2026"></label>
      </div>
      <div class="dash-admin-hint">Пустой «План продаж» считается по сумме планов менеджеров. Все изменения сохраняются в базу.</div>`;
  } else {
    bar.style.display = 'none';
    bar.innerHTML = '';
  }

  // ---- KPI ----
  document.getElementById('dashKpi').innerHTML = `
    ${kpi('План продаж', (plan||0)+' млн ₽', 'up', d.plan ? 'цель месяца' : 'сумма планов')}
    ${kpi('Факт продаж', fact+' млн ₽', pct>=90?'up':'down', pct+'% плана')}
    ${kpi('Количество броней', booksTotal, 'up', d.managers.length+' менеджеров')}
    ${kpi('Просроченные задачи', d.overdue, d.overdue>0?'down':'up', d.overdue>0?'требуют внимания':'всё в срок')}`;

  // ---- Кольцо плана ----
  const r=54, circ=2*Math.PI*r, off=circ*(1-Math.min(pct,100)/100);
  document.getElementById('planRing').innerHTML = `
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--sand)" stroke-width="12"/>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--terra)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 64 64)"/>
    </svg>
    <div class="pct"><b>${pct}%</b><span>выполнено</span></div>`;
  document.getElementById('planMeta').innerHTML = `
    <div class="row"><span>План месяца</span><b>${plan} млн ₽</b></div>
    <div class="row"><span>Факт</span><b style="color:var(--terra-dark)">${fact} млн ₽</b></div>
    <div class="row"><span>Осталось</span><b>${Math.max(plan-fact,0)} млн ₽</b></div>
    <div class="row"><span>Прогноз закрытия</span><b style="color:var(--st-free)">${forecast} млн ₽</b></div>`;

  // ---- Продажи по менеджерам ----
  const max = Math.max(1, ...d.managers.map(m=>+m.fact||0), ...d.managers.map(m=>+m.plan||0));
  document.getElementById('dashMgrChart').innerHTML =
    (admin ? addBtn('managers','Добавить менеджера') : '') +
    (d.managers.length ? d.managers.map(m=>`
      <div class="hbar dash-row">
        <div class="top"><span>${escapeHtml(m.name)} ${rowCtrls('managers',m.id)}</span><b>${m.fact} / ${m.plan} млн ₽</b></div>
        <div class="track" style="background:var(--sand);position:relative;">
          <div style="position:absolute;left:${(+m.plan||0)/max*100}%;top:-3px;height:16px;width:2px;background:var(--brown);opacity:.4;"></div>
          <div class="fill" style="width:${(+m.fact||0)/max*100}%"></div>
        </div>
      </div>`).join('') : emptyState('Нет менеджеров', admin));

  // ---- Горячие клиенты ----
  document.getElementById('hotClients').innerHTML =
    (admin ? addBtn('hot','Добавить клиента') : '') +
    (d.hot.length ? d.hot.map(h=>`
      <div class="hot-item dash-row"><div class="avatar">${initials(h.name)}</div>
        <div class="meta"><b>${escapeHtml(h.name)}</b><span>${escapeHtml(h.object||'')}</span></div>
        ${h.prob ? `<span class="chip ${h.level||'hot'}">${escapeHtml(h.prob)}</span>` : ''}
        ${rowCtrls('hot',h.id)}</div>`).join('') : emptyState('Нет горячих клиентов', admin));

  // ---- Проблемные сделки ----
  document.getElementById('problemDeals').innerHTML =
    (admin ? addBtn('problems','Добавить сделку') : '') +
    (d.problems.length ? d.problems.map(p=>`
      <div class="problem-item dash-row">
        <div class="ic" style="width:30px;height:30px;border-radius:8px;background:#FBE3D3;color:var(--terra-dark);display:grid;place-items:center;">!</div>
        <div class="meta"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.desc||'')}</span></div>
        ${p.tag ? `<span class="chip warn">${escapeHtml(p.tag)}</span>` : ''}
        ${rowCtrls('problems',p.id)}</div>`).join('') : emptyState('Нет проблемных сделок', admin));

  // ---- Таблица рейтинга (зеркалит менеджеров) ----
  const maxFact = Math.max(1, ...d.managers.map(m=>+m.fact||0));
  const sorted = [...d.managers].sort((a,b)=>(+b.fact||0)-(+a.fact||0));
  document.getElementById('mgrTable').innerHTML = `
    <thead><tr><th>#</th><th>Менеджер</th><th>План/Факт</th><th>Продажи</th><th>Брони</th><th>Конв.</th><th>Рейтинг</th></tr></thead>
    <tbody>${sorted.length ? sorted.map((m,i)=>{
      const rc = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      return `<tr><td><span class="rank ${rc}">${i+1}</span></td>
        <td><b>${escapeHtml(m.name)}</b></td>
        <td>${m.plan}/${m.fact}</td>
        <td><span class="tbl-bar" style="width:${(+m.fact||0)/maxFact*70}px"></span> ${m.fact} млн</td>
        <td>${m.books}</td><td>${m.conv}%</td>
        <td><span class="chip ${m.rating>=4.5?'ok':m.rating>=4?'warn':'hot'}" class="ic-inline">${iconStar(true,11)} ${m.rating}</span></td></tr>`;
    }).join('') : `<tr><td colspan="7">${emptyState('Добавьте менеджеров в блоке «Продажи по менеджерам»', false)}</td></tr>`}</tbody>`;

  // ---- Прогноз выручки ----
  document.getElementById('forecast').innerHTML = `
    <div style="text-align:center;padding:8px 0 14px;">
      <div style="font-family:'Fraunces',serif;font-size:34px;color:var(--terra-dark);line-height:1;">${forecast} млн ₽</div>
      <div style="font-size:12px;color:var(--brown-soft);margin-top:6px;">прогноз на конец месяца</div>
    </div>
    <div class="hbar"><div class="top"><span>Подтверждённые сделки</span><b>${fact} млн</b></div><div class="track"><div class="fill" style="width:${forecast?fact/forecast*100:0}%"></div></div></div>
    <div class="hbar"><div class="top"><span>В работе (вероятные)</span><b>+${Math.round(fact*0.18)} млн</b></div><div class="track"><div class="fill" style="width:18%;background:var(--st-booked)"></div></div></div>`;

  // ---- План-факт по объектам ----
  const pfMax = Math.max(1, ...d.planFact.flatMap(p=>[+p.plan||0,+p.fact||0]));
  document.getElementById('planFactObjects').innerHTML =
    (admin ? addBtn('planFact','Добавить объект') : '') +
    (d.planFact.length ? d.planFact.map(p=>`
      <div class="hbar dash-row"><div class="top"><span>${escapeHtml(p.name)} ${rowCtrls('planFact',p.id)}</span><b>${p.fact}/${p.plan} млн ₽ · ${p.plan?Math.round(p.fact/p.plan*100):0}%</b></div>
      <div class="track" style="position:relative;"><div style="position:absolute;left:${(+p.plan||0)/pfMax*100}%;top:-3px;height:16px;width:2px;background:var(--brown);opacity:.4;"></div>
      <div class="fill" style="width:${(+p.fact||0)/pfMax*100}%"></div></div></div>`).join('') : emptyState('Нет объектов', admin));

  // ---- Журнал действий ----
  document.getElementById('actionLog').innerHTML =
    (admin ? addBtn('log','Добавить запись') : '') +
    (d.log.length ? d.log.map(l=>`
      <div class="log-item dash-row"><div class="ic">${icon(LOG_ICON[l.icon]||'doc',15)}</div>
        <div style="flex:1;"><div><b>${escapeHtml(l.who)}</b> ${escapeHtml(l.action||'')}</div></div>
        <div class="tm">${escapeHtml(l.time||'')}</div>${rowCtrls('log',l.id)}</div>`).join('') : emptyState('Журнал пуст', admin));

  // ---- AI рекомендации ----
  document.getElementById('aiRecs').innerHTML =
    (admin ? `<div style="grid-column:1/-1;">${addBtn('aiRecs','Добавить рекомендацию')}</div>` : '') +
    (d.aiRecs.length ? d.aiRecs.map(a=>`
      <div class="dash-row" style="background:rgba(255,255,255,.55);border:1px solid #E8CBAE;border-radius:11px;padding:15px;">
        <b style="font-family:'Fraunces',serif;font-size:14.5px;color:var(--terra-dark);display:block;margin-bottom:7px;">${escapeHtml(a.title)} ${rowCtrls('aiRecs',a.id)}</b>
        <p style="margin:0;font-size:12.5px;line-height:1.55;color:var(--brown);">${escapeHtml(a.text||'')}</p>
      </div>`).join('') : `<div style="grid-column:1/-1;">${emptyState('Нет рекомендаций', admin)}</div>`);

  wireDashAdmin();
}

/* ---------- Хелперы рендера ---------- */
function initials(name){ return String(name||'').split(' ').map(w=>w[0]||'').join('').slice(0,2); }
function addBtn(section, label){ return `<button class="dash-add" data-add="${section}" class="ic-inline">${icon('plus',14)} ${label}</button>`; }
function rowCtrls(section, id){
  if(!state.adminMode) return '';
  return `<span class="dash-row-ctrls">
    <button class="dash-ce" data-edit-sec="${section}" data-edit-id="${id}" title="Редактировать">${icon('edit',12)}</button>
    <button class="dash-cd" data-del-sec="${section}" data-del-id="${id}" title="Удалить">${icon('close',12)}</button></span>`;
}
function emptyState(text, admin){
  return `<div class="dash-empty">${text}${admin?' · нажмите «+», чтобы добавить':''}</div>`;
}

/* ---------- Связывание элементов управления ---------- */
function wireDashAdmin(){
  if(!state.adminMode) return;

  const plan = document.getElementById('dashPlan');
  const over = document.getElementById('dashOverdue');
  const per  = document.getElementById('dashPeriod');
  if(plan) plan.onchange = ()=>{ dashSetField('plan', +plan.value||0); renderDashboard(); };
  if(over) over.onchange = ()=>{ dashSetField('overdue', +over.value||0); renderDashboard(); };
  if(per)  per.onchange  = ()=>{ dashSetField('period', per.value.trim()); renderDashboard(); };

  const demo = document.getElementById('dashDemoBtn');
  const clr  = document.getElementById('dashClearBtn');
  if(demo) demo.onclick = ()=>{ if(confirm('Загрузить демонстрационные данные? Текущие данные дашборда будут заменены.')){ dashLoadDemo(); renderDashboard(); toast('Пример загружен'); } };
  if(clr)  clr.onclick  = ()=>{ if(confirm('Очистить все данные дашборда?')){ dashClear(); renderDashboard(); toast('Дашборд очищен'); } };

  document.querySelectorAll('[data-add]').forEach(b=>b.onclick = ()=>openDashEdit(b.dataset.add, null));
  document.querySelectorAll('[data-edit-sec]').forEach(b=>b.onclick = ()=>openDashEdit(b.dataset.editSec, b.dataset.editId));
  document.querySelectorAll('[data-del-sec]').forEach(b=>b.onclick = ()=>{
    const sec = b.dataset.delSec, id = b.dataset.delId;
    if(confirm('Удалить запись?')){ dashRemove(sec, id); renderDashboard(); toast('Удалено'); }
  });
}

/* ---------- Модальный редактор блока ---------- */
function openDashEdit(section, id){
  const schema = DASH_SCHEMAS[section];
  if(!schema) return;
  const item = id ? dashData()[section].find(x=>x.id===id) : null;

  document.getElementById('dashEditTitle').textContent = (id?'Редактировать ':'Добавить ')+schema.title;
  document.getElementById('dashEditSection').value = section;
  document.getElementById('dashEditId').value = id || '';

  document.getElementById('dashEditBody').innerHTML = schema.fields.map(f=>{
    const val = item ? (item[f.k]!=null?item[f.k]:'') : '';
    if(f.type==='select'){
      return `<div class="form-row"><label>${f.label}</label><select data-fk="${f.k}">${
        f.options.map(([v,l])=>`<option value="${v}" ${String(val)===v?'selected':''}>${l}</option>`).join('')
      }</select></div>`;
    }
    if(f.type==='textarea'){
      return `<div class="form-row"><label>${f.label}</label><textarea data-fk="${f.k}" rows="3">${escapeHtml(val)}</textarea></div>`;
    }
    const step = f.step ? ` step="${f.step}"` : '';
    return `<div class="form-row"><label>${f.label}</label><input type="${f.type}"${step} data-fk="${f.k}" value="${escapeHtml(String(val))}" ${f.req?'required':''}></div>`;
  }).join('');

  document.getElementById('dashEditModal').classList.add('show');
}
function closeDashEdit(){ document.getElementById('dashEditModal').classList.remove('show'); }

function initDashEdit(){
  document.getElementById('dashEditClose').onclick  = closeDashEdit;
  document.getElementById('dashEditCancel').onclick = closeDashEdit;
  document.getElementById('dashEditForm').onsubmit = e=>{
    e.preventDefault();
    const section = document.getElementById('dashEditSection').value;
    const id = document.getElementById('dashEditId').value;
    const schema = DASH_SCHEMAS[section];
    const data = {};
    document.querySelectorAll('#dashEditBody [data-fk]').forEach(el=>{
      const f = schema.fields.find(x=>x.k===el.dataset.fk);
      data[el.dataset.fk] = f.type==='number' ? (el.value===''?0:parseFloat(el.value)) : el.value.trim();
    });
    if(id){ dashUpdate(section, id, data); toast('Изменения сохранены'); }
    else  { dashAdd(section, data); toast('Добавлено'); }
    closeDashEdit(); renderDashboard();
  };
}
