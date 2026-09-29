// ============================================================
// Frontend: reads project data from the GitHub repo so EVERY
// visitor sees the same content. No backend needed.
// ============================================================
const $ = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => [...c.querySelectorAll(s)];
const esc = t => { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; };

// ---- Data layer ----
const DataStore = {
  cache: null,
  async load() {
    if (this.cache) return this.cache;

    const cfg = (typeof GITHUB_CONFIG !== 'undefined') ? GITHUB_CONFIG : null;
    const localFallback = { projects: [], settings: {} };

    if (cfg && cfg.owner && !cfg.owner.includes('YOUR_')) {
      const url = `${cfg.rawBase}/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.dataPath}?t=${Date.now()}`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          this.cache = await res.json();
          return this.cache;
        }
      } catch (e) {
        console.warn('Remote data fetch failed, using local fallback.', e);
      }
    }
    // Local fallback (works offline / before config is set)
    try {
      const res = await fetch('data/projects.json', { cache: 'no-store' });
      if (res.ok) { this.cache = await res.json(); return this.cache; }
    } catch (e) {}
    this.cache = localFallback;
    return this.cache;
  },
  getProjects() { return (this.cache && this.cache.projects) || []; },
  getSettings() { return (this.cache && this.cache.settings) || {}; }
};

// ---- Rendering ----
function imageUrl(src) {
  if (!src) return '';
  if (src.startsWith('http') || src.startsWith('data:')) return src;
  const cfg = (typeof GITHUB_CONFIG !== 'undefined') ? GITHUB_CONFIG : null;
  if (cfg && cfg.owner && !cfg.owner.includes('YOUR_')) {
    return `${cfg.rawBase}/${cfg.owner}/${cfg.repo}/${cfg.branch}/${src}`;
  }
  return src;
}

function renderProjectCard(p) {
  const thumbSrc = imageUrl(p.thumbnail);
  const thumb = thumbSrc
    ? `<div class="project-thumb"><img src="${esc(thumbSrc)}" alt="${esc(p.title)}" loading="lazy"></div>`
    : `<div class="project-thumb"><div class="project-thumb-placeholder">&#128295;</div></div>`;
  const statusBadge = p.status === 'live'
    ? `<span class="project-status status-live">Live</span>`
    : `<span class="project-status status-wip">WIP</span>`;
  const tags = (p.tags||[]).map(t=>`<span class="project-tag">${esc(t)}</span>`).join('');
  const link = p.url
    ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="project-link">View Project <span>&#8594;</span></a>`
    : (p.filename
        ? `<a href="projects/${esc(p.filename)}" class="project-link">View Project <span>&#8594;</span></a>`
        : `<span class="project-link disabled">Coming soon</span>`);
  return `<div class="project-card reveal-up">
    <div style="position:relative">${thumb}${statusBadge}</div>
    <div class="project-body">
      <div class="project-category">${esc(p.category||'Project')}</div>
      <h3 class="project-title">${esc(p.title)}</h3>
      <p class="project-desc">${esc(p.description||'')}</p>
      ${tags?`<div class="project-tags">${tags}</div>`:''}
      ${link}
    </div>
  </div>`;
}

function renderProjectList(container, projects) {
  if (!container) return;
  if (!projects.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:3rem;grid-column:1/-1">Kono project nai. Admin panel theke add koro.</div>';
    return;
  }
  container.innerHTML = projects.map(renderProjectCard).join('');
  initScrollReveal();
}

// ---- UI helpers (unchanged behaviour) ----
function initPreloader(){const p=$('#preloader');if(!p)return;window.addEventListener('load',()=>{setTimeout(()=>{p.classList.add('done');setTimeout(()=>p.remove(),700)},1800)})}
function initNavigation(){const header=$('#siteHeader'),toggle=$('#navToggle'),nav=$('#mainNav');if(header){const onScroll=()=>header.classList.toggle('scrolled',window.scrollY>50);window.addEventListener('scroll',onScroll,{passive:true});onScroll()}if(toggle&&nav){toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',!open);nav.classList.toggle('open');document.body.style.overflow=open?'':'hidden'})}$$('.nav-link').forEach(l=>l.addEventListener('click',()=>{if(nav)nav.classList.remove('open');if(toggle)toggle.setAttribute('aria-expanded','false');document.body.style.overflow=''}))}
function initCounters(){$$('.stat-num[data-target]').forEach(el=>{const obs=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){const t=parseInt(el.dataset.target),d=1600,s=performance.now();const u=n=>{const p=Math.min((n-s)/d,1);el.textContent=Math.floor((1-Math.pow(2,-10*p))*t);if(p<1)requestAnimationFrame(u);else el.textContent=t};requestAnimationFrame(u);obs.unobserve(el)}})},{threshold:.5});obs.observe(el)})}
function initScrollReveal(){const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){setTimeout(()=>e.target.classList.add('revealed'),parseInt(e.target.dataset.delay)||0);obs.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -50px 0px'});$$('.reveal-up,.reveal-left,.reveal-right').forEach(el=>obs.observe(el))}
function initBackToTop(){const b=$('#backToTop');if(!b)return;window.addEventListener('scroll',()=>b.classList.toggle('visible',window.scrollY>600),{passive:true});b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}))}
function initTerminal(){const c=$('#terminalBody');if(!c)return;const lines=[{c:'whoami',o:'independent developer — bangladesh'},{c:'cat status.txt',o:'shipping tools people actually use.'},{c:'git push origin main',o:'portfolio updated -> live for everyone'}];c.innerHTML=lines.map(l=>`<div class="term-line" style="opacity:1"><span class="term-prompt">$</span><span class="term-cmd">${esc(l.c)}</span></div><div class="term-output">${esc(l.o)}</div>`).join('')+'<div class="term-line" style="opacity:1"><span class="term-prompt">forhad@github:~$</span><span class="term-cursor"></span></div>'}

// ---- Filters / Search on projects page ----
function initProjectsPage(projects){
  const grid=$('#projectsPageGrid');
  if(!grid)return;
  let filter='all', q='';
  function apply(){
    let list=projects.slice();
    if(filter!=='all'){
      list=list.filter(p=>{
        if(filter==='live')return p.status==='live';
        if(filter==='wip')return p.status==='wip';
        return (p.tags||[]).includes(filter)||(p.category||'')===filter;
      });
    }
    if(q){const s=q.toLowerCase();list=list.filter(p=>(p.title||'').toLowerCase().includes(s)||(p.description||'').toLowerCase().includes(s)||(p.tags||[]).some(t=>t.toLowerCase().includes(s)))}
    renderProjectList(grid,list);
  }
  $$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{$$('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;apply()}));
  const si=$('#projectSearch');if(si)si.addEventListener('input',e=>{q=e.target.value;apply()});
  apply();
}

// ---- Settings injection ----
function applySettings(s){
  if(!s)return;
  if(s.siteTitle){$$('[data-site-title]').forEach(e=>e.textContent=s.siteTitle)}
  if(s.email){$$('[data-email]').forEach(e=>{e.textContent=s.email;if(e.tagName==='A')e.href='mailto:'+s.email})}
  if(s.github){$$('[data-github]').forEach(e=>e.href=s.github)}
  if(s.telegram){$$('[data-telegram]').forEach(e=>e.href=s.telegram)}
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', async ()=>{
  initPreloader();initNavigation();initTerminal();initCounters();initScrollReveal();initBackToTop();
  await DataStore.load();
  applySettings(DataStore.getSettings());
  const projects = DataStore.getProjects();
  renderProjectList($('#portfolioGrid'), projects.slice(0,6));
  initProjectsPage(projects);
});
