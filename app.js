const STORAGE_KEY = 'bhhn_state_v1';
const PROFILE_KEY = 'bhhn_current_user';

// GitHub'a görsel klasörü yüklenmese bile uygulamadaki tüm logo alanlarını çalıştır.
document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.src.includes('bhhn-logo')) {
    image.src = window.BHHN_EMBEDDED_LOGO;
  }
}, true);
const DEFAULT_MEMBERS = [
  { id: 'nisu', name: 'Nisu' },
  { id: 'hatice', name: 'Hatice Nur' },
  { id: 'berfin', name: 'Berfin' },
  { id: 'heda', name: 'Heda' },
];
let MEMBERS = structuredClone(DEFAULT_MEMBERS);

const DEFAULT_GROUPS = [
  { id: 'ev', name: 'Ev', emoji: '🏠', memberIds: ['nisu', 'hatice'], accent: 'mint', createdAt: '2026-09-07T09:00:00.000Z' },
  { id: 'dordumuz', name: 'Dördümüz', emoji: '✨', memberIds: MEMBERS.map(m => m.id), accent: 'lilac', createdAt: '2026-09-07T09:01:00.000Z' },
];

const CATEGORY = {
  market: { label: 'Market', icon: '🛒' },
  yemek: { label: 'Yemek', icon: '🍝' },
  ev: { label: 'Ev', icon: '🏠' },
  ulasim: { label: 'Ulaşım', icon: '🚕' },
  fatura: { label: 'Fatura', icon: '🧾' },
  kahve: { label: 'Kahve', icon: '☕' },
  eglence: { label: 'Eğlence', icon: '🎟️' },
  diger: { label: 'Diğer', icon: '✦' },
};

let state = loadState();
let currentUserId = localStorage.getItem(PROFILE_KEY) || null;
let route = parseRoute();
let cloud = { enabled: false, status: 'local', api: null, auth: null, user: null, workspaceId: null, workspace: null, unsubscribers: [] };
let pendingCloudMigration = null;

const appShell = document.getElementById('appShell');
const onboarding = document.getElementById('onboarding');
const memberPicker = document.getElementById('memberPicker');
const view = document.getElementById('view');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');
const fab = document.getElementById('fab');
const syncButton = document.getElementById('syncButton');

function stateStorageKey(workspaceId = null) { return workspaceId ? `${STORAGE_KEY}_${workspaceId}` : STORAGE_KEY; }

function loadState(workspaceId = null) {
  try {
    const raw = localStorage.getItem(stateStorageKey(workspaceId));
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (err) {
    console.warn('bhhn local state could not be read:', err);
    return freshState();
  }
}

function freshState() {
  return { version: 2, members: structuredClone(DEFAULT_MEMBERS), groups: structuredClone(DEFAULT_GROUPS), expenses: [], settlements: [] };
}

function normalizeState(input) {
  const members = normalizeMembers(Array.isArray(input?.members) && input.members.length ? input.members : DEFAULT_MEMBERS);
  MEMBERS = structuredClone(members);
  return { version: 2, members, groups: Array.isArray(input?.groups) ? input.groups : structuredClone(DEFAULT_GROUPS), expenses: Array.isArray(input?.expenses) ? input.expenses : [], settlements: Array.isArray(input?.settlements) ? input.settlements : [] };
}

function normalizeMembers(members) {
  return structuredClone(members).map(m => m.id === 'hatice' ? { ...m, name: 'Hatice Nur' } : m);
}

function persist() {
  state.members = structuredClone(MEMBERS);
  localStorage.setItem(stateStorageKey(cloud.workspaceId), JSON.stringify(state));
}

function member(id) { return MEMBERS.find(m => m.id === id) || { id, name: id }; }
function group(id) { return state.groups.find(g => g.id === id); }
function money(value) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(Number(value || 0)); }
function shortMoney(value) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function cents(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function uid(prefix='id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function esc(v='') { return String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function today() { return new Date().toISOString().slice(0,10); }
function formatDate(d) { try { return new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'short', year: new Date().getFullYear() === Number(String(d).slice(0,4)) ? undefined : 'numeric' }).format(new Date(`${d}T12:00:00`)); } catch { return d; } }
function formatDateTime(iso) { try { return new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)); } catch { return ''; } }
function parseNumber(value) { return Number(String(value ?? '').replace(/\s/g,'').replace(',','.')) || 0; }

function avatarHTML(memberId, size='sm') {
  const m = member(memberId);
  return `<span class="avatar avatar-${size}" data-member="${esc(memberId)}">${esc(m.name.slice(0,1).toUpperCase())}</span>`;
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return { name: 'home' };
  const [name, id] = hash.split('/');
  if (name === 'group' && id) return { name:'group', id };
  if (['home','groups','activity','settings'].includes(name)) return { name };
  return { name:'home' };
}

function navigate(name, id) {
  location.hash = id ? `${name}/${id}` : name;
}

function renderMemberPicker() {
  memberPicker.innerHTML = MEMBERS.map(m => `
    <button class="member-choice" type="button" data-pick-member="${m.id}">
      ${avatarHTML(m.id,'md')} <span>${esc(m.name)}</span>
    </button>`).join('') + `
    <button class="member-choice add-member-choice" type="button" data-add-member-start>
      <span class="avatar avatar-md">＋</span><span>kişi ekle</span>
    </button>`;
  memberPicker.querySelectorAll('[data-pick-member]').forEach(btn => btn.addEventListener('click', () => chooseProfile(btn.dataset.pickMember)));
  memberPicker.querySelector('[data-add-member-start]')?.addEventListener('click', openAddMemberModal);
}

function chooseProfile(id) {
  if (!MEMBERS.some(m => m.id === id)) return;
  currentUserId = id;
  localStorage.setItem(PROFILE_KEY, id);
  onboarding.hidden = true;
  appShell.hidden = false;
  renderChrome();
  render();
}

function renderChrome() {
  if (!currentUserId) return;
  document.getElementById('profileAvatar').outerHTML = avatarHTML(currentUserId, 'sm').replace('<span ', '<span id="profileAvatar" ');
  document.getElementById('profileName').textContent = member(currentUserId).name;
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.route === (route.name === 'group' ? 'groups' : route.name)));
  fab.classList.toggle('hide', route.name === 'settings');
  updateSyncUI();
}

function computeBalances(groupId=null) {
  const ids = groupId ? (group(groupId)?.memberIds || []) : MEMBERS.map(m => m.id);
  const net = Object.fromEntries(ids.map(id => [id, 0]));
  for (const e of state.expenses) {
    if (groupId && e.groupId !== groupId) continue;
    if (!(e.payerId in net)) net[e.payerId] = 0;
    net[e.payerId] += Number(e.amount || 0);
    for (const [mid, owed] of Object.entries(e.splits || {})) {
      if (!(mid in net)) net[mid] = 0;
      net[mid] -= Number(owed || 0);
    }
  }
  for (const s of state.settlements) {
    if (groupId && s.groupId !== groupId) continue;
    if (!(s.fromId in net)) net[s.fromId] = 0;
    if (!(s.toId in net)) net[s.toId] = 0;
    net[s.fromId] += Number(s.amount || 0);
    net[s.toId] -= Number(s.amount || 0);
  }
  for (const key of Object.keys(net)) net[key] = cents(net[key]);
  return net;
}

function simplifyDebts(groupId=null) {
  const net = computeBalances(groupId);
  const creditors = Object.entries(net).filter(([,v]) => v > .009).map(([id,v]) => ({ id, amount: cents(v) })).sort((a,b)=>b.amount-a.amount);
  const debtors = Object.entries(net).filter(([,v]) => v < -.009).map(([id,v]) => ({ id, amount: cents(-v) })).sort((a,b)=>b.amount-a.amount);
  const out = [];
  let i=0, j=0;
  while (i < debtors.length && j < creditors.length) {
    const amount = cents(Math.min(debtors[i].amount, creditors[j].amount));
    if (amount > 0) out.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].amount = cents(debtors[i].amount - amount);
    creditors[j].amount = cents(creditors[j].amount - amount);
    if (debtors[i].amount <= .009) i++;
    if (creditors[j].amount <= .009) j++;
  }
  return out;
}

function currentUserTotals(groupId=null) {
  const debts = simplifyDebts(groupId);
  return {
    owedToYou: cents(debts.filter(d=>d.toId===currentUserId).reduce((s,d)=>s+d.amount,0)),
    youOwe: cents(debts.filter(d=>d.fromId===currentUserId).reduce((s,d)=>s+d.amount,0)),
  };
}

function currentUserDebtBreakdown(groupId=null) {
  return simplifyDebts(groupId)
    .filter(d => d.fromId === currentUserId)
    .map(d => ({ name: member(d.toId).name, amount: d.amount }));
}

function render() {
  if (!currentUserId) return;
  route = parseRoute();
  renderChrome();
  if (route.name === 'home') renderHome();
  else if (route.name === 'groups') renderGroups();
  else if (route.name === 'group') renderGroup(route.id);
  else if (route.name === 'activity') renderActivity();
  else if (route.name === 'settings') renderSettings();
  else renderHome();
}

function renderHome() {
  const totals = currentUserTotals();
  const debtBreakdown = currentUserDebtBreakdown();
  const recent = combinedActivity().slice(0,4);
  view.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">bhhn club</p><h1>selam ${esc(member(currentUserId).name.toLowerCase())} ✦</h1><p class="muted">hesaplar sakin, arkadaşlıklar baki.</p></div><img class="home-logo" src="assets/bhhn-logo.png" alt="bhhn. dört arkadaş logosu"></div>
    <section class="hero">
      <p class="eyebrow" style="color:rgba(255,255,255,.65)">genel durum</p>
      <h2 style="font-size:28px;margin:7px 0 0;letter-spacing:-.04em">aramızdaki denge</h2>
      <div class="hero-balance">
        <div class="balance-box"><small>sana gelecek</small><strong class="balance-positive">${money(totals.owedToYou)}</strong></div>
        <div class="balance-box"><small>senin borcun</small><strong class="balance-negative">${money(totals.youOwe)}</strong><div class="balance-details">${debtBreakdown.length ? debtBreakdown.map(d=>`<span><b>${esc(d.name)}’a</b> ${money(d.amount)}</span>`).join('') : '<span>borcun yok ✓</span>'}</div></div>
      </div>
    </section>
    <div class="quick-actions">
      <button class="quick-action" type="button" data-action="expense"><span>＋</span>harcama</button>
      <button class="quick-action" type="button" data-action="settle"><span>✓</span>ödeştik</button>
      <button class="quick-action" type="button" data-action="group"><span>✦</span>grup aç</button>
    </div>
    <section class="section">
      <div class="section-title"><h2>gruplarınız</h2><button class="text-button" type="button" data-go="groups">tümü</button></div>
      <div class="card-grid">${state.groups.slice(0,4).map(groupCardHTML).join('')}${state.groups.length < 4 ? addGroupCardHTML() : ''}</div>
    </section>
    <section class="section">
      <div class="section-title"><h2>son hareketler</h2><button class="text-button" type="button" data-go="activity">tümü</button></div>
      <div class="list">${recent.length ? recent.map(activityItemHTML).join('') : emptyHTML('🧾','daha hesap yok','ilk harcamayı eklediğinizde burada görünecek.')}</div>
    </section>`;
  bindCommonViewActions();
}

function groupCardHTML(g) {
  const t = currentUserTotals(g.id);
  let netText = 'hesaplar eşit';
  if (t.owedToYou > .009) netText = `${shortMoney(t.owedToYou)} alacağın var`;
  if (t.youOwe > .009) netText = `${shortMoney(t.youOwe)} borcun var`;
  return `<button class="group-card" data-accent="${esc(g.accent || 'mint')}" data-open-group="${esc(g.id)}" type="button">
    <div class="emoji">${esc(g.emoji || '✦')}</div>
    <h3>${esc(g.name)}</h3>
    <p>${g.memberIds.length} kişi</p>
    <div class="group-net">${esc(netText)}</div>
    <div class="group-members">${g.memberIds.map(id=>avatarHTML(id,'sm')).join('')}</div>
  </button>`;
}

function addGroupCardHTML() {
  return `<button class="group-card add-group-card" data-action="group" type="button"><div class="emoji">＋</div><strong>yeni grup</strong></button>`;
}

function renderGroups() {
  view.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">her plan ayrı hesap</p><h1>gruplar</h1><p class="muted">ev, tatil, kahve turu... ne lazımsa.</p></div><button class="btn btn-primary" type="button" data-action="group">＋ grup</button></div>
    <div class="card-grid">${state.groups.map(groupCardHTML).join('')}${addGroupCardHTML()}</div>`;
  bindCommonViewActions();
}

function renderGroup(groupId) {
  const g = group(groupId);
  if (!g) { navigate('groups'); return; }
  const debts = simplifyDebts(g.id);
  const txs = combinedActivity().filter(x=>x.groupId === g.id);
  const totals = currentUserTotals(g.id);
  const netPhrase = totals.owedToYou > .009 ? `${money(totals.owedToYou)} alacağın var` : totals.youOwe > .009 ? `${money(totals.youOwe)} borcun var` : 'senin hesabın dengede';
  view.innerHTML = `
    <div class="page-head"><button class="text-button" type="button" data-go="groups">← gruplar</button><button class="text-button" type="button" data-edit-group="${esc(g.id)}">düzenle</button></div>
    <section class="group-hero" style="background:var(--${esc(g.accent || 'mint')})">
      <div class="group-hero-top"><div><div class="group-emoji">${esc(g.emoji || '✦')}</div><h1>${esc(g.name)}</h1><p class="muted">${g.memberIds.map(id=>esc(member(id).name)).join(' · ')}</p></div><span class="pill">${esc(netPhrase)}</span></div>
      <div class="group-members">${g.memberIds.map(id=>avatarHTML(id,'md')).join('')}</div>
      <div class="debt-list">${debts.length ? debts.map(d=>`<div class="debt-row">${avatarHTML(d.fromId,'sm')}<strong>${esc(member(d.fromId).name)} → ${esc(member(d.toId).name)}</strong><span>${money(d.amount)}</span></div>`).join('') : `<div class="debt-row"><span>✓</span><strong>kimsenin kimseye borcu yok</strong><span>0 ₺</span></div>`}</div>
    </section>
    <div class="quick-actions">
      <button class="quick-action" type="button" data-action="expense" data-group-id="${esc(g.id)}"><span>＋</span>harcama</button>
      <button class="quick-action" type="button" data-action="settle" data-group-id="${esc(g.id)}"><span>✓</span>ödeştik</button>
      <button class="quick-action" type="button" data-copy-summary="${esc(g.id)}"><span>↗</span>özeti kopyala</button>
    </div>
    <section class="section"><div class="section-title"><h2>hareketler</h2><span class="tag">${txs.length} kayıt</span></div><div class="list">${txs.length ? txs.map(activityItemHTML).join('') : emptyHTML('✨','tertemiz sayfa','bu grupta henüz harcama yok.')}</div></section>`;
  bindCommonViewActions();
  view.querySelector(`[data-edit-group="${CSS.escape(g.id)}"]`)?.addEventListener('click', ()=>openGroupModal(g.id));
  view.querySelector(`[data-copy-summary="${CSS.escape(g.id)}"]`)?.addEventListener('click', ()=>copyGroupSummary(g.id));
}

function combinedActivity() {
  const expenses = state.expenses.map(e=>({ type:'expense', sortAt: e.createdAt || `${e.date}T12:00:00`, ...e }));
  const settlements = state.settlements.map(s=>({ type:'settlement', sortAt: s.createdAt || `${s.date}T12:00:00`, ...s }));
  return [...expenses, ...settlements].sort((a,b)=> new Date(b.sortAt)-new Date(a.sortAt));
}

function activityItemHTML(item) {
  const g = group(item.groupId);
  if (item.type === 'expense') {
    const cat = CATEGORY[item.category] || CATEGORY.diger;
    const yourShare = Number(item.splits?.[currentUserId] || 0);
    let sub = `${esc(member(item.payerId).name)} ödedi · ${esc(g?.name || 'Grup')} · ${formatDate(item.date)}`;
    let side = `<div class="amount">${money(item.amount)}<small>${yourShare ? `payın ${money(yourShare)}` : 'payın yok'}</small></div>`;
    return `<button class="list-item clickable" type="button" data-open-expense="${esc(item.id)}"><span class="icon-tile">${cat.icon}</span><span><h3>${esc(item.title)}</h3><p>${sub}</p></span>${side}</button>`;
  }
  return `<button class="list-item clickable" type="button" data-open-settlement="${esc(item.id)}"><span class="icon-tile">✓</span><span><h3>${esc(member(item.fromId).name)} → ${esc(member(item.toId).name)}</h3><p>ödeme · ${esc(g?.name || 'Grup')} · ${formatDate(item.date)}</p></span><div class="amount">${money(item.amount)}<small>kapandı</small></div></button>`;
}

function emptyHTML(icon,title,text) { return `<div class="empty"><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong>${esc(text)}</div>`; }

function renderActivity() {
  const all = combinedActivity();
  view.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">kim, ne, ne zaman</p><h1>hareketler</h1><p class="muted">bütün grupların tek akışı.</p></div></div>
    <div class="search"><input id="activitySearch" type="search" placeholder="harcama, kişi veya grup ara..." autocomplete="off" /></div>
    <div id="activityList" class="list">${all.length ? all.map(activityItemHTML).join('') : emptyHTML('🧾','henüz hareket yok','ilk harcamayı ekle ve burası dolsun.')}</div>`;
  bindCommonViewActions();
  document.getElementById('activitySearch').addEventListener('input', e => {
    const q = e.target.value.trim().toLocaleLowerCase('tr');
    const filtered = combinedActivity().filter(item => {
      const text = item.type === 'expense'
        ? `${item.title} ${member(item.payerId).name} ${group(item.groupId)?.name || ''} ${CATEGORY[item.category]?.label || ''}`
        : `${member(item.fromId).name} ${member(item.toId).name} ${group(item.groupId)?.name || ''}`;
      return text.toLocaleLowerCase('tr').includes(q);
    });
    document.getElementById('activityList').innerHTML = filtered.length ? filtered.map(activityItemHTML).join('') : emptyHTML('⌕','bulamadım','başka bir kelime dene.');
    bindActivityOpeners(document.getElementById('activityList'));
  });
}

function renderSettings() {
  const syncText = cloud.status === 'cloud' ? 'Canlı senkronizasyon açık' : cloud.status === 'error' ? 'Bulut bağlantısında sorun var' : 'Bu cihazda yerel mod';
  const syncClass = cloud.status === 'cloud' ? 'cloud' : cloud.status === 'error' ? 'error' : '';
  const invite = cloud.workspace?.inviteCode || '';
  view.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">bhhn.</p><h1>ayarlar</h1><p class="muted">küçük kasanızın kontrol odası.</p></div></div>
    <section class="settings-card" style="display:flex;align-items:center;gap:16px"><img class="logo-settings" src="assets/bhhn-logo.png" alt="bhhn. dört arkadaş logosu"><div><h3>bhhn.</h3><p style="margin-bottom:8px">balance between us</p><span class="status ${syncClass}">${esc(syncText)}</span></div></section>
    ${cloud.status==='cloud' ? `<section class="settings-card invite-card"><h3>${esc(cloud.workspace?.name || 'ortak alan')}</h3><p>arkadaşların hesap açıp bu kodla katılabilir.</p><div class="invite-code"><strong>${esc(invite)}</strong><button class="btn btn-secondary" type="button" data-copy-invite>kodu kopyala</button></div><p class="tiny muted">${MEMBERS.length} kişi · ${MEMBERS.map(m=>esc(m.name)).join(' · ')}</p></section>` : ''}
    <section class="settings-card"><h3>profil</h3><p>Şu an ${esc(member(currentUserId).name)} olarak görünüyorsun.</p><div class="settings-actions"><button class="btn btn-secondary" type="button" data-profile-switch>${cloud.status==='cloud'?'profil / çıkış':'profili değiştir'}</button>${cloud.status!=='cloud'?`<button class="btn btn-primary" type="button" data-add-member-settings>kişi ekle</button>`:''}${cloud.status==='cloud'?`<button class="btn btn-secondary" type="button" data-space-switch>alan değiştir</button>`:''}</div></section>
    <section class="settings-card"><h3>yedek</h3><p>Harcama, grup ve ödemeleri tek JSON dosyasına al.</p><div class="settings-actions"><button class="btn btn-secondary" type="button" data-export>yedek indir</button><button class="btn btn-secondary" type="button" data-import>yedek yükle</button><input id="importFile" type="file" accept="application/json" hidden></div></section>
    ${cloud.status!=='cloud' ? `<section class="settings-card"><h3>telefon-PC senkronizasyonu</h3><p>Uygulama eski görünümünde kalır. Girişi yalnızca bir kez burada yaparsın; mevcut grupların korunur.</p><button class="btn btn-primary" type="button" data-cloud-login>senkronizasyonu aç</button></section>` : ''}
    <section class="settings-card"><h3>yerel veriyi sıfırla</h3><p>Sadece bu cihazdaki önbelleği temizler.</p><button class="btn btn-danger" type="button" data-reset>verileri sıfırla</button></section>`;
  view.querySelector('[data-profile-switch]').addEventListener('click', openProfileModal);
  view.querySelector('[data-add-member-settings]')?.addEventListener('click', openAddMemberModal);
  view.querySelector('[data-cloud-login]')?.addEventListener('click', openCloudLoginModal);
  view.querySelector('[data-space-switch]')?.addEventListener('click',()=>showWorkspaceGate(cloud.user));
  view.querySelector('[data-copy-invite]')?.addEventListener('click',()=>navigator.clipboard?.writeText(invite).then(()=>showToast('davet kodu kopyalandı ✦')).catch(()=>showToast(`davet kodu: ${invite}`)));
  view.querySelector('[data-export]').addEventListener('click', exportBackup);
  view.querySelector('[data-import]').addEventListener('click', ()=>document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importBackup);
  view.querySelector('[data-reset]').addEventListener('click', resetLocalData);
}

function bindCommonViewActions() {
  view.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ()=>navigate(el.dataset.go)));
  view.querySelectorAll('[data-open-group]').forEach(el => el.addEventListener('click', ()=>navigate('group', el.dataset.openGroup)));
  view.querySelectorAll('[data-action="expense"]').forEach(el => el.addEventListener('click', ()=>openExpenseModal(null, el.dataset.groupId || (route.name === 'group' ? route.id : null))));
  view.querySelectorAll('[data-action="settle"]').forEach(el => el.addEventListener('click', ()=>openSettlementModal(null, el.dataset.groupId || (route.name === 'group' ? route.id : null))));
  view.querySelectorAll('[data-action="group"]').forEach(el => el.addEventListener('click', ()=>openGroupModal()));
  bindActivityOpeners(view);
}

function bindActivityOpeners(root) {
  root.querySelectorAll('[data-open-expense]').forEach(el => el.addEventListener('click', ()=>openExpenseModal(el.dataset.openExpense)));
  root.querySelectorAll('[data-open-settlement]').forEach(el => el.addEventListener('click', ()=>openSettlementDetails(el.dataset.openSettlement)));
}

function openModal(title, bodyHTML, onReady) {
  modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" type="button" aria-label="Kapat">×</button></div><div class="modal-body">${bodyHTML}</div></section></div>`;
  const backdrop = modalRoot.querySelector('.modal-backdrop');
  const close = () => { modalRoot.innerHTML=''; document.removeEventListener('keydown', keyHandler); };
  const keyHandler = e => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  modalRoot.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', keyHandler);
  onReady?.(modalRoot.querySelector('.modal-body'), close);
}

function openProfileModal() {
  if (cloud.status === 'cloud' && cloud.user) {
    openModal('profil', `<div class="settings-card"><h3>${esc(member(currentUserId).name)}</h3><p>${esc(cloud.user.email || '')}</p></div><div class="form-actions"><button class="btn btn-secondary" id="closeProfile" type="button">kapat</button><button class="btn btn-danger" id="signOutProfile" type="button">çıkış yap</button></div>`, (root,close)=>{
      root.querySelector('#closeProfile').addEventListener('click',close);
      root.querySelector('#signOutProfile').addEventListener('click',async()=>{ close(); await cloud.api.signOut(cloud.auth); });
    });
    return;
  }
  openModal('profili değiştir', `<div class="member-picker">${MEMBERS.map(m=>`<button class="member-choice" type="button" data-switch="${m.id}">${avatarHTML(m.id,'md')}<span>${esc(m.name)}</span></button>`).join('')}<button class="member-choice" type="button" data-add-member><span class="avatar avatar-md">＋</span><span>kişi ekle</span></button></div>`, (root,close)=>{
    root.querySelectorAll('[data-switch]').forEach(btn=>btn.addEventListener('click',()=>{ chooseProfile(btn.dataset.switch); close(); }));
    root.querySelector('[data-add-member]')?.addEventListener('click',()=>{ close(); openAddMemberModal(); });
  });
}

function slugifyMemberName(name='') {
  return name
    .toLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kisi';
}

function createMemberId(name='') {
  const base = slugifyMemberName(name);
  let candidate = base;
  let i = 2;
  while (MEMBERS.some(m => m.id === candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

function openAddMemberModal() {
  openModal('kişi ekle', `
    <form id="memberForm" class="form-grid">
      <div class="field"><label for="memberName">adı</label><input class="input" id="memberName" maxlength="40" required placeholder="mesela: Hatice Nur"></div>
      <div id="memberError" class="inline-error hide"></div>
      <div class="form-actions"><button class="btn btn-secondary" type="button" id="cancelMember">vazgeç</button><button class="btn btn-primary" type="submit">ekle</button></div>
    </form>`, (root, close) => {
      const form = root.querySelector('#memberForm');
      const input = root.querySelector('#memberName');
      input?.focus();
      root.querySelector('#cancelMember')?.addEventListener('click', () => { close(); openProfileModal(); });
      form?.addEventListener('submit', e => {
        e.preventDefault();
        const name = input.value.trim().replace(/\s+/g, ' ');
        const error = root.querySelector('#memberError');
        if (!name) {
          error.textContent = 'bir isim yaz.';
          error.classList.remove('hide');
          return;
        }
        if (MEMBERS.some(m => m.name.toLowerCase('tr-TR') === name.toLowerCase('tr-TR'))) {
          error.textContent = 'bu kişi zaten var.';
          error.classList.remove('hide');
          return;
        }
        const newMember = { id: createMemberId(name), name };
        MEMBERS.push(newMember);
        persist();
        chooseProfile(newMember.id);
        close();
        showToast(`${name} eklendi`);
      });
    });
}

function openGroupModal(groupId=null) {
  const editing = groupId ? group(groupId) : null;
  const selected = new Set(editing?.memberIds || [currentUserId]);
  const accents = ['mint','lilac','yellow','coral','blue'];
  openModal(editing ? 'grubu düzenle' : 'yeni grup', `
    <form id="groupForm" class="form-grid">
      <div class="field"><label for="groupName">grup adı</label><input class="input" id="groupName" required maxlength="40" value="${esc(editing?.name || '')}" placeholder="mesela: Alaçatı kaçamağı"></div>
      <div class="field"><label for="groupEmoji">emoji</label><input class="input" id="groupEmoji" maxlength="8" value="${esc(editing?.emoji || '✨')}" placeholder="✨"></div>
      <div class="field"><span class="field-label">kimler var?</span><div class="chips" id="groupMembers">${MEMBERS.map(m=>`<button class="chip ${selected.has(m.id)?'selected':''}" data-member-id="${m.id}" type="button">${esc(m.name)}</button>`).join('')}</div></div>
      <div class="field"><span class="field-label">renk</span><div class="chips" id="accentPicker">${accents.map(a=>`<button type="button" class="chip ${a===(editing?.accent || 'mint')?'selected':''}" data-accent="${a}" style="background:var(--${a})">${a}</button>`).join('')}</div></div>
      <div id="groupError" class="inline-error hide"></div>
      <div class="form-actions">${editing ? `<button class="btn btn-danger" type="button" id="deleteGroup">sil</button>` : `<button class="btn btn-secondary" type="button" id="cancelGroup">vazgeç</button>`}<button class="btn btn-primary" type="submit">${editing?'kaydet':'grubu aç'}</button></div>
    </form>`, (root,close)=>{
      let accent = editing?.accent || 'mint';
      root.querySelectorAll('#groupMembers .chip').forEach(btn=>btn.addEventListener('click',()=>{ const id=btn.dataset.memberId; if(selected.has(id)) selected.delete(id); else selected.add(id); btn.classList.toggle('selected'); }));
      root.querySelectorAll('#accentPicker .chip').forEach(btn=>btn.addEventListener('click',()=>{ accent=btn.dataset.accent; root.querySelectorAll('#accentPicker .chip').forEach(x=>x.classList.toggle('selected',x===btn)); }));
      root.querySelector('#cancelGroup')?.addEventListener('click',close);
      root.querySelector('#deleteGroup')?.addEventListener('click',async()=>{
        const hasTx = state.expenses.some(e=>e.groupId===groupId) || state.settlements.some(s=>s.groupId===groupId);
        if (hasTx) return showInline(root,'groupError','Bu grupta hareket olduğu için yanlışlıkla veri kaybı olmasın diye silemezsin. Önce hareketleri sil.');
        if (!confirm(`${editing.name} grubunu silmek istiyor musun?`)) return;
        await removeEntity('groups', groupId); close(); navigate('groups'); showToast('grup silindi');
      });
      root.querySelector('#groupForm').addEventListener('submit',async e=>{
        e.preventDefault();
        const name = root.querySelector('#groupName').value.trim();
        const emoji = root.querySelector('#groupEmoji').value.trim() || '✦';
        if (!name) return showInline(root,'groupError','Grubun bir adı olmalı.');
        if (selected.size < 2) return showInline(root,'groupError','Bir harcama grubu için en az 2 kişi seç.');
        if (editing) {
          const usedMembers = new Set();
          state.expenses.filter(x=>x.groupId===groupId).forEach(x=>{ usedMembers.add(x.payerId); Object.keys(x.splits||{}).forEach(id=>usedMembers.add(id)); });
          state.settlements.filter(x=>x.groupId===groupId).forEach(x=>{ usedMembers.add(x.fromId); usedMembers.add(x.toId); });
          const missing = [...usedMembers].filter(id=>!selected.has(id));
          if (missing.length) return showInline(root,'groupError',`${missing.map(id=>member(id).name).join(', ')} eski hareketlerde yer aldığı için gruptan çıkarılamaz.`);
        }
        const obj = { id: editing?.id || uid('grp'), name, emoji, memberIds:[...selected], accent, createdAt: editing?.createdAt || new Date().toISOString() };
        await saveEntity('groups', obj); close(); showToast(editing?'grup güncellendi':'grup hazır ✦'); if(!editing) navigate('group',obj.id); else render();
      });
    });
}

function showInline(root,id,text){ const el=root.querySelector(`#${id}`); if(el){ el.textContent=text; el.classList.remove('hide'); } }

function openExpenseModal(expenseId=null, preselectedGroupId=null) {
  const editing = expenseId ? state.expenses.find(e=>e.id===expenseId) : null;
  if (expenseId && !editing) return;
  const initialGroup = group(editing?.groupId || preselectedGroupId) || state.groups[0];
  if (!initialGroup) { showToast('önce bir grup aç'); return openGroupModal(); }
  let selectedGroupId = initialGroup.id;
  let selectedParticipants = new Set(editing ? Object.keys(editing.splits || {}) : initialGroup.memberIds);
  let splitMode = editing?.splitMode || 'equal';
  let splitDraft = editing ? structuredClone(editing.splitValues || (editing.splitMode === 'percent' ? Object.fromEntries(Object.entries(editing.splits || {}).map(([id,v]) => [id, editing.amount ? cents(Number(v) / Number(editing.amount) * 100) : 0])) : (editing.splits || {}))) : {};

  openModal(editing ? 'harcamayı düzenle' : 'harcama ekle', `
    <form id="expenseForm" class="form-grid" data-testid="expense-form">
      <div class="field"><label for="expenseGroup">grup</label><select id="expenseGroup" class="input">${state.groups.map(g=>`<option value="${esc(g.id)}" ${g.id===selectedGroupId?'selected':''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="expenseTitle">ne aldınız?</label><input id="expenseTitle" class="input" required maxlength="80" value="${esc(editing?.title || '')}" placeholder="market, akşam yemeği, taksi..."></div>
      <div class="field"><label for="expenseAmount">toplam</label><div class="money-input"><input id="expenseAmount" class="input" inputmode="decimal" required value="${editing ? esc(editing.amount) : ''}" placeholder="0,00"></div></div>
      <div class="field"><label for="expenseDate">tarih</label><input id="expenseDate" class="input" type="date" required value="${esc(editing?.date || today())}"></div>
      <div class="field"><label for="expenseCategory">kategori</label><select id="expenseCategory" class="input">${Object.entries(CATEGORY).map(([id,c])=>`<option value="${id}" ${id===(editing?.category||'diger')?'selected':''}>${c.icon} ${esc(c.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="expensePayer">kim ödedi?</label><select id="expensePayer" class="input"></select></div>
      <div class="field"><span class="field-label">kimler paylaşıyor?</span><div class="chips" id="participantChips"></div></div>
      <div class="field"><span class="field-label">nasıl bölünsün?</span><div class="segmented" id="splitMode"><button type="button" data-mode="equal">eşit</button><button type="button" data-mode="exact">tutar</button><button type="button" data-mode="percent">yüzde</button></div><div id="splitEditor" class="split-editor"></div></div>
      <div class="field"><label for="expenseNote">not <span class="muted">(opsiyonel)</span></label><textarea id="expenseNote" class="input" maxlength="240" placeholder="fiş bende, Berfin sonra verecek...">${esc(editing?.note || '')}</textarea></div>
      <div id="expenseError" class="inline-error hide"></div>
      <div class="form-actions">${editing ? `<button class="btn btn-danger" id="deleteExpense" type="button">sil</button>` : `<button class="btn btn-secondary" id="cancelExpense" type="button">vazgeç</button>`}<button class="btn btn-primary" type="submit">${editing?'kaydet':'ekle'}</button></div>
    </form>`, (root,close)=>{
      const groupSelect = root.querySelector('#expenseGroup');
      const amountInput = root.querySelector('#expenseAmount');
      const payerSelect = root.querySelector('#expensePayer');
      const chips = root.querySelector('#participantChips');
      const splitEditor = root.querySelector('#splitEditor');
      const modeBox = root.querySelector('#splitMode');

      function renderPeople(reset=false) {
        const g = group(selectedGroupId);
        if (!g) return;
        if (reset) { selectedParticipants = new Set(g.memberIds); splitDraft = {}; }
        selectedParticipants = new Set([...selectedParticipants].filter(id=>g.memberIds.includes(id)));
        if (!selectedParticipants.size) selectedParticipants.add(g.memberIds[0]);
        payerSelect.innerHTML = g.memberIds.map(id=>`<option value="${id}">${esc(member(id).name)}</option>`).join('');
        payerSelect.value = g.memberIds.includes(editing?.payerId) && !reset ? editing.payerId : (g.memberIds.includes(currentUserId) ? currentUserId : g.memberIds[0]);
        chips.innerHTML = g.memberIds.map(id=>`<button type="button" class="chip ${selectedParticipants.has(id)?'selected':''}" data-participant="${id}">${esc(member(id).name)}</button>`).join('');
        chips.querySelectorAll('[data-participant]').forEach(btn=>btn.addEventListener('click',()=>{
          const id=btn.dataset.participant;
          if(selectedParticipants.has(id)) { if(selectedParticipants.size===1) return showToast('en az bir kişi paylaşmalı'); selectedParticipants.delete(id); }
          else selectedParticipants.add(id);
          btn.classList.toggle('selected'); renderSplitEditor();
        }));
        renderSplitEditor();
      }
      function equalPreview() {
        const amount=parseNumber(amountInput.value); const ids=[...selectedParticipants];
        if(!amount || !ids.length) return Object.fromEntries(ids.map(id=>[id,0]));
        return equalSplits(amount, ids);
      }
      function renderSplitEditor() {
        modeBox.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mode===splitMode));
        const ids=[...selectedParticipants];
        if(splitMode==='equal') {
          const preview=equalPreview();
          splitEditor.innerHTML=ids.map(id=>`<div class="split-row"><div class="split-member">${avatarHTML(id,'sm')} ${esc(member(id).name)}</div><strong style="text-align:right">${money(preview[id]||0)}</strong></div>`).join('');
          return;
        }
        const suffix = splitMode==='percent' ? '%' : '₺';
        splitEditor.innerHTML=ids.map(id=>`<div class="split-row"><div class="split-member">${avatarHTML(id,'sm')} ${esc(member(id).name)}</div><div class="split-input-wrap"><input class="input" inputmode="decimal" data-split-id="${id}" value="${esc(splitDraft[id] ?? '')}" placeholder="0"><span>${suffix}</span></div></div>`).join('');
        splitEditor.querySelectorAll('[data-split-id]').forEach(inp=>inp.addEventListener('input',()=>{ splitDraft[inp.dataset.splitId]=inp.value; }));
      }
      groupSelect.addEventListener('change',()=>{ selectedGroupId=groupSelect.value; renderPeople(true); });
      amountInput.addEventListener('input',()=>{ if(splitMode==='equal') renderSplitEditor(); });
      modeBox.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{ splitMode=btn.dataset.mode; splitDraft={}; renderSplitEditor(); }));
      root.querySelector('#cancelExpense')?.addEventListener('click',close);
      root.querySelector('#deleteExpense')?.addEventListener('click',async()=>{ if(!confirm('Bu harcamayı silmek istiyor musun?')) return; await removeEntity('expenses', editing.id); close(); showToast('harcama silindi'); render(); });
      renderPeople(false);
      if (editing) payerSelect.value = editing.payerId;

      root.querySelector('#expenseForm').addEventListener('submit',async e=>{
        e.preventDefault();
        const title=root.querySelector('#expenseTitle').value.trim();
        const amount=cents(parseNumber(amountInput.value));
        const date=root.querySelector('#expenseDate').value;
        const category=root.querySelector('#expenseCategory').value;
        const payerId=payerSelect.value;
        const note=root.querySelector('#expenseNote').value.trim();
        const ids=[...selectedParticipants];
        if(!title) return showInline(root,'expenseError','Harcamaya kısa bir isim ver.');
        if(amount<=0) return showInline(root,'expenseError','Tutar 0’dan büyük olmalı.');
        if(!date) return showInline(root,'expenseError','Bir tarih seç.');
        if(!ids.length) return showInline(root,'expenseError','En az bir kişi paylaşmalı.');
        let splits={};
        if(splitMode==='equal') splits=equalSplits(amount,ids);
        else if(splitMode==='exact') {
          splits=Object.fromEntries(ids.map(id=>[id,cents(parseNumber(splitDraft[id]))]));
          const sum=cents(Object.values(splits).reduce((a,b)=>a+b,0));
          if(Math.abs(sum-amount)>.009) return showInline(root,'expenseError',`Payların toplamı ${money(sum)}. Toplam harcama ${money(amount)} olmalı.`);
        } else {
          const percentages=Object.fromEntries(ids.map(id=>[id,parseNumber(splitDraft[id])]));
          const sum=Object.values(percentages).reduce((a,b)=>a+b,0);
          if(Math.abs(sum-100)>.01) return showInline(root,'expenseError',`Yüzdelerin toplamı ${sum.toFixed(2)}%. Tam 100% olmalı.`);
          splits=percentageSplits(amount,percentages,ids);
        }
        const splitValues = splitMode === 'equal' ? null : (splitMode === 'exact' ? structuredClone(splits) : Object.fromEntries(ids.map(id=>[id,parseNumber(splitDraft[id])])));
        const obj={ id:editing?.id||uid('exp'), groupId:selectedGroupId, title, amount, date, category, payerId, splits, splitMode, splitValues, note, createdAt:editing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString() };
        await saveEntity('expenses',obj); close(); showToast(editing?'harcama güncellendi':'harcama eklendi ✦'); render();
      });
    });
}

function equalSplits(amount, ids) {
  const totalCents=Math.round(amount*100); const base=Math.floor(totalCents/ids.length); let remainder=totalCents-base*ids.length;
  const out={}; ids.forEach((id,index)=>{ const c=base+(index<remainder?1:0); out[id]=c/100; }); return out;
}

function percentageSplits(amount, percentages, ids) {
  const totalCents=Math.round(amount*100); const raw=ids.map(id=>({id, exact: totalCents*(percentages[id]||0)/100}));
  const out={}; let used=0; raw.forEach(x=>{ const c=Math.floor(x.exact); out[x.id]=c/100; used+=c; });
  let remaining=totalCents-used;
  raw.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact)));
  for(let i=0;i<remaining;i++) out[raw[i%raw.length].id]=cents(out[raw[i%raw.length].id]+.01);
  return out;
}

function openSettlementModal(settlementId=null, preselectedGroupId=null) {
  const editing=settlementId ? state.settlements.find(s=>s.id===settlementId) : null;
  const initialGroup=group(editing?.groupId||preselectedGroupId)||state.groups[0];
  if(!initialGroup) return showToast('önce bir grup aç');
  openModal(editing?'ödemeyi düzenle':'ödeştik', `
    <form id="settleForm" class="form-grid">
      <div class="field"><label for="settleGroup">grup</label><select id="settleGroup" class="input">${state.groups.map(g=>`<option value="${esc(g.id)}" ${g.id===initialGroup.id?'selected':''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="settleFrom">kim ödedi?</label><select id="settleFrom" class="input"></select></div>
      <div class="field"><label for="settleTo">kime?</label><select id="settleTo" class="input"></select></div>
      <div class="field"><label for="settleAmount">tutar</label><div class="money-input"><input id="settleAmount" class="input" inputmode="decimal" required value="${editing?esc(editing.amount):''}" placeholder="0,00"></div></div>
      <div class="field"><label for="settleDate">tarih</label><input id="settleDate" type="date" class="input" required value="${esc(editing?.date||today())}"></div>
      <div class="field"><label for="settleNote">not <span class="muted">(opsiyonel)</span></label><input id="settleNote" class="input" maxlength="160" value="${esc(editing?.note||'')}"></div>
      <div id="settleSuggestion"></div><div id="settleError" class="inline-error hide"></div>
      <div class="form-actions"><button class="btn btn-secondary" type="button" id="cancelSettle">vazgeç</button><button class="btn btn-primary" type="submit">kaydet</button></div>
    </form>`, (root,close)=>{
      const groupSel=root.querySelector('#settleGroup'); const fromSel=root.querySelector('#settleFrom'); const toSel=root.querySelector('#settleTo'); const amount=root.querySelector('#settleAmount');
      function populate() {
        const g=group(groupSel.value); const opts=g.memberIds.map(id=>`<option value="${id}">${esc(member(id).name)}</option>`).join(''); fromSel.innerHTML=opts; toSel.innerHTML=opts;
        const debts=simplifyDebts(g.id);
        let suggested=debts.find(d=>d.fromId===currentUserId)||debts[0];
        if(editing){ fromSel.value=editing.fromId; toSel.value=editing.toId; }
        else if(suggested){ fromSel.value=suggested.fromId; toSel.value=suggested.toId; if(!amount.value) amount.value=suggested.amount; }
        else { fromSel.value=g.memberIds[0]; toSel.value=g.memberIds[1]||g.memberIds[0]; }
        renderSuggestion();
      }
      function renderSuggestion(){ const d=simplifyDebts(groupSel.value).find(x=>x.fromId===fromSel.value&&x.toId===toSel.value); root.querySelector('#settleSuggestion').innerHTML=d?`<span class="status cloud">önerilen kapanış: ${money(d.amount)}</span>`:''; }
      groupSel.addEventListener('change',populate); fromSel.addEventListener('change',renderSuggestion); toSel.addEventListener('change',renderSuggestion); root.querySelector('#cancelSettle').addEventListener('click',close); populate();
      root.querySelector('#settleForm').addEventListener('submit',async e=>{ e.preventDefault(); const amountValue=cents(parseNumber(amount.value)); if(fromSel.value===toSel.value) return showInline(root,'settleError','Kendine ödeme yapamazsın 🙂'); if(amountValue<=0) return showInline(root,'settleError','Tutar 0’dan büyük olmalı.'); const obj={id:editing?.id||uid('set'),groupId:groupSel.value,fromId:fromSel.value,toId:toSel.value,amount:amountValue,date:root.querySelector('#settleDate').value,note:root.querySelector('#settleNote').value.trim(),createdAt:editing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}; await saveEntity('settlements',obj); close(); showToast('ödeme kaydedildi ✓'); render(); });
    });
}

function openSettlementDetails(id) {
  const s=state.settlements.find(x=>x.id===id); if(!s)return;
  openModal('ödeme detayı', `<div class="form-grid"><div class="settings-card"><h3>${esc(member(s.fromId).name)} → ${esc(member(s.toId).name)}</h3><p>${esc(group(s.groupId)?.name||'')} · ${formatDate(s.date)}</p><div style="font-size:34px;font-weight:900">${money(s.amount)}</div>${s.note?`<p style="margin-top:12px">${esc(s.note)}</p>`:''}</div><div class="form-actions"><button class="btn btn-danger" type="button" id="deleteSettle">sil</button><button class="btn btn-primary" type="button" id="editSettle">düzenle</button></div></div>`,(root,close)=>{
    root.querySelector('#deleteSettle').addEventListener('click',async()=>{ if(!confirm('Bu ödemeyi silmek istiyor musun?'))return; await removeEntity('settlements',id); close(); showToast('ödeme silindi'); render(); });
    root.querySelector('#editSettle').addEventListener('click',()=>{ close(); openSettlementModal(id); });
  });
}

function copyGroupSummary(groupId) {
  const g=group(groupId); const debts=simplifyDebts(groupId); let text=`${g.emoji} ${g.name} — bhhn.\n`;
  text += debts.length ? debts.map(d=>`${member(d.fromId).name} → ${member(d.toId).name}: ${money(d.amount)}`).join('\n') : 'Hesaplar eşit ✓';
  navigator.clipboard?.writeText(text).then(()=>showToast('grup özeti kopyalandı')).catch(()=>showToast('kopyalama izni verilmedi'));
}

async function saveEntity(kind,obj) {
  const list=state[kind]; const idx=list.findIndex(x=>x.id===obj.id); if(idx>=0) list[idx]=obj; else list.push(obj); persist();
  if(cloud.status==='cloud' && cloud.api) {
    try { const {doc,setDoc,db}=cloud.api; await setDoc(doc(db,'workspaces',cloud.workspaceId,kind,obj.id),obj); }
    catch(err){ console.error(err); setCloudStatus('error'); showToast('bulut yazamadı; kayıt bu cihazda güvende'); }
  }
}

async function removeEntity(kind,id) {
  state[kind]=state[kind].filter(x=>x.id!==id); persist();
  if(cloud.status==='cloud' && cloud.api) {
    try { const {doc,deleteDoc,db}=cloud.api; await deleteDoc(doc(db,'workspaces',cloud.workspaceId,kind,id)); }
    catch(err){ console.error(err); setCloudStatus('error'); showToast('buluttan silinemedi; yerel kayıt güncellendi'); }
  }
}

function exportBackup() {
  const payload={app:'bhhn',exportedAt:new Date().toISOString(),data:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`bhhn-yedek-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); showToast('yedek hazır');
}

function importBackup(event) {
  const file=event.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=async()=>{ try{ const parsed=JSON.parse(reader.result); const data=parsed?.app==='bhhn'?parsed.data:parsed; const normalized=normalizeState(data); if(!Array.isArray(normalized.groups)||!Array.isArray(normalized.expenses)||!Array.isArray(normalized.settlements))throw new Error('format'); if(!confirm('Mevcut yerel verinin yerine bu yedeği yükleyeyim mi?'))return; state=normalized; persist(); if(cloud.status==='cloud') await uploadAllToCloud(); showToast('yedek yüklendi'); render(); }catch(err){showToast('bu dosya geçerli bir bhhn. yedeği değil');} }; reader.readAsText(file); event.target.value='';
}

function resetLocalData() {
  if(!confirm('Bu cihazdaki tüm bhhn. verilerini sıfırlamak istediğine emin misin?'))return; state=freshState(); persist(); showToast('yerel veriler sıfırlandı'); render();
}

function showToast(text) {
  const el=document.createElement('div'); el.className='toast'; el.textContent=text; toastRoot.appendChild(el); setTimeout(()=>el.remove(),2800);
}

function updateSyncUI() {
  syncButton.classList.remove('sync-local','sync-cloud','sync-error');
  if(cloud.status==='cloud'){ syncButton.classList.add('sync-cloud'); syncButton.textContent='☁'; syncButton.title='Canlı Firebase senkronizasyonu açık'; }
  else if(cloud.status==='error'){ syncButton.classList.add('sync-error'); syncButton.textContent='!'; syncButton.title='Bulut bağlantısı sorunlu; yerel mod çalışıyor'; }
  else { syncButton.classList.add('sync-local'); syncButton.textContent='☁︎'; syncButton.title='Yerel mod'; }
}

function setCloudStatus(status){ cloud.status=status; updateSyncUI(); if(route.name==='settings' && currentUserId) renderSettings(); }

async function initCloud() {
  const cfg=window.BHHN_FIREBASE_CONFIG;
  if(!cfg || !cfg.apiKey || !cfg.projectId) { bootLocal(); return; }
  try {
    const appMod=await import('https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js');
    const authMod=await import('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js');
    const fsMod=await import('https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js');
    const app=appMod.initializeApp(cfg); const auth=authMod.getAuth(app); const db=fsMod.getFirestore(app);
    cloud.api={...fsMod,...authMod,db}; cloud.auth=auth; cloud.enabled=true;
    authMod.onAuthStateChanged(auth, async user=>{
      clearCloudListeners(); cloud.user=user || null;
      if(!user){ cloud.workspaceId=null; cloud.workspace=null; setCloudStatus('local'); bootLocal(); return; }
      await showWorkspaceGate(user);
    });
  } catch(err) { console.error('Firebase init failed',err); cloud.enabled=false; setCloudStatus('error'); bootLocal(); showToast('bulut açılamadı, yerel mod çalışıyor'); }
}
function bootLocal(){ cloud.status='local'; state=loadState(); MEMBERS=normalizeMembers(state.members || DEFAULT_MEMBERS); renderMemberPicker(); if(currentUserId && MEMBERS.some(m=>m.id===currentUserId)){onboarding.hidden=true;appShell.hidden=false;render();}else{onboarding.hidden=false;appShell.hidden=true;} }
function openCloudLoginModal(){
  pendingCloudMigration={state:structuredClone(state),userId:currentUserId};
  const selectedProfileName=member(currentUserId).name;
  openModal('senkronizasyonu aç', `<form id="cloudAuthForm" class="form-grid"><p class="muted">Mevcut grupların ve borçların korunacak. Aynı e-posta ve şifreyle telefonda da giriş yapacaksın.</p><div class="field"><label for="cloudEmail">e-posta</label><input class="input" id="cloudEmail" type="email" autocomplete="email" required></div><div class="field"><label for="cloudPassword">şifre</label><input class="input" id="cloudPassword" type="password" minlength="6" autocomplete="current-password" required></div><div id="cloudAuthError" class="inline-error hide"></div><div class="form-actions"><button class="btn btn-secondary" id="cloudLogin" type="button">giriş yap</button><button class="btn btn-primary" type="submit">ilk kez hesap aç</button></div></form>`,(root,close)=>{
    const email=()=>root.querySelector('#cloudEmail').value.trim();
    const password=()=>root.querySelector('#cloudPassword').value;
    const showError=e=>{const el=root.querySelector('#cloudAuthError');el.textContent=friendlyAuthError(e);el.classList.remove('hide');};
    root.querySelector('#cloudAuthForm').addEventListener('submit',async e=>{e.preventDefault();try{const cred=await cloud.api.createUserWithEmailAndPassword(cloud.auth,email(),password());await cloud.api.updateProfile(cred.user,{displayName:selectedProfileName});close();}catch(err){showError(err);}});
    root.querySelector('#cloudLogin').addEventListener('click',async()=>{try{await cloud.api.signInWithEmailAndPassword(cloud.auth,email(),password());close();}catch(err){showError(err);}});
  });
}
function authGateHTML(){ return `<img src="assets/bhhn-logo.png" alt="bhhn. dört arkadaş logosu" class="onboarding-logo" /><div class="onboarding-card auth-card"><p class="eyebrow">balance between us</p><h1>hesabına gir ✦</h1><p class="muted">kendi grupların, kendi arkadaşların. herkes sadece dahil olduğu alanı görür.</p><button class="btn btn-google" id="googleLogin" type="button">G ile devam et</button><div class="auth-divider"><span>veya</span></div><form id="emailAuth" class="form-grid"><div class="field"><label for="authName">adın <span class="muted">(ilk kayıt için)</span></label><input class="input" id="authName" maxlength="40" autocomplete="name" placeholder="Nisu"></div><div class="field"><label for="authEmail">e-posta</label><input class="input" id="authEmail" type="email" autocomplete="email" required placeholder="sen@ornek.com"></div><div class="field"><label for="authPassword">şifre</label><input class="input" id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="en az 6 karakter"></div><div id="authError" class="inline-error hide"></div><div class="auth-actions"><button class="btn btn-secondary" id="emailLogin" type="button">giriş yap</button><button class="btn btn-primary" type="submit">hesap aç</button></div></form><button class="text-button auth-demo" id="localDemo" type="button">sadece bu cihazda dene</button></div>`; }
function showAuthGate(){ appShell.hidden=true;onboarding.hidden=false;onboarding.innerHTML=authGateHTML(); const {GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,signInWithEmailAndPassword,updateProfile}=cloud.api; onboarding.querySelector('#googleLogin').addEventListener('click',async()=>{try{await signInWithPopup(cloud.auth,new GoogleAuthProvider());}catch(e){showAuthError(friendlyAuthError(e));}}); onboarding.querySelector('#emailAuth').addEventListener('submit',async e=>{e.preventDefault();const name=onboarding.querySelector('#authName').value.trim();const email=onboarding.querySelector('#authEmail').value.trim();const pass=onboarding.querySelector('#authPassword').value;if(!name)return showAuthError('ilk kayıt için adını yaz.');try{const cred=await createUserWithEmailAndPassword(cloud.auth,email,pass);await updateProfile(cred.user,{displayName:name});}catch(e){showAuthError(friendlyAuthError(e));}}); onboarding.querySelector('#emailLogin').addEventListener('click',async()=>{const email=onboarding.querySelector('#authEmail').value.trim();const pass=onboarding.querySelector('#authPassword').value;try{await signInWithEmailAndPassword(cloud.auth,email,pass);}catch(e){showAuthError(friendlyAuthError(e));}}); onboarding.querySelector('#localDemo').addEventListener('click',()=>{cloud.enabled=false;bootLocal();}); }
function showAuthError(text){const el=onboarding.querySelector('#authError');if(el){el.textContent=text;el.classList.remove('hide');}}
function friendlyAuthError(e){const c=e?.code||'';if(c.includes('email-already-in-use'))return 'bu e-posta zaten kayıtlı. giriş yap.';if(c.includes('invalid-credential'))return 'e-posta veya şifre hatalı.';if(c.includes('weak-password'))return 'şifre en az 6 karakter olmalı.';if(c.includes('invalid-email'))return 'e-posta adresini kontrol et.';if(c.includes('operation-not-allowed'))return 'Firebase giriş yöntemi açık değil.';if(c.includes('unauthorized-domain'))return 'bu web adresi Firebase yetkili alanlarına eklenmemiş.';if(c.includes('network-request-failed'))return 'Firebase bağlantısı kurulamadı; interneti kontrol et.';if(c.includes('popup-closed'))return 'giriş penceresi kapatıldı.';return `giriş yapılamadı${c?` (${c})`:''}.`;}
async function showWorkspaceGate(user){const {db,collection,query,where,getDocs}=cloud.api;currentUserId=user.uid;try{const snap=await getDocs(query(collection(db,'workspaces'),where('memberUids','array-contains',user.uid)));const spaces=snap.docs.map(d=>({id:d.id,...d.data()}));if(spaces.length===1)return loadWorkspace(spaces[0].id);renderWorkspacePicker(spaces);}catch(e){console.error(e);showAuthGate();showAuthError('alanlar yüklenemedi. Firestore kurallarını kontrol et.');}}
function renderWorkspacePicker(spaces){appShell.hidden=true;onboarding.hidden=false;onboarding.innerHTML=`<img src="assets/bhhn-logo.png" alt="bhhn. dört arkadaş logosu" class="onboarding-logo" /><div class="onboarding-card auth-card"><p class="eyebrow">ortak alanların</p><h1>${spaces.length?'hangisine girelim?':'ilk alanını aç ✦'}</h1><p class="muted">bir alanın içinde istediğin kadar harcama grubu açabilirsin.</p><div class="workspace-list">${spaces.map(w=>`<button class="member-choice workspace-choice" data-space="${esc(w.id)}" type="button"><span class="workspace-badge">${esc((w.name||'B').slice(0,1).toUpperCase())}</span><span><strong>${esc(w.name||'ortak alan')}</strong><small>${(w.memberUids||[]).length} kişi</small></span></button>`).join('')}</div><form id="createWorkspace" class="mini-form"><input class="input" id="workspaceName" maxlength="40" placeholder="mesela: bhhn. ✦" required><button class="btn btn-primary" type="submit">alan oluştur</button></form><form id="joinWorkspace" class="mini-form"><input class="input invite-input" id="inviteCode" maxlength="8" placeholder="DAVET KODU" required><button class="btn btn-secondary" type="submit">koda katıl</button></form><button class="text-button" id="logoutGate" type="button">çıkış yap</button><div id="workspaceError" class="inline-error hide"></div></div>`;onboarding.querySelectorAll('[data-space]').forEach(b=>b.addEventListener('click',()=>loadWorkspace(b.dataset.space)));onboarding.querySelector('#createWorkspace').addEventListener('submit',async e=>{e.preventDefault();await createWorkspace(onboarding.querySelector('#workspaceName').value.trim());});onboarding.querySelector('#joinWorkspace').addEventListener('submit',async e=>{e.preventDefault();await joinWorkspace(onboarding.querySelector('#inviteCode').value.trim().toUpperCase());});onboarding.querySelector('#logoutGate').addEventListener('click',()=>cloud.api.signOut(cloud.auth));}
function workspaceError(t){const e=onboarding.querySelector('#workspaceError');if(e){e.textContent=t;e.classList.remove('hide');}}
function randomInvite(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);return Array.from(bytes,b=>chars[b%chars.length]).join('');}
function cloudProfile(u){return {id:u.uid,name:u.displayName||u.email?.split('@')[0]||'Kullanıcı'};}
async function createWorkspace(name){
  if(!name)return;
  const {db,doc,writeBatch}=cloud.api;
  const id=uid('space'),u=cloud.user,profile=cloudProfile(u);
  for(let attempt=0;attempt<6;attempt++){
    const code=randomInvite();
    const data={name,ownerUid:u.uid,memberUids:[u.uid],profiles:{[u.uid]:profile},inviteCode:code,createdAt:new Date().toISOString()};
    try{
      const batch=writeBatch(db);
      batch.set(doc(db,'workspaces',id),data);
      batch.set(doc(db,'workspaceInvites',code),{workspaceId:id,ownerUid:u.uid,createdAt:data.createdAt});
      await batch.commit();
      await loadWorkspace(id);
      if(pendingCloudMigration) await migrateLocalSnapshotToCloud(pendingCloudMigration);
      return;
    }catch(e){
      console.error('workspace create attempt failed',e);
      if(attempt===5)workspaceError('alan oluşturulamadı. Firestore kurallarını ve bağlantıyı kontrol et.');
    }
  }
}
function remapMemberIdInSnapshot(snapshot,fromId,toId){
  const out=structuredClone(snapshot),mapId=id=>id===fromId?toId:id;
  out.members=(out.members||[]).map(m=>m.id===fromId?{...m,id:toId}:m).filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i);
  out.groups=(out.groups||[]).map(g=>({...g,memberIds:[...new Set((g.memberIds||[]).map(mapId))]}));
  out.expenses=(out.expenses||[]).map(e=>({...e,payerId:mapId(e.payerId),splits:Object.fromEntries(Object.entries(e.splits||{}).map(([id,value])=>[mapId(id),value]))}));
  out.settlements=(out.settlements||[]).map(s=>({...s,fromId:mapId(s.fromId),toId:mapId(s.toId)}));
  return out;
}
async function migrateLocalSnapshotToCloud(migration){
  const oldId=migration.userId,newId=cloud.user?.uid;
  if(!oldId||!newId||!cloud.workspaceId)return;
  try{
    const migrated=remapMemberIdInSnapshot(migration.state,oldId,newId);
    const profiles=Object.fromEntries((migrated.members||[]).map(m=>[m.id,m]));
    await cloud.api.updateDoc(cloud.api.doc(cloud.api.db,'workspaces',cloud.workspaceId),{profiles});
    state=normalizeState(migrated);MEMBERS=normalizeMembers(state.members);currentUserId=newId;persist();
    await uploadAllToCloud();pendingCloudMigration=null;showToast('eski grupların buluta taşındı ✓');render();
  }catch(err){console.error(err);showToast('gruplar cihazda güvende; buluta aktarma tamamlanamadı');}
}
async function joinWorkspace(code){
  if(!code)return workspaceError('davet kodunu yaz.');
  const clean=code.replace(/\s/g,'').toUpperCase();
  const {db,doc,getDoc,updateDoc,arrayUnion}=cloud.api;
  try{
    const inviteSnap=await getDoc(doc(db,'workspaceInvites',clean));
    if(!inviteSnap.exists())return workspaceError('bu davet kodu geçersiz ya da artık aktif değil.');
    const workspaceId=inviteSnap.data().workspaceId,u=cloud.user,profile=cloudProfile(u);
    await updateDoc(doc(db,'workspaces',workspaceId),{memberUids:arrayUnion(u.uid),[`profiles.${u.uid}`]:profile});
    await loadWorkspace(workspaceId);
  }catch(e){
    console.error(e);
    if(e?.code==='permission-denied'){
      try{await loadWorkspace((await getDoc(doc(db,'workspaceInvites',clean))).data()?.workspaceId);return;}catch{}
    }
    workspaceError('alana katılınamadı. kodu, bağlantıyı ve Firestore kurallarını kontrol et.');
  }
}
async function loadWorkspace(workspaceId){
  clearCloudListeners();
  const {db,doc,getDoc,collection,getDocs,onSnapshot}=cloud.api;
  // Önce bu alana ait cihaz önbelleğini kullan; ağdan gelen veri hemen üzerine yazılır.
  const cached=loadState(workspaceId);
  if(cached){state=cached;MEMBERS=normalizeMembers(cached.members||[]);}
  try{
    const wref=doc(db,'workspaces',workspaceId),wsnap=await getDoc(wref);
    if(!wsnap.exists())throw new Error('workspace missing');
    cloud.workspaceId=workspaceId;cloud.workspace={id:workspaceId,...wsnap.data()};
    MEMBERS=normalizeMembers(Object.values(cloud.workspace.profiles||{}));
    if(!MEMBERS.some(m=>m.id===currentUserId))throw new Error('not a member');
    state={version:3,members:structuredClone(MEMBERS),groups:[],expenses:[],settlements:[]};
    for(const kind of ['groups','expenses','settlements']){const snap=await getDocs(collection(db,'workspaces',workspaceId,kind));state[kind]=snap.docs.map(d=>d.data());}
    persist();onboarding.hidden=true;appShell.hidden=false;setCloudStatus('cloud');render();
    cloud.unsubscribers.push(onSnapshot(wref,snap=>{if(!snap.exists())return;cloud.workspace={id:workspaceId,...snap.data()};MEMBERS=normalizeMembers(Object.values(cloud.workspace.profiles||{}));state.members=structuredClone(MEMBERS);persist();render();},e=>{console.error(e);setCloudStatus('error');}));
    for(const kind of ['groups','expenses','settlements'])cloud.unsubscribers.push(onSnapshot(collection(db,'workspaces',workspaceId,kind),snap=>{state[kind]=snap.docs.map(d=>d.data());persist();render();},e=>{console.error(e);setCloudStatus('error');}));
  }catch(e){console.error(e);setCloudStatus('error');await showWorkspaceGate(cloud.user);}
}
function clearCloudListeners(){cloud.unsubscribers.forEach(fn=>{try{fn?.()}catch{}});cloud.unsubscribers=[];}
async function uploadAllToCloud(){if(!cloud.api||!cloud.workspaceId)return;const {db,doc,setDoc,collection,getDocs,deleteDoc}=cloud.api;for(const kind of ['groups','expenses','settlements']){const snap=await getDocs(collection(db,'workspaces',cloud.workspaceId,kind));await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));await Promise.all(state[kind].map(obj=>setDoc(doc(db,'workspaces',cloud.workspaceId,kind,obj.id),obj)));}}
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.route)));
document.getElementById('profileButton').addEventListener('click',openProfileModal);
fab.addEventListener('click',()=>openExpenseModal(null,route.name==='group'?route.id:null));
syncButton.addEventListener('click',()=>{ if(cloud.status==='cloud')showToast('4 cihaz için canlı senkronizasyon açık'); else if(cloud.status==='error')showToast('bulut bağlantısı yok; yerel kayıtlar çalışıyor'); else showToast('yerel mod: Firebase eklenince dört cihaz anlık eşitlenir'); });
window.addEventListener('hashchange',render);
window.addEventListener('beforeunload',()=>cloud.unsubscribers.forEach(fn=>fn?.()));

if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
initCloud();
