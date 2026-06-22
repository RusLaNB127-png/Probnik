/* ============================================================
   СОСТОЯНИЕ + УТИЛИТЫ
   Здесь живёт глобальное состояние и общие функции,
   используемые во всех вкладках.
   ============================================================ */

// Детерминированный псевдослучайный генератор (стабильная шахматка по seed)
function makeRng(seed){
  let s = seed;
  return ()=>{ s = (s*1103515245 + 12345) & 0x7fffffff; return s/0x7fffffff; };
}

// Генерация помещений для объекта (по конфигу из BUILDINGS)
function genUnits(key){
  const b = BUILDINGS[key];
  const rng = makeRng(b.seed);
  const units = [];
  let num = b.startNum;
  b.corps.forEach((corp, ci)=>{
    for(let f=b.floors; f>=1; f--){
      for(let u=0; u<b.perFloor; u++){
        const area = +(34 + Math.round(rng()*78)).toFixed(0);
        const pricePerM = Math.round((b.basePrice + (f*1.4) + rng()*40));
        const status = STATUS_WEIGHT[Math.floor(rng()*STATUS_WEIGHT.length)];
        const mgr = MANAGERS[Math.floor(rng()*MANAGERS.length)];
        const hasClient = (status!=='free' && status!=='unavailable') ? rng()>0.25 : false;
        units.push({
          id: key+'-'+(num),
          number: (ci*100 + 100 + u + 1) + '·' + f,
          displayNum: '№'+ (b.startNum + units.length),
          corp, floor:f, area,
          pricePerM,                       // тыс. ₽/м²
          total: Math.round(area*pricePerM/1000*10)/10, // млн ₽
          status,
          managerId: mgr.id,
          client: hasClient ? CLIENT_NAMES[Math.floor(rng()*CLIENT_NAMES.length)] : null,
          kind: b.kind,
        });
        num++;
      }
    }
  });
  return units;
}

// ---------- Глобальное состояние ----------
const state = {
  building: 'italika',
  units: {},                 // кэш помещений по объектам
  selectedUnitId: null,
  activeClientId: 'c1',
  filters: { corp:'', floor:'', status:'', manager:'', priceMin:'', priceMax:'', areaMin:'', areaMax:'' },
};

// ---------- Хелперы ----------
function units(){
  if(!state.units[state.building]) state.units[state.building] = genUnits(state.building);
  return state.units[state.building];
}
function mgrName(id){ return (MANAGERS.find(m=>m.id===id)||{}).name||'—'; }
function mgrShort(id){ return (MANAGERS.find(m=>m.id===id)||{}).short||'—'; }
function fmtMoney(mln){ return mln.toLocaleString('ru-RU',{maximumFractionDigits:1})+' млн ₽'; }

// KPI-карточка (используется в воронке и дашборде)
function kpi(label,val,trend,note){
  return `<div class="kpi"><div class="label">${label}</div><div class="val">${val}</div><div class="trend ${trend}">${trend==='up'?'▲':'▼'} ${note}</div></div>`;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = '<span style="color:var(--st-booked)">✓</span> '+msg;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}
