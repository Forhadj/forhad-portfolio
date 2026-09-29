// ============================================================
// Admin Panel — Enhanced with Security, ZIP Upload & Profile Image
// Commits directly to GitHub via REST API with Netlify auto-rebuild
// ============================================================
const $ = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

// ============================================================
// SECURITY UTILITIES
// ============================================================
const SecurityUtils = {
  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  },

  // Sanitize URLs (only http/https)
  validateUrl(url) {
    try {
      if (!url) return false;
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  // Validate file type by extension
  validateFileType(filename, allowedExts) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    return allowedExts.includes(ext);
  },

  // Validate file size (in MB)
  validateFileSize(file, maxMB) {
    return file.size <= (maxMB * 1024 * 1024);
  },

  // Validate image file
  validateImageFile(file) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    
    if (!allowedMimes.includes(file.type)) return false;
    if (!this.validateFileType(file.name, allowedExts)) return false;
    if (!this.validateFileSize(file, 5)) return false; // 5 MB max
    
    return true;
  },

  // Validate ZIP file
  validateZipFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return ext === 'zip' && this.validateFileSize(file, 50); // 50 MB max
  }
};

// ============================================================
// SESSION & AUTH
// ============================================================
function getSession(){try{return JSON.parse(localStorage.getItem('fp_gh_session'))}catch(e){return null}}
function requireAuth(){
  const s=getSession();
  if(!s||!s.token){location.href='login.html';return false}
  return true;
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
let STATE = { 
  projects: [], 
  settings: {}, 
  profileImage: null,
  sha: null, 
  editingId: null, 
  imageData: null 
};

// ============================================================
// GITHUB API HELPERS
// ============================================================
function cfg(){ return (typeof GITHUB_CONFIG!=='undefined')?GITHUB_CONFIG:null; }
function apiUrl(path){ const c=cfg(); return `${c.apiBase}/repos/${c.owner}/${c.repo}/contents/${path}`; }

function ghHeaders(){
  const s=getSession();
  return { 
    'Authorization':'token '+s.token, 
    'Accept':'application/vnd.github+json', 
    'Content-Type':'application/json' 
  };
}

function b64encode(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str){ return decodeURIComponent(escape(atob(str.replace(/\n/g,'')))); }

async function ghGetFile(path){
  const c=cfg();
  const res=await fetch(apiUrl(path)+`?ref=${c.branch}`,{headers:ghHeaders()});
  if(res.status===404)return{content:null,sha:null};
  if(!res.ok){const e=await res.text();throw new Error('GET '+path+' failed: '+res.status)}
  const j=await res.json();
  try {
    return { content: JSON.parse(b64decode(j.content)), sha: j.sha };
  } catch {
    return { content: null, sha: j.sha };
  }
}

async function ghPutFile(path, obj, message, sha){
  const c=cfg();
  const body={ message, content:b64encode(JSON.stringify(obj,null,2)), branch:c.branch };
  if(sha)body.sha=sha;
  const res=await fetch(apiUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!res.ok){const e=await res.text();throw new Error('PUT '+path+' failed: '+res.status)}
  return res.json();
}

async function ghPutBinary(path, base64Content, message, sha){
  const c=cfg();
  const body={ message, content:base64Content, branch:c.branch };
  if(sha)body.sha=sha;
  const res=await fetch(apiUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!res.ok){const e=await res.text();throw new Error('Upload '+path+' failed: '+res.status)}
  return res.json();
}

async function ghDeleteFile(path, sha, message){
  const c=cfg();
  const body={ message, sha, branch:c.branch };
  const res=await fetch(apiUrl(path),{method:'DELETE',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!res.ok){const e=await res.text();throw new Error('DELETE '+path+' failed: '+res.status)}
  return res.json();
}

// ============================================================
// TOAST & UI HELPERS
// ============================================================
function toast(msg,type='success'){
  const c=$('#toastContainer');
  const t=document.createElement('div');
  t.className='admin-toast admin-toast-'+type;
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>{
    t.style.opacity='0';
    t.style.transform='translateX(100%)';
    setTimeout(()=>t.remove(),300);
  },4000);
}

function setBusy(b){ 
  document.body.style.cursor=b?'progress':'default'; 
  $$('.admin-btn').forEach(x=>x.disabled=b); 
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadData(){
  setBusy(true);
  try{
    const file=await ghGetFile(cfg().dataPath);
    if(file.content){ 
      STATE.projects=file.content.projects||[]; 
      STATE.settings=file.content.settings||{}; 
      STATE.profileImage=file.content.profileImage||null;
      STATE.sha=file.sha; 
    }
    else { 
      STATE.projects=[]; 
      STATE.settings={}; 
      STATE.profileImage=null;
      STATE.sha=null; 
    }
    toast('✓ Data loaded from GitHub');
  }catch(e){ 
    console.error(e); 
    toast('⚠ Load failed: '+e.message,'error'); 
  }
  setBusy(false);
}

async function saveData(message){
  setBusy(true);
  try{
    const obj={ 
      projects:STATE.projects, 
      settings:STATE.settings,
      profileImage:STATE.profileImage 
    };
    const r=await ghPutFile(cfg().dataPath, obj, message, STATE.sha);
    STATE.sha=r.content.sha;
    toast('✓ Saved! Netlify rebuilding (~30s)');
  }catch(e){ 
    console.error(e); 
    toast('⚠ Save failed: '+e.message,'error'); 
  }
  setBusy(false);
}

// ============================================================
// PROFILE IMAGE MANAGEMENT
// ============================================================
function loadProfileImageUI(){
  const preview=$('#profileImagePreview');
  if(STATE.profileImage){
    preview.className='profile-img-preview';
    preview.innerHTML=`<img src="${SecurityUtils.escapeHtml(STATE.profileImage)}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
  }else{
    preview.className='profile-img-placeholder';
    preview.textContent='👤 No profile image';
  }
}

$('#profileImageUpload')?.addEventListener('change',function(){
  const f=this.files[0];
  if(!f)return;
  
  if(!SecurityUtils.validateImageFile(f)){
    toast('Image must be JPG/PNG/WebP/GIF and max 5MB','error');
    return;
  }
  
  const r=new FileReader();
  r.onload=async(e)=>{
    try{
      setBusy(true);
      const b64=e.target.result.split(',')[1];
      const filename=`images/profile/${uid()}.${f.name.split('.').pop().toLowerCase()}`;
      await ghPutBinary(filename, b64, 'Upload profile image', null);
      STATE.profileImage=filename;
      await saveData('Update profile image');
      loadProfileImageUI();
      toast('✓ Profile image uploaded');
    }catch(err){
      toast('⚠ Profile upload failed: '+err.message,'error');
    }finally{
      setBusy(false);
    }
  };
  r.readAsDataURL(f);
});

// ============================================================
// ZIP FILE EXTRACTION
// ============================================================
async function extractZipFile(file){
  // Library detection: we'll use a simple zip reading approach
  // For production, consider JSZip: https://stuk.github.io/jszip/
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // For now, we'll show a guide for manual extraction
        // In production, use JSZip library
        const filename = `uploads/${uid()}.zip`;
        const b64 = e.target.result.split(',')[1];
        
        toast('⏳ Uploading ZIP file...', 'info');
        await ghPutBinary(filename, b64, 'Upload ZIP project file', null);
        
        toast('✓ ZIP uploaded! Extraction guide:', 'success');
        alert(`ZIP file uploaded to ${filename}\n\nExtraction Guide:\n1. Clone repo locally\n2. Extract the ZIP\n3. Place files in project folder\n4. Push to GitHub\n\nOr use GitHub's web interface to extract.`);
        
        resolve(filename);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

$('#projectZipUpload')?.addEventListener('change', async function(){
  const f=this.files[0];
  if(!f)return;
  
  if(!SecurityUtils.validateZipFile(f)){
    toast('File must be a .zip and max 50MB','error');
    return;
  }
  
  try{
    setBusy(true);
    await extractZipFile(f);
  }catch(err){
    toast('⚠ ZIP upload failed: '+err.message,'error');
  }finally{
    setBusy(false);
  }
});

// ============================================================
// DASHBOARD
// ============================================================
function refreshStats(){
  $('#statTotal').textContent=STATE.projects.length;
  $('#statLive').textContent=STATE.projects.filter(p=>p.status==='live').length;
  $('#statWip').textContent=STATE.projects.filter(p=>p.status==='wip').length;
  $('#statImg').textContent=STATE.projects.filter(p=>p.thumbnail).length;

  const rp=$('#recentProjects');
  const recent=STATE.projects.slice(0,5);
  rp.innerHTML = recent.length
    ? '<table class="admin-table"><thead><tr><th>Title</th><th>Category</th><th>Status</th></tr></thead><tbody>'+
      recent.map(p=>`<tr><td>${SecurityUtils.escapeHtml(p.title)}</td><td>${SecurityUtils.escapeHtml(p.category)}</td><td><span class="admin-badge admin-badge-${p.status}">${p.status}</span></td></tr>`).join('')+
      '</tbody></table>'
    : '<div class="admin-empty-state">কোনো প্রজেক্ট নেই। যোগ করুন!</div>';
}

// ============================================================
// PROJECTS TABLE
// ============================================================
function refreshTable(){
  const tbody=$('#projectsTableBody'), empty=$('#projectsEmpty');
  const q=($('#adminProjectSearch')?.value||'').toLowerCase();
  let list=STATE.projects;
  if(q)list=list.filter(p=>
    (p.title||'').toLowerCase().includes(q)||
    (p.category||'').toLowerCase().includes(q)||
    (p.tags||[]).some(t=>t.toLowerCase().includes(q))
  );
  
  if(!list.length){
    tbody.innerHTML='';
    empty.style.display='block';
    return;
  }
  
  empty.style.display='none';
  tbody.innerHTML=list.map(p=>{
    const th=p.thumbnail
      ? `<img src="${SecurityUtils.escapeHtml(p.thumbnail)}" style="width:60px;height:40px;object-fit:cover;border-radius:4px" alt="">`
      : `<div style="width:60px;height:40px;background:#1c1813;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#5a544c;font-size:.65rem">none</div>`;
    const tags=(p.tags||[]).slice(0,3).map(t=>`<span class="admin-badge" style="background:rgba(255,178,56,.08);color:#b87a1a;border:1px solid rgba(255,178,56,.15)">${SecurityUtils.escapeHtml(t)}</span>`).join(' ');
    return `<tr><td>${th}</td><td>${SecurityUtils.escapeHtml(p.title)}</td><td>${SecurityUtils.escapeHtml(p.category)}</td>
      <td><span class="admin-badge admin-badge-${p.status||'wip'}">${p.status||'wip'}</span></td>
      <td>${tags}</td>
      <td><div class="admin-actions">
        <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="editProject('${p.id}')">Edit</button>
        <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deleteProject('${p.id}')">Del</button>
      </div></td></tr>`;
  }).join('');
}

// ============================================================
// PROJECT MODAL
// ============================================================
function openModal(edit){
  STATE.editingId=edit?edit.id:null;
  STATE.imageData=null;
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
    
    if(edit.thumbnail){
      setImgPreview(edit.thumbnail);
    } else {
      clearImgPreview();
    }
  } else {
    clearImgPreview();
  }
  
  $('#projectModal').classList.add('show');
}

function closeModal(){ 
  $('#projectModal').classList.remove('show'); 
  STATE.editingId=null; 
  STATE.imageData=null; 
}

function clearImgPreview(){ 
  const p=$('#imagePreview'); 
  p.className='img-preview-placeholder'; 
  p.textContent='📷 No image selected'; 
}

function setImgPreview(src){ 
  const p=$('#imagePreview'); 
  p.className='img-preview'; 
  p.innerHTML=`<img src="${SecurityUtils.escapeHtml(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" alt="">`; 
}

// ============================================================
// IMAGE UPLOAD FOR PROJECTS
// ============================================================
$('#projectImage')?.addEventListener('change',function(){
  const f=this.files[0];
  if(!f)return;
  
  if(!SecurityUtils.validateImageFile(f)){
    toast('Image must be JPG/PNG/WebP/GIF and max 5MB','error');
    this.value='';
    return;
  }
  
  const r=new FileReader();
  r.onload=e=>{
    STATE.imageData=e.target.result.split(',')[1];
    setImgPreview(e.target.result);
  };
  r.readAsDataURL(f);
});

async function uploadProjectImage(ext){
  const filename=`images/uploads/${uid()}.${ext}`;
  await ghPutBinary(filename, STATE.imageData, 'Upload project thumbnail', null);
  return filename;
}

// ============================================================
// SAVE PROJECT
// ============================================================
$('#saveProject')?.addEventListener('click',async()=>{
  const title=$('#projectTitle').value.trim();
  const desc=$('#projectDesc').value.trim();
  const category=$('#projectCategory').value.trim();
  const url=$('#projectUrl').value.trim();
  
  if(!title||!desc||!category){
    toast('Title, Description & Category are required','error');
    return;
  }
  
  // Security: Validate URL if provided
  if(url && !SecurityUtils.validateUrl(url)){
    toast('Invalid URL. Must be http:// or https://','error');
    return;
  }
  
  setBusy(true);
  try{
    let thumbPath=null;
    if(STATE.imageData){
      const ext=(($('#projectImage').files[0]?.name||'').split('.').pop()||'png').toLowerCase();
      thumbPath=await uploadProjectImage(ext);
      toast('✓ Image uploaded');
    }
    
    const data={
      id: STATE.editingId||uid(),
      title, 
      description:desc,
      category,
      status:$('#projectStatus').value||'wip',
      url: url || null,
      filename:$('#projectFile').value.trim()||null,
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
    closeModal();
    refreshTable();
    refreshStats();
    toast('✓ Project saved!');
  }catch(e){ 
    console.error(e); 
    toast('⚠ Failed: '+e.message,'error'); 
  }
  setBusy(false);
});

// ============================================================
// EDIT / DELETE
// ============================================================
window.editProject=function(id){ 
  const p=STATE.projects.find(x=>x.id===id); 
  if(p)openModal(p); 
};

window.deleteProject=async function(id){
  if(!confirm('Delete this project? It will be removed from GitHub too.'))return;
  const p=STATE.projects.find(x=>x.id===id);
  STATE.projects=STATE.projects.filter(x=>x.id!==id);
  await saveData('Delete project: '+(p?p.title:id));
  refreshTable();
  refreshStats();
  toast('✓ Project deleted');
};

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsUI(){
  const s=STATE.settings||{};
  $('#settingTitle').value=s.siteTitle||'Forhad Hossain';
  $('#settingDesc').value=s.siteDesc||'';
  $('#settingEmail').value=s.email||'';
  $('#settingGithub').value=s.github||'';
  $('#settingTelegram').value=s.telegram||'';
}

$('#saveSettings')?.addEventListener('click',async()=>{
  const email=$('#settingEmail').value.trim();
  const github=$('#settingGithub').value.trim();
  const telegram=$('#settingTelegram').value.trim();
  
  // Validate URLs
  if(github && !SecurityUtils.validateUrl(github)){
    toast('GitHub URL must be http:// or https://','error');
    return;
  }
  if(telegram && !SecurityUtils.validateUrl(telegram)){
    toast('Telegram URL must be http:// or https://','error');
    return;
  }
  
  STATE.settings={
    siteTitle:$('#settingTitle').value.trim(),
    siteDesc:$('#settingDesc').value.trim(),
    email,
    github,
    telegram
  };
  await saveData('Update site settings');
  toast('✓ Settings saved');
});

// ============================================================
// NAVIGATION
// ============================================================
function initNav(){
  const sidebar=$('#adminSidebar'),overlay=$('#sidebarOverlay'),toggle=$('#mobileToggle');
  
  toggle?.addEventListener('click',()=>{
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  
  overlay?.addEventListener('click',()=>{
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
  
  $$('.admin-nav-link[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    $$('.admin-nav-link').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    $$('.admin-tab-panel').forEach(p=>p.classList.remove('active'));
    $('#tab-'+b.dataset.tab)?.classList.add('active');
    $('#pageTitle').textContent=b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1);
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }));
  
  $('#logoutBtn')?.addEventListener('click',()=>{
    if(confirm('Logout?')){
      localStorage.removeItem('fp_gh_session');
      location.href='login.html';
    }
  });
  
  $('#closeModal')?.addEventListener('click',closeModal);
  $('#cancelProject')?.addEventListener('click',closeModal);
  $('#projectModal')?.addEventListener('click',e=>{if(e.target.id==='projectModal')closeModal()});
  $('#addProjectBtn')?.addEventListener('click',()=>openModal(null));
  $('#adminProjectSearch')?.addEventListener('input',refreshTable);
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded',async()=>{
  if(!requireAuth())return;
  const s=getSession();
  if(s&&s.user)$('#adminUser').textContent=s.user;
  
  initNav();
  await loadData();
  
  refreshStats();
  refreshTable();
  loadSettingsUI();
  loadProfileImageUI();
});
