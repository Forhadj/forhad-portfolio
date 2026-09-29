// ============================================================
// Web File Upload Handler with Edit & Preview
// Handles HTML, CSS, JS, Images, Fonts, etc.
// ============================================================

const UploadManager = {
  selectedFiles: [],
  editingFile: null,
  
  init() {
    const fileInput = document.getElementById('websiteFileInput');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    document.getElementById('uploadAllBtn')?.addEventListener('click', () => this.uploadAll());
    document.getElementById('clearFilesBtn')?.addEventListener('click', () => this.clearFiles());
    document.getElementById('editorSaveBtn')?.addEventListener('click', () => this.saveFileChanges());
    document.getElementById('editorCloseBtn')?.addEventListener('click', () => this.closeEditor());
    document.getElementById('editorPreviewBtn')?.addEventListener('click', () => this.previewFile());
  },

  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const allowedExtensions = ['html', 'css', 'js', 'json', 'xml', 'txt', 'md', 'svg', 'woff', 'woff2', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    this.selectedFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast(`❌ ${file.name} ফাইল সাপোর্ট করে না`, 'error');
        return false;
      }
      if (file.size > 50*1024*1024) {
        toast(`❌ ${file.name} ৫০MB এর বেশি`, 'error');
        return false;
      }
      return true;
    });

    this.renderFileList();
    document.getElementById('uploadActions').style.display = this.selectedFiles.length > 0 ? 'block' : 'none';
    toast(`✓ ${this.selectedFiles.length} ফাইল নির্বাচিত`, 'success');
  },

  renderFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    this.selectedFiles.forEach((file, idx) => {
      const ext = file.name.split('.').pop().toLowerCase();
      const isText = ['html', 'css', 'js', 'json', 'xml', 'txt', 'md', 'svg'].includes(ext);
      
      const item = document.createElement('div');
      item.className = 'upload-file-item';
      item.innerHTML = `
        <span class="file-item-name">📄 ${file.name} (${(file.size/1024).toFixed(2)}KB)</span>
        <div class="file-item-actions">
          ${isText ? `<button class="file-item-btn file-item-edit" onclick="UploadManager.editFile(${idx})">✎ Edit</button>` : ''}
          ${['jpg','jpeg','png','gif','webp'].includes(ext) ? `<button class="file-item-btn file-item-preview" onclick="UploadManager.previewImage(${idx})">👁️ View</button>` : ''}
          <button class="file-item-btn file-item-delete" onclick="UploadManager.removeFile(${idx})">🗑️ Remove</button>
        </div>
      `;
      fileList.appendChild(item);
    });
  },

  editFile(idx) {
    const file = this.selectedFiles[idx];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.editingFile = { index: idx, file, content: e.target.result };
      document.getElementById('editorFileName').textContent = file.name;
      document.getElementById('editorContent').value = e.target.result;
      document.getElementById('editorContainer').style.display = 'block';
      document.getElementById('fileListContainer').style.display = 'none';
    };
    
    reader.readAsText(file);
  },

  saveFileChanges() {
    if (!this.editingFile) return;
    
    const newContent = document.getElementById('editorContent').value;
    const blob = new Blob([newContent], { type: 'text/plain' });
    this.selectedFiles[this.editingFile.index] = new File([blob], this.editingFile.file.name, { type: this.editingFile.file.type });
    
    toast('✓ ফাইল পরিবর্তন সংরক্ষণ করা হয়েছে', 'success');
    this.closeEditor();
  },

  closeEditor() {
    document.getElementById('editorContainer').style.display = 'none';
    document.getElementById('fileListContainer').style.display = 'block';
    this.editingFile = null;
  },

  previewFile() {
    if (!this.editingFile) return;
    const file = this.editingFile.file;
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'html') {
      const content = document.getElementById('editorContent').value;
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      toast('শুধুমাত্র HTML ফাইল প্রিভিউ করা যায়', 'info');
    }
  },

  previewImage(idx) {
    const file = this.selectedFiles[idx];
    const reader = new FileReader();
    reader.onload = (e) => {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML = `
        <div style="position:relative; max-width:90%; max-height:90%;">
          <img src="${e.target.result}" style="max-width:100%; max-height:100%; border-radius:8px;">
          <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:10px; right:10px; background:#ffb238; border:none; color:#080705; padding:8px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">✕</button>
        </div>
      `;
      document.body.appendChild(modal);
    };
    reader.readAsDataURL(file);
  },

  removeFile(idx) {
    this.selectedFiles.splice(idx, 1);
    this.renderFileList();
    document.getElementById('uploadActions').style.display = this.selectedFiles.length > 0 ? 'block' : 'none';
    toast('✓ ফাইল সরানো হয়েছে', 'success');
  },

  clearFiles() {
    if (!confirm('সব ফাইল মুছে ফেলবেন?')) return;
    this.selectedFiles = [];
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('uploadActions').style.display = 'none';
    document.getElementById('websiteFileInput').value = '';
  },

  async uploadAll() {
    if (this.selectedFiles.length === 0) {
      toast('কোনো ফাইল নির্বাচিত নয়', 'error');
      return;
    }

    setBusy(true);
    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.style.display = 'block';

    try {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const file = this.selectedFiles[i];
        await this.uploadFile(file, i, this.selectedFiles.length);
      }
      toast('✓ সব ফাইল আপলোড সম্পন্ন!', 'success');
      this.clearFiles();
      progressDiv.style.display = 'none';
    } catch (err) {
      toast('⚠ আপলোড ব্যর্থ: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  },

  async uploadFile(file, current, total) {
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const ext = file.name.split('.').pop().toLowerCase();
          const folder = this.getFolder(ext);
          const timestamp = Date.now();
          const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `${folder}/${timestamp}-${cleanName}`;
          
          const b64 = e.target.result.split(',')[1];
          
          // Update progress
          const progress = ((current + 1) / total) * 100;
          document.getElementById('progressFill').style.width = progress + '%';
          document.getElementById('progressText').textContent = Math.round(progress) + '%';
          document.getElementById('progressFile').textContent = file.name;
          
          await ghPutBinary(path, b64, `Upload ${file.name}`, null);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      
      reader.readAsDataURL(file);
    });
  },

  getFolder(ext) {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const fontExts = ['woff', 'woff2'];
    const htmlExts = ['html'];
    
    if (imageExts.includes(ext)) return 'projects/images';
    if (fontExts.includes(ext)) return 'projects/fonts';
    if (htmlExts.includes(ext)) return 'projects';
    return 'projects/assets';
  }
};

// ============================================================
// PROJECT PREVIEW MODAL
// ============================================================
const ProjectViewer = {
  openProject(projectId) {
    const project = STATE.projects.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    
    const projectLink = project.url ? `target="_blank" href="${SecurityUtils.escapeHtml(project.url)}"` : 'href="#"';
    const fileLink = project.filename ? `target="_blank" href="${SecurityUtils.escapeHtml(project.filename)}"` : '';
    
    modal.innerHTML = `
      <div style="background:#16130e; border:1px solid #2a2520; border-radius:12px; max-width:700px; max-height:90vh; overflow-y:auto; padding:24px; position:relative;">
        <button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:12px;right:12px;background:#e85d5d;border:none;color:#f5f0e8;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:1.2rem;">✕</button>
        
        ${project.thumbnail ? `<img src="${SecurityUtils.escapeHtml(project.thumbnail)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:16px;" alt="">` : ''}
        
        <div style="margin-bottom:12px;">
          <span class="admin-badge admin-badge-${project.status}" style="margin-right:8px;">${(project.status || 'wip').toUpperCase()}</span>
          <span class="admin-badge" style="background:rgba(255,178,56,.1);color:#ffb238;border:1px solid rgba(255,178,56,.2);">${SecurityUtils.escapeHtml(project.category)}</span>
        </div>
        
        <h2 style="color:#f5f0e8;font-size:1.4rem;margin-bottom:8px;">${SecurityUtils.escapeHtml(project.title)}</h2>
        <p style="color:#b8b0a4;font-size:.95rem;line-height:1.6;margin-bottom:16px;">${SecurityUtils.escapeHtml(project.description)}</p>
        
        ${project.tags && project.tags.length > 0 ? `
          <div style="margin-bottom:16px;">
            ${project.tags.map(t => `<span class="admin-badge" style="background:rgba(255,178,56,.08);color:#b87a1a;border:1px solid rgba(255,178,56,.15);margin-right:6px;">${SecurityUtils.escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div style="display:flex;gap:12px;margin-top:20px;">
          ${project.url && SecurityUtils.validateUrl(project.url) ? `<a ${projectLink} class="admin-btn admin-btn-primary" style="flex:1;text-align:center;">🌐 Visit Live</a>` : ''}
          ${project.filename ? `<a ${fileLink} class="admin-btn admin-btn-secondary" style="flex:1;text-align:center;">📂 Open Project Files</a>` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
};

// ============================================================
// Initialize on Load
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  UploadManager.init();
});
