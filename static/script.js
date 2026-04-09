'use strict';

/* ── State ───────────────────────────────────────── */
let storedJwt    = null;
let storedUid    = null;
let storedName   = null;
let storedRegion = null;
let storedOpenId = null;
let storedMethod = null;
let isAuthed     = false;

let selStart = 0;
let selEnd   = 0;

/* ── Textarea cursor ─────────────────────────────── */
const bioInput = document.getElementById('bioInput');
['keyup','mouseup','focus','click'].forEach(ev =>
  bioInput.addEventListener(ev, () => {
    selStart = bioInput.selectionStart;
    selEnd   = bioInput.selectionEnd;
  })
);

/* ── Insert format code ──────────────────────────── */
function insertCode(code) {
  bioInput.focus();
  const val      = bioInput.value;
  const selected = val.substring(selStart, selEnd);

  if (selected.length) {
    bioInput.value = val.slice(0, selStart) + code + selected + val.slice(selEnd);
    bioInput.selectionStart = selStart + code.length;
    bioInput.selectionEnd   = selStart + code.length + selected.length;
  } else {
    bioInput.value = val.slice(0, selStart) + code + val.slice(selEnd);
    bioInput.selectionStart = bioInput.selectionEnd = selStart + code.length;
  }
  selStart = bioInput.selectionStart;
  selEnd   = bioInput.selectionEnd;
  onBioInput();
}

/* ── Bio input handler ───────────────────────────── */
function onBioInput() {
  updatePreview();
  document.getElementById('charCount').textContent = bioInput.value.length;
}

/* ── Parse FF format codes ───────────────────────── */
function parseFF(text) {
  if (!text.trim()) return '<span class="ph-text">Type your bio to see preview...</span>';

  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const HEX = /^[0-9A-Fa-f]{6}$/;
  let result = '', i = 0, openTags = [];

  const closeAll = () => { while(openTags.length) result += openTags.pop(); };

  while (i < escaped.length) {
    if (escaped[i] === '[') {
      const close = escaped.indexOf(']', i);
      if (close !== -1) {
        const code = escaped.slice(i + 1, close);
        if (code === 'B')  { result += '<b>'; openTags.push('</b>'); i = close+1; continue; }
        if (code === 'C')  { result += '<mark style="background:rgba(255,255,0,.3);color:inherit;padding:0 2px;border-radius:2px;">'; openTags.push('</mark>'); i = close+1; continue; }
        if (HEX.test(code)) {
          if (openTags.includes('</span>')) {
            while(openTags.length) { const t=openTags.pop(); result+=t; if(t==='</span>') break; }
          }
          result += `<span style="color:#${code}">`;
          openTags.push('</span>');
          i = close+1; continue;
        }
      }
    }
    if (escaped[i] === '\n') { result += '<br>'; i++; continue; }
    result += escaped[i++];
  }
  closeAll();
  return result || '<span class="ph-text">Type your bio to see preview...</span>';
}

/* ── Update preview ──────────────────────────────── */
function updatePreview() {
  document.getElementById('bioPreview').innerHTML = parseFF(bioInput.value);
  if (isAuthed) {
    document.getElementById('previewName').textContent = storedName || 'PLAYER';
    document.getElementById('previewUID').textContent  = storedUid  || '———';
  }
}

/* ── Clear bio ───────────────────────────────────── */
function clearBio() {
  bioInput.value = '';
  selStart = selEnd = 0;
  onBioInput();
  bioInput.focus();
}

/* ── Copy bio ────────────────────────────────────── */
function copyBio() {
  if (!bioInput.value.trim()) return;
  navigator.clipboard.writeText(bioInput.value).catch(() => {
    bioInput.select(); document.execCommand('copy');
  });
  const fb = document.getElementById('copyFeedback');
  fb.classList.remove('hidden');
  setTimeout(() => fb.classList.add('hidden'), 2500);
}

/* ── Auth tab switch ─────────────────────────────── */
function switchAuthTab(name) {
  document.querySelectorAll('.atab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
  document.getElementById('atab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
}

/* ── Read credentials from UI ────────────────────── */
function readCreds() {
  const tab = document.querySelector('.atab.active')?.dataset.tab || 'jwt';
  const params = {};
  if (tab === 'jwt')     { params.jwt          = document.getElementById('inp-jwt').value.trim(); }
  if (tab === 'uidpass') { params.uid           = document.getElementById('inp-uid').value.trim();
                           params.pass          = document.getElementById('inp-pass').value.trim(); }
  if (tab === 'token')   { params.access_token  = document.getElementById('inp-token').value.trim(); }
  return params;
}

/* ── Authorise ───────────────────────────────────── */
async function doAuthorise() {
  const creds = readCreds();
  if (!Object.values(creds).some(v => v)) {
    showAuthError('Enter credentials first.'); return;
  }

  setAuthLoading(true);
  hidePlayerCard();
  setDot('idle');

  try {
    const qs  = new URLSearchParams(creds);
    const res = await fetch('/authorise?' + qs);
    const data = await res.json();
    setAuthLoading(false);

    if (data.code === 200) {
      storedJwt    = data.jwt;
      storedUid    = data.uid;
      storedName   = data.name;
      storedRegion = data.region;
      storedOpenId = data.open_id;
      storedMethod = data.login_method;
      isAuthed     = true;
      showPlayerCard(data);
      setDot('ok');
    } else {
      isAuthed = false;
      showAuthError(data.reason || data.status);
      setDot('error');
    }
  } catch (e) {
    setAuthLoading(false);
    showAuthError('Network error: ' + e.message);
    setDot('error');
  }
}

function setAuthLoading(on) {
  document.getElementById('authLoader').classList.toggle('hidden', !on);
  document.getElementById('authBtn').disabled = on;
}

function setDot(state) {
  const d = document.getElementById('authStatusDot');
  d.className = 'status-dot ' + state;
}

function showAuthError(msg) {
  const p = document.getElementById('playerCard');
  p.classList.remove('hidden');
  p.innerHTML = `<div style="color:var(--red);font-size:13px;padding:6px 0;">❌ ${msg || 'Authorisation failed'}</div>`;
}

function hidePlayerCard() {
  document.getElementById('playerCard').classList.add('hidden');
}

function resetAuth() {
  isAuthed = false;
  storedJwt = storedUid = storedName = storedRegion = storedOpenId = storedMethod = null;
  hidePlayerCard();
  setDot('idle');
  document.getElementById('previewName').textContent = 'SULAV';
  document.getElementById('previewUID').textContent  = '———';
  document.getElementById('outputPanel').classList.add('hidden');
}

function showPlayerCard(data) {
  const pc = document.getElementById('playerCard');
  pc.classList.remove('hidden');

  const name = data.name || 'Unknown';
  const initial = (name[0] || '?').toUpperCase();

  pc.innerHTML = `
    <div class="player-card-head">
      <div class="player-avatar"><span>${initial}</span></div>
      <div class="player-info">
        <div class="player-name">${name}</div>
        <div class="player-meta-row">
          <span class="meta-chip uid-chip">UID <span>${data.uid || '—'}</span></span>
          <span class="meta-chip region-chip">🌏 <span>${data.region || '—'}</span></span>
        </div>
      </div>
      <div class="player-status-badge active">✅ ACTIVE</div>
    </div>
    <div class="player-details-row">
      <div class="detail-item">
        <div class="detail-lbl">Login Method</div>
        <div class="detail-val">${data.login_method || '—'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">Open ID</div>
        <div class="detail-val mono">${data.open_id || '—'}</div>
      </div>
    </div>
    <button class="btn-reauth" onclick="resetAuth()">🔄 Re-Authorise</button>
  `;

  document.getElementById('previewName').textContent = name;
  document.getElementById('previewUID').textContent  = data.uid || '———';
}

/* ── Change Bio ──────────────────────────────────── */
async function doChangeBio() {
  const bio = bioInput.value.trim();
  if (!bio) { alert('Please enter a bio first.'); return; }

  if (!isAuthed || !storedJwt) {
    alert('Please Authorise your account first (Step 1).'); return;
  }

  setBioLoading(true);
  document.getElementById('outputPanel').classList.add('hidden');

  const params = new URLSearchParams({ bio, jwt: storedJwt });

  try {
    const res  = await fetch('/bio_upload?' + params);
    const data = await res.json();
    setBioLoading(false);
    showOutput(data);
  } catch (e) {
    setBioLoading(false);
    showOutput({ status: '❌ Network Error', code: 0, reason: e.message });
  }
}

function setBioLoading(on) {
  document.getElementById('bioLoader').classList.toggle('hidden', !on);
  document.getElementById('changeBioBtn').disabled = on;
}

function showOutput(data) {
  const panel = document.getElementById('outputPanel');
  const isOk  = (data.code === 200) || (typeof data.status === 'string' && data.status.includes('✅'));

  document.getElementById('outputStatusIcon').textContent = isOk ? '✅' : '❌';
  document.getElementById('outputStatusText').textContent = isOk ? 'Bio Changed Successfully' : 'Upload Failed';
  document.getElementById('outputStatusText').style.color = isOk ? 'var(--green)' : 'var(--red)';

  set('out-status',  data.status  || '—');
  set('out-code',    String(data.code ?? '—'));
  set('out-name',    data.name    || storedName   || '—');
  set('out-uid',     data.uid     || storedUid    || '—');
  set('out-region',  data.region  || storedRegion || '—');
  set('out-bio',     data.bio     || bioInput.value || '—');
  set('out-method',  data.login_method || storedMethod || '—');
  set('out-openid',  data.open_id || storedOpenId || '—');
  set('out-server',  data.server_response || data.reason || '—');

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Init ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  onBioInput();
});
