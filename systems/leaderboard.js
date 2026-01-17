const LS_KEY = 'sb_leaderboard_v1';
let room = null;
let currentUser = null;
let myRecord = null;
const pageState = { tab: 'local', local: 0, global: 0 };
const PAGE_SIZE = 8;
const COLL_NAME = 'player_v2'; // Bumped for new schema

function getLocalScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocalScores(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
export function addLocalScore(score, replayData = null) {
  const arr = getLocalScores();
  // If we have replayData, we must store it. 
  // LocalStorage has size limits, so we might only store the last few replays fully, 
  // or just store the most recent one in memory for immediate playback?
  // For the prompt, we store it in the object.
  arr.push({ score, at: Date.now(), replayData });
  arr.sort((a,b)=>b.score-a.score);
  // Prevent LS overflow by only keeping top scores and maybe stripping replay data from old ones
  const toSave = arr.slice(0, 50).map((item, idx) => {
      // Keep replay data only for top 5 to save space
      if (idx > 5) return { ...item, replayData: null };
      return item;
  });
  saveLocalScores(toSave);
  renderLocal();
  
  // Also store the very last replay in a global var for the "Submit" flow
  if (replayData) window.__lastReplayData = replayData;
}
function renderLocal() {
  const list = document.getElementById('local-scores'); if (!list) return;
  const arr = getLocalScores();
  const totalPages = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
  pageState.local = Math.min(pageState.local, totalPages - 1);
  const start = pageState.local * PAGE_SIZE;
  const pageItems = arr.slice().sort((a,b)=>b.score-a.score).slice(start, start + PAGE_SIZE);
  list.innerHTML = '';
  pageItems.forEach((e)=>{
    const li = document.createElement('li');
    const d = new Date(e.at);
    li.textContent = `${e.score} — ${d.toLocaleDateString()} ${d.toLocaleTimeString()} `;
    if (e.replayData) {
      const meta = { replayData: e.replayData, user: (currentUser?.username)||'you', score: e.score };
      li.appendChild(createReplayButton(meta));
    }
    list.appendChild(li);
  });
  updatePagination(totalPages, pageState.local);
}
function renderGlobalFromRecords(records) {
  const list = document.getElementById('global-scores'); if (!list) return;
  const items = [];
  for (const r of records) {
    try {
      // Support new 'stats' column or legacy 'data' column
      const raw = r.stats || r.data || '{}';
      const stats = JSON.parse(raw);
      if (typeof stats.highScore === 'number') {
        items.push({ 
          user: r.username, 
          score: stats.highScore, 
          // Check for URL first, then legacy embedded JSON
          clip: stats.lastReplayUrl || stats.lastReplayJson || null 
        });
      }
    } catch {}
  }
  items.sort((a,b)=>b.score-a.score);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  pageState.global = Math.min(pageState.global, totalPages - 1);
  const start = pageState.global * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);
  list.innerHTML = '';
  pageItems.forEach((e)=>{
    const li = document.createElement('li');
    li.textContent = '';
    const img = document.createElement('img'); img.className='lb-avatar'; img.alt=`${e.user} avatar`; img.src=`https://images.websim.com/avatar/${e.user}`;
    const name = document.createElement('span'); name.textContent = `${e.user}: ${e.score} `;
    li.appendChild(img); li.appendChild(name);
    if (e.clip) {
      li.appendChild(createReplayButton({ replayData: e.clip, user: e.user, score: e.score }));
    }
    list.appendChild(li);
  });
  updatePagination(totalPages, pageState.global);
}
async function ensureRoom() {
  try { if (!currentUser) currentUser = await (window.websim?.getUser?.() || window.websim?.getCurrentUser?.()); } catch {}
  if (typeof WebsimSocket === 'undefined' || !window.websim) { room = null; return; }
  if (!room) { try { room = new WebsimSocket(); } catch { room = null; } }
}
async function ensureMyRecord() {
  await ensureRoom();
  if (!room) return;
  const coll = room.collection(COLL_NAME);
  for (let attempt = 0; attempt < 3 && !myRecord; attempt++) {
    const byId = coll.filter({ user_id: currentUser.id }).getList();
    if (byId.length) { myRecord = byId[0]; break; }
    const byName = coll.filter({ username: currentUser.username }).getList();
    if (byName.length) {
      byName.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      myRecord = byName[0];
      try { await coll.update(myRecord.id, { user_id: currentUser.id }); } catch {}
      break;
    }
    await new Promise(r=>setTimeout(r, 250));
  }
  if (!myRecord) {
    // Each user gets 1 row. stats column for score/replay, purchases for virtual items.
    myRecord = await coll.create({ 
      user_id: currentUser.id, 
      stats: JSON.stringify({ highScore: 0, recent: [] }),
      purchases: JSON.stringify({})
    });
  }
}
export async function submitScoreToDB(score) {
  try {
    await ensureMyRecord();
    if (!room || !myRecord) return;
    const coll = room.collection(COLL_NAME);
    
    // Normalize data from stats column or legacy data column
    let stats = {};
    const raw = myRecord.stats || myRecord.data || '{}';
    try { stats = JSON.parse(raw); } catch { stats = {}; }
    const recent = Array.isArray(stats.recent) ? stats.recent : [];
    
    const replayData = window.__lastReplayData || null;
    let replayUrl = stats.lastReplayUrl || null;

    // Upload replay JSON to blob storage to keep database row size small
    if (replayData && window.websim?.upload) {
      try {
        const blob = new Blob([JSON.stringify(replayData)], { type: 'application/json' });
        const file = new File([blob], `replay_${currentUser.username}_${Date.now()}.json`);
        replayUrl = await window.websim.upload(file);
      } catch (err) {
        console.error('Replay upload failed:', err);
      }
    }
    
    recent.unshift({ score, at: Date.now() });
    const highScore = Math.max(Number(stats.highScore||0), score);
    
    const newStats = { 
        highScore, 
        recent: recent.slice(0, 50), 
        lastReplayUrl: replayUrl // Store the file upload URL
    };
    
    await coll.update(myRecord.id, { 
      stats: JSON.stringify(newStats),
      purchases: myRecord.purchases || JSON.stringify({}) // Initialized/Maintained empty purchases json
    });
    
    const updated = coll.filter({ username: currentUser.username }).getList();
    myRecord = updated[0] || myRecord;
  } catch (e) {
    console.warn('Submit failed:', e);
  }
}
async function subscribeGlobal() {
  await ensureRoom();
  if (!room) {
    const list = document.getElementById('global-scores');
    if (list) list.innerHTML = '<li>Global leaderboard unavailable</li>';
    return;
  }
  try {
    const coll = room.collection(COLL_NAME);
    coll.subscribe(renderGlobalFromRecords);
    renderGlobalFromRecords(coll.getList());
  } catch { 
    const list = document.getElementById('global-scores');
    if (list) list.innerHTML = '<li>Global leaderboard unavailable</li>';
  }
}
function bindModal() {
  const btn = document.getElementById('leaderboard-button');
  const modal = document.getElementById('leaderboard-modal');
  const close = document.getElementById('lb-close');
  if (btn && modal && close) {
    btn.addEventListener('click', ()=>{ pageState.tab='local'; pageState.local=0; renderLocal(); setActiveTab('local'); modal.classList.remove('hidden'); });
    close.addEventListener('click', ()=> {
      modal.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('leaderboard:closed'));
    });
  }
}
function setActiveTab(which='local') {
  pageState.tab = which;
  const localBtn = document.getElementById('lb-tab-local');
  const globalBtn = document.getElementById('lb-tab-global');
  const localList = document.getElementById('local-scores');
  const globalList = document.getElementById('global-scores');
  if (!localBtn || !globalBtn || !localList || !globalList) return;
  localBtn.classList.toggle('is-active', which==='local');
  globalBtn.classList.toggle('is-active', which==='global');
  localList.classList.toggle('hidden', which!=='local');
  globalList.classList.toggle('hidden', which!=='global');
  // refresh pagination display for current tab
  if (which === 'local') renderLocal(); else subscribeGlobal();
}
function bindSubmit() {
  const submit = document.getElementById('submit-score-btn');
  submit?.addEventListener('click', async ()=>{
    submit.disabled = true;
    document.getElementById('skip-submit-btn')?.setAttribute('disabled','true');
    document.getElementById('submit-loading')?.classList.remove('hidden');
    const scoreText = document.getElementById('final-score')?.textContent || '0';
    const score = parseInt(scoreText, 10) || 0;
    await submitScoreToDB(score);
    document.getElementById('submit-loading')?.classList.add('hidden');
    document.getElementById('skip-submit-btn')?.removeAttribute('disabled');
    // open modal to show updated global
    document.getElementById('leaderboard-modal')?.classList.remove('hidden');
  });
}
function bindTabs() {
  document.getElementById('lb-tab-local')?.addEventListener('click', ()=>{ pageState.local=0; setActiveTab('local'); });
  document.getElementById('lb-tab-global')?.addEventListener('click', async ()=>{ pageState.global=0; await subscribeGlobal(); setActiveTab('global'); });
}
function updatePagination(totalPages, currentPage) {
  const indicator = document.getElementById('lb-page-indicator');
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  if (!indicator || !prev || !next) return;
  indicator.textContent = `${Math.min(currentPage+1,totalPages)} / ${totalPages}`;
  prev.disabled = currentPage <= 0;
  next.disabled = currentPage >= totalPages - 1;
}
function bindPagination() {
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  prev?.addEventListener('click', ()=>{
    if (pageState.tab==='local') { pageState.local = Math.max(0, pageState.local-1); renderLocal(); }
    else { pageState.global = Math.max(0, pageState.global-1); subscribeGlobal(); }
  });
  next?.addEventListener('click', ()=>{
    if (pageState.tab==='local') { pageState.local++; renderLocal(); }
    else { pageState.global++; subscribeGlobal(); }
  });
}
function createReplayButton(meta) {
  const btn = document.createElement('button');
  btn.className = 'lb-replay'; btn.type = 'button'; btn.setAttribute('aria-label','Watch replay');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="currentColor" stroke-width="0"/></svg>';
  btn.addEventListener('click', ()=> showReplayModal(meta));
  return btn;
}
function bindReplayModal() {
  const modal = document.getElementById('replay-modal');
  const closeBtn = document.getElementById('replay-close');
  closeBtn?.addEventListener('click', ()=> hideReplayModal());
  modal?.addEventListener('click', (e)=>{ if(e.target===modal) hideReplayModal(); });
}
async function showReplayModal({ replayData, user, score }) {
  const modal = document.getElementById('replay-modal'); if (!modal) return;
  
  const container = document.getElementById('replay-container');
  // Clear previous player
  container.innerHTML = '<div style="color:white; display:flex; align-items:center; justify-content:center; height:100%;">Loading Replay...</div>';

  if (replayData) {
      let data = replayData;
      // If the data is a string, it's a URL from the database
      if (typeof replayData === 'string' && (replayData.startsWith('http') || replayData.includes('.json'))) {
          try {
              const resp = await fetch(replayData);
              data = await resp.json();
          } catch (e) {
              console.error("Failed to fetch replay data", e);
              container.innerHTML = '<p style="color:white;">Replay data could not be loaded</p>';
              return;
          }
      }

      container.innerHTML = '';
      const { mountReplay } = await import('../replay/main.jsx');
      mountReplay(container, data);
  } else {
      container.innerHTML = '<p style="color:white;">Replay unavailable</p>';
  }

  const uname = user?.username || user?.name || user || 'You';
  const usernameEl = document.getElementById('replay-username'); usernameEl.textContent = `@${uname}`; usernameEl.href = `https://websim.com/@${uname}`;
  const avatarEl = document.getElementById('replay-avatar'); avatarEl.src = `https://images.websim.com/avatar/${uname}`;
  const scoreEl = document.getElementById('replay-score'); scoreEl.textContent = `Score: ${Number(score||0)}`;
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
}

function hideReplayModal() {
  const modal = document.getElementById('replay-modal');
  const container = document.getElementById('replay-container');
  
  if (container) {
      import('../replay/main.jsx').then(({ unmountReplay }) => {
          unmountReplay(container);
      });
  }
  
  modal?.classList.add('hidden'); modal?.setAttribute('aria-hidden','true');
}
window.addEventListener('DOMContentLoaded', () => {
  bindModal();
  bindSubmit();
  bindTabs();
  bindPagination();
  bindReplayModal();
  renderLocal();
  // remove auto global subscribe on load
  // subscribeGlobal();
});