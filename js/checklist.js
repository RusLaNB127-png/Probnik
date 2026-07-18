/* ============================================================
   ВКЛАДКА «ЧЕК-ЛИСТ ОП»
   Общий шаблон чек-листа (редактируется в админ-режиме),
   прогресс отмечается индивидуально по каждому сотруднику.
   Данные — в state.checklist (в базе).
   ============================================================ */

// Мини-кольцо прогресса
function clRing(pct, size=42){
  const r = size/2 - 4, c = 2*Math.PI*r, off = c*(1 - Math.min(pct,100)/100);
  const col = pct>=100 ? 'var(--st-free)' : 'var(--terra)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--sand)" stroke-width="4"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/>
    <text x="${size/2}" y="${size/2+3.5}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--brown)">${pct}</text>
  </svg>`;
}

function renderChecklist(){
  const admin = state.adminMode;
  const cl = checklistData();
  if(!MANAGERS.find(m=>m.id===state.checklistMgr)) state.checklistMgr = MANAGERS[0].id;
  const mgrId = state.checklistMgr;
  const mgr = MANAGERS.find(m=>m.id===mgrId);

  // Средний прогресс по отделу
  const avg = Math.round(MANAGERS.reduce((s,m)=>s+checklistStats(m.id).pct,0) / (MANAGERS.length||1));
  document.getElementById('clSub').textContent =
    `Общий чек-лист отдела продаж · ${MANAGERS.length} сотрудников · средняя готовность ${avg}%`;

  // ---- Панель администратора ----
  const bar = document.getElementById('clAdminBar');
  if(admin){
    bar.style.display = 'block';
    bar.innerHTML = `
      <div class="dash-admin-head">
        <h4 class="ic-inline">${icon('gear',15)} Редактирование чек-листа <span class="badge-admin">Админ</span></h4>
        <div class="dash-admin-actions">
          <button class="btn btn-sm ic-inline" id="clAddSection">${icon('plus',14)} Раздел</button>
          <button class="btn btn-sm" id="clLoadDefault">Шаблон по умолчанию</button>
        </div>
      </div>
      <div class="dash-admin-hint">Шаблон общий для всех сотрудников. Прогресс каждый отмечает у себя. Изменения сохраняются в базу.</div>`;
  } else {
    bar.style.display = 'none';
    bar.innerHTML = '';
  }

  // ---- Команда: карточки сотрудников с прогрессом ----
  document.getElementById('clTeam').innerHTML = MANAGERS.map(m=>{
    const st = checklistStats(m.id);
    return `<button class="cl-emp ${m.id===mgrId?'active':''}" data-mgr="${m.id}">
      <div class="avatar">${m.short}</div>
      <div class="cl-emp-meta"><b>${escapeHtml(m.name)}</b><span>${st.done} из ${st.total}</span></div>
      <div class="cl-emp-ring">${clRing(st.pct)}</div>
    </button>`;
  }).join('');

  // ---- Чек-лист выбранного сотрудника ----
  const st = checklistStats(mgrId);
  document.getElementById('clBody').innerHTML = `
    <div class="cl-body-head">
      <div>
        <h3>Чек-лист · ${escapeHtml(mgr.name)}</h3>
        <div class="cl-body-sub">${st.done} из ${st.total} пунктов выполнено</div>
      </div>
      <button class="btn btn-sm" id="clResetMgr">Сбросить отметки</button>
    </div>
    <div class="cl-progress">
      <div class="track"><div class="fill ${st.pct>=100?'full':''}" style="width:${st.pct}%"></div></div>
      <b>${st.pct}%</b>
    </div>
    ${cl.sections.length ? cl.sections.map(sec=>{
      const secDone = (sec.items||[]).filter(it=>checklistIsDone(mgrId,it.id)).length;
      return `<div class="cl-section">
        <div class="cl-section-head">
          <h4>${escapeHtml(sec.title)} <span class="cl-section-count">${secDone}/${(sec.items||[]).length}</span></h4>
          ${admin ? `<span class="cl-sec-ctrls">
            <button class="cl-cbtn" data-add-item="${sec.id}" title="Добавить пункт">${icon('plus',12)}</button>
            <button class="cl-cbtn" data-ren-sec="${sec.id}" title="Переименовать раздел">${icon('edit',12)}</button>
            <button class="cl-cbtn del" data-del-sec="${sec.id}" title="Удалить раздел">${icon('close',12)}</button>
          </span>` : ''}
        </div>
        <div class="cl-items">
          ${(sec.items||[]).map(it=>{
            const done = checklistIsDone(mgrId, it.id);
            return `<div class="cl-item ${done?'done':''}">
              <button class="cl-check ${done?'on':''}" data-toggle="${it.id}" aria-pressed="${done}">${done?icon('check',13):''}</button>
              <span class="cl-item-title" data-toggle="${it.id}">${escapeHtml(it.title)}</span>
              ${admin ? `<span class="cl-item-ctrls">
                <button class="cl-cbtn" data-edit-item="${it.id}" data-sec="${sec.id}" title="Изменить">${icon('edit',12)}</button>
                <button class="cl-cbtn del" data-del-item="${it.id}" data-sec="${sec.id}" title="Удалить">${icon('close',12)}</button>
              </span>` : ''}
            </div>`;
          }).join('') || `<div class="cl-section-empty">В разделе пока нет пунктов${admin?' — добавьте «＋»':''}</div>`}
        </div>
      </div>`;
    }).join('') : `<div class="dash-empty">Чек-лист пуст${admin?' — добавьте раздел':''}</div>`}
  `;

  wireChecklist();
}

function wireChecklist(){
  // Выбор сотрудника
  document.querySelectorAll('#clTeam [data-mgr]').forEach(b=>b.onclick = ()=>{
    state.checklistMgr = b.dataset.mgr;
    renderChecklist();
  });
  // Переключение пунктов
  document.querySelectorAll('#clBody [data-toggle]').forEach(el=>el.onclick = ()=>{
    checklistToggle(state.checklistMgr, el.dataset.toggle);
    renderChecklist();
  });
  // Сброс отметок сотрудника
  const reset = document.getElementById('clResetMgr');
  if(reset) reset.onclick = ()=>{
    const mgr = MANAGERS.find(m=>m.id===state.checklistMgr);
    if(confirm('Снять все отметки у сотрудника «'+mgr.name+'»?')){
      checklistResetMgr(state.checklistMgr); renderChecklist(); toast('Отметки сброшены');
    }
  };

  if(!state.adminMode) return;
  // Админ: разделы и пункты
  const addSec = document.getElementById('clAddSection');
  if(addSec) addSec.onclick = ()=>{
    const t = prompt('Название нового раздела:');
    if(t && t.trim()){ checklistAddSection(t.trim()); renderChecklist(); toast('Раздел добавлен'); }
  };
  const loadDef = document.getElementById('clLoadDefault');
  if(loadDef) loadDef.onclick = ()=>{
    if(confirm('Загрузить шаблон чек-листа по умолчанию? Текущий шаблон и все отметки будут заменены.')){
      checklistLoadDefault(); renderChecklist(); toast('Шаблон загружен');
    }
  };
  document.querySelectorAll('[data-add-item]').forEach(b=>b.onclick = ()=>{
    const t = prompt('Текст нового пункта:');
    if(t && t.trim()){ checklistAddItem(b.dataset.addItem, t.trim()); renderChecklist(); }
  });
  document.querySelectorAll('[data-ren-sec]').forEach(b=>b.onclick = ()=>{
    const s = checklistData().sections.find(x=>x.id===b.dataset.renSec);
    const t = prompt('Название раздела:', s ? s.title : '');
    if(t && t.trim()){ checklistRenameSection(b.dataset.renSec, t.trim()); renderChecklist(); }
  });
  document.querySelectorAll('[data-del-sec]').forEach(b=>b.onclick = ()=>{
    if(confirm('Удалить раздел вместе со всеми пунктами?')){ checklistRemoveSection(b.dataset.delSec); renderChecklist(); toast('Раздел удалён'); }
  });
  document.querySelectorAll('[data-edit-item]').forEach(b=>b.onclick = ()=>{
    const sec = checklistData().sections.find(x=>x.id===b.dataset.sec);
    const it = sec && sec.items.find(i=>i.id===b.dataset.editItem);
    const t = prompt('Текст пункта:', it ? it.title : '');
    if(t && t.trim()){ checklistUpdateItem(b.dataset.sec, b.dataset.editItem, t.trim()); renderChecklist(); }
  });
  document.querySelectorAll('[data-del-item]').forEach(b=>b.onclick = ()=>{
    if(confirm('Удалить пункт?')){ checklistRemoveItem(b.dataset.sec, b.dataset.delItem); renderChecklist(); }
  });
}
