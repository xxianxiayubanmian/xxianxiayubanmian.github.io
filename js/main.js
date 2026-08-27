(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // 页面元素进入视口时轻量揭示，避免首屏之外内容同时出现。
  const reveal = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    reveal.forEach((el) => observer.observe(el));
  } else reveal.forEach((el) => el.classList.add('is-visible'));

  // macOS 风格代码块：为每个 figure.highlight 套上窗口边框并提供复制按钮。
  const copyFallback = (text, done) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  };
  const decorate = (fig) => {
    if (fig.closest('.mac-code')) return;
    const wrapEl = document.createElement('div'); wrapEl.className = 'mac-code';
    const head = document.createElement('div'); head.className = 'mac-code-head';
    const dots = document.createElement('span'); dots.className = 'mac-dots';
    ['r', 'y', 'g'].forEach((c) => { const i = document.createElement('i'); i.className = c; dots.appendChild(i); });
    const lang = (fig.className.match(/highlight[\s-]+([a-z0-9+#-]+)/i) || [])[1] || 'text';
    const label = document.createElement('span'); label.className = 'mac-lang'; label.textContent = lang;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mac-copy'; btn.textContent = '复制';
    const body = document.createElement('div'); body.className = 'mac-code-body';
    fig.parentNode.insertBefore(wrapEl, fig);
    body.appendChild(fig);
    head.append(dots, label, btn);
    wrapEl.append(head, body);
    btn.addEventListener('click', () => {
      const codeNode = fig.querySelector('td.code') || fig;
      const text = codeNode.innerText.replace(/\n+$/, '');
      const done = () => { btn.textContent = '已复制'; btn.classList.add('ok'); setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('ok'); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => copyFallback(text, done));
      else copyFallback(text, done);
    });
  };
  $$('figure.highlight').forEach(decorate);

  // 减弱动效判定（全部动效共享）
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== 第四批动效 =====
  // 10) 站内链接离场过渡：点击后柔光渐隐，浏览器前进返回不受影响
  if (!reduceMotion) {
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
      if (href && !href.startsWith('/') && !href.startsWith(window.location.origin)) return;
      document.body.classList.add('is-leaving');
      setTimeout(() => document.body.classList.remove('is-leaving'), 600);
    });
  }

  // 12) 正文图片柔焦揭幕
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const imgs = $$('.prose img');
    const iio = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('img-settle'); iio.unobserve(e.target); }
    }), { threshold: .15 });
    imgs.forEach((im) => { if (im.complete && im.naturalWidth === 0) return; iio.observe(im); });
  }

  // 13) 进度条到底变色
  const pbar = $('#progressBar');
  if (pbar) {
    const syncDone = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      pbar.classList.toggle('is-done', max > 0 && window.scrollY >= max - 4);
    };
    window.addEventListener('scroll', () => requestAnimationFrame(syncDone), { passive: true });
    syncDone();
  }

  // 14) 终端式开场日志（每会话仅一次）
  if (!reduceMotion && !sessionStorage.getItem('mistline-booted')) {
    sessionStorage.setItem('mistline-booted', '1');
    const log = document.createElement('div');
    log.className = 'boot-log';
    ['> mistline v1.0 loading theme…', '> morandi palette … ok', '> ready.'].forEach((t, i) => {
      const s = document.createElement('span');
      s.textContent = t;
      s.style.animationDelay = `${i * .22}s`;
      log.appendChild(s);
    });
    document.body.appendChild(log);
    setTimeout(() => log.remove(), 2600);
  }

  // 1) 通用揭示：reveal 标记、账本条目、年份线、友链卡、代码块窗口、文章标题
  const revealTargets = [
    ...$$('[data-reveal]'),
    ...$$('.entry'), ...$$('.year-mark'),
    ...$$('.friend-card'), ...$$('.mac-code'),
    ...$$('.post-title'), ...$$('.post-cover .cover-meta'), ...$$('.post-cover .cover-tags'),
  ];
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }), { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach((el) => io.observe(el));
    // 兜底：部分嵌入视图/遮挡场景 IO 不触发，load 后按几何位置补一次首屏揭示
    window.addEventListener('load', () => setTimeout(() => {
      const vh = window.innerHeight;
      revealTargets.forEach((el) => {
        if (el.classList.contains('is-visible')) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) el.classList.add('is-visible');
      });
    }, 350));
  } else revealTargets.forEach((el) => el.classList.add('is-visible'));

  // 2) 首页封面：入场定场动画已由 CSS hero-settle 完成（无滚动监听）

  // 3) 导航滚动形态：离开顶部后收窄并加投影
  const nav = $('.site-nav');
  if (nav) {
    let nTicking = false;
    const syncNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', () => {
      if (nTicking) return; nTicking = true;
      requestAnimationFrame(() => { syncNav(); nTicking = false; });
    }, { passive: true });
    syncNav();
  }

  // 4) 返回顶部按钮
  const toTop = $('#toTop');
  if (toTop) {
    let tTicking = false;
    window.addEventListener('scroll', () => {
      if (tTicking) return; tTicking = true;
      requestAnimationFrame(() => { toTop.classList.toggle('is-show', window.scrollY > 600); tTicking = false; });
    }, { passive: true });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // 4c) 标题字符级渐入：大标题（页面标题/文章标题）拆字逐个浮现
  if (!reduceMotion) {
    $$('.page-title, .post-title').forEach((h) => {
      const walk = (node) => {
        if (node.nodeType === 3) {
          const frag = document.createDocumentFragment();
          const chars = [...node.textContent];
          if (!chars.some((c) => c.trim())) { frag.appendChild(node.cloneNode()); return frag; }
          chars.forEach((ch, idx) => {
            if (!ch.trim()) { frag.appendChild(document.createTextNode(ch)); return; }
            const s = document.createElement('span');
            s.className = 'char-rise';
            s.style.animationDelay = `${Math.min(idx * 45, 900)}ms`;
            s.textContent = ch;
            frag.appendChild(s);
          });
          return frag;
        }
        if (node.nodeType === 1 && node.childNodes) {
          [...node.childNodes].forEach((child) => {
            const r = walk(child);
            if (r) { node.replaceChild(r, child); }
          });
        }
        return null;
      };
      // 只拆直接文本，保留 <br> 等结构
      h.querySelectorAll('.dot-accent').forEach(() => {});
      [...h.childNodes].forEach((child) => {
        if (child.nodeType === 3 && child.textContent.trim()) {
          const frag = walk(child);
          if (frag) h.replaceChild(frag, child);
        }
      });
    });
  }

  // 4d) 封面离场幕布：滚过首屏后底部柔光收起
  const heroEl = $('.hero');
  if (heroEl) {
    let hbTicking = false;
    const syncHero = () => heroEl.classList.toggle('is-left', window.scrollY > window.innerHeight * .55);
    window.addEventListener('scroll', () => {
      if (hbTicking) return; hbTicking = true;
      requestAnimationFrame(() => { syncHero(); hbTicking = false; });
    }, { passive: true });
    syncHero();
  }

  const tocFab = $('#tocFab');
  const desktopToc = $('.toc');
  if (tocFab && desktopToc && desktopToc.querySelector('a')) {
    const sheet = document.createElement('nav');
    sheet.className = 'toc-sheet';
    sheet.setAttribute('aria-label', '章节目录');
    sheet.innerHTML = desktopToc.innerHTML;
    document.body.appendChild(sheet);
    tocFab.hidden = false;
    let fTicking = false;
    window.addEventListener('scroll', () => {
      if (fTicking) return; fTicking = true;
      requestAnimationFrame(() => {
        tocFab.classList.toggle('is-show', window.scrollY > 500);
        fTicking = false;
      });
    }, { passive: true });
    tocFab.addEventListener('click', () => sheet.classList.toggle('is-open'));
    sheet.addEventListener('click', (ev) => {
      if (ev.target.closest('a')) sheet.classList.remove('is-open');
    });
    document.addEventListener('click', (ev) => {
      if (!sheet.classList.contains('is-open')) return;
      if (!ev.target.closest('.toc-sheet') && !ev.target.closest('#tocFab')) sheet.classList.remove('is-open');
    });
    // 抽屉内同步阅读进度高亮
    const syncSheet = () => {
      const src = desktopToc.querySelector('a.active');
      const dst = sheet.querySelector('a.active');
      if (dst) dst.classList.remove('active');
      if (src) {
        const href = src.getAttribute('href');
        const twin = [...sheet.querySelectorAll('a')].find((a) => a.getAttribute('href') === href);
        if (twin) twin.classList.add('active');
      }
    };
    const io2 = new MutationObserver(syncSheet);
    io2.observe(desktopToc, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // 5) 页面整体淡入（后台标签 rAF 会被挂起，超时兜底确保必然完成）
  if (!reduceMotion) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity .45s ease';
    const showBody = () => { document.body.style.opacity = '1'; };
    requestAnimationFrame(() => requestAnimationFrame(showBody));
    setTimeout(showBody, 400);
  }

  // 6) 返回顶部按钮升级为进度环：环随页面阅读进度填充
  if (toTop) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 44 44');
    ring.setAttribute('class', 'to-top-ring');
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', '22'); circ.setAttribute('cy', '22'); circ.setAttribute('r', '20');
    circ.setAttribute('fill', 'none'); circ.setAttribute('stroke-width', '1.6');
    ring.appendChild(circ);
    toTop.appendChild(ring);
    const C = 2 * Math.PI * 20;
    circ.style.strokeDasharray = `${C}`;
    let rTicking = false;
    const syncRing = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      circ.style.strokeDashoffset = `${C * (1 - (max > 0 ? window.scrollY / max : 0))}`;
    };
    window.addEventListener('scroll', () => {
      if (rTicking) return; rTicking = true;
      requestAnimationFrame(() => { syncRing(); rTicking = false; });
    }, { passive: true });
    syncRing();
  }

  // 7) 文章卡片鼠标光晕：高亮跟随指针的柔和径向光
  if (!reduceMotion && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.post-card, .friend-card, .toc').forEach((card) => {
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--glow-x', `${ev.clientX - r.left}px`);
        card.style.setProperty('--glow-y', `${ev.clientY - r.top}px`);
      }, { passive: true });
    });
  }

  // 8) 关于页统计数字：进入视口时从 0 滚动到目标值
  const statNums = $$('.about-stats b');
  if (statNums.length && !reduceMotion && 'IntersectionObserver' in window) {
    const sio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      sio.unobserve(e.target);
      const el = e.target;
      const target = parseInt(el.textContent, 10) || 0;
      if (!/^\d+$/.test(String(el.textContent).trim())) return;
      const t0 = performance.now();
      const dur = 900;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: .4 });
    statNums.forEach((el) => sio.observe(el));
  }

  // 9) 章节小节进入时给标题加下划线描画
  if (!reduceMotion) {
    const heads = $$('.prose h2, .prose h3');
    if (heads.length && 'IntersectionObserver' in window) {
      const hio = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-seen'); hio.unobserve(e.target); }
      }), { threshold: .8 });
      heads.forEach((h) => hio.observe(h));
    }
  }

  // Gitalk 评论挂载：仅在文章页且局部配置存在时初始化。
  const gtBox = $('#gitalk-container');
  const cfgTag = $('#gitalk-config');
  if (gtBox && cfgTag) {
    const bootGitalk = () => {
      if (typeof Gitalk === 'undefined') return;
      let cfg = {};
      try { cfg = JSON.parse(cfgTag.textContent); } catch (e) {}
      new Gitalk(Object.assign({ distractionFreeMode: false }, cfg)).render('gitalk-container');
    };
    if (typeof Gitalk !== 'undefined') bootGitalk();
    else window.addEventListener('load', bootGitalk);
  }

  // 目录滚动联动：阅读位置对应的章节在侧栏目录中保持高亮。
  const tocLinks = $$('.toc a');
  if (tocLinks.length) {
    const pairs = [];
    tocLinks.forEach((linkEl) => {
      let rawId = '';
      try { rawId = decodeURIComponent((linkEl.getAttribute('href') || '').replace(/^#/, '')); } catch (e) {}
      const targetEl = rawId && document.getElementById(rawId);
      if (targetEl) pairs.push({ linkEl, targetEl });
    });
    if (pairs.length) {
      const setActive = () => {
        let current = null;
        const probe = window.innerHeight * .32;
        pairs.forEach((p) => { if (p.targetEl.getBoundingClientRect().top <= probe) current = p; });
        tocLinks.forEach((l) => l.classList.remove('active'));
        if (current) current.linkEl.classList.add('active');
      };
      let ticking = false;
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { setActive(); ticking = false; }); } }, { passive: true });
      setActive();
    }
  }

  const toggle = $('#navToggle');
  const menu = $('#mobileMenu');
  if (toggle && menu) toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
  });

  // Hero 文案缓慢轮换，让首屏保持呼吸感。
  const word = $('#heroWord');
  if (word && word.dataset.words) {
    const words = JSON.parse(word.dataset.words);
    if (words.length > 1) {
      let index = 0;
      window.setInterval(() => {
        word.classList.add('is-changing');
        window.setTimeout(() => { index = (index + 1) % words.length; word.textContent = words[index]; word.classList.remove('is-changing'); }, 260);
      }, 3900);
    }
  }

  const bar = $('#progressBar');
  if (bar) window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }, { passive: true });

  const input = $('#searchInput');
  const ledger = $('#ledger');
  const empty = $('#emptyState');
  const clear = $('#clearSearch');
  const chips = $$('.chip');
  if (!input || !ledger) return;
  const entries = $$('.entry', ledger);
  const texts = entries.map((entry) => entry.textContent.toLowerCase());
  let activeTag = '';
  const filter = () => {
    const query = input.value.trim().toLowerCase();
    let shown = 0;
    entries.forEach((entry, i) => {
      const matchesQuery = !query || texts[i].includes(query);
      const matchesTag = !activeTag || texts[i].includes(`#${activeTag.toLowerCase()}`);
      entry.hidden = !(matchesQuery && matchesTag);
      if (!entry.hidden) shown++;
    });
    $$('.year-mark', ledger).forEach((mark) => {
      const next = mark.nextElementSibling;
      let hasVisible = false;
      let current = next;
      while (current && current.classList.contains('entry')) { if (!current.hidden) hasVisible = true; current = current.nextElementSibling; }
      mark.hidden = !hasVisible;
    });
    empty.hidden = shown > 0;
    if (clear) clear.hidden = !input.value;
  };
  input.addEventListener('input', filter);
  if (clear) clear.addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
  chips.forEach((chip) => chip.addEventListener('click', () => {
    activeTag = activeTag === chip.dataset.tag ? '' : chip.dataset.tag;
    chips.forEach((item) => item.classList.toggle('active', item === chip && activeTag));
    filter();
  }));
})();
