/* ============================================================
   ИПОТЕЧНЫЙ КАЛЬКУЛЯТОР
   Открывается из карточки помещения (цена подставляется).
   Программы банков хранятся в базе и редактируются в админ-режиме;
   КП использует эти же программы, чтобы цифры совпадали.
   ============================================================ */

const DEFAULT_MORTGAGE_PROGRAMS = [
  { id:'fam',  name:'Семейная ипотека',    rate:6,  years:30, minDown:20, note:'Для семей с детьми' },
  { id:'it',   name:'IT-ипотека',          rate:5,  years:30, minDown:20, note:'Для сотрудников IT-компаний' },
  { id:'gov',  name:'Господдержка',        rate:8,  years:30, minDown:20, note:'Стандартная господдержка' },
  { id:'base', name:'Базовая программа',   rate:18, years:25, minDown:20, note:'Без льгот' },
  { id:'rass', name:'Рассрочка застройщика',rate:0, years:1,  minDown:20, note:'Беспроцентно, до сдачи дома' },
];

function mortgageData(){
  if(!state.mortgage || !Array.isArray(state.mortgage.programs) || !state.mortgage.programs.length){
    state.mortgage = { programs: JSON.parse(JSON.stringify(DEFAULT_MORTGAGE_PROGRAMS)) };
  }
  return state.mortgage;
}
function mortgagePrograms(){ return mortgageData().programs; }

/* ---------- Математика ---------- */
// Аннуитетный платёж
function mAnnuity(principal, annualPct, years){
  const n = Math.max(1, Math.round(years*12));
  if(principal <= 0) return 0;
  const r = annualPct/100/12;
  if(r <= 0) return Math.round(principal/n);
  return Math.round(principal * r / (1 - Math.pow(1+r, -n)));
}
// График по годам: проценты, тело долга, остаток
function mSchedule(principal, annualPct, years){
  const n = Math.max(1, Math.round(years*12));
  const r = annualPct/100/12;
  const pay = mAnnuity(principal, annualPct, years);
  let bal = principal, rows = [], yInt = 0, yBody = 0;
  for(let i=1; i<=n; i++){
    const interest = Math.max(0, bal * r);
    // Последний платёж гасит остаток полностью (иначе копится ошибка округления)
    const body = (i === n) ? bal : Math.min(bal, pay - interest);
    bal = Math.max(0, bal - body);
    yInt += interest; yBody += body;
    if(i % 12 === 0 || i === n){
      rows.push({ year: Math.ceil(i/12), interest: yInt, body: yBody, balance: bal });
      yInt = 0; yBody = 0;
    }
  }
  return { pay, rows, total: pay*n };
}
// Склонение: 1 год / 2 года / 5 лет
function plural(n, one, few, many){
  const a = Math.abs(Math.round(n)) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5)   return few;
  if(b === 1)          return one;
  return many;
}
function mRub(v){ return Math.round(v).toLocaleString('ru-RU')+' ₽'; }
function mRubShort(v){
  if(Math.abs(v) >= 1e6) return (Math.round(v/1e5)/10).toLocaleString('ru-RU')+' млн ₽';
  if(Math.abs(v) >= 1e3) return Math.round(v/1e3).toLocaleString('ru-RU')+' тыс ₽';
  return Math.round(v)+' ₽';
}

/* ---------- Состояние формы ---------- */
const mCalc = { unitId:null, price:0, downPct:20, years:30, progId:'fam', rate:6, showSchedule:false };

function openMortgage(unitId){
  const u = unitId ? getUnit(unitId) : null;
  mCalc.unitId = unitId || null;
  mCalc.price = u ? Math.round(u.total*1e6) : 10000000;
  const p = mortgagePrograms()[0];
  mCalc.progId = p.id; mCalc.rate = p.rate; mCalc.years = p.years; mCalc.downPct = p.minDown;
  mCalc.showSchedule = false;
  renderMortgage();
  document.getElementById('mortModal').classList.add('show');
}
function closeMortgage(){ document.getElementById('mortModal').classList.remove('show'); }

function renderMortgage(){
  const u = mCalc.unitId ? getUnit(mCalc.unitId) : null;
  const price = Math.max(0, mCalc.price);
  const down = Math.round(price * mCalc.downPct/100);
  const loan = Math.max(0, price - down);
  const sch = mSchedule(loan, mCalc.rate, mCalc.years);
  const overpay = Math.max(0, sch.total - loan);
  const income = Math.round(sch.pay / 0.4);
  const prog = mortgagePrograms().find(p=>p.id===mCalc.progId) || {};

  // Шапка: объект
  document.getElementById('mortSub').textContent = u
    ? `${u.kind||'Квартира'} ${u.displayNum} · ${u.corp} · ${u.floor} этаж · ${u.area} м²`
    : 'Свободный расчёт';

  // Программы
  document.getElementById('mortProgs').innerHTML = mortgagePrograms().map(p=>`
    <button class="mort-prog ${p.id===mCalc.progId?'active':''}" data-prog="${p.id}">
      <b>${escapeHtml(p.name)}</b>
      <span class="mort-prog-rate">${p.rate}%</span>
      <span class="mort-prog-note">${escapeHtml(p.note||'')}</span>
    </button>`).join('');

  // Поля
  document.getElementById('mortFields').innerHTML = `
    <div class="mort-field">
      <div class="mort-field-top"><label>Стоимость</label><b>${mRub(price)}</b></div>
      <input type="range" id="mPriceR" min="1000000" max="80000000" step="100000" value="${price}">
      <input type="number" id="mPriceN" value="${price}" step="100000">
    </div>
    <div class="mort-field">
      <div class="mort-field-top"><label>Первый взнос</label><b>${mRub(down)} · ${mCalc.downPct}%</b></div>
      <input type="range" id="mDownR" min="${prog.minDown||0}" max="90" step="1" value="${mCalc.downPct}">
      <input type="number" id="mDownN" value="${down}" step="100000">
      ${prog.minDown ? `<div class="mort-hint">Минимальный взнос по программе — ${prog.minDown}%</div>`:''}
    </div>
    <div class="mort-field">
      <div class="mort-field-top"><label>Срок кредита</label><b>${mCalc.years} ${plural(mCalc.years,'год','года','лет')}</b></div>
      <input type="range" id="mYearsR" min="1" max="30" step="1" value="${mCalc.years}">
      <input type="number" id="mYearsN" value="${mCalc.years}" min="1" max="30">
    </div>
    <div class="mort-field">
      <div class="mort-field-top"><label>Ставка</label><b>${mCalc.rate}%</b></div>
      <input type="range" id="mRateR" min="0" max="30" step="0.1" value="${mCalc.rate}">
      <input type="number" id="mRateN" value="${mCalc.rate}" step="0.1">
    </div>`;

  // Результат
  document.getElementById('mortResult').innerHTML = `
    <div class="mort-pay">
      <span>Ежемесячный платёж</span>
      <b>${mRub(sch.pay)}</b>
      <i>${escapeHtml(prog.name||'')} · ${mCalc.rate}% · ${mCalc.years} ${plural(mCalc.years,'год','года','лет')}</i>
    </div>
    <div class="mort-nums">
      <div><span>Сумма кредита</span><b>${mRub(loan)}</b></div>
      <div><span>Первый взнос</span><b>${mRub(down)}</b></div>
      <div><span>Переплата</span><b class="warn">${mRub(overpay)}</b></div>
      <div><span>Всего выплат</span><b>${mRub(sch.total + down)}</b></div>
      <div><span>Нужен доход от*</span><b>${mRub(income)}</b></div>
    </div>
    <div class="mort-note">* Ориентировочно: платёж не должен превышать 40% дохода. Расчёт предварительный, не является офертой.</div>`;

  // Сравнение программ
  document.getElementById('mortCompare').innerHTML = `
    <table class="tbl mort-tbl">
      <thead><tr><th>Программа</th><th>Ставка</th><th>Срок</th><th>Платёж/мес</th><th>Переплата</th></tr></thead>
      <tbody>${mortgagePrograms().map(p=>{
        const l = Math.max(0, price - Math.round(price*Math.max(mCalc.downPct, p.minDown||0)/100));
        const s = mSchedule(l, p.rate, p.years);
        return `<tr class="${p.id===mCalc.progId?'sel':''}">
          <td><b>${escapeHtml(p.name)}</b></td><td>${p.rate}%</td>
          <td>${p.years} ${plural(p.years,'год','года','лет')}</td>
          <td><b style="color:var(--terra-dark)">${mRub(s.pay)}</b></td>
          <td>${mRubShort(Math.max(0, s.total - l))}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;

  // График платежей
  const schHost = document.getElementById('mortSchedule');
  schHost.innerHTML = `
    <button class="btn btn-sm" id="mSchToggle">${mCalc.showSchedule?'Скрыть':'Показать'} график платежей</button>
    ${mCalc.showSchedule ? `
      <table class="tbl mort-tbl" style="margin-top:12px;">
        <thead><tr><th>Год</th><th>Проценты</th><th>Основной долг</th><th>Остаток</th></tr></thead>
        <tbody>${sch.rows.map(r=>`<tr>
          <td>${r.year}</td><td>${mRubShort(r.interest)}</td>
          <td>${mRubShort(r.body)}</td><td><b>${mRubShort(r.balance)}</b></td></tr>`).join('')}</tbody>
      </table>` : ''}`;

  // Админ: редактирование программ
  const adm = document.getElementById('mortAdmin');
  if(state.adminMode){
    adm.style.display = 'block';
    adm.innerHTML = `
      <div class="dash-admin-head">
        <h4 class="ic-inline">${icon('gear',15)} Программы ипотеки <span class="badge-admin">Админ</span></h4>
        <div class="dash-admin-actions">
          <button class="btn btn-sm ic-inline" id="mAddProg">${icon('plus',13)} Программа</button>
          <button class="btn btn-sm" id="mResetProgs">Сбросить</button>
        </div>
      </div>
      <table class="tbl mort-tbl">
        <thead><tr><th>Название</th><th>Ставка,%</th><th>Срок, лет</th><th>Мин. взнос,%</th><th></th></tr></thead>
        <tbody>${mortgagePrograms().map(p=>`<tr>
          <td><input class="mort-inp" data-e="name" data-id="${p.id}" value="${escapeHtml(p.name)}"></td>
          <td><input class="mort-inp num" type="number" step="0.1" data-e="rate" data-id="${p.id}" value="${p.rate}"></td>
          <td><input class="mort-inp num" type="number" data-e="years" data-id="${p.id}" value="${p.years}"></td>
          <td><input class="mort-inp num" type="number" data-e="minDown" data-id="${p.id}" value="${p.minDown}"></td>
          <td><button class="cl-cbtn del" data-del-prog="${p.id}">${icon('close',12)}</button></td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="dash-admin-hint">Изменения применяются к калькулятору и к коммерческому предложению.</div>`;
  } else { adm.style.display='none'; adm.innerHTML=''; }

  wireMortgage();
}

function wireMortgage(){
  // Программы
  document.querySelectorAll('#mortProgs [data-prog]').forEach(b=>b.onclick=()=>{
    const p = mortgagePrograms().find(x=>x.id===b.dataset.prog);
    if(!p) return;
    mCalc.progId = p.id; mCalc.rate = p.rate; mCalc.years = p.years;
    if(mCalc.downPct < (p.minDown||0)) mCalc.downPct = p.minDown;
    renderMortgage();
  });
  // Поля: слайдер + число синхронно
  const price = Math.max(0, mCalc.price);
  const pair = (rId, nId, apply)=>{
    const r=document.getElementById(rId), n=document.getElementById(nId);
    if(r) r.oninput = ()=>{ apply(+r.value); renderMortgage(); };
    if(n) n.onchange = ()=>{ apply(+n.value); renderMortgage(); };
  };
  pair('mPriceR','mPriceN', v=>{ mCalc.price = Math.max(0, v); });
  pair('mYearsR','mYearsN', v=>{ mCalc.years = Math.min(30, Math.max(1, Math.round(v))); });
  pair('mRateR','mRateN',  v=>{ mCalc.rate = Math.min(40, Math.max(0, v)); });
  const dr=document.getElementById('mDownR'), dn=document.getElementById('mDownN');
  if(dr) dr.oninput = ()=>{ mCalc.downPct = +dr.value; renderMortgage(); };
  if(dn) dn.onchange = ()=>{
    const pct = price>0 ? Math.round(+dn.value/price*100) : 0;
    mCalc.downPct = Math.min(90, Math.max(0, pct)); renderMortgage();
  };
  // График
  const t=document.getElementById('mSchToggle');
  if(t) t.onclick = ()=>{ mCalc.showSchedule = !mCalc.showSchedule; renderMortgage(); };

  // Админ
  document.querySelectorAll('#mortAdmin .mort-inp').forEach(inp=>inp.onchange=()=>{
    const p = mortgagePrograms().find(x=>x.id===inp.dataset.id);
    if(!p) return;
    const f = inp.dataset.e;
    p[f] = (f==='name') ? inp.value : Math.max(0, +inp.value||0);
    if(p.id===mCalc.progId && f==='rate')  mCalc.rate = p.rate;
    if(p.id===mCalc.progId && f==='years') mCalc.years = p.years;
    saveState(); renderMortgage();
  });
  document.querySelectorAll('#mortAdmin [data-del-prog]').forEach(b=>b.onclick=()=>{
    if(mortgagePrograms().length<=1){ toast('Нужна хотя бы одна программа'); return; }
    state.mortgage.programs = mortgagePrograms().filter(p=>p.id!==b.dataset.delProg);
    if(mCalc.progId===b.dataset.delProg){ const p=mortgagePrograms()[0]; mCalc.progId=p.id; mCalc.rate=p.rate; mCalc.years=p.years; }
    saveState(); renderMortgage();
  });
  const add=document.getElementById('mAddProg');
  if(add) add.onclick = ()=>{
    mortgagePrograms().push({ id:uid('mp'), name:'Новая программа', rate:10, years:20, minDown:20, note:'' });
    saveState(); renderMortgage();
  };
  const res=document.getElementById('mResetProgs');
  if(res) res.onclick = ()=>{
    if(confirm('Вернуть программы по умолчанию?')){
      state.mortgage = { programs: JSON.parse(JSON.stringify(DEFAULT_MORTGAGE_PROGRAMS)) };
      const p=mortgagePrograms()[0]; mCalc.progId=p.id; mCalc.rate=p.rate; mCalc.years=p.years;
      saveState(); renderMortgage(); toast('Программы сброшены');
    }
  };
}

/* ---------- Заявка на ипотеку → задача менеджеру ---------- */
function mortgageRequest(){
  const u = mCalc.unitId ? getUnit(mCalc.unitId) : null;
  const prog = mortgagePrograms().find(p=>p.id===mCalc.progId) || {};
  const price = Math.max(0, mCalc.price);
  const down = Math.round(price*mCalc.downPct/100);
  const pay = mAnnuity(price-down, mCalc.rate, mCalc.years);
  const mgrId = (u && u.managerId) || (typeof currentUserId==='function' && role()==='manager' ? currentUserId() : MANAGERS[0].id);
  taskAdd({
    title: `Ипотека: подготовить заявку${u?` — ${u.displayNum} (${u.corp})`:''}`,
    managerId: mgrId,
    due: isoDate(addDays(TODAY, 2)),
    status: 'planned',
    comment: `${prog.name||''} · ${mCalc.rate}% · ${mCalc.years} лет · взнос ${mCalc.downPct}% (${mRub(down)}) · платёж ${mRub(pay)}`,
  });
  logActivity({ type:'deal', icon:'doc',
    text:`Заявка на ипотеку${u?` · ${u.displayNum}`:''}: ${prog.name||''} — ${mRub(pay)}/мес`, who:mgrId });
  if(typeof refreshLive==='function') refreshLive();
  toast('Заявка создана — задача поставлена менеджеру');
}

function initMortgage(){
  document.getElementById('mortClose').onclick = closeMortgage;
  document.getElementById('mortModal').addEventListener('click', e=>{
    if(e.target.id==='mortModal') closeMortgage();
  });
  document.getElementById('mortRequest').onclick = mortgageRequest;
}
