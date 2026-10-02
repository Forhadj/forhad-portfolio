/**
 * Modern Portfolio Enhancement
 * Loads profile image and project data from GitHub
 */

(function() {
  'use strict';

  const cfg = window.GITHUB_CONFIG;
  
  // Safe HTML escaping
  const esc = (value) => {
    const d = document.createElement('div');
    d.textContent = value || '';
    return d.innerHTML;
  };

  // Build asset URL from GitHub
  const asset = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (!cfg) return path;
    const cleanPath = path.replace(/^\//, '');
    return `${cfg.rawBase}/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cleanPath}`;
  };

  // Load portfolio data
  async function loadPortfolioData() {
    if (!cfg || !cfg.owner || cfg.owner.includes('YOUR_')) return;

    try {
      const url = `${cfg.rawBase}/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.dataPath}?v=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      
      if (!response.ok) {
        console.log('Portfolio data not yet available');
        return;
      }

      const data = await response.json();

      // Load profile image if available
      if (data.profileImage && data.profileImage.trim()) {
        const profileElements = document.querySelectorAll('[data-profile-image]');
        profileElements.forEach((img) => {
          img.src = asset(data.profileImage);
          img.hidden = false;
        });
      }

      // Render projects
      const projects = Array.isArray(data.projects) ? data.projects : [];
      if (!projects.length) {
        console.log('No projects found yet');
        return;
      }

      renderProjects(projects.slice(0, 6));
      document.dispatchEvent(new CustomEvent('portfolio:ready'));

    } catch (error) {
      console.warn('Portfolio loader:', error.message);
    }
  }

  // Render project cards
  function renderProjects(projects) {
    const grid = document.querySelector('#portfolioGrid');
    if (!grid) return;

    grid.innerHTML = projects.map((project) => {
      const image = asset(project.thumbnail);
      const tags = (project.tags || [])
        .slice(0, 4)
        .map((tag) => `<span class="project-tag">${esc(tag)}</span>`)
        .join('');

      const link = project.url && /^https?:\/\//i.test(project.url)
        ? `<a class="project-link" href="${esc(project.url)}" target="_blank" rel="noopener noreferrer">Open project <span>↗</span></a>`
        : '<span class="project-link disabled">Preview coming soon</span>';

      return `
        <article class="project-card reveal-up">
          <div class="project-thumb">
            ${image
              ? `<img src="${esc(image)}" alt="${esc(project.title)}" loading="lazy">`
              : '<div class="project-thumb-placeholder">◈</div>'
            }
          </div>
          <div class="project-body">
            <div class="project-category">${esc(project.category || 'Project')}</div>
            <h3 class="project-title">${esc(project.title || 'Untitled')}</h3>
            <p class="project-desc">${esc(project.description || '')}</p>
            ${tags ? `<div class="project-tags">${tags}</div>` : ''}
            ${link}
          </div>
        </article>
      `;
    }).join('');

    // Trigger scroll reveal for new elements
    if (window.initScrollReveal) {
      window.initScrollReveal();
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPortfolioData);
  } else {
    loadPortfolioData();
  }

  // Expose to global scope for admin panel
  window.Portfolio = {
    reload: loadPortfolioData,
    renderProjects: renderProjects
  };

})();
