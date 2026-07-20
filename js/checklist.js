/* ============================================================
   ВКЛАДКА «ЧЕК-ЛИСТ ОП» — задачи сотрудников со статусами.
   Колонки: №, задача, срок, ответственный, статус, комментарий.
   Сотрудник видит только свои задачи (под своей учёткой);
   РОП видит общий чек-лист по всем «отсекам» + трекер в дашборде.
   ============================================================ */

function statusPill(status){
  const s = TASK_STATUSES[status] || TASK_STATUSES.planned;
  return `<span class="tsk-pill" style="--sc:${s.color}">${s.label}</span>`;
}
function statusSelect(t){
  return `<select class="tsk-status-sel" data-id="${t.id}" style="--sc:${(TASK_STATUSES[t.status]||{}).color||'#999'}">
    ${TASK_STATUS_ORDER.map(s=>`<option value="${s}" ${s===t.status?'selected':''}>${TASK_STATUSES[s].label}</option>`).join('')}
  </select>`;
}

// Таблица задач. opts: { showOwner, canEdit }
function taskTableHTML(tasks, opts){
  const { showOwner, canEdit } = opts;
  const today = isoDate(TODAY);
  const cols = 3 + (showOwner?1:0) + 2 + (canEdit?1:0);
  const head = `<tr>
    <th style="width:34px">№</th>
    <th>Задача</th>
    <th style="width:110px">Срок</th>
    ${showOwner?'<th style="width:150px">Ответственный</th>':''}
    <th style="width:150px">Статус</th>
    <th>Комментарий</th>
    ${canEdit?'<th style="width:64px"></th>':''}
  </tr>`;
  const rows = tasks.length ? tasks.map((t,i)=>{
    const overdue = t.status!=='done' && t.due && t.due < today;
    return `<tr class="tsk-row ${t.status}">
      <td class="tsk-num">${i+1}</td>
      <td class="tsk-title">${escapeHtml(t.title)}</td>
      <td class="tsk-due ${overdue?'overdue':''}">${t.due?fmtDateRu(t.due):'—'}</td>
      ${showOwner?`<td class="tsk-owner">${escapeHtml(mgrName(t.managerId))}</td>`:''}
      <td class="tsk-status">${canEdit?statusSelect(t):statusPill(t.status)}</td>
      <td class="tsk-comment ${canEdit?'editable':''}" ${canEdit?`data-comment="${t.id}"`:''}>${t.comment?escapeHtml(t.comment):(canEdit?'<span class="tsk-add-comment">＋ комментарий</span>':'—')}</td>
      ${canEdit?`<td class="tsk-actions">
        <button class="cl-cbtn" data-edit-task="${t.id}" title="Изменить">${icon('edit',12)}</button>
        <button class="cl-cbtn del" data-del-task="${t.id}" title="Удалить">${icon('close',12)}</button>
      </td>`:''}
    </tr>`;
  }).join('') : `<tr><td colspan="${cols}" class="tsk-empty">Задач нет</td></tr>`;
  return `<div class="tsk-tbl-wrap"><table class="tbl tsk-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Вкладка ---------- */
function renderChecklist(){
  const u = currentUser();
  const rop = isRop();
  const head = document.querySelector('#view-checklist .view-head h2');
  const content = document.getElementById('clContent');
  const actions = document.getElementById('clHeadActions');

  if(rop){
    head.textContent = 'Общий чек-лист ОП';
    document.getElementById('clSub').textContent =
      `Вы вошли как ${u.name} · ${u.role}. Задачи всех сотрудников разбиты по отсекам. Тот же трекер — в Дашборде РОП.`;
    actions.innerHTML = `<button class="btn btn-primary ic-inline" id="clAddTask">${icon('plus',15)} Новая задача</button>`;
    renderGeneralChecklist(content, { manage:true });
    document.getElementById('clAddTask').onclick = ()=>openTaskModal(null, null);
  } else {
    head.textContent = 'Мои задачи';
    const st = taskStats(u.id);
    document.getElementById('clSub').textContent =
      `${u.name} · ${u.role} · ${st.total} задач · выполнено ${st.done}${st.overdue?` · просрочено ${st.overdue}`:''}`;
    actions.innerHTML = `<button class="btn btn-primary ic-inline" id="clAddTask">${icon('plus',15)} Добавить задачу</button>`;
    content.innerHTML = `
      <div class="cl-main-card">
        ${taskStatsBar(u.id)}
        ${taskTableHTML(tasksFor(u.id), { showOwner:true, canEdit:true })}
      </div>`;
    document.getElementById('clAddTask').onclick = ()=>openTaskModal(null, u.id);
    wireTaskTable(content);
  }
}

// Полоска статистики (для личного вида)
function taskStatsBar(mgrId){
  const st = taskStats(mgrId);
  const chip = (n,label,color)=>`<span class="tsk-stat"><b style="color:${color}">${n}</b> ${label}</span>`;
  return `<div class="tsk-stats-bar">
    ${chip(st.total,'всего','var(--brown)')}
    ${chip(st.done,'выполнено',TASK_STATUSES.done.color)}
    ${chip(st.inProgress,'в работе',TASK_STATUSES.in_progress.color)}
    ${chip(st.planned,'запланировано',TASK_STATUSES.planned.color)}
    ${chip(st.failed,'не выполнено',TASK_STATUSES.failed.color)}
    ${st.overdue?chip(st.overdue,'просрочено','var(--terra-dark)'):''}
    <span class="tsk-stat-pct"><div class="track"><div class="fill" style="width:${st.pct}%"></div></div>${st.pct}%</span>
  </div>`;
}

// Общий чек-лист: отсеки по сотрудникам
function renderGeneralChecklist(host, opts){
  const manage = opts && opts.manage;
  host.innerHTML = MANAGERS.map(m=>{
    const st = taskStats(m.id);
    return `<div class="cl-compartment">
      <div class="cl-comp-head">
        <div class="cl-comp-title"><span class="avatar">${m.short}</span>
          <div><b>${escapeHtml(m.name)}</b><span>Менеджер ОП</span></div>
        </div>
        <div class="cl-comp-stats">
          <span class="tsk-mini done">${st.done} вып.</span>
          <span class="tsk-mini work">${st.inProgress} в работе</span>
          ${st.overdue?`<span class="tsk-mini over">${st.overdue} просроч.</span>`:''}
          <span class="cl-comp-pct">${st.pct}%</span>
          ${manage?`<button class="btn btn-sm ic-inline" data-add-for="${m.id}">${icon('plus',13)} Задача</button>`:''}
        </div>
      </div>
      ${taskTableHTML(tasksFor(m.id), { showOwner:false, canEdit:manage })}
    </div>`;
  }).join('');
  wireTaskTable(host);
  if(manage){
    host.querySelectorAll('[data-add-for]').forEach(b=>b.onclick = ()=>openTaskModal(null, b.dataset.addFor));
  }
}

// Общий трекер для дашборда РОП
function renderChecklistTracker(host){
  const rows = MANAGERS.map(m=>{
    const st = taskStats(m.id);
    return `<tr>
      <td><b>${escapeHtml(m.name)}</b></td>
      <td>${st.total}</td>
      <td style="color:${TASK_STATUSES.done.color}">${st.done}</td>
      <td style="color:${TASK_STATUSES.in_progress.color}">${st.inProgress}</td>
      <td style="color:${TASK_STATUSES.planned.color}">${st.planned}</td>
      <td style="color:${TASK_STATUSES.failed.color}">${st.failed}</td>
      <td>${st.overdue?`<b style="color:var(--terra-dark)">${st.overdue}</b>`:'—'}</td>
      <td style="min-width:130px"><div class="tsk-track"><div class="tsk-fill ${st.pct>=100?'full':''}" style="width:${st.pct}%"></div></div></td>
      <td style="text-align:right"><b>${st.pct}%</b></td>
    </tr>`;
  }).join('');
  const totals = MANAGERS.reduce((a,m)=>{ const s=taskStats(m.id); a.total+=s.total; a.done+=s.done; a.over+=s.overdue; return a; }, {total:0,done:0,over:0});
  host.innerHTML = `
    <div class="card-sub" style="margin-bottom:12px;">Всего задач ${totals.total} · выполнено ${totals.done}${totals.over?` · просрочено ${totals.over}`:''}</div>
    <table class="tbl tsk-tracker">
      <thead><tr><th>Сотрудник</th><th>Всего</th><th>Вып.</th><th>В работе</th><th>Заплан.</th><th>Не вып.</th><th>Просроч.</th><th>Прогресс</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ---------- Связывание таблиц ---------- */
function wireTaskTable(host){
  // Смена статуса
  host.querySelectorAll('.tsk-status-sel').forEach(sel=>sel.onchange = ()=>{
    taskUpdate(sel.dataset.id, { status: sel.value });
    renderChecklist(); renderDashboard();
  });
  // Комментарий
  host.querySelectorAll('[data-comment]').forEach(td=>td.onclick = ()=>{
    const t = tasksAll().find(x=>x.id===td.dataset.comment);
    const v = prompt('Комментарий к задаче:', t ? t.comment : '');
    if(v!==null){ taskUpdate(td.dataset.comment, { comment: v.trim() }); renderChecklist(); }
  });
  // Редактирование / удаление
  host.querySelectorAll('[data-edit-task]').forEach(b=>b.onclick = ()=>openTaskModal(b.dataset.editTask, null));
  host.querySelectorAll('[data-del-task]').forEach(b=>b.onclick = ()=>{
    if(confirm('Удалить задачу?')){ taskRemove(b.dataset.delTask); renderChecklist(); renderDashboard(); toast('Задача удалена'); }
  });
}

/* ---------- Модалка задачи ---------- */
function openTaskModal(id, presetMgr){
  const t = id ? tasksAll().find(x=>x.id===id) : null;
  const canAssign = canManageTasks();
  document.getElementById('clTaskTitle').textContent = id ? 'Редактирование задачи' : 'Новая задача';
  document.getElementById('clTaskId').value = id || '';
  document.getElementById('clTaskTask').value = t ? t.title : '';
  document.getElementById('clTaskDue').value = t ? t.due : isoDate(TODAY);
  document.getElementById('clTaskComment').value = t ? t.comment : '';
  // Ответственный
  const mgrSel = document.getElementById('clTaskMgr');
  mgrSel.innerHTML = MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  mgrSel.value = t ? t.managerId : (presetMgr || currentUserId());
  // Сотрудник не может переназначать — только РОП/админ
  document.getElementById('clTaskMgrRow').style.display = canAssign ? '' : 'none';
  if(!canAssign) mgrSel.value = currentUserId();
  // Статус
  document.getElementById('clTaskStatus').innerHTML =
    TASK_STATUS_ORDER.map(s=>`<option value="${s}">${TASK_STATUSES[s].label}</option>`).join('');
  document.getElementById('clTaskStatus').value = t ? t.status : 'planned';
  document.getElementById('clTaskModal').classList.add('show');
}
function closeTaskModal(){ document.getElementById('clTaskModal').classList.remove('show'); }
function initTaskModal(){
  document.getElementById('clTaskClose').onclick  = closeTaskModal;
  document.getElementById('clTaskCancel').onclick = closeTaskModal;
  document.getElementById('clTaskForm').onsubmit = e=>{
    e.preventDefault();
    const id = document.getElementById('clTaskId').value;
    const canAssign = canManageTasks();
    const data = {
      title:     document.getElementById('clTaskTask').value.trim(),
      due:       document.getElementById('clTaskDue').value,
      managerId: canAssign ? document.getElementById('clTaskMgr').value : currentUserId(),
      status:    document.getElementById('clTaskStatus').value,
      comment:   document.getElementById('clTaskComment').value.trim(),
    };
    if(!data.title){ toast('Укажите задачу'); return; }
    if(id){ taskUpdate(id, data); toast('Задача сохранена'); }
    else  { taskAdd(data); toast('Задача добавлена'); }
    closeTaskModal(); renderChecklist(); renderDashboard();
  };
}
