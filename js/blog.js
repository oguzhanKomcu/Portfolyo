// Blog sayfalarının ortak davranışları. İçerik artık HTML'de hazır geliyor
// (scripts/build-blog.mjs üretir); bu dosya sadece etkileşimleri ekler.

// ---------- RESİM YEDEĞİ: kapak resmi yoksa temaya uygun alan göster ----------
function initImageFallbacks() {
    const toPlaceholder = img => {
        const box = document.createElement('div');
        box.className = 'img-placeholder';
        box.innerHTML = '<i class="fas fa-code"></i>';
        // Detay sayfasında kapak yoksa boş kutu göstermek yerine tamamen kaldır
        const cover = img.closest('.post-cover');
        if (cover) cover.remove();
        else img.replaceWith(box);
    };

    document.querySelectorAll('img[data-fallback]').forEach(img => {
        // Script çalışmadan önce hata vermiş olabilir
        if (img.complete && img.naturalWidth === 0) toPlaceholder(img);
        else img.addEventListener('error', () => toPlaceholder(img));
    });
}

// ---------- KOD KOPYALAMA ----------
function initCopyButtons() {
    document.querySelectorAll('.code-block').forEach(block => {
        const button = block.querySelector('.copy-btn');
        const code = block.querySelector('pre');
        if (!button || !code) return;

        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code.textContent);
                button.textContent = 'Kopyalandı ✓';
            } catch {
                button.textContent = 'Kopyalanamadı';
            }
            setTimeout(() => (button.textContent = 'Kopyala'), 2000);
        });
    });
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

initImageFallbacks();
initCopyButtons();
initMenu();
initParticles();
