# Forhad Portfolio — GitHub + Netlify CMS

এই ভার্সনে প্রোজেক্ট ডাটা `data/projects.json`-এ GitHub-এ commit হয়। Netlify GitHub push দেখলে সাইট rebuild করে, তাই সব visitor একই data দেখতে পায়।

## Folder structure

- `index.html` — homepage
- `projects.html` — searchable/filterable project list
- `data/projects.json` — public project data
- `images/uploads/` — uploaded thumbnails
- `admin/login.html` — GitHub token login
- `admin/index.html` — add/edit/delete dashboard
- `js/github-config.js` — repository settings

## Setup

1. এই folder-এর সব file একটি GitHub repository-তে upload করো।
2. GitHub repository public রাখো।
3. `js/github-config.js` খুলে বদলাও:
   - `owner` = তোমার GitHub username
   - `repo` = repository name
   - `branch` = সাধারণত `main`
4. Netlify-তে repository connect করো। Build command ফাঁকা রাখো, publish directory হিসেবে `/` ব্যবহার করো।
5. Site deploy হলে `https://your-site.netlify.app/admin/login.html` খুলো।
6. GitHub username এবং একটি Fine-grained Personal Access Token দাও। Token-এর জন্য শুধু ওই repository-তে **Contents: Read and write** permission দাও।

## Important security note

এই static CMS client-side GitHub API ব্যবহার করে। Token server-এ রাখা হয় না, শুধু admin browser-এর localStorage-এ রাখা হয়। নিরাপত্তার জন্য:

- আলাদা, সীমিত permission-এর token ব্যবহার করো।
- Token কখনো website code, GitHub file বা screenshot-এ রেখো না।
- কাজ শেষ হলে token revoke করে নতুন token বানানো ভালো।
- আরও শক্তিশালী security দরকার হলে Netlify Identity/Decap CMS বা server-side OAuth ব্যবহার করা উচিত।

## Publishing flow

Admin panel → Save & Publish → GitHub commit → Netlify rebuild → visitors see the update.
