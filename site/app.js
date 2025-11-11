async function loadJSON(p){ const r = await fetch(p); return r.ok ? r.json() : null; }
function imgSrc(rel){ return rel ? 'assets/'+rel : ''; }

function weaponCard(w, levels){
  const lv = (levels.filter(x=>x.weapon_id===w.id).sort((a,b)=>a.level-b.level));
  const first = lv[0] || {};
  const id = 'lv_'+w.id;
  const statsHTML = (o)=>`
    <div class="small">DMG ${o.damage ?? '-'} / RoF ${o.fire_rate ?? '-'} / Spread ${o.spread ?? '-'}</div>
    <div class="small">Reload ${o.reload_time ?? '-'} / Mag ${o.mag_size ?? '-'}</div>`;
  return `<div class="card">
    ${w.image_rel ? `<img src="${imgSrc(w.image_rel)}" alt="${w.name_ja||w.name_en||w.id}">` : ''}
    <div class="meta">
      <div class="row"><span class="badge">武器</span><b>${w.name_ja||w.name_en||w.id}</b></div>
      <div class="small">価格: ${w.price ?? '-'} / レア: ${w.rarity ?? '-'}</div>
      <div id="${id}_stats">${statsHTML(first)}</div>
      ${lv.length>1 ? `<input id="${id}" class="slider" type="range" min="${lv[0].level}" max="${lv[lv.length-1].level}" value="${lv[0].level}">` : ''}
    </div>
  </div>`;
}

function arcCard(a, drops, items){
  const d = drops.filter(x=>x.arc_id===a.id);
  const li = d.map(x=>{
    const it = items.find(i=>i.id===x.item_id);
    const name = it ? (it.name_ja||it.name_en||it.id) : x.item_id;
    return `<div class="small">・${name}${x.rate_pct?` (${x.rate_pct}%)`:''}</div>`;
  }).join('');
  return `<div class="card">
    ${a.image_rel ? `<img src="${imgSrc(a.image_rel)}" alt="${a.name_ja||a.name_en||a.id}">` : ''}
    <div class="meta">
      <div class="row"><span class="badge">敵</span><b>${a.name_ja||a.name_en||a.id}</b></div>
      ${a.class?`<div class="small">分類: ${a.class}</div>`:''}
      ${li?`<div>${li}</div>`:''}
    </div>
  </div>`;
}

function itemCard(it){
  return `<div class="card">
    ${it.image_rel ? `<img src="${imgSrc(it.image_rel)}" alt="${it.name_ja||it.name_en||it.id}">` : ''}
    <div class="meta">
      <div class="row"><span class="badge">アイテム</span><b>${it.name_ja||it.name_en||it.id}</b></div>
      <div class="small">価格: ${it.price ?? '-'}</div>
      ${it.type?`<div class="small">種類: ${it.type}</div>`:''}
    </div>
  </div>`;
}

(async () => {
  const data = await loadJSON('data/arcraiders.json') || {weapons:[],weapon_levels:[],items:[],arcs:[],arc_drops:[]};
  const q = document.getElementById('q'), cat = document.getElementById('cat'), root = document.getElementById('content');
  function render(){
    const qv = (q.value||'').toLowerCase();
    const cv = cat.value;
    const blocks = [];
    if(!cv || cv==='weapons'){
      blocks.push(...data.weapons.filter(w => !qv || (w.name_ja||'').toLowerCase().includes(qv) || (w.name_en||'').toLowerCase().includes(qv))
        .map(w => weaponCard(w, data.weapon_levels)));
    }
    if(!cv || cv==='arcs'){
      blocks.push(...data.arcs.filter(a => !qv || (a.name_ja||'').toLowerCase().includes(qv) || (a.name_en||'').toLowerCase().includes(qv))
        .map(a => arcCard(a, data.arc_drops, data.items)));
    }
    if(!cv || cv==='items'){
      blocks.push(...data.items.filter(i => !qv || (i.name_ja||'').toLowerCase().includes(qv) || (i.name_en||'').toLowerCase().includes(qv))
        .map(itemCard));
    }
    root.innerHTML = blocks.join('');
    // wire sliders
    data.weapons.forEach(w => {
      const lv = data.weapon_levels.filter(x=>x.weapon_id===w.id).sort((a,b)=>a.level-b.level);
      if(lv.length<2) return;
      const el = document.getElementById('lv_'+w.id);
      const stats = document.getElementById('lv_'+w.id+'_stats');
      const statsHTML = (o)=>`
        <div class="small">DMG ${o.damage ?? '-'} / RoF ${o.fire_rate ?? '-'} / Spread ${o.spread ?? '-'}</div>
        <div class="small">Reload ${o.reload_time ?? '-'} / Mag ${o.mag_size ?? '-'}</div>`;
      el.addEventListener('input', () => {
        const cur = lv.find(x=>String(x.level)===el.value) || lv[0];
        stats.innerHTML = statsHTML(cur);
      });
    });
  }
  q.addEventListener('input', render); cat.addEventListener('change', render);
  render();
})();

