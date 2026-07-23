/* ============================================================
   КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ ПО КВАРТИРЕ (многостраничный буклет)
   Формируется из карточки помещения, печатается / сохраняется в PDF.
   Блоки: обложка · характеристики+планировка · финансы (ипотека,
   рассрочка) · акции и контакты. Без персонализации по клиенту.
   ============================================================ */

// Аннуитетный платёж
function kpAnnuity(principal, annualPct, years){
  const r = annualPct/100/12, n = years*12;
  if(r <= 0) return Math.round(principal/n);
  return Math.round(principal * r / (1 - Math.pow(1+r, -n)));
}
function kpRub(v){ return Math.round(v).toLocaleString('ru-RU')+' ₽'; }
function kpMln(v){ return (Math.round(v*10)/10).toLocaleString('ru-RU',{maximumFractionDigits:1})+' млн ₽'; }

function kpViewText(u){
  const cat = u.view && u.view.category ? (VIEW_CATEGORIES.find(v=>v.id===u.view.category)||{}).label : '';
  const dir = u.view && u.view.direction ? u.view.direction : '';
  return [cat, dir].filter(Boolean).join(' · ') || '—';
}

function generateKP(unitId){
  const u = getUnit(unitId);
  if(!u) return;
  const bName = BUILDINGS[state.building].name;
  const mgr = MANAGERS.find(m=>m.id===u.managerId) || MANAGERS[0];
  const priceRub = u.total * 1e6;

  // Ипотека: первый взнос 20%
  const downPct = 20, loan = priceRub * (1 - downPct/100);
  const progs = [
    { name:'Семейная ипотека', rate:6,  years:30 },
    { name:'IT-ипотека',       rate:5,  years:30 },
    { name:'Базовая программа',rate:18, years:25 },
  ].map(p=>({ ...p, pay: kpAnnuity(loan, p.rate, p.years) }));
  const rassrochka = Math.round((priceRub - priceRub*downPct/100) / 12);

  const flag = '<span class="kp-flag"></span>';
  const brandHead = `<div class="kp-brand">${flag}<div><div class="kp-brand-name">ИТАЛИКА</div><div class="kp-brand-sub">Жилой квартал</div></div></div>`;

  // Планировка (если загружена)
  const plan = (u.plans && u.plans[0]) ? u.plans[0].url : null;
  const planBlock = plan
    ? `<img src="${plan}" alt="Планировка" class="kp-plan-img">`
    : `<div class="kp-plan-empty">${flag}<span>Планировка предоставляется по запросу</span></div>`;

  const facts = [
    ['Площадь', u.area+' м²'],
    ['Этаж', u.floor],
    ['Корпус', u.corp],
    ['Тип', u.kind||'Квартира'],
  ];

  const chars = [
    ['Помещение', u.displayNum],
    ['Корпус', u.corp],
    ['Этаж', u.floor],
    ['Площадь', u.area+' м²'],
    ['Тип', u.kind||'Квартира'],
    ['Вид из окна', kpViewText(u)],
    ['Цена за м²', kpRub(u.pricePerM*1000)],
    ['Статус', (STATUSES[u.status]||{}).label || '—'],
  ];

  const pages = `
    <!-- Страница 1: обложка -->
    <section class="kp-page kp-cover">
      ${brandHead}
      <div class="kp-cover-mid">
        <div class="kp-kicker">Коммерческое предложение</div>
        <h1 class="kp-cover-title">${u.kind||'Квартира'} ${u.displayNum}</h1>
        <div class="kp-cover-obj">${u.corp} · ${bName}</div>
        <div class="kp-cover-price">${kpMln(u.total)}</div>
        <div class="kp-cover-facts">
          ${facts.map(([k,v])=>`<div class="kp-cf"><span>${k}</span><b>${v}</b></div>`).join('')}
        </div>
      </div>
      <div class="kp-cover-foot">${bName} · ${isoDate(TODAY).split('-').reverse().join('.')}</div>
    </section>

    <!-- Страница 2: характеристики + планировка -->
    <section class="kp-page">
      <div class="kp-ph">${brandHead}<div class="kp-ph-num">Стр. 2</div></div>
      <h2 class="kp-h2">Характеристики и планировка</h2>
      <div class="kp-two">
        <table class="kp-tbl">
          ${chars.map(([k,v])=>`<tr><td class="kp-k">${k}</td><td class="kp-v">${v}</td></tr>`).join('')}
        </table>
        <div class="kp-plan">${planBlock}</div>
      </div>
      <div class="kp-note">Указанные характеристики соответствуют проектной документации. Цена действительна на дату формирования предложения.</div>
    </section>

    <!-- Страница 3: финансовые условия -->
    <section class="kp-page">
      <div class="kp-ph">${brandHead}<div class="kp-ph-num">Стр. 3</div></div>
      <h2 class="kp-h2">Финансовые условия</h2>
      <div class="kp-price-box">
        <div><span>Стоимость</span><b>${kpMln(u.total)}</b></div>
        <div><span>Цена за м²</span><b>${kpRub(u.pricePerM*1000)}</b></div>
        <div><span>Первоначальный взнос (20%)</span><b>${kpRub(priceRub*downPct/100)}</b></div>
      </div>
      <h3 class="kp-h3">Ипотека</h3>
      <table class="kp-tbl kp-mort">
        <thead><tr><th>Программа</th><th>Ставка</th><th>Срок</th><th>Платёж в месяц*</th></tr></thead>
        <tbody>
          ${progs.map(p=>`<tr><td>${p.name}</td><td>${p.rate}%</td><td>${p.years} лет</td><td><b>${kpRub(p.pay)}</b></td></tr>`).join('')}
        </tbody>
      </table>
      <h3 class="kp-h3">Рассрочка от застройщика</h3>
      <div class="kp-rass">Беспроцентная рассрочка на 12 месяцев — <b>${kpRub(rassrochka)}/мес</b> при первом взносе 20%.</div>
      <div class="kp-note">* Расчёт ориентировочный, при первоначальном взносе 20%. Точные условия уточняйте у менеджера. Не является публичной офертой.</div>
    </section>

    <!-- Страница 4: акции + контакты -->
    <section class="kp-page">
      <div class="kp-ph">${brandHead}<div class="kp-ph-num">Стр. 4</div></div>
      <h2 class="kp-h2">Акции и условия покупки</h2>
      <ul class="kp-promo">
        <li>Скидка <b>3%</b> при 100% оплате</li>
        <li>Кухонный гарнитур в подарок при бронировании до конца месяца</li>
        <li>Бесплатное бронирование квартиры на 3 дня</li>
        <li>Trade-in: зачёт вашей недвижимости в счёт покупки</li>
      </ul>
      <div class="kp-contact">
        <div class="kp-contact-t">Ваш менеджер</div>
        <div class="kp-contact-row">
          <div class="kp-avatar">${mgr.short}</div>
          <div>
            <div class="kp-mgr-name">${mgr.name}</div>
            <div class="kp-mgr-line">${mgr.phone||''}</div>
            <div class="kp-mgr-line">${mgr.email||''}</div>
          </div>
        </div>
      </div>
      <div class="kp-cover-foot" style="margin-top:auto;">${bName} · Отдел продаж</div>
    </section>`;

  document.getElementById('kpPages').innerHTML = pages;
  document.getElementById('kpModal').classList.add('show');
}

function initKP(){
  const modal = document.getElementById('kpModal');
  document.getElementById('kpClose').onclick = ()=>modal.classList.remove('show');
  document.getElementById('kpPrint').onclick = ()=>window.print();
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('show'); });
}
