/* ============================================================
   ВКЛАДКА «ЦИФРОВЫЕ ПРОФИЛИ КЛИЕНТОВ»
   ============================================================ */

function stageColor(stage){
  const i = STAGES.indexOf(stage);
  return `hsl(${18 + i*4}, ${40+i*3}%, ${62-i*3}%)`;
}

function renderClientList(){
  document.getElementById('clientCount').textContent = CLIENTS.length+' активных';
  document.getElementById('clientList').innerHTML = CLIENTS.map(c=>`
    <div class="client-item ${c.id===state.activeClientId?'active':''}" data-id="${c.id}">
      <div class="avatar">${c.name.split(' ').map(w=>w[0]).join('')}</div>
      <div class="meta"><b>${c.name}</b><span>${c.object}</span></div>
      <span class="stage-tag" style="background:${stageColor(c.stage)}33;color:var(--brown)">${c.stage}</span>
    </div>`).join('');
  document.querySelectorAll('.client-item').forEach(el=>el.onclick=()=>{
    state.activeClientId = el.dataset.id;
    renderClientList(); renderClientCard();
  });
}

function renderClientCard(){
  const c = CLIENTS.find(x=>x.id===state.activeClientId);
  if(!c) return;
  document.getElementById('clientCard').innerHTML = `
    <div class="client-card">
      <div class="client-card-head">
        <div class="avatar">${c.name.split(' ').map(w=>w[0]).join('')}</div>
        <div style="flex:1;">
          <h3>${c.name}</h3>
          <div class="sub">${c.phone} · источник: ${c.source}</div>
        </div>
        <span class="stage-tag" style="background:var(--terra);color:#fff;padding:6px 12px;font-size:12px;">${c.stage}</span>
      </div>
      <div class="cc-grid">
        <div><div class="k">Интересующий объект</div><div class="v">${c.object}</div></div>
        <div><div class="k">Бюджет</div><div class="v">${c.budget}</div></div>
        <div><div class="k">Цель покупки</div><div class="v">${c.goal}</div></div>
        <div><div class="k">Источник лида</div><div class="v">${c.source}</div></div>
        <div><div class="k">Менеджер</div><div class="v">${mgrName(c.mgr)}</div></div>
        <div><div class="k">Стадия сделки</div><div class="v">${c.stage}</div></div>
      </div>

      <div class="cc-cols" style="padding-bottom:0;">
        <div class="ai-card">
          <h4><span class="spark">✦</span>AI-подсказка по клиенту</h4>
          <p>${c.ai.rec}</p>
          <span class="ai-next">→ ${c.ai.next}</span>
        </div>
        <div class="sub-card">
          <h4>Комментарий менеджера</h4>
          <p style="font-size:13px;color:var(--brown);margin:0;line-height:1.55;">${c.note}</p>
          <textarea placeholder="Добавить комментарий…" style="width:100%;margin-top:11px;border:1px solid var(--line);border-radius:8px;padding:9px;font-family:inherit;font-size:13px;resize:vertical;min-height:48px;background:var(--bg-2);"></textarea>
        </div>
      </div>

      <div class="cc-cols">
        <div class="sub-card">
          <h4>📞 История коммуникаций</h4>
          ${c.comms.map(([t,d])=>`<div class="timeline-item"><div class="t">${t}</div><div class="d">${d}</div></div>`).join('')}
        </div>
        <div class="sub-card">
          <h4>✓ Задачи по клиенту</h4>
          ${c.tasks.map(([d,due,od])=>`<div class="task-item ${od?'overdue':''}"><span class="dotmark" style="background:${od?'var(--terra)':'var(--st-free)'}"></span>${d}<span class="due">${due}</span></div>`).join('')}
          <button class="btn btn-sm" style="margin-top:11px;">＋ Добавить задачу</button>
        </div>
      </div>
    </div>`;
}
