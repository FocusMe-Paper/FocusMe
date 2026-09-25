/* =========================================================================
   FocusMe demo page — players + rendering (plain JS, no dependencies)
   ========================================================================= */
(function () {
  'use strict';

  var DATA = window.DEMO_DATA;
  if (!DATA) { return; }

  /* ----------------------------------------------------------------- utils */
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) { sec = 0; }
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* deterministic decorative waveform (no decoding needed -> works from file://) */
  function makeBars(seedStr, n) {
    var h = hashSeed(seedStr + '|' + n);
    function rnd() {
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5;  h >>>= 0;
      return h / 4294967296;
    }
    var bars = [];
    for (var i = 0; i < n; i++) {
      var t = n > 1 ? i / (n - 1) : 0;
      var env = Math.pow(Math.sin(Math.PI * t), 0.45);
      bars.push(Math.max(0.10, Math.min(1, env * (0.34 + 0.66 * rnd()))));
    }
    return bars;
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  /* labels below are interpolated into markup, so escape them first */
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --------------------------------------------------------------- playback */
  var players = [];
  var redraws = [];
  var nowPlayingEl = document.getElementById('nowPlaying');
  var liveDot = document.querySelector('.live-dot');
  var currentLabel = null;

  function pauseAll(except) {
    players.forEach(function (p) { if (p !== except) { p.pause(); } });
  }

  function setNowPlaying(label) {
    currentLabel = label;
    if (nowPlayingEl) { nowPlayingEl.textContent = label ? ('Playing: ' + label) : 'Nothing playing'; }
    if (liveDot) { liveDot.classList.toggle('on', !!label); }
  }
  /* ------------------------------------------------------------ the player */
  function createPlayer(opts) {
    var root = document.createElement('div');
    var lbl = escHtml(opts.label);
    root.className = 'player';
    root.innerHTML =
      '<button class="play" type="button" aria-label="Play ' + lbl + '">' +
        '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 5.2v13.6L19 12z"/></svg>' +
        '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3.2v14H8zM12.8 5H16v14h-3.2z"/></svg>' +
      '</button>' +
      '<div class="wave-wrap" role="slider" tabindex="0" aria-label="Seek in ' + lbl + '" ' +
           'aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<canvas class="wave" height="36"></canvas>' +
      '</div>' +
      '<span class="time" aria-hidden="true">0:00</span>';

    var playBtn = root.querySelector('.play');
    var wrapEl = root.querySelector('.wave-wrap');
    var canvas = root.querySelector('canvas');
    var timeEl = root.querySelector('.time');
    var ctx = canvas.getContext('2d');

    var audio = new Audio();
    audio.preload = 'metadata';
    audio.src = opts.src;

    var bars = [];
    var progress = 0;
    var raf = null;
    var dragging = false;

    function measure() {
      var dpr = window.devicePixelRatio || 1;
      var w = Math.max(24, wrapEl.clientWidth || 60);
      var h = 36;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.max(14, Math.min(110, Math.round(w / 5.5)));
      bars = makeBars(opts.seed, count);
      draw();
    }

    function draw() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.width / dpr;
      var h = 36;
      if (!w) { return; }
      var cWave = cssVar('--wave', '#c9d1e4');
      var cAcc = cssVar('--accent', '#4f63f0');
      var n = bars.length;
      if (!n) { return; }

      ctx.clearRect(0, 0, w, h);

      var gap = n > 46 ? 1.4 : (n > 30 ? 2 : 2.6);
      var bw = (w - gap * (n - 1)) / n;
      if (bw < 1) { gap = 1; bw = (w - (n - 1)) / n; }
      var radius = Math.min(bw / 2, 1.8);
      var maxH = h - 6;

      function paint(color, clipW) {
        if (clipW <= 0) { return; }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, clipW, h);
        ctx.clip();
        ctx.fillStyle = color;
        for (var i = 0; i < n; i++) {
          var bh = Math.max(2, bars[i] * maxH);
          roundRect(ctx, i * (bw + gap), (h - bh) / 2, bw, bh, radius);
          ctx.fill();
        }
        ctx.restore();
      }

      paint(cWave, w);
      paint(cAcc, w * progress);
    }

    function sync() {
      var d = audio.duration;
      progress = (isFinite(d) && d > 0) ? Math.min(1, audio.currentTime / d) : 0;
      timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(isFinite(d) ? d : 0);
      wrapEl.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      draw();
    }

    function tick() {
      sync();
      raf = (!audio.paused && !audio.ended) ? requestAnimationFrame(tick) : null;
    }

    function stopRaf() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    playBtn.addEventListener('click', function () {
      if (audio.paused || audio.ended) {
        if (audio.ended) { audio.currentTime = 0; }
        var pr = audio.play();
        if (pr && pr.catch) { pr.catch(function () { root.classList.add('is-error'); }); }
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', function () {
      root.classList.add('is-playing');
      setNowPlaying(opts.shortLabel || opts.label);
      stopRaf();
      tick();
    });

    audio.addEventListener('pause', function () {
      root.classList.remove('is-playing');
      stopRaf();
      sync();
      if (currentLabel === (opts.shortLabel || opts.label)) { setNowPlaying(null); }
    });

    audio.addEventListener('ended', function () {
      root.classList.remove('is-playing');
      stopRaf();
      sync();
      if (currentLabel === (opts.shortLabel || opts.label)) { setNowPlaying(null); }
    });

    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('error', function () {
      root.classList.add('is-error');
      root.title = 'Audio not found: ' + opts.src;
    });

    function seekFromEvent(e) {
      var d = audio.duration;
      if (!isFinite(d) || d <= 0) { return; }
      var rect = wrapEl.getBoundingClientRect();
      progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = progress * d;
      timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(d);
      draw();
    }

    wrapEl.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (wrapEl.setPointerCapture) { try { wrapEl.setPointerCapture(e.pointerId); } catch (err) {} }
      seekFromEvent(e);
      e.preventDefault();
    });
    wrapEl.addEventListener('pointermove', function (e) { if (dragging) { seekFromEvent(e); } });
    wrapEl.addEventListener('pointerup', function (e) {
      dragging = false;
      if (wrapEl.releasePointerCapture) { try { wrapEl.releasePointerCapture(e.pointerId); } catch (err) {} }
    });
    wrapEl.addEventListener('pointercancel', function () { dragging = false; });

    wrapEl.addEventListener('keydown', function (e) {
      var d = audio.duration;
      if (!isFinite(d) || d <= 0) { return; }
      var step = d * 0.05;
      if (e.key === 'ArrowRight') { audio.currentTime = Math.min(d, audio.currentTime + step); sync(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - step); sync(); e.preventDefault(); }
      else if (e.key === 'Home') { audio.currentTime = 0; sync(); e.preventDefault(); }
      else if (e.key === 'End') { audio.currentTime = Math.max(0, d - 0.05); sync(); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { playBtn.click(); e.preventDefault(); }
    });

    var api = {
      el: root,
      audio: audio,
      label: opts.label,
      pause: function () { if (!audio.paused) { audio.pause(); } },
      redraw: function () { measure(); sync(); }
    };

    players.push(api);
    redraws.push(api);

    if (window.ResizeObserver) {
      new ResizeObserver(function () { measure(); }).observe(wrapEl);
    } else {
      window.addEventListener('resize', function () { measure(); });
    }
    measure();
    sync();

    return root;
  }
  /* -------------------------------------------------------------- rendering */
  function isSystem(c) { return c.group === 'baseline' || c.group === 'ours'; }

  function buildColumn(col, sample, sysIndex) {
    var tpl = document.getElementById('columnTemplate');
    var node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.group = col.group;
    node.dataset.colId = col.suffix;

    var nameEl = node.querySelector('.col-name');
    nameEl.textContent = col.name;
    nameEl.dataset.realName = col.name;
    nameEl.title = col.blurb || col.name;

    var src = DATA.audioDir + sample.id + '-' + col.suffix + '.wav';
    var dl = node.querySelector('.col-dl');
    dl.href = src;
    dl.setAttribute('aria-label', 'Download ' + col.name + ' wav');
    node.querySelector('.col-slot').appendChild(createPlayer({
      src: src,
      label: col.name + ' - ' + sample.title,
      shortLabel: col.name + ' (' + sample.title + ')',
      seed: sample.id + '-' + col.suffix,
      group: col.group
    }));

    return node;
  }

  /* how many columns every row of the grid carries: 9 signals lay out best as
     3 rows of 3 (reference + inputs, then the systems) */
  var COLS_PER_ROW = 3;

  function buildSample(cond, sample, index) {
    var tpl = document.getElementById('sampleTemplate');
    var node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.sample-title').textContent = sample.title || ('Sample ' + (index + 1));
    node.querySelector('.sample-text').textContent = sample.text || '';
    node.querySelector('.sample-meta').textContent = sample.meta || '';

    var host = node.querySelector('.player-grid');
    var sysIndex = 0;
    var row = null;
    DATA.columns.forEach(function (col, i) {
      if (i % COLS_PER_ROW === 0) {
        row = document.createElement('div');
        row.className = 'player-row';
        host.appendChild(row);
      }
      row.appendChild(buildColumn(col, sample, isSystem(col) ? sysIndex++ : -1));
    });

    // stagger the entrance animation a little
    node.style.animationDelay = (index * 60) + 'ms';
    return node;
  }

  function buildCondition(cond) {
    var tpl = document.getElementById('conditionTemplate');
    var node = tpl.content.firstElementChild.cloneNode(true);
    node.id = 'panel-' + cond.id;
    node.setAttribute('aria-labelledby', 'tab-' + cond.id);

    var head = document.createElement('p');
    head.className = 'cond-head';
    var label = document.createElement('strong');
    label.textContent = cond.label;
    head.appendChild(label);
    if (cond.tag) {
      var tag = document.createElement('span');
      tag.className = 'tab-tag';
      tag.textContent = cond.tag;
      head.appendChild(tag);
    }
    var note = document.createElement('span');
    note.className = 'cond-note';
    note.textContent = ' ' + (cond.note || '');
    head.appendChild(note);
    node.insertBefore(head, node.firstChild);

    var list = node.querySelector('.samples');
    cond.samples.forEach(function (s, i) { list.appendChild(buildSample(cond, s, i)); });
    return node;
  }

  var panel = document.getElementById('demoPanel');
  var tabsEl = document.getElementById('demoTabs');
  var panels = {};

  if (!panel || !tabsEl || !document.getElementById('columnTemplate')) {
    document.body.classList.remove('is-loading');
    return;
  }

  DATA.conditions.forEach(function (cond, i) {
    var p = buildCondition(cond);
    if (i !== 0) { p.hidden = true; }
    panel.appendChild(p);
    panels[cond.id] = p;

    var tab = document.createElement('button');
    tab.className = 'tab';
    tab.type = 'button';
    tab.id = 'tab-' + cond.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'panel-' + cond.id);
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    tab.innerHTML = '<span>' + cond.label + '</span>' +
                    (cond.tag ? '<span class="tab-tag">' + cond.tag + '</span>' : '');
    tab.addEventListener('click', function () { select(cond.id); });
    tabsEl.appendChild(tab);
  });

  panel.classList.add('is-ready');

  function select(id) {
    Object.keys(panels).forEach(function (k) {
      panels[k].hidden = (k !== id);
      var t = document.getElementById('tab-' + k);
      if (t) { t.setAttribute('aria-selected', k === id ? 'true' : 'false'); }
    });
    pauseAll(null);
    setNowPlaying(null);
    requestAnimationFrame(function () {
      // canvases of a freshly shown panel have a real width only now
      redraws.forEach(function (p) { p.redraw(); });
    });
  }

  tabsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
    var ids = DATA.conditions.map(function (c) { return c.id; });
    var cur = 0;
    ids.forEach(function (id, i) {
      var t = document.getElementById('tab-' + id);
      if (t && t.getAttribute('aria-selected') === 'true') { cur = i; }
    });
    var next = (cur + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
    select(ids[next]);
    document.getElementById('tab-' + ids[next]).focus();
    e.preventDefault();
  });
  /* ------------------------------------------------------------ blind mode */
  var blindBtn = document.getElementById('blindBtn');
  var blindOn = false;
  var blindMap = {};

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function applyBlind(on) {
    blindOn = on;
    document.body.classList.toggle('is-blind', on);
    if (blindBtn) { blindBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); }

    var systems = DATA.columns.filter(isSystem);

    if (on) {
      var letters = shuffle('ABCDEFGH'.slice(0, systems.length).split(''));
      blindMap = {};
      systems.forEach(function (c, i) { blindMap[c.suffix] = 'System ' + letters[i]; });
    }

    Array.prototype.forEach.call(document.querySelectorAll('.col'), function (col) {
      var nameEl = col.querySelector('.col-name');
      if (!nameEl) { return; }
      var id = col.dataset.colId;
      nameEl.textContent = (on && blindMap[id]) ? blindMap[id] : (nameEl.dataset.realName || nameEl.textContent);
    });

    if (on) { toast('Blind mode on - model names hidden and relabelled'); }
  }

  if (blindBtn) {
    blindBtn.addEventListener('click', function () { applyBlind(!blindOn); });
  }

  /* ----------------------------------------------------------------- theme */
  var themeBtn = document.getElementById('themeBtn');
  var stored = null;
  try { stored = localStorage.getItem('focusme-theme'); } catch (err) { stored = null; }

  function setTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) { try { localStorage.setItem('focusme-theme', theme); } catch (err) {} }
    requestAnimationFrame(function () {
      players.forEach(function (p) { p.redraw(); });
    });
  }

  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(stored || (prefersDark ? 'dark' : 'light'), false);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next, true);
    });
  }

  /* --------------------------------------------------------------- toast */
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 1800);
  }

  /* ---------------------------------------------------------- page chrome */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    if (header) { header.classList.toggle('is-stuck', window.scrollY > 8); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  if ('IntersectionObserver' in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  var updated = document.getElementById('updated');
  if (updated) {
    updated.textContent = new Date().toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /* placeholder links -> friendly hint instead of a dead '#' */
  Array.prototype.forEach.call(document.querySelectorAll('[data-todo]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      toast('Placeholder link - add your ' + a.dataset.todo + ' URL in index.html');
    });
  });

  document.body.classList.remove('is-loading');
})();