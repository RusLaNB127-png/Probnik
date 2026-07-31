/* ============================================================
   АВТОРИЗАЦИЯ — экран входа, применение прав, управление
   учётными записями (для РОП).
   ============================================================ */

function showLogin(){ document.getElementById('authScreen').classList.add('show'); }
function hideLogin(){ document.getElementById('authScreen').classList.remove('show'); }

// Применение прав текущей роли к интерфейсу
function applyPermissions(){
  const dashTab = document.querySelector('.tab[data-view="dashboard"]');
  if(dashTab) dashTab.style.display = can('dashboard') ? '' : 'none';
  const rulesTab = document.querySelector('.tab[data-view="rules"]');
  if(rulesTab) rulesTab.style.display = can('admin') ? '' : 'none';
  const gear = document.getElementById('adminToggle');
  if(gear) gear.style.display = can('admin') ? '' : 'none';
  if(!can('admin') && state.adminMode){ state.adminMode = false; }
  // Если менеджер стоит на скрытой вкладке — увести на шахматку
  const active = document.querySelector('.tab.active');
  if(active && active.dataset.view==='rules' && !can('admin')){
    const chess = document.querySelector('.tab[data-view="chess"]'); if(chess) chess.click();
  }
  if(active && active.dataset.view==='dashboard' && !can('dashboard')){
    const chess = document.querySelector('.tab[data-view="chess"]'); if(chess) chess.click();
  }
}

function initAuth(){
  // Заполнить подсказку демо-доступов
  const hint = document.getElementById('authHint');
  if(hint){
    hint.innerHTML = `<b>Демо-доступы</b> (пароль у всех: <code>${DEFAULT_PW}</code>)<br>` +
      (state.auth.users||[]).filter(u=>u.active).map(u=>`${escapeHtml(u.email)} — ${u.role==='rop'?'РОП':'менеджер'}`).join('<br>');
  }
  // Восстановить сессию
  const s = loadSessionUid();
  const acc = s ? account(s) : null;
  if(acc && acc.active){
    state.auth.sessionUid = acc.uid;
    state.currentUser = acc.uid;
    hideLogin();
  } else {
    clearSessionUid();
    showLogin();
  }
  bindAuthForm();
  applyPermissions();
  renderUserSwitch();

  // Управление пользователями
  document.getElementById('usersClose').onclick = ()=>document.getElementById('usersModal').classList.remove('show');
  document.getElementById('userAddForm').onsubmit = e=>{
    e.preventDefault();
    const name=document.getElementById('uaName').value.trim();
    const email=document.getElementById('uaEmail').value.trim();
    const pw=document.getElementById('uaPass').value.trim();
    if(!name||!email){ toast('Укажите имя и e-mail'); return; }
    if((state.auth.users||[]).some(u=>u.email.toLowerCase()===email.toLowerCase())){ toast('E-mail уже используется'); return; }
    userAddManager(name, email, pw);
    document.getElementById('userAddForm').reset();
    renderUsersList(); refreshLive();
    toast('Сотрудник добавлен');
  };
}

function bindAuthForm(){
  const form = document.getElementById('authForm');
  const err = document.getElementById('authError');
  form.onsubmit = e=>{
    e.preventDefault();
    err.textContent='';
    const res = login(
      document.getElementById('authEmail').value,
      document.getElementById('authPass').value,
      document.getElementById('authRemember').checked
    );
    if(!res.ok){ err.textContent = res.msg; return; }
    document.getElementById('authPass').value='';
    hideLogin();
    applyPermissions();
    renderUserSwitch();
    // Полный перерисов под новую роль
    renderChess(); renderClientList(); renderClientCard();
    renderDashboard(); renderChecklist(); renderAnalytics(); renderNotifs();
    toast('Добро пожаловать, '+res.acc.name);
  };
}

function doLogout(){
  logout();
  const menu=document.getElementById('userMenu'); if(menu) menu.classList.remove('show');
  document.getElementById('authEmail').value='';
  document.getElementById('authPass').value='';
  document.getElementById('authError').textContent='';
  showLogin();
}

function openUsersModal(){
  renderUsersList();
  document.getElementById('usersModal').classList.add('show');
  const menu=document.getElementById('userMenu'); if(menu) menu.classList.remove('show');
}
function renderUsersList(){
  const host=document.getElementById('usersList');
  host.innerHTML = (state.auth.users||[]).map(u=>`
    <div class="user-row ${u.active?'':'off'}">
      <div class="user-row-av">${mkShort(u.name)}</div>
      <div class="user-row-meta"><b>${escapeHtml(u.name)}</b><span>${escapeHtml(u.email)} · ${u.role==='rop'?'Руководитель':'Менеджер'}</span></div>
      <div class="user-row-actions">
        <button class="btn btn-sm" data-reset="${u.uid}">Сбросить пароль</button>
        ${u.uid==='rop' ? '<span class="user-row-tag">основной</span>'
          : `<button class="btn btn-sm" data-toggle="${u.uid}" style="${u.active?'color:var(--terra-dark);border-color:var(--terra-dark);':''}">${u.active?'Отключить':'Включить'}</button>`}
      </div>
    </div>`).join('');
  host.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{
    const pw = prompt('Новый пароль для сотрудника:');
    if(pw && pw.trim()){ userSetPassword(b.dataset.reset, pw.trim()); toast('Пароль обновлён'); }
  });
  host.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{
    const a=account(b.dataset.toggle); userSetActive(a.uid, !a.active); renderUsersList(); refreshLive();
  });
}
