/* LabTAS Docs — theme, search, on-this-page highlight, lightbox */
(function () {
  // ---------- theme ----------
  var saved = null;
  try { saved = localStorage.getItem('labtas-docs-theme'); } catch (e) {}
  if (saved === 'dark' || (!saved && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

function toggleTheme() {
  var el = document.documentElement;
  var dark = el.getAttribute('data-theme') === 'dark';
  if (dark) { el.removeAttribute('data-theme'); } else { el.setAttribute('data-theme', 'dark'); }
  try { localStorage.setItem('labtas-docs-theme', dark ? 'light' : 'dark'); } catch (e) {}
}

// ---------- lightbox ----------
function lightbox(img) {
  var lb = document.getElementById('lb');
  lb.querySelector('img').src = img.src;
  lb.classList.add('on');
}

// ---------- search ----------
(function () {
  var q = document.getElementById('q');
  var box = document.getElementById('results');
  if (!q || !box || !window.SEARCH_INDEX) return;
  var idx = window.SEARCH_INDEX;
  var sel = -1;

  function norm(s) { return (s || '').toLowerCase(); }

  function render(list, term) {
    if (!list.length) {
      box.innerHTML = '<div class="none">ไม่พบผลลัพธ์สำหรับ “' + term + '”</div>';
    } else {
      box.innerHTML = list.map(function (r) {
        return '<a href="' + r.page + (r.anchor || '') + '">' +
          '<div class="r-ch">' + r.chapter + '</div>' +
          '<div class="r-sec">' + r.section + '</div>' +
          '<div class="r-tx">' + r.text + '</div></a>';
      }).join('');
    }
    box.hidden = false;
    sel = -1;
  }

  q.addEventListener('input', function () {
    var t = norm(q.value.trim());
    if (t.length < 2) { box.hidden = true; return; }
    var scored = [];
    for (var i = 0; i < idx.length; i++) {
      var r = idx[i];
      var st = norm(r.section), tx = norm(r.text), ch = norm(r.chapter);
      var score = -1;
      if (st.indexOf(t) >= 0) score = 0;
      else if (ch.indexOf(t) >= 0) score = 1;
      else if (tx.indexOf(t) >= 0) score = 2;
      if (score >= 0) scored.push([score, r]);
    }
    scored.sort(function (a, b) { return a[0] - b[0]; });
    render(scored.slice(0, 9).map(function (x) { return x[1]; }), q.value.trim());
  });

  q.addEventListener('keydown', function (e) {
    var links = box.querySelectorAll('a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!links.length) return;
      sel = e.key === 'ArrowDown' ? Math.min(sel + 1, links.length - 1) : Math.max(sel - 1, 0);
      links.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sel >= 0 && links[sel]) {
      location.href = links[sel].href;
    } else if (e.key === 'Escape') {
      box.hidden = true; q.blur();
    }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search')) box.hidden = true;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
  });
})();

// ---------- on-this-page active highlight ----------
(function () {
  var links = document.querySelectorAll('.rail a');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        links.forEach(function (a) { a.classList.remove('on'); });
        var a = map[en.target.id];
        if (a) a.classList.add('on');
      }
    });
  }, { rootMargin: '-15% 0px -75% 0px' });
  document.querySelectorAll('.doc h2[id]').forEach(function (h) { obs.observe(h); });
})();
