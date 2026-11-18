// Blog derleyicisi: blog/posts.json'u okuyup arama motorları için hazır HTML sayfaları üretir.
//
//   node scripts/build-blog.mjs
//
// Ürettikleri (elle düzenlemeyin, her çalıştırmada yeniden yazılır):
//   blog.html              -> yazı listesi
//   blog/<slug>.html       -> her yazının kendi sayfası
//   sitemap.xml, robots.txt
//
// Bağımlılığı yoktur, sadece Node.js 18+ yeterli.

import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://www.ogikom.com';
const AUTHOR = 'Oğuzhan Kömcü';
const BLOG_DESCRIPTION = 'Oğuzhan Kömcü\'nün .NET, C#, yazılım ve yapay zeka üzerine yazıları.';
const DEFAULT_IMAGE = 'img/oguzhanpp.jpg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_MARK = '<!-- Bu dosya scripts/build-blog.mjs tarafından üretilir. Elle düzenlemeyin; blog/posts.json\'u değiştirin. -->';

// ---------- yardımcılar ----------
const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const absoluteUrl = (relativePath) => `${SITE_URL}/${relativePath.replace(/^\/+/, '')}`;

function formatDate(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    if (isNaN(date)) return escapeHtml(isoDate);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function validatePosts(posts) {
    if (!Array.isArray(posts)) throw new Error('posts.json bir dizi olmalı: [ {...}, {...} ]');
    const slugs = new Set();
    posts.forEach((post, i) => {
        const where = `posts.json -> ${i + 1}. yazı`;
        for (const field of ['slug', 'title', 'date']) {
            if (!post[field]) throw new Error(`${where}: "${field}" alanı zorunlu`);
        }
        if (!/^[a-z0-9-]+$/.test(post.slug)) {
            throw new Error(`${where}: slug sadece küçük harf (a-z), rakam ve tire içerebilir: "${post.slug}"`);
        }
        if (slugs.has(post.slug)) throw new Error(`${where}: "${post.slug}" slug'ı birden fazla kez kullanılmış`);
        slugs.add(post.slug);
        if (isNaN(new Date(post.date))) throw new Error(`${where}: tarih YYYY-AA-GG formatında olmalı`);
        if (post.coverImage && !existsSync(path.join(ROOT, post.coverImage))) {
            console.warn(`⚠️  ${post.slug}: kapak resmi bulunamadı (${post.coverImage}), yerine şablon görsel gösterilecek.`);
        }
    });
}

// ---------- ortak parçalar ----------
// prefix: sayfanın köke göre konumu ("" kökte, "../" blog/ klasöründe)
function head({ title, description, canonical, image, type, prefix, jsonLd }) {
    return `<!DOCTYPE html>
<html lang="tr">

<head>
    ${GENERATED_MARK}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(AUTHOR)}">
    <link rel="canonical" href="${canonical}">

    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${escapeHtml(AUTHOR)}">
    <meta property="og:locale" content="tr_TR">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">

    <link rel="icon" href="${prefix}img/favicon.ico">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link
        href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;600&family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@300;500;700&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="${prefix}css/blog.css">
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>`;
}

function nav(prefix) {
    return `    <canvas id="canvas-bg"></canvas>

    <nav class="navbar">
        <div class="container">
            <a href="${prefix}index.html" class="logo">OK<span style="color:#fff">.</span></a>

            <div class="hamburger" id="hamburger">
                <i class="fas fa-bars"></i>
            </div>

            <ul class="nav-links" id="nav-links">
                <li><a href="${prefix}index.html#about">Hakkımda</a></li>
                <li><a href="${prefix}index.html#projects">Projeler</a></li>
                <li><a href="${prefix}index.html#personal-projects">Kişisel Projeler</a></li>
                <li><a href="${prefix}blog.html" class="active">Blog</a></li>
                <li><a href="${prefix}index.html#contact">İletişim</a></li>
            </ul>
        </div>
    </nav>`;
}

function footer(prefix) {
    return `    <footer>
        <p class="copyright">System.Status: Online | &copy; ${new Date().getFullYear()} ${escapeHtml(AUTHOR)}</p>
    </footer>

    <script src="${prefix}js/blog.js"></script>
</body>

</html>
`;
}

function image(src, alt, prefix, { lazy = true } = {}) {
    const placeholder = '<div class="img-placeholder"><i class="fas fa-code"></i></div>';
    if (!src) return placeholder;
    // data-fallback: resim yüklenemezse blog.js yerine şablon görseli koyar
    return `<img src="${prefix}${escapeHtml(src)}" alt="${escapeHtml(alt)}"${lazy ? ' loading="lazy"' : ''} data-fallback>`;
}

function meta(post) {
    const tags = (post.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    return `<div class="post-meta"><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>${tags}</div>`;
}

// ---------- içerik blokları ----------
function renderBlock(block, prefix) {
    switch (block.type) {
        case 'heading':
            return `<h2>${escapeHtml(block.text)}</h2>`;
        case 'list':
            return `<ul>${(block.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
        case 'quote':
            return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
        case 'image': {
            const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : '';
            return `<figure>${image(block.src, block.alt || block.caption || '', prefix)}${caption}</figure>`;
        }
        case 'code': {
            const lang = block.language ? ` class="language-${escapeHtml(block.language)}"` : '';
            return `<div class="code-block"><pre><code${lang}>${escapeHtml(block.code)}</code></pre>`
                + `<button type="button" class="copy-btn">Kopyala</button></div>`;
        }
        case 'paragraph':
            return `<p>${escapeHtml(block.text)}</p>`;
        default:
            console.warn(`⚠️  Bilinmeyen içerik tipi "${block.type}", paragraf olarak basıldı.`);
            return `<p>${escapeHtml(block.text || '')}</p>`;
    }
}

// ---------- sayfalar ----------
function postPage(post) {
    const prefix = '../';
    const url = absoluteUrl(`blog/${post.slug}.html`);
    const imageUrl = absoluteUrl(post.coverImage && existsSync(path.join(ROOT, post.coverImage)) ? post.coverImage : DEFAULT_IMAGE);
    const description = post.subtitle || post.title;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        image: imageUrl,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        inLanguage: 'tr-TR',
        keywords: (post.tags || []).join(', '),
        mainEntityOfPage: url,
        author: { '@type': 'Person', name: AUTHOR, url: SITE_URL }
    };

    const cover = post.coverImage
        ? `\n                <div class="post-cover">${image(post.coverImage, post.title, prefix, { lazy: false })}</div>`
        : '';

    return `${head({ title: `${post.title} | ${AUTHOR}`, description, canonical: url, image: imageUrl, type: 'article', prefix, jsonLd })}

<body>
${nav(prefix)}

    <main>
        <div class="container">
            <article class="post">
                <a href="${prefix}blog.html" class="back-link">&lt; Tüm yazılar</a>
                <header class="post-header">
                    ${meta(post)}
                    <h1>${escapeHtml(post.title)}</h1>
                    ${post.subtitle ? `<p class="post-subtitle">${escapeHtml(post.subtitle)}</p>` : ''}
                </header>${cover}
                <div class="post-content">
                    ${(post.content || []).map(block => renderBlock(block, prefix)).join('\n                    ')}
                </div>
            </article>
        </div>
    </main>

${footer(prefix)}`;
}

function listPage(posts) {
    const prefix = '';
    const url = absoluteUrl('blog.html');

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `Blog | ${AUTHOR}`,
        description: BLOG_DESCRIPTION,
        url,
        inLanguage: 'tr-TR',
        author: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
        blogPost: posts.map(post => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: absoluteUrl(`blog/${post.slug}.html`),
            datePublished: post.date
        }))
    };

    const cards = posts.length === 0
        ? '<p class="status-message">Henüz yazı yok.</p>'
        : `<div class="blog-grid">
${posts.map(post => `                <a class="blog-card" href="blog/${post.slug}.html">
                    <div class="blog-card-img">${image(post.coverImage, post.title, prefix)}</div>
                    <div class="blog-card-body">
                        ${meta(post)}
                        <h2>${escapeHtml(post.title)}</h2>
                        <p>${escapeHtml(post.subtitle || '')}</p>
                        <span class="read-more">Devamını oku →</span>
                    </div>
                </a>`).join('\n')}
            </div>`;

    return `${head({ title: `Blog | ${AUTHOR}`, description: BLOG_DESCRIPTION, canonical: url, image: absoluteUrl(DEFAULT_IMAGE), type: 'website', prefix, jsonLd })}

<body>
${nav(prefix)}

    <main>
        <div class="container">
            <h1 class="page-title">Blog</h1>
            <p class="page-subtitle">// .NET, yazılım ve yapay zeka üzerine notlar</p>

            ${cards}
        </div>
    </main>

${footer(prefix)}`;
}

function sitemap(posts) {
    const latest = posts[0]?.updated || posts[0]?.date;
    const urls = [
        { loc: absoluteUrl(''), priority: '1.0' },
        { loc: absoluteUrl('blog.html'), lastmod: latest, priority: '0.8' },
        ...posts.map(post => ({ loc: absoluteUrl(`blog/${post.slug}.html`), lastmod: post.updated || post.date, priority: '0.7' }))
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

// ---------- çalıştır ----------
const posts = JSON.parse(await readFile(path.join(ROOT, 'blog', 'posts.json'), 'utf8'));
validatePosts(posts);
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// posts.json'dan silinmiş yazıların eski sayfalarını temizle
const blogDir = path.join(ROOT, 'blog');
const wanted = new Set(posts.map(p => `${p.slug}.html`));
for (const file of await readdir(blogDir)) {
    if (!file.endsWith('.html') || wanted.has(file)) continue;
    const content = await readFile(path.join(blogDir, file), 'utf8');
    if (content.includes(GENERATED_MARK)) {
        await unlink(path.join(blogDir, file));
        console.log(`🗑️  blog/${file} silindi (posts.json'da artık yok)`);
    }
}

for (const post of posts) {
    await writeFile(path.join(blogDir, `${post.slug}.html`), postPage(post));
    console.log(`✓ blog/${post.slug}.html`);
}
await writeFile(path.join(ROOT, 'blog.html'), listPage(posts));
await writeFile(path.join(ROOT, 'sitemap.xml'), sitemap(posts));
await writeFile(path.join(ROOT, 'robots.txt'), robots);
console.log(`✓ blog.html, sitemap.xml, robots.txt (${posts.length} yazı)`);
