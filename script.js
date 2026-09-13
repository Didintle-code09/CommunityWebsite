/* =========================================================================
   MMOTONG / PERSKEBUILT — COMMUNITY ARCHIVE
   A project by Didintle Moratamotho

   How the scroll animation works
   ------------------------------
   One requestAnimationFrame loop runs while the page is scrolling. For each
   element marked [data-scene] it computes a progress value from 0 to 1 and
   writes it to that element as the custom property --p. The stylesheet does
   the rest, so this file never sets individual styles like top or width.

   Everything that only needs to happen once (a heading appearing, a line
   drawing itself) uses an IntersectionObserver instead, which costs nothing
   while scrolling.

   Measurements (element heights and offsets) are cached and only recomputed
   on resize, so the scroll loop never forces the browser to re-lay-out.
   ========================================================================= */

(function () {
  'use strict';

  /* Set before first paint so the loader can cover the page. */
  document.documentElement.classList.add('js');

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)');
  var NARROW = window.matchMedia('(max-width: 860px)');

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('is-loading');

    splitText();
    checkImages();
    initLoader();
    initNav();
    initMenu();
    initObservers();
    initCounters();
    initCompare();
    initAudio();
    initCursor();
    initScroll();
  });

  /* ---------------------------------------------------------------------
     TEXT SPLITTING
     Wraps characters or words in spans so they can be animated one by one.
     The original text stays readable to screen readers because the wrapper
     keeps the same text content.
     --------------------------------------------------------------------- */
  function splitText() {
    var nodes = document.querySelectorAll('[data-split]');

    Array.prototype.forEach.call(nodes, function (node) {
      var mode = node.getAttribute('data-split');
      var text = node.textContent;
      var parts = mode === 'words' ? text.split(/(\s+)/) : text.split('');
      var frag = document.createDocumentFragment();
      var index = 0;

      parts.forEach(function (part) {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var span = document.createElement('span');
        span.className = mode === 'words' ? 'word' : 'char';
        span.style.setProperty(mode === 'words' ? '--wi' : '--ci', index);
        span.textContent = part;
        frag.appendChild(span);
        index++;
      });

      node.setAttribute('aria-label', text);
      node.textContent = '';
      node.appendChild(frag);
    });
  }

  /* ---------------------------------------------------------------------
     IMAGE SLOTS
     Photographs have not been supplied yet. Any image that fails to load
     marks its plate .is-empty, which swaps in the "Photograph wanted" card
     describing the picture the archive is looking for. Drop a real file in
     /images with the same name and the photograph simply appears.
     --------------------------------------------------------------------- */
  function checkImages() {
    var imgs = document.querySelectorAll('.plate__img');

    Array.prototype.forEach.call(imgs, function (img) {
      var plate = img.closest('.plate') || img.parentElement;

      var fail = function () { if (plate) plate.classList.add('is-empty'); };
      var pass = function () { if (plate) plate.classList.remove('is-empty'); };

      if (img.complete) {
        if (img.naturalWidth === 0) fail(); else pass();
      } else {
        img.addEventListener('error', fail);
        img.addEventListener('load', pass);
      }
    });
  }

  /* ---------------------------------------------------------------------
     LOADER
     The line tracks real loading where possible, then always finishes.
     --------------------------------------------------------------------- */
  function initLoader() {
    var loader = document.getElementById('loader');
    if (!loader) return;

    var line = loader.querySelector('.loader__line');
    var num = loader.querySelector('.loader__num');
    var value = 0;
    var target = 12;
    var done = false;
    var settled = false;

    var imgs = document.querySelectorAll('img');
    var total = imgs.length || 1;
    var seen = 0;

    var tick = function () {
      seen++;
      target = 12 + Math.round((seen / total) * 76);
    };

    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete) { tick(); return; }
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    });

    window.addEventListener('load', function () { settled = true; });
    /* Never let a slow asset hold the story hostage. */
    setTimeout(function () { settled = true; }, 2600);

    var step = function () {
      if (settled) target = 100;
      value = lerp(value, target, settled ? 0.24 : 0.08);
      if (value > 99.4) value = 100;

      if (line) line.style.transform = 'scaleX(' + (value / 100) + ')';
      if (num) num.textContent = Math.round(value);

      if (value >= 100 && !done) {
        done = true;
        setTimeout(finish, 320);
        return;
      }
      requestAnimationFrame(step);
    };

    var finish = function () {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      /* Removing it from the tree keeps it out of the tab order. */
      setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 900);
      measure();
      update();
    };

    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------------
     NAVIGATION
     --------------------------------------------------------------------- */
  function initNav() {
    var nav = document.getElementById('nav');
    var links = document.querySelectorAll('.nav__links a[data-nav]');
    var hero = document.querySelector('.hero');

    NAV = { el: nav, links: links, hero: hero };
  }

  var NAV = null;

  function initMenu() {
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('menu');
    if (!toggle || !menu) return;

    var items = menu.querySelectorAll('.menu__link');
    Array.prototype.forEach.call(items, function (item, i) {
      item.style.setProperty('--i', i);
    });

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        var first = menu.querySelector('.menu__link');
        if (first) first.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    Array.prototype.forEach.call(items, function (item) {
      item.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     ONE-SHOT REVEALS
     --------------------------------------------------------------------- */
  function initObservers() {
    var targets = document.querySelectorAll(
      '[data-reveal], .opener, .decade, .archive__title, .credits__name, .facts__item'
    );

    Array.prototype.forEach.call(document.querySelectorAll('.facts__item'), function (el, i) {
      el.style.setProperty('--i', i);
    });

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     NUMBER COUNTERS
     Counts up once. The accessible value is always in the DOM as text, so
     assistive technology never reads a partial number.
     --------------------------------------------------------------------- */
  function initCounters() {
    var counts = document.querySelectorAll('.count');
    if (!counts.length) return;

    var run = function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var suffix = el.getAttribute('data-suffix') || '';
      var out = el.querySelector('.count__num');
      if (!out || isNaN(end)) return;

      if (REDUCED.matches) return;

      var start = performance.now();
      var dur = 1500;

      var frame = function (now) {
        var t = clamp((now - start) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = end * eased;
        out.textContent = format(value, decimals) + suffix;
        if (t < 1) requestAnimationFrame(frame);
        else out.textContent = format(end, decimals) + suffix;
      };
      requestAnimationFrame(frame);
    };

    var format = function (value, decimals) {
      var fixed = value.toFixed(decimals);
      var parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
      return parts.join('.');
    };

    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    Array.prototype.forEach.call(counts, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     THEN & NOW
     Scroll drives the divider, but as soon as someone takes hold of the
     handle, their input wins until they leave the section.
     --------------------------------------------------------------------- */
  var COMPARE = null;

  function initCompare() {
    var frame = document.querySelector('.compare__frame');
    var range = document.getElementById('compare-range');
    if (!frame || !range) return;

    COMPARE = { frame: frame, range: range, manual: false };

    var apply = function (value) {
      frame.style.setProperty('--c', value);
    };
    apply(range.value);

    range.addEventListener('input', function () {
      COMPARE.manual = true;
      apply(range.value);
    });
    range.addEventListener('keydown', function () { COMPARE.manual = true; });

    COMPARE.set = function (value) {
      if (COMPARE.manual) return;
      range.value = Math.round(value);
      apply(value);
    };
    COMPARE.release = function () { COMPARE.manual = false; };
  }

  /* ---------------------------------------------------------------------
     MEMORY RECORDINGS
     No audio files exist yet. Put a path in data-audio and the player turns
     itself on: nothing here pretends to play something that isn't there.
     --------------------------------------------------------------------- */
  function initAudio() {
    var blocks = document.querySelectorAll('.audio[data-audio]');

    Array.prototype.forEach.call(blocks, function (block) {
      var src = block.getAttribute('data-audio');
      var btn = block.querySelector('.audio__btn');
      var status = block.querySelector('.audio__status');
      if (!src || !btn) return;

      var audio = new Audio(src);
      block.classList.add('is-ready');
      btn.disabled = false;
      btn.setAttribute('aria-label', 'Play recording');
      if (status) status.textContent = 'Recorded memory';

      btn.addEventListener('click', function () {
        if (audio.paused) {
          audio.play();
          block.classList.add('is-playing');
          btn.setAttribute('aria-label', 'Pause recording');
        } else {
          audio.pause();
          block.classList.remove('is-playing');
          btn.setAttribute('aria-label', 'Play recording');
        }
      });

      audio.addEventListener('ended', function () {
        block.classList.remove('is-playing');
        btn.setAttribute('aria-label', 'Play recording');
      });
    });
  }

  /* ---------------------------------------------------------------------
     CURSOR (desktop only)
     --------------------------------------------------------------------- */
  function initCursor() {
    var cursor = document.querySelector('.cursor');
    if (!cursor || !FINE.matches || REDUCED.matches) return;

    var label = cursor.querySelector('.cursor__label');
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    var cx = x;
    var cy = y;
    var live = false;

    document.addEventListener('mousemove', function (e) {
      x = e.clientX;
      y = e.clientY;
      if (!live) { live = true; cursor.classList.add('is-live'); }

      var hot = e.target.closest ? e.target.closest('[data-cursor], a, button, summary') : null;
      cursor.classList.toggle('is-hot', !!hot);
      if (label) label.textContent = hot && hot.getAttribute('data-cursor') ? hot.getAttribute('data-cursor') : '';
    });

    var follow = function () {
      cx = lerp(cx, x, 0.18);
      cy = lerp(cy, y, 0.18);
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  /* =====================================================================
     THE SCROLL ENGINE
     ===================================================================== */
  var scenes = [];
  var chapters = [];
  var ticking = false;
  var vh = window.innerHeight;

  function initScroll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-scene]'), function (el) {
      scenes.push({
        el: el,
        kind: el.getAttribute('data-scene'),
        top: 0,
        height: 0,
        setup: false
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.chapter[data-chapter]'), function (el) {
      chapters.push({ el: el, top: 0, height: 0, num: el.getAttribute('data-chapter'), title: el.getAttribute('data-title'), nav: el.getAttribute('data-nav') });
    });

    measure();
    update();

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); }, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(function () { measure(); update(); }, 220); });

    /* Late-loading fonts and images change offsets. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); update(); });
    }
    window.addEventListener('load', function () { measure(); update(); });
  }

  function request() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  /* All layout reads happen here and nowhere else. */
  function measure() {
    vh = window.innerHeight;
    var y = window.pageYOffset;

    scenes.forEach(function (scene) {
      var rect = scene.el.getBoundingClientRect();
      scene.top = rect.top + y;
      scene.height = rect.height;
      if (!scene.setup) { setupScene(scene); scene.setup = true; }
      if (scene.remeasure) scene.remeasure();
    });

    chapters.forEach(function (chapter) {
      var rect = chapter.el.getBoundingClientRect();
      chapter.top = rect.top + y;
      chapter.height = rect.height;
    });
  }

  function update() {
    var y = window.pageYOffset;
    var docHeight = document.documentElement.scrollHeight - vh;

    /* Overall reading progress. */
    document.documentElement.style.setProperty('--scroll', docHeight > 0 ? clamp(y / docHeight, 0, 1) : 0);

    updateNav(y);
    updateChapter(y);

    scenes.forEach(function (scene) {
      /* How far through this scene's scroll runway we are. A pinned scene
         is "running" while its own height passes the viewport. */
      var travel = Math.max(scene.height - vh, 1);
      var p = clamp((y - scene.top) / travel, 0, 1);

      var near = y + vh > scene.top - vh && y < scene.top + scene.height + vh;
      if (!near) return;

      scene.el.style.setProperty('--p', p.toFixed(4));
      if (scene.run) scene.run(p, y);
    });
  }

  function updateNav(y) {
    if (!NAV || !NAV.el) return;
    var past = NAV.hero ? NAV.hero.offsetHeight * 0.4 : 400;
    NAV.el.classList.toggle('is-solid', y > Math.min(past, vh));
  }

  /* Chapter indicator, with a rolling text change. */
  var currentChapter = null;

  function updateChapter(y) {
    var indicator = document.querySelector('.indicator');
    if (!indicator) return;

    var mid = y + vh * 0.42;
    var found = null;

    chapters.forEach(function (chapter) {
      if (mid >= chapter.top && mid < chapter.top + chapter.height) found = chapter;
    });

    indicator.classList.toggle('is-on', !!found);
    if (!found || found === currentChapter) return;

    var numRoll = indicator.querySelector('.indicator__roll--num');
    var titleRoll = indicator.querySelector('.indicator__roll--title');

    roll(numRoll, found.num);
    roll(titleRoll, found.title);
    currentChapter = found;

    if (NAV && NAV.links) {
      Array.prototype.forEach.call(NAV.links, function (link) {
        link.classList.toggle('is-current', link.getAttribute('data-nav') === found.nav);
      });
    }
  }

  function roll(wrap, text) {
    if (!wrap) return;
    var node = wrap.querySelector('.indicator__text');
    if (!node || node.textContent === text) return;

    wrap.classList.remove('is-in');
    wrap.classList.add('is-out');

    setTimeout(function () {
      node.textContent = text;
      wrap.classList.remove('is-out');
      /* Force a reflow so the entry animation restarts cleanly. */
      void wrap.offsetWidth;
      wrap.classList.add('is-in');
    }, 260);
  }

  /* =====================================================================
     SCENE BEHAVIOUR
     Each scene type gets a run(p) called with its own 0–1 progress. Only
     scenes that need per-frame logic beyond a CSS variable define one.
     ===================================================================== */
  function setupScene(scene) {
    switch (scene.kind) {
      case 'land': setupLand(scene); break;
      case 'uncover': setupUncover(scene); break;
      case 'portrait': setupPortrait(scene); break;
      case 'place': setupPlace(scene); break;
      case 'compare': setupCompare(scene); break;
      case 'memories': setupMemories(scene); break;
      case 'reel': setupReel(scene); break;
      case 'future': setupFuture(scene); break;
      default: break;
    }
  }

  /* --- CHAPTER 01: sticky frame, swapping layers ---------------------- */
  function setupLand(scene) {
    var steps = scene.el.querySelectorAll('.land__step');
    var layers = scene.el.querySelectorAll('.land__layer');
    var move = scene.el.querySelector('.land__move');
    var tag = scene.el.querySelector('.land__tag-text');
    var active = -1;

    scene.run = function () {
      /* The live step is the one closest to the middle of the screen. */
      var mid = vh * 0.5;
      var best = 0;
      var bestDist = Infinity;

      Array.prototype.forEach.call(steps, function (step, i) {
        var rect = step.getBoundingClientRect();
        var dist = Math.abs(rect.top + rect.height / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });

      if (best === active) return;
      active = best;

      var step = steps[best];
      var want = step.getAttribute('data-layer');

      Array.prototype.forEach.call(steps, function (s, i) {
        s.classList.toggle('is-live', i === best);
      });

      Array.prototype.forEach.call(layers, function (layer) {
        layer.classList.toggle('is-active', layer.getAttribute('data-layer') === want);
      });

      if (move) {
        move.style.setProperty('--lz', step.getAttribute('data-zoom') || 1);
        move.style.setProperty('--lx', (step.getAttribute('data-x') || 0) + '%');
        move.style.setProperty('--ly', (step.getAttribute('data-y') || 0) + '%');
      }

      if (tag) {
        var text = step.getAttribute('data-tag');
        if (tag.textContent !== text) {
          tag.classList.add('is-out');
          setTimeout(function () {
            tag.textContent = text;
            tag.classList.remove('is-out');
          }, 260);
        }
      }
    };
  }

  /* --- CHAPTER 02: the staged uncovering ------------------------------ */
  function setupUncover(scene) {
    var reveal = scene.el.querySelector('.uncover__reveal');
    var pct = scene.el.querySelector('.uncover__pct');
    var stages = scene.el.querySelectorAll('.uncover__stages li');
    var steps = [0.2, 0.5, 0.8, 1];
    var last = -1;

    scene.run = function (p) {
      /* Four deliberate stops rather than a continuous slide. */
      var index = p < 0.22 ? 0 : p < 0.46 ? 1 : p < 0.7 ? 2 : 3;
      if (index === last) return;
      last = index;

      var value = steps[index];
      if (reveal) reveal.style.setProperty('--u', value);
      if (pct) pct.textContent = Math.round(value * 100);

      Array.prototype.forEach.call(stages, function (li, i) {
        li.classList.toggle('is-done', i <= index);
      });
    };
  }

  /* --- CHAPTER 03: portrait lines appearing in turn ------------------- */
  function setupPortrait(scene) {
    var timed = scene.el.querySelectorAll('[data-at]');

    scene.run = function (p) {
      Array.prototype.forEach.call(timed, function (el) {
        var at = parseFloat(el.getAttribute('data-at'));
        el.classList.toggle('is-on', p >= at);
      });
    };
  }

  /* --- CHAPTER 04: camera push toward a detail ------------------------ */
  function setupPlace(scene) {
    var zoom = scene.el.querySelector('.place__zoom');
    var focus = scene.el.getAttribute('data-focus');
    var timed = scene.el.querySelectorAll('[data-at]');

    if (zoom && focus) zoom.style.setProperty('--focus', focus);

    scene.run = function (p) {
      Array.prototype.forEach.call(timed, function (el) {
        var at = parseFloat(el.getAttribute('data-at'));
        var untilAttr = el.getAttribute('data-until');
        var until = untilAttr === null ? Infinity : parseFloat(untilAttr);
        el.classList.toggle('is-on', p >= at && p < until);
      });
    };
  }

  /* --- CHAPTER 05: scroll drives the divider unless a hand is on it --- */
  function setupCompare(scene) {
    scene.run = function (p) {
      if (!COMPARE) return;
      if (p <= 0.01 || p >= 0.99) COMPARE.release();
      /* Starts almost entirely "then", ends on "now". */
      var value = 92 - clamp((p - 0.12) / 0.62, 0, 1) * 92;
      COMPARE.set(value);
    };
  }

  /* --- CHAPTER 06: gentle parallax between fragments ------------------ */
  function setupMemories(scene) {
    var items = scene.el.querySelectorAll('[data-speed]');

    scene.run = function (p) {
      if (NARROW.matches || REDUCED.matches) return;
      var shift = (p - 0.5) * 2;
      Array.prototype.forEach.call(items, function (el) {
        var speed = parseFloat(el.getAttribute('data-speed')) || 0;
        el.style.setProperty('--y', (shift * speed * 160).toFixed(1) + 'px');
      });
    };
  }

  /* --- CHAPTER 07: horizontal reel, photographs developing ------------ */
  function setupReel(scene) {
    var track = scene.el.querySelector('.reel__track');
    var cards = scene.el.querySelectorAll('.reel__card');
    var yearOut = scene.el.querySelector('.reel__year-num');
    var distance = 0;

    scene.remeasure = function () {
      if (!track) return;
      /* How far the track must travel for its last card to reach the edge. */
      distance = Math.max(track.scrollWidth - window.innerWidth + 48, 0);
    };
    scene.remeasure();

    scene.run = function (p) {
      if (!track) return;
      if (REDUCED.matches) { track.style.setProperty('--rx', '0px'); return; }

      track.style.setProperty('--rx', (distance * p).toFixed(1) + 'px');

      /* Year counter runs from the archive's earliest decade to now. */
      if (yearOut) {
        var year = Math.round(lerp(1960, 2026, p));
        if (yearOut.textContent !== String(year)) yearOut.textContent = year;
      }

      /* Each photograph develops as it crosses the middle of the screen. */
      Array.prototype.forEach.call(cards, function (card) {
        var rect = card.getBoundingClientRect();
        var centre = rect.left + rect.width / 2;
        var d = clamp(1 - Math.abs(centre - window.innerWidth * 0.42) / (window.innerWidth * 0.7), 0, 1);
        card.style.setProperty('--d', d.toFixed(3));
      });
    };
  }

  /* --- CHAPTER 08: the closing statement ------------------------------ */
  function setupFuture(scene) {
    var lines = scene.el.querySelectorAll('.future__line');

    scene.run = function (p) {
      Array.prototype.forEach.call(lines, function (line) {
        var at = parseFloat(line.getAttribute('data-at'));
        line.classList.toggle('is-on', p >= at);
      });
    };
  }

  /* ---------------------------------------------------------------------
     TIMELINE CHIPS
     Highlights the decade currently on screen.
     --------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var chips = document.querySelectorAll('.timeline__chip');
    var decades = document.querySelectorAll('.decade');
    if (!chips.length || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        Array.prototype.forEach.call(chips, function (chip) {
          chip.classList.toggle('is-current', chip.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px' });

    Array.prototype.forEach.call(decades, function (el) { io.observe(el); });
  });
})();