// ============================================================
// Admin panel — commits directly to GitHub via REST API.
// After a save, Netlify auto-rebuilds and EVERYONE sees it.
// ============================================================
const $ = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
const esc = t=>{const d=document.createElement('div');d.textContent=t||'';return d.innerHTML;};
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const fmtDate = iso=>{if(!iso)return'-';const d=new Date(iso);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};

// ---- session ----
function getSession(){try{return JSON.parse(localStorage.getItem('fp_gh_session'))}catch(e){return null}}
function requireAuth(){
  const s=getSession();
  if(!s||!s.token){location.href='login.html';return false}
  return true;
}

// ---- state ----
let STATE = { projects: [], settings: {}, sha: null, editingId: null, imageData: null };

// ---- GitHub API ----
function cfg(){ return (typeof GITHUB_CONFIG!=='undefined')?GITHUB_CONFIG:null; }
function apiUrl(path){ const c=cfg(); return `${c.apiBase}/repos/${c.owner}/${c.repo}/contents/${path}`; }

function ghHeaders(){
  const s=getSession();
  return { 'Authorization':'token '+s.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' };
}
function b64encode(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str){ return decodeURIComponent(escape(atob(str.replace(/\n/g,'')))); }

async function ghGetFile(path){
  const c=cfg();
  const res=await fetch(apiUrl(path)+`?ref=${c.branch}`,{headers:ghHeaders()});
  if(res.status===404)return{content:null,sha:null};
  if(!res.ok){const e=await res.text();throw new Error('GET '+path+' failed: '+res.status+' '+e)}
  const j=await res.json();
  return { content: JSON.parse(b64decode(j.content)), sha: j.sha };
}

async function ghPutFile(path, obj, message, sha){
  const c=cfg();
  const body={ message, content:b64encode(JSON.stringify(obj,null,2)), branch:c.branch };
  if(sha)body.sha=sha;
  const res=await fetch(apiUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!res.ok){const e=await res.text();throw new Error('PUT '+path+' failed: '+res.status+' '+e)}
  return res.json();
}

async function ghPutBinary(path, base64Content, message, sha){
  const c=cfg();
  const body={ message, content:base64Content, branch:c.branch };
  if(sha)body.sha=sha;
  const res=await fetch(apiUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!res.ok){const e=await res.text();throw new Error('Upload '+path+' failed: '+res.status+' '+e)}
  return res.json();
}

// ---- toast ----
function toast(msg,type='success'){
  const c=$('#toastContainer');const t=document.createElement('div');
  t.className='admin-toast admin-toast-'+type;t.textContent=msg;c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(100%)';setTimeout(()=>t.remove(),300)},4000);
}
function setBusy(b){ document.body.style.cursor=b?'progress':'default'; $$('.admin-btn').forEach(x=>x.disabled=b); }

// ---- load data from GitHub ----
async function loadData(){
  setBusy(true);
  try{
    const file=await ghGetFile(cfg().dataPath);
    if(file.content){ STATE.projects=file.content.projects||[]; STATE.settings=file.content.settings||{}; STATE.sha=file.sha; }
    else { STATE.projects=[]; STATE.settings={}; STATE.sha=null; }
    toast('Data loaded from GitHub');
  }catch(e){ console.error(e); toast('Load failed: '+e.message,'error'); }
  setBusy(false);
}

async function saveData(message){
  setBusy(true);
  try{
    const obj={ projects:STATE.projects, settings:STATE.settings };
    const r=await ghPutFile(cfg().dataPath, obj, message, STATE.sha);
    STATE.sha=r.content.sha;
    toast('Saved! Netlify will rebuild in ~30s');
  }catch(e){ console.error(e); toast('Save failed: '+e.message,'error'); }
  setBusy(false);
}

// ---- render dashboard ----
function refreshStats(){
  $('#statTotal').textContent=STATE.projects.length;
  $('#statLive').textContent=STATE.projects.filter(p=>p.status==='live').length;
  $('#statWip').textContent=STATE.projects.filter(p=>p.status==='wip').length;
  $('#statImg').textContent=STATE.projects.filter(p=>p.thumbnail).length;

  const rp=$('#recentProjects');
  const recent=STATE.projects.slice(0,5);
  rp.innerHTML = recent.length
    ? '<table class="admin-table"><thead><tr><th>Title</th><th>Category</th><th>Status</th></tr></thead><tbody>'+
      recent.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(p.category)}</td><td><span class="admin-badge admin-badge-${p.status}">${p.status}</span></td></tr>`).join('')+
      '</tbody></table>'
    : '<div class="admin-empty-state">Kono project nai. Add koro!</div>';
}

// ---- render projects table ----
function refreshTable(){
  const tbody=$('#projectsTableBody'), empty=$('#projectsEmpty');
  const q=($('#adminProjectSearch')?.value||'').toLowerCase();
  let list=STATE.projects;
  if(q)list=list.filter(p=>(p.title||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q)));
  if(!list.length){tbody.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';
  tbody.innerHTML=list.map(p=>{
    const th=p.thumbnail
      ? `<img src="${esc(p.thumbnail)}" style="width:60px;height:40px;object-fit:cover;border-radius:4px">`
      : `<div style="width:60px;height:40px;background:#1c1813;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#5a544c;font-size:.65rem">none</div>`;
    const tags=(p.tags||[]).slice(0,3).map(t=>`<span class="admin-badge" style="background:rgba(255,178,56,.08);color:#b87a1a;border:1px solid rgba(255,178,56,.15)">${esc(t)}</span>`).join(' ');
    return `<tr><td>${th}</td><td>${esc(p.title)}</td><td>${esc(p.category)}</td>
      <td><span class="admin-badge admin-badge-${p.status||'wip'}">${p.status||'wip'}</span></td>
      <td>${tags}</td>
      <td><div class="admin-actions">
        <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="editProject('${p.id}')">Edit</button>
        <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deleteProject('${p.id}')">Del</button>
      </div></td></tr>`;
  }).join('');
}

// ---- modal ----
function openModal(edit){
  STATE.editingId=edit?edit.id:null; STATE.imageData=null;
  $('#modalTitle').textContent=edit?'Edit Project':'Add Project';
  $('#projectForm').reset();
  if(edit){
    $('#projectTitle').value=edit.title||'';
    $('#projectCategory').value=edit.category||'Web App';
    $('#projectDesc').value=edit.description||'';
    $('#projectStatus').value=edit.status||'wip';
    $('#projectUrl').value=edit.url||'';
    $('#projectFile').value=edit.filename||'';
    $('#projectTags').value=(edit.tags||[]).join(', ');
    if(edit.thumbnail)setImgPreview(edit.thumbnail); else clearImgPreview();
  } else clearImgPreview();
  $('#projectModal').classList.add('show');
}
function closeModal(){ $('#projectModal').classList.remove('show'); STATE.editingId=null; STATE.imageData=null; }
function clearImgPreview(){ const p=$('#imagePreview'); p.className='img-preview-placeholder'; p.textContent='No image selected'; }
function setImgPreview(src){ const p=$('#imagePreview'); p.className='img-preview'; p.innerHTML=`<img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`; }

// ---- image upload to repo ----
$('#projectImage')?.addEventListener('change',function(){
  const f=this.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=e=>{ STATE.imageData=e.target.result.split(',')[1]; setImgPreview(e.target.result); };
  r.readAsDataURL(f);
});

async function uploadImage(ext){
  // returns the repo path of the uploaded image
  const filename=`images/uploads/${uid()}.${ext}`;
  const okExt = ext||'png';
  await ghPutBinary(filename, STATE.imageData, 'Upload image '+filename, null);
  return filename;
}

// ---- save project ----
$('#saveProject')?.addEventListener('click',async()=>{
  const title=$('#projectTitle').value.trim();
  const desc=$('#projectDesc').value.trim();
  if(!title||!desc){toast('Title & description are required','error');return}
  setBusy(true);
  try{
    let thumbPath=null;
    if(STATE.imageData){
      const ext=(($('#projectImage').files[0]?.name||'').split('.').pop()||'png').toLowerCase();
      thumbPath=await uploadImage(ext);
      toast('Image uploaded to repo');
    }
    const data={
      id: STATE.editingId||uid(),
      title, description:desc,
      category:$('#projectCategory').value,
      status:$('#projectStatus').value,
      url:$('#projectUrl').value.trim(),
      filename:$('#projectFile').value.trim(),
      tags:$('#projectTags').value.split(',').map(t=>t.trim()).filter(Boolean),
      createdAt: new Date().toISOString()
    };
    if(STATE.editingId){
      const i=STATE.projects.findIndex(p=>p.id===STATE.editingId);
      data.createdAt=STATE.projects[i].createdAt;
      data.thumbnail=thumbPath||STATE.projects[i].thumbnail||null;
      STATE.projects[i]=data;
    }else{
      data.thumbnail=thumbPath;
      STATE.projects.unshift(data);
    }
    await saveData((STATE.editingId?'Update':'Add')+' project: '+title);
    closeModal(); refreshTable(); refreshStats();
  }catch(e){ console.error(e); toast('Failed: '+e.message,'error'); }
  setBusy(false);
});

// ---- edit / delete ----
window.editProject=function(id){ const p=STATE.projects.find(x=>x.id===id); if(p)openModal(p); };
window.deleteProject=async function(id){
  if(!confirm('Delete this project? It will be removed from GitHub too.'))return;
  const p=STATE.projects.find(x=>x.id===id);
  STATE.projects=STATE.projects.filter(x=>x.id!==id);
  await saveData('Delete project: '+(p?p.title:id));
  refreshTable(); refreshStats();
};

// ---- settings ----
function loadSettingsUI(){
  const s=STATE.settings||{};
  $('#settingTitle').value=s.siteTitle||'Forhad Hossain';
  $('#settingDesc').value=s.siteDesc||'';
  $('#settingEmail').value=s.email||'';
  $('#settingGithub').value=s.github||'';
  $('#settingTelegram').value=s.telegram||'';
}
$('#saveSettings')?.addEventListener('click',async()=>{
  STATE.settings={
    siteTitle:$('#settingTitle').value.trim(),
    siteDesc:$('#settingDesc').value.trim(),
    email:$('#settingEmail').value.trim(),
    github:$('#settingGithub').value.trim(),
    telegram:$('#settingTelegram').value.trim()
  };
  await saveData('Update site settings');
});

// ---- nav ----
function initNav(){
  const sidebar=$('#adminSidebar'),overlay=$('#sidebarOverlay'),toggle=$('#mobileToggle');
  toggle?.addEventListener('click',()=>{sidebar.classList.toggle('open');overlay.classList.toggle('show')});
  overlay?.addEventListener('click',()=>{sidebar.classList.remove('open');overlay.classList.remove('show')});
  $$('.admin-nav-link[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    $$('.admin-nav-link').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    $$('.admin-tab-panel').forEach(p=>p.classList.remove('active'));
    $('#tab-'+b.dataset.tab)?.classList.add('active');
    $('#pageTitle').textContent=b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1);
    sidebar.classList.remove('open');overlay.classList.remove('show');
  }));
  $('#logoutBtn')?.addEventListener('click',()=>{localStorage.removeItem('fp_gh_session');location.href='login.html'});
  $('#closeModal')?.addEventListener('click',closeModal);
  $('#cancelProject')?.addEventListener('click',closeModal);
  $('#projectModal')?.addEventListener('click',e=>{if(e.target.id==='projectModal')closeModal()});
  $('#addProjectBtn')?.addEventListener('click',()=>openModal(null));
  $('#adminProjectSearch')?.addEventListener('input',refreshTable);
}

// ---- boot ----
document.addEventListener('DOMContentLoaded',async()=>{
  if(!requireAuth())return;
  const s=getSession(); if(s&&s.user)$('#adminUser').textContent=s.user;
  initNav();
  await loadData();
  refreshStats(); refreshTable(); loadSettingsUI();
});
