// Blog sayfalarının ortak kodu: veriyi blog/posts.json'dan okur, liste ve detay sayfasını çizer.
// İçerik her zaman textContent ile basılır; JSON'a yazılan HTML etiketleri çalışmaz, düz metin görünür.

const POSTS_URL = 'blog/posts.json';

async function loadPosts() {
    const response = await fetch(POSTS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`posts.json okunamadı (${response.status})`);
    const posts = await response.json();
    // En yeni yazı en üstte
    return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Sayfa dosyaya çift tıklanarak (file://) açıldıysa tarayıcı JSON okumayı engeller
function loadErrorMessage(defaultText) {
    return location.protocol === 'file:'
        ? 'Sayfa dosya olarak açıldığı için yazılar okunamadı. Bir sunucu üzerinden açın (ör. VS Code Live Server). Yayındaki sitede sorun olmaz.'
        : defaultText;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (isNaN(date)) return isoDate || '';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Kapak resmi; dosya yoksa veya yüklenemezse temaya uygun bir alan gösterir
function createImage(src, alt) {
    const placeholder = () => {
        const box = el('div', 'img-placeholder');
        box.appendChild(el('i', 'fas fa-code'));
        return box;
    };
    if (!src) return placeholder();

    const img = el('img');
    img.src = src;
    img.alt = alt || '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.replaceWith(placeholder()));
    return img;
}

function createMeta(post) {
    const meta = el('div', 'post-meta');
    meta.appendChild(el('span', null, formatDate(post.date)));
    (post.tags || []).forEach(tag => meta.appendChild(el('span', 'tag', tag)));
    return meta;
}

function postUrl(post) {
    return `blog-post.html?slug=${encodeURIComponent(post.slug)}`;
}

// ---------- LİSTE SAYFASI ----------
async function renderBlogList(container) {
    try {
        const posts = await loadPosts();
        container.textContent = '';

        if (posts.length === 0) {
            container.appendChild(el('p', 'status-message', 'Henüz yazı yok.'));
            return;
        }

        const grid = el('div', 'blog-grid');
        posts.forEach(post => {
            const card = el('a', 'blog-card');
            card.href = postUrl(post);

            const imgBox = el('div', 'blog-card-img');
            imgBox.appendChild(createImage(post.coverImage, post.title));
            card.appendChild(imgBox);

            const body = el('div', 'blog-card-body');
            body.appendChild(createMeta(post));
            body.appendChild(el('h2', null, post.title));
            body.appendChild(el('p', null, post.subtitle || ''));
            body.appendChild(el('span', 'read-more', 'Devamını oku →'));
            card.appendChild(body);

            grid.appendChild(card);
        });
        container.appendChild(grid);
    } catch (err) {
        console.error(err);
        container.textContent = '';
        container.appendChild(el('p', 'status-message', loadErrorMessage('Yazılar yüklenemedi.')));
    }
}

// ---------- DETAY SAYFASI ----------
function renderBlock(block) {
    switch (block.type) {
        case 'heading':
            return el('h2', null, block.text);

        case 'list': {
            const ul = el('ul');
            (block.items || []).forEach(item => ul.appendChild(el('li', null, item)));
            return ul;
        }

        case 'quote':
            return el('blockquote', null, block.text);

        case 'image': {
            const figure = el('figure');
            figure.appendChild(createImage(block.src, block.alt || block.caption));
            if (block.caption) figure.appendChild(el('figcaption', null, block.caption));
            return figure;
        }

        case 'code': {
            const wrapper = el('div', 'code-block');
            const pre = el('pre');
            pre.appendChild(el('code', block.language ? `language-${block.language}` : null, block.code));

            const copyBtn = el('button', 'copy-btn', 'Kopyala');
            copyBtn.type = 'button';
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(block.code);
                    copyBtn.textContent = 'Kopyalandı ✓';
                } catch {
                    copyBtn.textContent = 'Kopyalanamadı';
                }
                setTimeout(() => (copyBtn.textContent = 'Kopyala'), 2000);
            });

            wrapper.append(pre, copyBtn);
            return wrapper;
        }

        case 'paragraph':
        default:
            return el('p', null, block.text);
    }
}

async function renderBlogPost(container) {
    const slug = new URLSearchParams(location.search).get('slug');

    try {
        const posts = await loadPosts();
        const post = posts.find(p => p.slug === slug);
        container.textContent = '';

        if (!post) {
            container.appendChild(el('p', 'status-message', 'Aradığınız yazı bulunamadı.'));
            return;
        }

        document.title = `${post.title} | Oğuzhan Kömcü`;
        const description = document.querySelector('meta[name="description"]');
        if (description && post.subtitle) description.content = post.subtitle;

        const header = el('header', 'post-header');
        header.appendChild(createMeta(post));
        header.appendChild(el('h1', null, post.title));
        if (post.subtitle) header.appendChild(el('p', 'post-subtitle', post.subtitle));
        container.appendChild(header);

        if (post.coverImage) {
            const cover = el('div', 'post-cover');
            const img = createImage(post.coverImage, post.title);
            // Detayda kapak yoksa boş alan göstermek yerine tamamen gizle
            img.addEventListener('error', () => cover.remove());
            cover.appendChild(img);
            container.appendChild(cover);
        }

        const content = el('div', 'post-content');
        (post.content || []).forEach(block => content.appendChild(renderBlock(block)));
        container.appendChild(content);
    } catch (err) {
        console.error(err);
        container.textContent = '';
        container.appendChild(el('p', 'status-message', loadErrorMessage('Yazı yüklenemedi.')));
    }
}

// ---------- MOBİL MENÜ ----------
function initMenu() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', () => {
        const open = navLinks.classList.toggle('active');
        const icon = hamburger.querySelector('i');
        icon.classList.toggle('fa-bars', !open);
        icon.classList.toggle('fa-times', open);
    });
}

// ---------- ARKA PLAN PARÇACIKLARI (ana sayfadakinin hafif hali) ----------
function initParticles() {
    const canvas = document.getElementById('canvas-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const count = (canvas.width * canvas.height) / 14000;
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.1,
            vx: Math.random() * 1 - 0.5,
            vy: Math.random() * 1 - 0.5
        }));
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.x > canvas.width || p.x < 0) p.vx = -p.vx;
            if (p.y > canvas.height || p.y < 0) p.vy = -p.vy;

            ctx.fillStyle = '#00f3ff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const dx = p.x - particles[j].x;
                const dy = p.y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 100) {
                    ctx.strokeStyle = `rgba(0, 243, 255, ${1 - distance / 100})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
}

document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initParticles();
});
