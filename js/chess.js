/* ============================================================
   ВКЛАДКА «ШАХМАТКА» — три режима отображения:
   grid (классическая шахматка), floor (интерактивный этаж), facade (вид корпуса)
   + боковая панель помещения, админ-режим, лайтбокс, презентационный режим.
   ============================================================ */

function buildLegend(){
  document.getElementById('legend').innerHTML = STATUS_ORDER.map(s=>
    `<span class="item"><span class="dot" style="background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span>`).join('');
}

function buildFilters(){
  const b = state.buildingConfig;
  const all = units();
  const floors = [...new Set(all.map(u=>u.floor))].sort((a,c)=>c-a);
  document.getElementById('fCorp').innerHTML = `<option value="">Все корпуса</option>`+b.corps.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('fFloor').innerHTML = `<option value="">Все этажи</option>`+floors.map(f=>`<option value="${f}">${f} этаж</option>`).join('');
  document.getElementById('fStatus').innerHTML = `<option value="">Все статусы</option>`+STATUS_ORDER.map(s=>`<option value="${s}">${STATUSES[s].label}</option>`).join('');
  document.getElementById('fManager').innerHTML = `<option value="">Все менеджеры</option>`+MANAGERS.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('fView').innerHTML = `<option value="">Любой вид</option>`+VIEW_CATEGORIES.map(v=>`<option value="${v.id}">${v.label}</option>`).join('');
  ['fCorp','fFloor','fStatus','fManager','fPriceMin','fPriceMax','fAreaMin','fAreaMax','fQuery'].forEach(id=>{
    const el = document.getElementById(id);
    if(el && el.tagName==='INPUT') el.value='';
  });
  document.getElementById('fFavorites').checked = false;
}

function passFilter(u){
  const f = state.filters;
  if(f.corp && u.corp!==f.corp) return false;
  if(f.floor && u.floor!=f.floor) return false;
  if(f.status && u.status!==f.status) return false;
  if(f.manager && u.managerId!==f.manager) return false;
  if(f.view && (!u.view || u.view.category!==f.view)) return false;
  if(f.priceMin && u.pricePerM < +f.priceMin) return false;
  if(f.priceMax && u.pricePerM > +f.priceMax) return false;
  if(f.areaMin && u.area < +f.areaMin) return false;
  if(f.areaMax && u.area > +f.areaMax) return false;
  if(f.favoritesOnly && !state.favorites.has(u.id)) return false;
  if(f.query){
    const q = f.query.toLowerCase();
    const client = getClient(u.clientId);
    const hit = u.displayNum.toLowerCase().includes(q)
             || (client && client.name.toLowerCase().includes(q))
             || (''+u.area).includes(q);
    if(!hit) return false;
  }
  return true;
}

/* ============================================================
   ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ
   ============================================================ */
function setChessView(mode){
  state.chessView = mode;
  document.querySelectorAll('.view-switch-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.viewMode===mode);
  });
  // По умолчанию — первый корпус для floor/facade
  const cfg = state.buildingConfig;
  if(mode==='floor' && !state.floorViewCorp) state.floorViewCorp = cfg.corps[0];
  if(mode==='floor' && !state.floorViewFloor){
    const ccfg = corpCfg(cfg, state.floorViewCorp);
    state.floorViewFloor = ccfg.floors;
  }
  if(mode==='facade' && !state.facadeCorp) state.facadeCorp = cfg.corps[0];
  renderChess();
}

function bindViewSwitch(){
  document.querySelectorAll('.view-switch-btn').forEach(b=>{
    b.onclick = ()=>setChessView(b.dataset.viewMode);
  });
}

/* ============================================================
   ДИСПЕТЧЕР РЕНДЕРА (3 режима)
   ============================================================ */
function renderChess(){
  const b = state.buildingConfig;
  // Режим «Вид корпуса» выведен из интерфейса — на всякий случай откатываем к сетке
  if(state.chessView==='facade'){
    state.chessView='grid';
    document.querySelectorAll('.view-switch-btn').forEach(x=>x.classList.toggle('active', x.dataset.viewMode==='grid'));
  }
  document.getElementById('chessTitle').textContent = ({
    grid:'Шахматка', floor:'Интерактивный этаж'
  })[state.chessView]+' · '+b.name;

  const grid    = document.getElementById('chessGrid');
  const floor   = document.getElementById('floorView');
  const facade  = document.getElementById('facadeView');
  const toolbar = document.getElementById('modeToolbar');

  grid.style.display    = state.chessView==='grid'   ? '' : 'none';
  floor.style.display   = state.chessView==='floor'  ? '' : 'none';
  facade.style.display  = state.chessView==='facade' ? '' : 'none';

  if(state.chessView==='grid'){
    toolbar.style.display = 'none';
    renderGridView();
  } else if(state.chessView==='floor'){
    toolbar.style.display = '';
    renderFloorToolbar();
    renderFloorView();
  } else {
    toolbar.style.display = '';
    renderFacadeToolbar();
    renderFacadeView();
  }
}

/* ============================================================
   РЕЖИМ 1: КЛАССИЧЕСКАЯ ШАХМАТКА
   ============================================================ */
function renderGridView(){
  const b = state.buildingConfig;
  const grid = document.getElementById('chessGrid');
  grid.classList.toggle('admin', state.adminMode);

  const all = units();
  let html = '';
  b.corps.forEach(corp=>{
    if(state.filters.corp && state.filters.corp!==corp) return;
    html += `<div class="chess-corp-title">${corp}</div>`;
    const floors = [...new Set(all.filter(u=>u.corp===corp).map(u=>u.floor))].sort((a,c)=>c-a);
    floors.forEach(f=>{
      const rowUnits = all
        .filter(u=>u.corp===corp && u.floor===f)
        .sort((a,c)=>a.position-c.position);
      html += `<div class="chess-row"><div class="floor-label">${f} эт.</div><div class="cells">`;
      rowUnits.forEach(u=>{
        const visible = passFilter(u);
        const fav = state.favorites.has(u.id) ? '<span class="fav-star">'+iconStar(true,11)+'</span>' : '';
        const adminBtn = state.adminMode ? '<span class="admin-edit" data-edit="'+u.id+'" title="Редактировать">'+icon('edit',11)+'</span>' : '';
        html += `<div class="cell ${visible?'':'dim'} ${u.id===state.selectedUnitId?'sel':''}"
                    style="background:${STATUSES[u.status].color}" data-id="${u.id}" title="${u.displayNum} · ${STATUSES[u.status].label}">
                   ${fav}
                   <span class="num">${u.displayNum}</span><span class="area">${u.area} м²</span>
                   ${adminBtn}
                 </div>`;
      });
      html += `</div></div>`;
    });
  });
  grid.innerHTML = html;

  grid.querySelectorAll('.cell:not(.dim)').forEach(c=>{
    c.addEventListener('click', e=>{
      if(e.target.closest('.admin-edit')){
        e.stopPropagation();
        openUnitForm(e.target.closest('.admin-edit').dataset.edit);
        return;
      }
      openPanel(c.dataset.id);
    });
  });
}

/* ============================================================
   РЕЖИМ 2: ИНТЕРАКТИВНЫЙ ЭТАЖ
   ============================================================ */
function renderFloorToolbar(){
  const cfg = state.buildingConfig;
  const tb = document.getElementById('modeToolbar');
  const corp = state.floorViewCorp || cfg.corps[0];
  const ccfg = corpCfg(cfg, corp);
  const floors = [];
  for(let f=ccfg.floors; f>=1; f--) floors.push(f);

  tb.innerHTML = `
    <span class="mt-label">Корпус</span>
    <select id="floorCorpSel">${cfg.corps.map(c=>`<option ${c===corp?'selected':''}>${c}</option>`).join('')}</select>
    <span class="mt-label" style="margin-left:8px;">Этаж</span>
    <div class="mt-floors" id="floorFloorBtns">
      ${floors.map(f=>`<button class="mt-floor-btn ${f===state.floorViewFloor?'active':''}" data-f="${f}">${f}</button>`).join('')}
    </div>
  `;
  document.getElementById('floorCorpSel').onchange = e=>{
    state.floorViewCorp = e.target.value;
    const cc = corpCfg(cfg, state.floorViewCorp);
    if(state.floorViewFloor > cc.floors) state.floorViewFloor = cc.floors;
    renderChess();
  };
  tb.querySelectorAll('.mt-floor-btn').forEach(b=>{
    b.onclick = ()=>{ state.floorViewFloor = +b.dataset.f; renderChess(); };
  });
}

function renderFloorView(){
  const corp = state.floorViewCorp;
  const floor = state.floorViewFloor;
  const host = document.getElementById('floorView');
  if(!corp || !floor){
    host.innerHTML = `<div class="floor-view-empty">Выберите корпус и этаж для отображения интерактивного плана.</div>`;
    return;
  }
  const rowUnits = units()
    .filter(u=>u.corp===corp && u.floor===floor)
    .sort((a,c)=>a.position-c.position);

  if(!rowUnits.length){
    host.innerHTML = `<div class="floor-view-empty">На выбранном этаже нет помещений.</div>`;
    return;
  }

  const total   = rowUnits.length;
  const free    = rowUnits.filter(u=>u.status==='free').length;
  const sold    = rowUnits.filter(u=>u.status==='sold' || u.status==='contract').length;
  const totalSum= rowUnits.reduce((s,u)=>s+u.total, 0);

  host.innerHTML = `
    <div class="floor-plan">
      <div class="floor-plan-head">
        <div>
          <div class="floor-plan-title">${corp} · ${floor} этаж</div>
          <div class="floor-plan-sub">Архитектурный план этажа — наведите на квартиру для деталей, кликните, чтобы открыть карточку</div>
        </div>
        <div class="floor-plan-stats">
          <div>Всего <b>${total}</b></div>
          <div>Свободно <b style="color:var(--st-free)">${free}</b></div>
          <div>Продано <b style="color:var(--terra-dark)">${sold}</b></div>
          <div>Сумма <b>${fmtMoney(totalSum)}</b></div>
        </div>
      </div>
      <div class="floor-plan-canvas">${buildFloorPlanSVG(rowUnits)}</div>
      <div class="floor-plan-legend">
        ${STATUS_ORDER.map(s=>`<span class="item"><span class="dot" style="background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span>`).join('')}
      </div>
    </div>
  `;

  // Клик — открыть карточку, ховер — тултип
  host.querySelectorAll('.apt').forEach(g=>{
    if(g.classList.contains('dim')) return;
    g.addEventListener('click', ()=>openPanel(g.dataset.id));
    g.addEventListener('mouseenter', e=>showFloorTooltip(e, getUnit(g.dataset.id)));
    g.addEventListener('mousemove',  moveFloorTooltip);
    g.addEventListener('mouseleave', hideFloorTooltip);
  });
}

/* ============================================================
   ГЕНЕРАТОР СХЕМАТИЧЕСКОГО ПЛАНА ЭТАЖА (SVG)
   Планировка мирового «дома-пластины»: центральное ядро
   (лестница + лифт + коридор), квартиры двумя полосами по бокам.
   ============================================================ */
function buildFloorPlanSVG(rowUnits){
  const W = 1240, H = 600;
  // Наружный контур здания
  const bx0 = 16, by0 = 16, bx1 = W-16, by1 = H-16;
  // Внутренняя рабочая зона (после наружных стен)
  const ix0 = bx0+16, iy0 = by0+16, ix1 = bx1-16, iy1 = by1-16;
  // Центральное ядро
  const coreW = 200, coreX0 = W/2 - coreW/2, coreX1 = W/2 + coreW/2;
  const gap = 12;
  const leftZ  = [ix0, coreX0 - gap];
  const rightZ = [coreX1 + gap, ix1];
  const midY = (iy0+iy1)/2, corr = 6;
  const topB = [iy0, midY - corr];
  const botB = [midY + corr, iy1];

  // Раскладка квартир: верхняя и нижняя полосы, слева/справа от ядра
  const n = rowUnits.length;
  const topUnits = rowUnits.slice(0, Math.ceil(n/2));
  const botUnits = rowUnits.slice(Math.ceil(n/2));
  const splitZone = (arr)=>{
    const l = arr.slice(0, Math.ceil(arr.length/2));
    const r = arr.slice(Math.ceil(arr.length/2));
    return [l, r];
  };
  const [topL, topR] = splitZone(topUnits);
  const [botL, botR] = splitZone(botUnits);

  // Раскладка ячеек в зоне
  const cellsInZone = (arr, zone, band, outerSide)=>{
    if(!arr.length) return [];
    const cw = (zone[1]-zone[0]) / arr.length;
    return arr.map((u,i)=>({
      u, x: zone[0] + i*cw, y: band[0], w: cw, h: band[1]-band[0], outerSide
    }));
  };
  const cells = [
    ...cellsInZone(topL, leftZ,  topB, 'top'),
    ...cellsInZone(topR, rightZ, topB, 'top'),
    ...cellsInZone(botL, leftZ,  botB, 'bottom'),
    ...cellsInZone(botR, rightZ, botB, 'bottom'),
  ];

  const apts = cells.map(c=>aptSVG(c)).join('');

  // Оси-«кружки» сверху (как на чертеже) — по границам ячеек верхней полосы
  const boundXs = new Set([ix0, coreX0, coreX1, ix1]);
  cells.filter(c=>c.outerSide==='top').forEach(c=>{ boundXs.add(c.x); boundXs.add(c.x+c.w); });
  const axisMarks = [...boundXs].sort((a,b)=>a-b).map((x,i)=>`
    <line x1="${x.toFixed(1)}" y1="${by0-14}" x2="${x.toFixed(1)}" y2="${by0}" class="fp-axis-tick"/>
    <circle cx="${x.toFixed(1)}" cy="${by0-22}" r="9" class="fp-axis-bubble"/>
    <text x="${x.toFixed(1)}" y="${by0-18.5}" class="fp-axis-num">${i+1}</text>
  `).join('');

  return `
  <svg class="fp-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="План этажа">
    <defs>
      <pattern id="fpHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="7" class="fp-hatch-line"/>
      </pattern>
    </defs>

    <!-- фон-подложка -->
    <rect x="0" y="0" width="${W}" height="${H}" class="fp-bg"/>

    <!-- оси-кружки -->
    ${axisMarks}

    <!-- наружные стены (двойной контур) -->
    <rect x="${bx0}" y="${by0}" width="${bx1-bx0}" height="${by1-by0}" rx="8" class="fp-outer"/>
    <rect x="${bx0+6}" y="${by0+6}" width="${bx1-bx0-12}" height="${by1-by0-12}" rx="5" class="fp-outer-inner"/>

    <!-- коридор (тонкая полоса между полосами) -->
    <rect x="${ix0}" y="${midY-corr}" width="${ix1-ix0}" height="${corr*2}" class="fp-corridor"/>

    <!-- квартиры -->
    ${apts}

    <!-- центральное ядро -->
    ${coreSVG(coreX0, iy0, coreW, iy1-iy0)}
  </svg>`;
}

/* Одна квартира */
function aptSVG(c){
  const { u, x, y, w, h, outerSide } = c;
  const st  = STATUSES[u.status];
  const cat = VIEW_CATEGORIES.find(v=>v.id===(u.view && u.view.category));
  const sel = u.id===state.selectedUnitId;
  const visible = passFilter(u);
  const g = 4;                                   // внутренний зазор между квартирами
  const rx = x+g, ry = y+g, rw = w-g*2, rh = h-g*2;
  const pad = 13;
  // Окна на наружной стене
  const winY = outerSide==='top' ? ry+1.5 : ry+rh-1.5;
  const win = `<line x1="${rx+14}" y1="${winY}" x2="${rx+rw-14}" y2="${winY}" class="fp-window"/>`;
  // Внутренняя перегородка (жилая / кухня)
  const px = rx + rw*0.42;
  const part = `<line x1="${px.toFixed(1)}" y1="${ry+pad}" x2="${px.toFixed(1)}" y2="${ry+rh-pad}" class="fp-part"/>`;
  // Статус-плашка
  const label = st.label;
  const plW = Math.min(rw-pad*2, label.length*6.0 + 14);
  const plX = rx+pad, plY = ry+rh-pad-15;
  const statusPill = `
    <rect x="${plX}" y="${plY}" width="${plW}" height="15" rx="4" fill="${st.color}"/>
    <text x="${plX+plW/2}" y="${plY+10.5}" class="fp-apt-status">${escapeHtml(label)}</text>`;
  // Иконка вида
  const viewIc = cat ? iconInSvg(VIEW_ICON[cat.id], rx+rw-pad-16, ry+pad-2, 16, '#82705F') : '';

  return `
  <g class="apt ${sel?'sel':''} ${visible?'':'dim'}" data-id="${u.id}" style="--st:${st.color}">
    <rect class="fp-apt-fill" x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${st.color}"/>
    <rect class="fp-apt-wall" x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4"/>
    ${part}
    ${win}
    <text x="${rx+pad}" y="${ry+pad+15}" class="fp-apt-num">${escapeHtml(u.displayNum)}</text>
    <text x="${rx+pad}" y="${ry+pad+32}" class="fp-apt-area">${u.area} м²</text>
    <text x="${rx+pad}" y="${ry+pad+47}" class="fp-apt-kind">${escapeHtml(u.kind||'')}</text>
    ${viewIc}
    ${statusPill}
  </g>`;
}

/* Центральное ядро: лестница + лифт + коридор */
function coreSVG(x, y, w, h){
  const cx = x + w/2;
  // Лестница — верхняя часть
  const stTop = y+18, stH = 132, stX = x+22, stW = w-44;
  let steps = '';
  const nSteps = 9, sh = stH/nSteps;
  for(let i=1;i<nSteps;i++){
    steps += `<line x1="${stX}" y1="${(stTop+i*sh).toFixed(1)}" x2="${stX+stW}" y2="${(stTop+i*sh).toFixed(1)}" class="fp-core-line"/>`;
  }
  // Лифт — под лестницей
  const elY = stTop+stH+22, elS = 74, elX = cx-elS/2;
  const elevator = `
    <rect x="${elX}" y="${elY}" width="${elS}" height="${elS}" rx="5" class="fp-core-cell"/>
    <line x1="${elX}" y1="${elY}" x2="${elX+elS}" y2="${elY+elS}" class="fp-core-line"/>
    <line x1="${elX+elS}" y1="${elY}" x2="${elX}" y2="${elY+elS}" class="fp-core-line"/>
    <text x="${cx}" y="${elY+elS+16}" class="fp-core-cap" text-anchor="middle">ЛИФТ</text>`;

  return `
  <g class="fp-core">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="fp-core-box"/>
    <rect x="${stX}" y="${stTop}" width="${stW}" height="${stH}" rx="4" class="fp-core-cell"/>
    ${steps}
    <line x1="${x+w/2}" y1="${stTop}" x2="${x+w/2}" y2="${stTop+stH}" class="fp-core-line strong"/>
    <text x="${x+w/2}" y="${stTop-5}" class="fp-core-cap" text-anchor="middle">ЛЕСТНИЦА</text>
    ${elevator}
    <text x="${x+w/2}" y="${y+h-16}" class="fp-core-cap wide" text-anchor="middle">КОРИДОР · ХОЛЛ</text>
  </g>`;
}

let _ftEl;
function ensureFloorTooltip(){
  if(_ftEl) return _ftEl;
  _ftEl = document.createElement('div');
  _ftEl.className = 'floor-tooltip';
  document.body.appendChild(_ftEl);
  return _ftEl;
}
function showFloorTooltip(e, u){
  if(!u) return;
  const el = ensureFloorTooltip();
  const st = STATUSES[u.status];
  const cat = VIEW_CATEGORIES.find(v=>v.id===(u.view && u.view.category));
  el.innerHTML = `
    <div class="ft-num">${u.displayNum}</div>
    <div class="ft-row"><span>Площадь</span><b>${u.area} м²</b></div>
    <div class="ft-row"><span>Цена</span><b>${fmtMoney(u.total)}</b></div>
    <div class="ft-row"><span>Этаж</span><b>${u.floor}</b></div>
    ${cat ? `<div class="ft-row"><span>Вид</span><b class="ic-inline">${icon(VIEW_ICON[cat.id],13)} ${cat.label}</b></div>` : ''}
    <span class="ft-status" style="background:${st.color}">${st.label}</span>
  `;
  el.classList.add('show');
  moveFloorTooltip(e);
}
function moveFloorTooltip(e){
  if(!_ftEl || !_ftEl.classList.contains('show')) return;
  const pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  const w = _ftEl.offsetWidth, h = _ftEl.offsetHeight;
  if(x + w > window.innerWidth - 8) x = e.clientX - w - pad;
  if(y + h > window.innerHeight - 8) y = e.clientY - h - pad;
  _ftEl.style.left = x+'px'; _ftEl.style.top = y+'px';
}
function hideFloorTooltip(){ if(_ftEl) _ftEl.classList.remove('show'); }

/* ============================================================
   РЕЖИМ 3: ВИД КОРПУСА (фасад)
   ============================================================ */
function renderFacadeToolbar(){
  const cfg = state.buildingConfig;
  const corp = state.facadeCorp || cfg.corps[0];
  const tb = document.getElementById('modeToolbar');
  tb.innerHTML = `
    <span class="mt-label">Корпус</span>
    <select id="facadeCorpSel">${cfg.corps.map(c=>`<option ${c===corp?'selected':''}>${c}</option>`).join('')}</select>
    <span style="font-size:12px; color:var(--brown-soft); margin-left:auto;">
      Наведите на окно — увидите номер. Клик — открыть карточку. Свободные помещения отмечены белой точкой.
    </span>
  `;
  document.getElementById('facadeCorpSel').onchange = e=>{
    state.facadeCorp = e.target.value; renderChess();
  };
}

function renderFacadeView(){
  const cfg = state.buildingConfig;
  const corp = state.facadeCorp;
  const host = document.getElementById('facadeView');
  if(!corp){
    host.innerHTML = `<div class="floor-view-empty">Выберите корпус.</div>`;
    return;
  }
  const ccfg = corpCfg(cfg, corp);
  const all = units().filter(u=>u.corp===corp);

  // строки от верхнего к нижнему
  const floors = [];
  for(let f=ccfg.floors; f>=1; f--) floors.push(f);

  const rows = floors.map(f=>{
    const row = all
      .filter(u=>u.floor===f)
      .sort((a,c)=>a.position-c.position);
    return `<div class="facade-floor">
      <div class="facade-floor-lbl">${f}</div>
      <div class="facade-floor-cells" style="--per-floor:${ccfg.perFloor}">
        ${row.map(u=>{
          const st = STATUSES[u.status];
          const free = u.status==='free' ? 'is-free' : '';
          const sel  = u.id===state.selectedUnitId ? 'sel' : '';
          return `<button class="facade-window ${free} ${sel}"
              style="--st-color:${st.color}"
              data-id="${u.id}"
              title="${u.displayNum} · ${st.label} · ${u.area} м² · ${fmtMoney(u.total)}"></button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="facade-sky"></div>
    <div class="facade-ground"></div>
    <div class="facade-building">
      <div class="facade-roof"></div>
      <div class="facade-name">${cfg.name} · ${corp}</div>
      ${rows}
    </div>
    <div class="facade-legend">
      ${STATUS_ORDER.map(s=>`<span class="item"><span class="dot" style="background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span>`).join('')}
    </div>
  `;

  host.querySelectorAll('.facade-window').forEach(w=>{
    w.onclick = ()=>openPanel(w.dataset.id);
  });
}

/* ============================================================
   СВОДКА (правая колонка)
   ============================================================ */
function renderAside(){
  const all = units().filter(passFilter);
  const counts = {}; STATUS_ORDER.forEach(s=>counts[s]=0);
  all.forEach(u=>counts[u.status]++);
  const total = all.length;
  const favCount = all.filter(u=>state.favorites.has(u.id)).length;
  const todayShows = showsOnDate(isoDate(TODAY)).length;
  const weekShows = state.shows.filter(s=>{
    const d = new Date(s.date+'T00:00:00');
    const diff = (d - TODAY) / 86400000;
    return diff >= -1 && diff < 7;
  }).length;

  document.getElementById('chessAside').innerHTML = `
    <div class="mini-card">
      <h4>Сводка по объекту</h4>
      ${STATUS_ORDER.map(s=>`<div class="mini-stat"><span style="display:flex;align-items:center;gap:7px;"><span class="dot" style="width:11px;height:11px;border-radius:3px;background:${STATUSES[s].color}"></span>${STATUSES[s].label}</span><b>${counts[s]}</b></div>`).join('')}
      <div class="mini-stat" style="border-top:1px solid var(--line);margin-top:4px;padding-top:9px;"><span>Всего помещений</span><b>${total}</b></div>
      <div class="mini-stat"><span class="ic-inline">${iconStar(true,12)} Избранных</span><b>${favCount}</b></div>
    </div>
    <div class="mini-card">
      <h4>Активность показов</h4>
      <div class="mini-stat"><span>Показов сегодня</span><b style="color:var(--terra-dark)">${todayShows}</b></div>
      <div class="mini-stat"><span>Показов на неделю</span><b>${weekShows}</b></div>
      <button class="btn btn-sm" style="margin-top:10px; width:100%;" onclick="openCalendar()">Открыть календарь</button>
    </div>`;
}

function bindFilters(){
  const map = {fCorp:'corp',fFloor:'floor',fStatus:'status',fManager:'manager',fView:'view',fPriceMin:'priceMin',fPriceMax:'priceMax',fAreaMin:'areaMin',fAreaMax:'areaMax',fQuery:'query'};
  Object.entries(map).forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      state.filters[key]=el.value; renderChess(); renderAside();
    });
  });
  document.getElementById('fFavorites').addEventListener('change', e=>{
    state.filters.favoritesOnly = e.target.checked;
    renderChess(); renderAside();
  });
  document.getElementById('fReset').onclick=()=>{
    state.filters = {corp:'',floor:'',status:'',manager:'',view:'',priceMin:'',priceMax:'',areaMin:'',areaMax:'',favoritesOnly:false,query:''};
    buildFilters(); renderChess(); renderAside();
  };
}

/* ============================================================
   БОКОВАЯ ПАНЕЛЬ ОБЪЕКТА (с видом, планировками, презентацией)
   ============================================================ */
function openPanel(id){
  const u = getUnit(id);
  if(!u) return;
  state.selectedUnitId = id;
  renderChess();
  const st = STATUSES[u.status];
  const client = getClient(u.clientId);
  const isFav = state.favorites.has(id);
  const pres = state.presentationMode;

  const cat = u.view && u.view.category ? VIEW_CATEGORIES.find(v=>v.id===u.view.category) : null;
  const mainPhoto = (u.view && u.view.photos || []).find(p=>p.isMain) || (u.view && u.view.photos || [])[0];
  const restPhotos = (u.view && u.view.photos || []).filter(p=>!mainPhoto || p.id!==mainPhoto.id);

  const unitShows = state.shows
    .filter(s=>s.unitId===id && s.status!=='cancelled')
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  const panel = document.getElementById('panel');
  panel.classList.toggle('presentation', pres);

  panel.innerHTML = `
    <div class="pres-banner ic-inline">${icon('monitor',15)} Презентационный режим · клиент видит только основное</div>
    <div class="panel-head">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--brown-soft);">${u.kind} · ${u.corp}</div>
        <h3 style="font-size:24px;margin-top:3px;">${u.displayNum}</h3>
        <div style="margin-top:9px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <span class="status-pill" style="background:${st.color}"><span class="dot"></span>${st.label}</span>
          <button class="fav-toggle ic-inline ${isFav?'on':''} pres-hide" id="favBtn">${iconStar(isFav,14)} ${isFav?'В избранном':'В избранное'}</button>
          <button class="pres-toggle ic-inline ${pres?'on':''}" id="presBtn">${pres?icon('check',14):icon('monitor',14)} Презентация</button>
        </div>
      </div>
      <button class="close" id="panelClose">${icon('close',17)}</button>
    </div>

    <div class="panel-body">
      <!-- Быстрые действия -->
      <div class="panel-actions-row pres-hide">
        <button class="panel-quick-btn" data-q="show">${icon('calendar',16)}Назначить показ</button>
        <button class="panel-quick-btn" data-q="book">${icon('home',16)}Создать бронь</button>
        ${client ? `<button class="panel-quick-btn" data-q="client">${icon('user',16)}Профиль клиента</button>` : ''}
        ${u.plans && u.plans.length ? `<button class="panel-quick-btn" data-q="plan">${icon('ruler',16)}Планировка</button>` : ''}
        ${(u.view && u.view.photos && u.view.photos.length) ? `<button class="panel-quick-btn" data-q="view">${icon('camera',16)}Вид из окна</button>` : ''}
        <button class="panel-quick-btn" data-q="floor">${icon('grid',16)}Этаж целиком</button>
      </div>

      <div class="kv">
        <div><div class="k">Этаж</div><div class="v">${u.floor}</div></div>
        <div><div class="k">Площадь</div><div class="v">${u.area} м²</div></div>
        <div><div class="k">Цена за м²</div><div class="v">${u.pricePerM} тыс. ₽</div></div>
        <div><div class="k">Общая стоимость</div><div class="v" style="color:var(--terra-dark)">${fmtMoney(u.total)}</div></div>
      </div>

      <!-- Планировка -->
      <div class="panel-section-title">Планировка</div>
      ${ (u.plans && u.plans.length)
          ? `<div class="plans-block"><div class="plans-grid">
              ${u.plans.map((p,i)=>`<div class="plan-card" style="background-image:url('${p.url.replace(/'/g,"%27")}')" data-plan-i="${i}">
                <div class="plan-card-title">${p.title || ('Планировка '+(i+1))}</div>
              </div>`).join('')}
            </div></div>`
          : `<div class="plans-empty">Планировка не загружена${state.adminMode?'. Откройте редактирование, чтобы добавить.':''}</div>` }

      <!-- Вид из окна -->
      <div class="panel-section-title">Вид из окна</div>
      <div class="view-block">
        <div class="view-block-head">
          ${cat ? `<span class="view-cat-tag ic-inline">${icon(VIEW_ICON[cat.id],14)} ${cat.label}</span>` : ''}
          ${u.view && u.view.direction ? `<span class="view-direction-tag ic-inline">${icon('compass',13)} ${u.view.direction}</span>` : ''}
          ${!cat && !(u.view && u.view.direction) ? `<span style="color:var(--brown-soft); font-size:12px;">Не указан</span>` : ''}
        </div>
        ${u.view && u.view.description ? `<div style="font-size:13px; color:var(--brown); line-height:1.45;">${escapeHtml(u.view.description)}</div>` : ''}
        ${(u.view && u.view.comment && !pres) ? `<div class="pres-hide" style="font-size:12px; color:var(--brown-soft); margin-top:6px; padding-left:9px; border-left:2px solid var(--terra-light, #E8CBAE);"><b>Комментарий менеджера:</b> ${escapeHtml(u.view.comment)}</div>` : ''}
        <div class="view-photos">
          ${ mainPhoto
              ? `<div class="vp-main" style="background-image:url('${mainPhoto.url.replace(/'/g,"%27")}')" data-vp-id="${mainPhoto.id}"></div>`
              : `<div class="vp-empty">Фотографии вида из окна не загружены</div>` }
          ${restPhotos.map(p=>`<div class="vp-thumb" style="background-image:url('${p.url.replace(/'/g,"%27")}')" data-vp-id="${p.id}"></div>`).join('')}
        </div>
      </div>

      <!-- Менеджер и клиент — скрыты в презентации -->
      <div class="pres-hide">
        <div class="panel-section-title">Закреплённый менеджер</div>
        <div class="person-row">
          <div class="avatar">${mgrShort(u.managerId)}</div>
          <div class="meta"><b>${mgrName(u.managerId)}</b><span>Менеджер отдела продаж</span></div>
          <button class="go-link ic-inline" data-go-mgr="${u.managerId}">${icon('arrowRight',13)} Клиенты</button>
        </div>

        <div class="panel-section-title">Клиент</div>
        ${ client ? `<div class="person-row">
              <div class="avatar">${client.name.split(' ').map(w=>w[0]).join('')}</div>
              <div class="meta"><b>${client.name}</b><span>${client.phone} · ${client.stage}</span></div>
              <button class="go-link ic-inline" data-go-client="${client.id}">${icon('arrowRight',13)} Карточка</button>
           </div>`
          : `<div class="person-row" style="color:var(--brown-soft)"><div class="avatar" style="background:var(--line-soft)">—</div><div class="meta"><b>Клиент не закреплён</b><span>Помещение без активной сделки</span></div></div>` }

        <div class="panel-section-title">Назначенные показы (${unitShows.length})</div>
        ${ unitShows.length
            ? unitShows.map(s=>{
                const c = getClient(s.clientId);
                const ss = SHOW_STATUSES[s.status];
                return `<div class="person-row" style="border-left:3px solid ${ss.color}">
                  <div style="font-family:Georgia,serif; font-size:15px; font-weight:600; min-width:74px;">${s.time}</div>
                  <div class="meta">
                    <b>${c ? c.name : 'Клиент'}</b>
                    <span>${fmtDateRu(s.date)} · ${mgrName(s.managerId)} · ${ss.label}</span>
                  </div>
                  <button class="go-link ic-inline" data-go-show="${s.id}">${icon('arrowRight',13)} В календарь</button>
                </div>`;
              }).join('')
            : `<div style="color:var(--brown-soft); font-size:13px; padding:6px 2px;">Показы не назначены</div>` }
        <button class="btn btn-sm ic-inline" style="margin-top:9px;" onclick="openShowFormForUnit('${u.id}')">${icon('plus',14)} Назначить показ</button>

        <div class="panel-section-title">Сменить статус</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;" id="statusSwitcher">
          ${STATUS_ORDER.map(s=>`<button class="btn btn-sm" data-st="${s}" style="${s===u.status?'border-color:var(--terra);color:var(--terra);':''}">
              <span style="width:9px;height:9px;border-radius:3px;background:${STATUSES[s].color};display:inline-block;"></span>${STATUSES[s].label}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="panel-actions pres-hide">
      <button class="btn btn-primary" data-act="book">Забронировать</button>
      <button class="btn" data-act="show">Назначить показ</button>
      <button class="btn" data-act="deal">Создать сделку</button>
      <button class="btn ic-inline" data-act="mortgage">${icon('diamond',15)} Ипотечный калькулятор</button>
      <button class="btn ic-inline" data-act="kp">${icon('doc',15)} Коммерческое предложение</button>
      ${ state.adminMode
          ? `<button class="btn ic-inline" data-act="edit">${icon('edit',15)} Редактировать</button>`
          : `<button class="btn" data-act="status">Изменить статус</button>` }
    </div>`;

  panel.classList.add('show');
  document.getElementById('scrim').classList.add('show');
  document.getElementById('panelClose').onclick = closePanel;

  document.getElementById('favBtn').onclick = ()=>{
    toggleFavorite(id);
    openPanel(id); renderChess(); renderAside();
    toast(state.favorites.has(id) ? u.displayNum+' в избранном' : 'Удалено из избранного');
  };
  document.getElementById('presBtn').onclick = ()=>{
    state.presentationMode = !state.presentationMode;
    openPanel(id);
    toast(state.presentationMode ? 'Презентационный режим' : 'Рабочий режим');
  };

  // Лайтбокс — планировки
  panel.querySelectorAll('[data-plan-i]').forEach(el=>{
    el.onclick = ()=>{
      const i = +el.dataset.planI;
      openLightbox(u.plans.map(p=>({ url:p.url, caption:p.title })), i);
    };
  });
  // Лайтбокс — фото вида
  panel.querySelectorAll('[data-vp-id]').forEach(el=>{
    el.onclick = ()=>{
      const all = (u.view && u.view.photos) || [];
      const i = all.findIndex(p=>p.id===el.dataset.vpId);
      openLightbox(all.map(p=>({ url:p.url, caption:(cat?cat.label:'Вид из окна')+' · '+u.displayNum })), Math.max(0,i));
    };
  });
  // Быстрые действия
  panel.querySelectorAll('.panel-quick-btn').forEach(btn=>btn.onclick = ()=>{
    const q = btn.dataset.q;
    if(q==='show')   openShowFormForUnit(id);
    else if(q==='book'){
      updateUnit(id,{status:'booked'});
      openPanel(id); renderAside(); renderChess();
      toast(u.displayNum+' забронировано');
    }
    else if(q==='client' && client){ closePanel(); goClient(client.id); }
    else if(q==='plan' && u.plans && u.plans.length){
      openLightbox(u.plans.map(p=>({ url:p.url, caption:p.title })), 0);
    }
    else if(q==='view' && u.view && u.view.photos && u.view.photos.length){
      openLightbox(u.view.photos.map(p=>({ url:p.url, caption:(cat?cat.label:'Вид')+' · '+u.displayNum })), 0);
    }
    else if(q==='floor'){
      closePanel();
      state.chessView = 'floor';
      state.floorViewCorp = u.corp;
      state.floorViewFloor = u.floor;
      setChessView('floor');
    }
  });

  // Старые блоки (видны только не в презентации)
  const ss = document.getElementById('statusSwitcher');
  if(ss){
    ss.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
      updateUnit(id, { status: btn.dataset.st });
      openPanel(id); renderAside(); renderChess();
      toast(u.displayNum+' → '+STATUSES[btn.dataset.st].label);
    });
  }

  panel.querySelectorAll('[data-go-client]').forEach(b=>b.onclick=()=>{
    goClient(b.dataset.goClient); closePanel();
  });
  panel.querySelectorAll('[data-go-show]').forEach(b=>b.onclick=()=>{
    closePanel(); openCalendarOnShow(b.dataset.goShow);
  });
  panel.querySelectorAll('[data-go-mgr]').forEach(b=>b.onclick=()=>{
    closePanel(); goManager(b.dataset.goMgr);
  });

  panel.querySelectorAll('.panel-actions [data-act]').forEach(btn=>btn.onclick=()=>{
    const a = btn.dataset.act;
    if(a==='book'){ updateUnit(id,{status:'booked'}); openPanel(id); renderAside(); renderChess(); toast(u.displayNum+' забронировано'); }
    else if(a==='show'){ openShowFormForUnit(id); }
    else if(a==='deal'){ updateUnit(id,{status:'contract'}); openPanel(id); renderAside(); renderChess(); toast('Сделка создана по '+u.displayNum); }
    else if(a==='kp'){ generateKP(id); }
    else if(a==='mortgage'){ openMortgage(id); }
    else if(a==='status'){ if(ss) ss.scrollIntoView({behavior:'smooth',block:'center'}); }
    else if(a==='edit'){ closePanel(); openUnitForm(id); }
  });
}

function closePanel(){
  document.getElementById('panel').classList.remove('show');
  document.getElementById('scrim').classList.remove('show');
  state.selectedUnitId = null; renderChess();
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

/* ============================================================
   ЛАЙТБОКС
   ============================================================ */
let _lbState = { items:[], i:0 };
function openLightbox(items, startIndex){
  if(!items || !items.length) return;
  _lbState = { items, i: startIndex||0 };
  renderLightbox();
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('show');
}
function renderLightbox(){
  const { items, i } = _lbState;
  const cur = items[i];
  if(!cur) return;
  document.getElementById('lightboxImg').src = cur.url;
  document.getElementById('lightboxCaption').textContent = cur.caption || '';
  const thumbs = document.getElementById('lightboxThumbs');
  thumbs.innerHTML = items.length>1 ? items.map((p,k)=>
    `<div class="th ${k===i?'active':''}" style="background-image:url('${p.url.replace(/'/g,"%27")}')" data-i="${k}"></div>`
  ).join('') : '';
  thumbs.querySelectorAll('.th').forEach(t=>t.onclick = ()=>{ _lbState.i = +t.dataset.i; renderLightbox(); });
  document.getElementById('lightboxPrev').style.visibility = items.length>1 ? '' : 'hidden';
  document.getElementById('lightboxNext').style.visibility = items.length>1 ? '' : 'hidden';
}
function initLightbox(){
  document.getElementById('lightboxClose').onclick = closeLightbox;
  document.getElementById('lightboxPrev').onclick = ()=>{
    _lbState.i = (_lbState.i - 1 + _lbState.items.length) % _lbState.items.length;
    renderLightbox();
  };
  document.getElementById('lightboxNext').onclick = ()=>{
    _lbState.i = (_lbState.i + 1) % _lbState.items.length;
    renderLightbox();
  };
  document.getElementById('lightbox').onclick = e=>{
    if(e.target.id==='lightbox') closeLightbox();
  };
  document.addEventListener('keydown', e=>{
    if(!document.getElementById('lightbox').classList.contains('show')) return;
    if(e.key==='Escape') closeLightbox();
    else if(e.key==='ArrowLeft')  document.getElementById('lightboxPrev').click();
    else if(e.key==='ArrowRight') document.getElementById('lightboxNext').click();
  });
}

/* ============================================================
   АДМИН-ПАНЕЛЬ — независимые floors/perFloor по каждому корпусу
   ============================================================ */
function renderAdminPanel(){
  const panel = document.getElementById('adminPanel');
  if(!state.adminMode){ panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const cfg = state.buildingConfig;
  panel.innerHTML = `
    <div class="admin-panel-head">
      <h4 class="ic-inline">${icon('gear',15)} Управление структурой здания <span class="badge-admin">Админ</span></h4>
      <button class="btn btn-sm ic-inline" id="adminAddCorp">${icon('plus',14)} Добавить корпус</button>
    </div>
    <div class="admin-panel-corps">
      ${cfg.corps.map(corp=>{
        const ccfg = corpCfg(cfg, corp);
        const corpUnits = units().filter(u=>u.corp===corp);
        return `<div class="admin-corp" data-corp-card="${corp}">
          <div class="admin-corp-name" style="display:flex; justify-content:space-between; align-items:center;">
            <span>${corp} · ${corpUnits.length} помещений</span>
            ${cfg.corps.length>1 ? `<button class="btn btn-sm icon-only" data-corp-remove="${corp}" style="color:var(--terra-dark); border-color:var(--terra-dark);" title="Удалить корпус">${icon('close',14)}</button>` : ''}
          </div>
          <div class="admin-stepper">
            <span class="lbl">Этажей в этом корпусе</span>
            <span class="ctrl">
              <button data-corp="${corp}" data-act="floor-dec">−</button>
              <span class="val">${ccfg.floors}</span>
              <button data-corp="${corp}" data-act="floor-inc">＋</button>
            </span>
          </div>
          <div class="admin-stepper">
            <span class="lbl">Помещений на этаже</span>
            <span class="ctrl">
              <button data-corp="${corp}" data-act="pf-dec">−</button>
              <span class="val">${ccfg.perFloor}</span>
              <button data-corp="${corp}" data-act="pf-inc">＋</button>
            </span>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="admin-panel-foot">
      <button class="btn btn-sm" id="adminResetData" style="color:var(--terra-dark);">Сбросить все данные к дефолту</button>
      <span style="font-size:12px; color:var(--brown-soft); align-self:center;">
        Этажность и количество помещений независимы для каждого корпуса. Изменения одного корпуса не влияют на другие.
      </span>
    </div>
  `;

  panel.querySelectorAll('[data-act]').forEach(btn=>btn.onclick = ()=>{
    const corp = btn.dataset.corp;
    const ccfg = corpCfg(cfg, corp);
    const a = btn.dataset.act;
    if(a==='floor-inc'){ setFloors(corp, ccfg.floors+1); toast(corp+': добавлен этаж'); }
    else if(a==='floor-dec'){
      if(ccfg.floors<=1){ toast('Минимум 1 этаж'); return; }
      if(!confirm(corp+': удалить верхний этаж со всеми помещениями?')) return;
      setFloors(corp, ccfg.floors-1); toast(corp+': этаж удалён');
    }
    else if(a==='pf-inc'){ setPerFloor(corp, ccfg.perFloor+1); toast(corp+': +1 помещение в ряд'); }
    else if(a==='pf-dec'){
      if(ccfg.perFloor<=1){ toast('Минимум 1 помещение в ряду'); return; }
      if(!confirm(corp+': удалить крайнее помещение на каждом этаже?')) return;
      setPerFloor(corp, ccfg.perFloor-1); toast(corp+': помещения удалены');
    }
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
  });

  panel.querySelectorAll('[data-corp-remove]').forEach(btn=>btn.onclick = ()=>{
    const name = btn.dataset.corpRemove;
    if(!confirm('Удалить корпус «'+name+'» со всеми помещениями?')) return;
    removeCorp(name);
    if(state.floorViewCorp===name) state.floorViewCorp = state.buildingConfig.corps[0];
    if(state.facadeCorp===name)    state.facadeCorp    = state.buildingConfig.corps[0];
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
    toast('Корпус удалён');
  });

  document.getElementById('adminAddCorp').onclick = ()=>{
    const name = prompt('Название нового корпуса:');
    if(!name) return;
    addCorp(name);
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
    toast('Корпус «'+name+'» добавлен');
  };

  document.getElementById('adminResetData').onclick = ()=>{
    if(!confirm('Сбросить все данные шахматки к исходному состоянию? Это удалит все ваши изменения.')) return;
    resetToDefaults();
    renderAdminPanel(); renderChess(); renderAside(); buildFilters();
    toast('Данные сброшены');
  };
}

function toggleAdminMode(){
  state.adminMode = !state.adminMode;
  document.getElementById('adminToggle').classList.toggle('admin-on', state.adminMode);
  renderAdminPanel();
  renderChess();
  renderDashboard();
  renderChecklist();
  toast(state.adminMode ? 'Режим администратора включён' : 'Режим продаж');
}

/* ============================================================
   ФОРМА РЕДАКТИРОВАНИЯ ПОМЕЩЕНИЯ — с видом, планировками, фото
   ============================================================ */
// Буфер для фото/планировок текущего редактируемого помещения
let _unitFormBuf = { view: [], plans: [], photos: [] };

function renderPhotoPreview(host, arr, kind){
  host.innerHTML = arr.map((p,i)=>{
    const isMain = kind==='view' && p.isMain;
    return `<div class="pp-thumb ${isMain?'is-main':''}" style="background-image:url('${p.url.replace(/'/g,"%27")}')" data-i="${i}" title="${kind==='view' ? (isMain?'Основная фотография':'Кликните, чтобы сделать основной') : (p.title||'')}">
      <button type="button" class="pp-del" data-i="${i}">${icon('close',12)}</button>
    </div>`;
  }).join('');
  host.querySelectorAll('.pp-del').forEach(b=>b.onclick = e=>{
    e.stopPropagation();
    arr.splice(+b.dataset.i, 1);
    if(kind==='view' && arr.length && !arr.some(p=>p.isMain)) arr[0].isMain = true;
    renderPhotoPreview(host, arr, kind);
  });
  if(kind==='view'){
    host.querySelectorAll('.pp-thumb').forEach(t=>t.onclick = ()=>{
      const i = +t.dataset.i;
      arr.forEach((p,k)=>p.isMain = (k===i));
      renderPhotoPreview(host, arr, kind);
    });
  }
}

function readFilesToDataUrls(fileList){
  return Promise.all([...fileList].map(file=>new Promise(res=>{
    const reader = new FileReader();
    reader.onload = e=>res({ url: e.target.result });
    reader.readAsDataURL(file);
  })));
}

function openUnitForm(id){
  const u = getUnit(id);
  if(!u) return;
  const cfg = state.buildingConfig;

  document.getElementById('unitFormId').value = id;
  document.getElementById('unitFormSub').textContent = u.kind+' · '+u.corp+' · '+u.floor+' этаж';
  document.getElementById('unitFormNum').value   = u.displayNum;
  document.getElementById('unitFormKind').value  = u.kind;
  document.getElementById('unitFormCorp').innerHTML = cfg.corps.map(c=>`<option ${c===u.corp?'selected':''}>${c}</option>`).join('');
  document.getElementById('unitFormFloor').value = u.floor;
  document.getElementById('unitFormArea').value  = u.area;
  document.getElementById('unitFormPrice').value = u.pricePerM;
  document.getElementById('unitFormStatus').innerHTML  = STATUS_ORDER.map(s=>`<option value="${s}" ${s===u.status?'selected':''}>${STATUSES[s].label}</option>`).join('');
  document.getElementById('unitFormManager').innerHTML = MANAGERS.map(m=>`<option value="${m.id}" ${m.id===u.managerId?'selected':''}>${m.name}</option>`).join('');

  // Вид из окна
  const v = u.view || { direction:'', category:'', description:'', comment:'', photos:[] };
  document.getElementById('unitFormViewDir').innerHTML = `<option value="">— не указано —</option>`+
    VIEW_DIRECTIONS.map(d=>`<option ${d===v.direction?'selected':''}>${d}</option>`).join('');
  document.getElementById('unitFormViewCat').innerHTML = `<option value="">— не указана —</option>`+
    VIEW_CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===v.category?'selected':''}>${c.label}</option>`).join('');
  document.getElementById('unitFormViewDesc').value    = v.description || '';
  document.getElementById('unitFormViewComment').value = v.comment || '';
  document.getElementById('unitFormViewPhotos').value  = '';

  // Буфер фото/планировок (копия, чтобы отмена не портила оригинал)
  _unitFormBuf = {
    view:   JSON.parse(JSON.stringify(v.photos || [])),
    plans:  JSON.parse(JSON.stringify(u.plans || [])),
    photos: JSON.parse(JSON.stringify(u.photos || [])),
  };
  renderPhotoPreview(document.getElementById('unitFormViewPreview'),  _unitFormBuf.view,   'view');
  renderPhotoPreview(document.getElementById('unitFormPlanPreview'),  _unitFormBuf.plans,  'plan');
  renderPhotoPreview(document.getElementById('unitFormPhotoPreview'), _unitFormBuf.photos, 'photo');

  document.getElementById('unitFormPlans').value  = '';
  document.getElementById('unitFormPhotos').value = '';

  document.getElementById('unitFormModal').classList.add('show');
}

function closeUnitForm(){ document.getElementById('unitFormModal').classList.remove('show'); }

function initUnitForm(){
  document.getElementById('unitFormClose').onclick = closeUnitForm;
  document.getElementById('unitCancel').onclick    = closeUnitForm;
  document.getElementById('unitDelete').onclick    = ()=>{
    const id = document.getElementById('unitFormId').value;
    const u = getUnit(id);
    if(!u) return;
    if(!confirm('Удалить помещение '+u.displayNum+'?')) return;
    deleteUnit(id);
    closeUnitForm(); renderChess(); renderAside();
    toast('Помещение удалено');
  };

  // Загрузка файлов
  document.getElementById('unitFormViewFilesBtn').onclick  = ()=>document.getElementById('unitFormViewFiles').click();
  document.getElementById('unitFormPlanFilesBtn').onclick  = ()=>document.getElementById('unitFormPlanFiles').click();
  document.getElementById('unitFormPhotoFilesBtn').onclick = ()=>document.getElementById('unitFormPhotoFiles').click();

  document.getElementById('unitFormViewFiles').onchange = async e=>{
    const items = await readFilesToDataUrls(e.target.files);
    items.forEach(it=>{
      _unitFormBuf.view.push({ id: uid('vp'), url: it.url, isMain: !_unitFormBuf.view.some(p=>p.isMain) });
    });
    renderPhotoPreview(document.getElementById('unitFormViewPreview'), _unitFormBuf.view, 'view');
    e.target.value = '';
  };
  document.getElementById('unitFormPlanFiles').onchange = async e=>{
    const items = await readFilesToDataUrls(e.target.files);
    items.forEach((it,i)=>{
      _unitFormBuf.plans.push({ id: uid('pl'), url: it.url, title: 'Планировка '+(_unitFormBuf.plans.length+1) });
    });
    renderPhotoPreview(document.getElementById('unitFormPlanPreview'), _unitFormBuf.plans, 'plan');
    e.target.value = '';
  };
  document.getElementById('unitFormPhotoFiles').onchange = async e=>{
    const items = await readFilesToDataUrls(e.target.files);
    items.forEach(it=>_unitFormBuf.photos.push({ id: uid('ph'), url: it.url }));
    renderPhotoPreview(document.getElementById('unitFormPhotoPreview'), _unitFormBuf.photos, 'photo');
    e.target.value = '';
  };

  document.getElementById('unitForm').onsubmit = e=>{
    e.preventDefault();
    const id = document.getElementById('unitFormId').value;
    const u  = getUnit(id);
    if(!u) return;
    const area  = parseFloat(document.getElementById('unitFormArea').value);
    const price = parseFloat(document.getElementById('unitFormPrice').value);

    // URL-поля → добавляем в буферы. data:URL содержит запятые, поэтому
    // если ввод начинается с data: — берём как единый URL, иначе разделяем по запятым/переносам.
    const parseUrls = s => {
      const v = (s||'').trim();
      if(!v) return [];
      if(v.startsWith('data:')) return [v];
      return v.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
    };
    parseUrls(document.getElementById('unitFormViewPhotos').value).forEach(url=>{
      _unitFormBuf.view.push({ id: uid('vp'), url, isMain: !_unitFormBuf.view.some(p=>p.isMain) });
    });
    parseUrls(document.getElementById('unitFormPlans').value).forEach(url=>{
      _unitFormBuf.plans.push({ id: uid('pl'), url, title: 'Планировка '+(_unitFormBuf.plans.length+1) });
    });
    parseUrls(document.getElementById('unitFormPhotos').value).forEach(url=>{
      _unitFormBuf.photos.push({ id: uid('ph'), url });
    });

    // Гарантируем, что main у view-фото проставлен
    if(_unitFormBuf.view.length && !_unitFormBuf.view.some(p=>p.isMain)) _unitFormBuf.view[0].isMain = true;

    updateUnit(id, {
      displayNum: document.getElementById('unitFormNum').value.trim(),
      kind:       document.getElementById('unitFormKind').value.trim(),
      corp:       document.getElementById('unitFormCorp').value,
      floor:      parseInt(document.getElementById('unitFormFloor').value, 10),
      area, pricePerM: price,
      total:      Math.round(area*price/1000*10)/10,
      status:     document.getElementById('unitFormStatus').value,
      managerId:  document.getElementById('unitFormManager').value,
      view: {
        direction:   document.getElementById('unitFormViewDir').value,
        category:    document.getElementById('unitFormViewCat').value,
        description: document.getElementById('unitFormViewDesc').value.trim(),
        comment:     document.getElementById('unitFormViewComment').value.trim(),
        photos:      _unitFormBuf.view,
      },
      plans:  _unitFormBuf.plans,
      photos: _unitFormBuf.photos,
    });
    closeUnitForm(); renderChess(); renderAside();
    toast('Изменения сохранены');
  };
}
