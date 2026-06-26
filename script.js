/* =============================================
   MYSTIC ALBUM — script.js
   ============================================= */

(function () {
    'use strict';

    // ---- DOM refs ----
    const gallery    = document.getElementById('galleryContainer');
    const overlay    = document.getElementById('modalOverlay');
    const modalScene = document.getElementById('modalScene');

    // ---- State ----
    let cards          = [];
    let activeParticles= [];
    let particleTimer  = null;
    let animFrame      = null;
    let particleRafId  = null;

    // ---- Rarity labels (RU) ----
    const RARITY_LABELS = {
        'common':    'Обычная',
        'rare':      'Редкая',
        'very-rare': 'Очень редкая',
        'epic':      'Эпическая',
        'legendary': 'Легендарная',
    };

    // =========================================
    // 1. LOAD DATA
    //    Reads from window.CARDS_DATA (set by data.js).
    //    No fetch → no CORS issues with file://.
    // =========================================
    function loadData() {
        if (window.CARDS_DATA && Array.isArray(window.CARDS_DATA)) {
            cards = window.CARDS_DATA;
        } else {
            console.warn('data.js не загружен, используем демо-данные.');
            cards = getDemoData();
        }
        renderGallery();
    }

    // =========================================
    // 2. RENDER GALLERY
    // =========================================
    function renderGallery() {
        gallery.innerHTML = '';
        cards.forEach((card, i) => {
            const el = document.createElement('div');
            el.className = `card rarity-${card.rarity}`;
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', card.title);

            // Resolve image path — local images/xxx or remote URL
            const imgSrc = resolveImage(card.image, i);

            el.innerHTML = `
                <div class="card-inner-clip">
                    <div class="card-photo-wrap">
                        <img
                            class="card-photo"
                            src="${escHtml(imgSrc)}"
                            alt="${escHtml(card.title)}"
                            loading="lazy"
                            onerror="this.src='https://picsum.photos/seed/fallback${i}/400/534'"
                        >
                    </div>
                    <div class="card-title-bar">
                        <span>${escHtml(card.title)}</span>
                    </div>
                </div>
            `;
            el.addEventListener('click', () => openModal(i));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(i); }
            });
            gallery.appendChild(el);
        });
    }

    // =========================================
    // 3. OPEN MODAL
    // =========================================
    function openModal(index) {
        const card = cards[index];
        const imgSrc = resolveImage(card.image, index);

        modalScene.innerHTML = `
            <div class="modal-card rarity-${escHtml(card.rarity)}" id="modalCard" role="button" tabindex="0" aria-label="Закрыть карточку">
                <div class="modal-photo-wrap">
                    <img
                        class="modal-photo"
                        src="${escHtml(imgSrc)}"
                        alt="${escHtml(card.title)}"
                        onerror="this.src='https://picsum.photos/seed/fallback/400/534'"
                    >
                    <div class="modal-sheen" id="modalSheen"></div>
                </div>
                <div class="modal-desc-panel">
                    <div class="modal-card-title">${escHtml(card.title)}</div>
                    <span class="modal-rarity-label rarity-${escHtml(card.rarity)}">${RARITY_LABELS[card.rarity] || card.rarity}</span>
                    <p class="modal-desc-text">${escHtml(card.description)}</p>
                </div>
            </div>
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        const modalCard  = document.getElementById('modalCard');
        modalCard.addEventListener('click', closeModal);

        const modalSheen = document.getElementById('modalSheen');
        init3D(modalScene, modalCard, modalSheen);
        startParticles(card.rarity, modalScene);
    }

    // =========================================
    // 4. CLOSE MODAL
    // =========================================
    function closeModal() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        stopParticles();
        cancelAnimationFrame(animFrame);
        setTimeout(() => {
            if (!overlay.classList.contains('active')) modalScene.innerHTML = '';
        }, 300);
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // =========================================
    // 5. 3D PARALLAX EFFECT
    // =========================================
    function init3D(stage, card, sheen) {
        let targetX = 0, targetY = 0;
        let currentX = 0, currentY = 0;
        let isInside = false;
        const MAX_DEG = 12;

        function animate() {
            animFrame = requestAnimationFrame(animate);
            if (!isInside) { targetX = 0; targetY = 0; }
            currentX += (targetX - currentX) * 0.1;
            currentY += (targetY - currentY) * 0.1;
            card.style.transform = `rotateY(${currentX}deg) rotateX(${currentY}deg)`;
            if (sheen) {
                const sx = ((currentX / MAX_DEG) + 1) * 50;
                const sy = ((-currentY / MAX_DEG) + 1) * 50;
                sheen.style.background =
                    `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,0.14) 0%, transparent 58%)`;
            }
        }
        animate();

        stage.addEventListener('mousemove', (e) => {
            isInside = true;
            const r = stage.getBoundingClientRect();
            targetX =  ((e.clientX - r.left) / r.width  - 0.5) * MAX_DEG;
            targetY = -((e.clientY - r.top)  / r.height - 0.5) * MAX_DEG;
        });
        stage.addEventListener('mouseleave', () => { isInside = false; });
    }

    // =========================================
    // 6. PARTICLE SYSTEM (ОПТИМИЗИРОВАНО)
    // =========================================
    const PARTICLE_CONFIG = {
        'common':    null,
        'rare':      {
            count: 1, interval: 150,
            colors: ['#60b0ff', '#a0d0ff', '#ffffff'],
            size: [4, 8], speed: [5.0, 10.0], life: [50, 75],
            shapes: ['circle']
        },
        'very-rare': {
            count: 2, interval: 130,
            colors: ['#ffd700', '#ffe980', '#ffb800', '#fff0a0'],
            size: [4, 9], speed: [6.0, 12.0], life: [55, 80],
            shapes: ['circle', 'star']
        },
        'epic':      {
            count: 2, interval: 110,
            colors: ['#b040f0', '#d060ff', '#ff60ff', '#ff80ff'],
            size: [5, 11], speed: [7.0, 14.0], life: [60, 85],
            shapes: ['circle', 'star']
        },
        'legendary': {
            count: 3, interval: 100, // Снижено количество одновременно создаваемых частиц и увеличен интервал
            colors: ['#ff3090', '#ff8c00', '#ffe000', '#00e88a', '#00cfff', '#c040ff', '#ffffff'],
            size: [4, 13], speed: [8.0, 16.0], life: [65, 90], // Уменьшено время жизни частиц для предотвращения лагов
            shapes: ['circle', 'star', 'diamond']
        },
    };

    function startParticles(rarity, container) {
        const cfg = PARTICLE_CONFIG[rarity];
        if (!cfg) return;
        stopParticles();

        function spawnBatch() {
            if (!overlay.classList.contains('active')) return;
            const rect = container.getBoundingClientRect();
            // Center of the card
            const cx = rect.left + rect.width  * 0.5;
            const cy = rect.top  + rect.height * 0.5;
            for (let i = 0; i < cfg.count; i++) {
                spawnParticle(cfg, cx, cy);
            }
            particleTimer = setTimeout(spawnBatch, cfg.interval);
        }
        spawnBatch();
        runParticleTick();
    }

    function spawnParticle(cfg, cx, cy) {
        const p   = document.createElement('div');
        const size  = rand(cfg.size[0], cfg.size[1]);
        const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
        const shape = cfg.shapes[Math.floor(Math.random() * cfg.shapes.length)];
        const life  = Math.round(rand(cfg.life[0], cfg.life[1]));
        const spd   = rand(cfg.speed[0], cfg.speed[1]);

        // Random angle in full 360°
        const angle = Math.random() * Math.PI * 2;
        const vx    = Math.cos(angle) * spd;
        const vy    = Math.sin(angle) * spd;

        // Увеличенный случайный разброс от центра карточки
        const ox = (Math.random() - 0.5) * 120;
        const oy = (Math.random() - 0.5) * 120;
        const startX = cx + ox;
        const startY = cy + oy;

        p.className = 'particle';
        const glowSize = size * 2.5;

        if (shape === 'star') {
            p.style.cssText = `
                width:${size}px; height:${size}px;
                background: ${color};
                box-shadow: 0 0 ${glowSize}px ${color};
                left:0px; top:0px;
                opacity:0;
                clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            `;
        } else if (shape === 'diamond') {
            p.style.cssText = `
                width:${size}px; height:${size}px;
                background: ${color};
                box-shadow: 0 0 ${glowSize}px ${color};
                left:0px; top:0px;
                opacity:0;
                clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
            `;
        } else {
            p.style.cssText = `
                width:${size}px; height:${size}px;
                background: ${color};
                box-shadow: 0 0 ${glowSize}px ${color}, 0 0 ${glowSize*2}px ${color}44;
                left:0px; top:0px;
                opacity:0;
                border-radius:50%;
            `;
        }

        // Добавляем частицы внутрь overlay, чтобы они находились между фоном overlay и самой карточкой
        overlay.appendChild(p);
        activeParticles.push({
            el: p,
            x: startX, y: startY,
            vx, vy,
            halfW: size / 2,
            halfH: size / 2,
            life, maxLife: life,
            drag: 0.985,   // Уменьшенное сопротивление воздуха для большего размаха
            gravity: 0,    // no gravity: they float outward symmetrically
        });
    }

    function runParticleTick() {
        function tick() {
            particleRafId = requestAnimationFrame(tick);
            for (let i = activeParticles.length - 1; i >= 0; i--) {
                const p = activeParticles[i];
                p.life--;
                p.x  += p.vx;
                p.y  += p.vy;
                p.vx *= p.drag;
                p.vy *= p.drag;

                const progress = p.life / p.maxLife;  // 1→0 as particle ages

                // Smooth fade: ease-in (quick appear) then ease-out (long fade)
                let opacity;
                if (progress > 0.85) {
                    // First 15% of life: fade IN
                    opacity = (1 - progress) / 0.15;
                } else {
                    // Rest: fade out gently using a curve
                    opacity = Math.pow(progress / 0.85, 0.6);
                }

                // Slight scale-down as they travel
                const scale = 0.4 + progress * 0.6;

                // GPU-ускоренное перемещение через translate3d вместо left/top (избавляет от лагов и reflow)
                p.el.style.transform = `translate3d(${p.x - p.halfW}px, ${p.y - p.halfH}px, 0) scale(${scale}) rotate(${(1 - progress) * 360}deg)`;
                p.el.style.opacity   = Math.max(0, Math.min(1, opacity));

                if (p.life <= 0) {
                    p.el.remove();
                    activeParticles.splice(i, 1);
                }
            }
        }
        cancelAnimationFrame(particleRafId);
        tick();
    }

    function stopParticles() {
        clearTimeout(particleTimer);
        cancelAnimationFrame(particleRafId);
        activeParticles.forEach(p => p.el.remove());
        activeParticles = [];
    }

    // =========================================
    // 7. LOCAL IMAGE RESOLVER
    //    Paths starting with "images/" are served
    //    relative to album.html — works directly
    //    when all files are in the same folder.
    //    Absolute URLs pass through unchanged.
    // =========================================
    function resolveImage(src, fallbackIndex) {
        if (!src) return `https://picsum.photos/seed/fallback${fallbackIndex}/400/534`;
        // If already a full URL, return as-is
        if (/^https?:\/\//i.test(src)) return src;
        // Otherwise treat as relative path (e.g. "images/1.jpg")
        return src;
    }

    // =========================================
    // UTILITIES
    // =========================================
    function rand(min, max) { return min + Math.random() * (max - min); }
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getDemoData() {
        return [
            { title:'Мощный',           image:'images/1.png',               rarity:'common',    description:'Тихий заснеженный лес на рассвете. Иней превращает каждую ветку в хрустальный узор, а тишина здесь настолько плотная, что слышно, как падает снег.' },
            { title:'Ночной город',     image:'https://picsum.photos/seed/city22/400/534',      rarity:'rare',      description:'Мегаполис в три часа ночи. Неоновые вывески отражаются в лужах после дождя, и город кажется двойником самого себя — перевёрнутым и живым.' },
            { title:'Золотой закат',    image:'https://picsum.photos/seed/sunset3/400/534',     rarity:'very-rare', description:'Последние пятнадцать минут перед тем, как солнце скрывается за горизонтом. В это время небо горит так, что кажется — за ним скрывается другой мир.' },
            { title:'Шторм над морем',  image:'https://picsum.photos/seed/storm44/400/534',     rarity:'epic',      description:'Стихия, которую невозможно остановить. Волны высотой с пятиэтажный дом сталкиваются с утёсами, а молнии освещают небо так, будто боги устроили войну.' },
            { title:'Звёздный вихрь',   image:'https://picsum.photos/seed/galaxy5/400/534',     rarity:'legendary', description:'Место, где заканчиваются карты и начинается легенда. Говорят, те, кто видел этот водоворот звёзд вживую, уже не могли смотреть на обычное небо без слёз.' },
            { title:'Старый маяк',      image:'https://picsum.photos/seed/lighthouse6/400/534', rarity:'common',    description:'Построен в 1847 году. За эти годы он пережил семь штормов, три войны и бесчисленное количество туманных ночей. Свет не гас ни разу.' },
            { title:'Горное озеро',     image:'https://picsum.photos/seed/lake77/400/534',      rarity:'rare',      description:'На высоте 3200 метров над уровнем моря. Вода настолько чистая и холодная, что отражение гор в ней чётче, чем сами горы.' },
            { title:'Кристальная пещера', image:'https://picsum.photos/seed/cave88/400/534',    rarity:'very-rare', description:'Кристаллы селенита вырастали здесь миллионы лет. Самый большой из них — 11 метров в длину. Внутри постоянно 58°C, и без защитного костюма человек потеряет сознание за 10 минут.' },
            { title:'Пурпурный туман',  image:'https://picsum.photos/seed/fog99/400/534',       rarity:'epic',      description:'Феномен, который наблюдается только в одном месте на Земле два раза в год. Местные жители называют его «дыханием леса» и не заходят в туман в одиночку.' },
            { title:'Врата богов',      image:'https://picsum.photos/seed/gate10/400/534',      rarity:'legendary', description:'Древняя каменная арка, возраст которой не поддаётся датировке. Ни одна цивилизация в радиусе тысячи километров не оставила записей о её строительстве. Она просто была всегда.' },
        ];
    }

    // ---- Boot ----
    loadData();

})();