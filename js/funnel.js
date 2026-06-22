/* ============================================================
   ВКЛАДКА «ВОРОНКА И СТАТИСТИКА»
   ============================================================ */

function renderFunnel(){
  const leads = FUNNEL_DATA[0][1];
  const closed = FUNNEL_DATA[7][1];
  const conv = (closed/leads*100).toFixed(1);
  const soldUnits = units().filter(u=>u.status==='sold');
  const soldSum = soldUnits.reduce((s,u)=>s+u.total,0);
  const avg = soldSum>0 ? (soldSum/Math.max(soldUnits.length,1)) : 0;

  // KPI
  document.getElementById('funnelKpi').innerHTML = `
    ${kpi('Количество лидов', leads, 'up','+12% к маю')}
    ${kpi('Конверсия в сделку', conv+'%', 'up','+0,8 п.п.')}
    ${kpi('Средний чек', fmtMoney(avg), 'up','+3%')}
    ${kpi('Сумма продаж', fmtMoney(soldSum), 'up','за месяц')}`;

  // Воронка-бары
  const max = FUNNEL_DATA[0][1];
  document.getElementById('funnelChart').innerHTML = FUNNEL_DATA.map(([label,count],i)=>{
    const w = 40 + (count/max)*60;
    const stepConv = i>0 ? Math.round(count/FUNNEL_DATA[i-1][1]*100) : 100;
    const hue = 22, light = 58 - i*3;
    return `<div class="funnel-stage">
      <div class="funnel-bar" style="width:${w}%;background:linear-gradient(90deg,hsl(${hue},48%,${light}%),hsl(${hue+4},52%,${light-6}%))">
        <span class="label">${label}</span><span class="count">${count}</span>
      </div>
      ${i>0?`<div class="funnel-conv">конверсия с предыдущего этапа: ${stepConv}%</div>`:''}
    </div>`;
  }).join('');

  // Источники
  const srcMax = Math.max(...SOURCES.map(s=>s[1]));
  document.getElementById('sourcesList').innerHTML = SOURCES.map(([n,v])=>`
    <div class="li"><span class="nm">${n}</span><span class="mini-track"><i style="width:${v/srcMax*100}%"></i></span><span class="pct">${v}%</span></div>`).join('');

  // Отказы
  const refMax = Math.max(...REFUSALS.map(s=>s[1]));
  document.getElementById('refusalsList').innerHTML = REFUSALS.map(([n,v])=>`
    <div class="li"><span class="nm">${n}</span><span class="mini-track"><i style="width:${v/refMax*100}%;background:var(--st-sold)"></i></span><span class="pct">${v}%</span></div>`).join('');

  // Эффективность менеджеров
  const effMax = Math.max(...MGR_EFF.map(m=>m[1]));
  document.getElementById('mgrEffChart').innerHTML = MGR_EFF.map(([n,v])=>`
    <div class="hbar"><div class="top"><span>${n}</span><b>${v}%</b></div><div class="track"><div class="fill" style="width:${v/effMax*100}%"></div></div></div>`).join('');

  // Недельная динамика
  document.getElementById('weeklyChart').innerHTML = svgGroupedBars(WEEKLY);
}

function svgGroupedBars(data){
  const W=460, H=210, pad=34;
  const max = Math.max(...data.flatMap(d=>[d[1],d[2]]));
  const bw=22, gap=10, groupW=bw*2+gap, step=(W-pad)/data.length;
  let bars='';
  data.forEach((d,i)=>{
    const x = pad + i*step + (step-groupW)/2;
    const h1=(d[1]/max)*(H-pad-20), h2=(d[2]/max)*(H-pad-20);
    bars += `
      <rect x="${x}" y="${H-pad-h1}" width="${bw}" height="${h1}" rx="4" fill="var(--st-booked)"/>
      <rect x="${x+bw+gap}" y="${H-pad-h2}" width="${bw}" height="${h2}" rx="4" fill="var(--terra)"/>
      <text x="${x+groupW/2}" y="${H-pad+15}" text-anchor="middle" font-size="11" fill="var(--brown-soft)" font-family="Inter">${d[0]}</text>
      <text x="${x+bw/2}" y="${H-pad-h1-5}" text-anchor="middle" font-size="10" fill="var(--brown-soft)" font-family="Inter">${d[1]}</text>
      <text x="${x+bw+gap+bw/2}" y="${H-pad-h2-5}" text-anchor="middle" font-size="10" fill="var(--brown-soft)" font-family="Inter">${d[2]}</text>`;
  });
  return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}">
    <line x1="${pad}" y1="${H-pad}" x2="${W}" y2="${H-pad}" stroke="var(--line)"/>
    ${bars}
  </svg>
  <div style="display:flex;gap:18px;margin-top:8px;font-size:12px;color:var(--brown-soft)">
    <span style="display:flex;align-items:center;gap:6px;"><span style="width:11px;height:11px;border-radius:3px;background:var(--st-booked)"></span>Брони</span>
    <span style="display:flex;align-items:center;gap:6px;"><span style="width:11px;height:11px;border-radius:3px;background:var(--terra)"></span>Продажи</span>
  </div>`;
}
