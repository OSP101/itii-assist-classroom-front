// Recovery UI for a failed code-split chunk.
//
// Next.js loads most of the app as lazy chunks fetched at runtime. When one of
// those requests fails, the page keeps the server-rendered markup — it looks
// completely normal — but every control behind that chunk is dead. Plain <a>
// links still navigate, because those need no JavaScript, so the app reads as
// "the page works but nothing is clickable". That is exactly how the
// 2026-08-24 outage presented, and users had no way to tell what happened.
//
// Written as an inline script rather than a React component on purpose:
// - it must run even when the failure is severe enough that React never
//   hydrates, in which case no component would ever mount;
// - it must not itself live in a lazy chunk, or it would be taken out by the
//   very failure it exists to report.
//
// It builds its UI with document.createElement and element.style.* writes.
// Those are CSSOM writes, which CSP does not police, so this needs no nonce
// for styling and does not depend on the app's stylesheet having loaded.
export const buildChunkRecoveryScript = () => `
(() => {
  var shown = false;

  var isChunkFailure = function (text) {
    if (!text) return false;
    return /Failed to load chunk|ChunkLoadError|Loading chunk \S+ failed|error loading dynamically imported module/i.test(text);
  };

  // Fallback domain fronted by the Cloudflare tunnel (itii-cloudflared),
  // kept running specifically as a backup access path alongside the KKU
  // reverse proxy. Its traffic never touches the KKU per-URL rate limiter,
  // so it stays usable exactly when the primary domain is the one failing.
  var BACKUP_ORIGIN = 'https://cocolab.osp101.com';

  var strings = function () {
    var th = (document.documentElement.lang || 'th').toLowerCase().indexOf('en') !== 0;
    return th
      ? {
          message: 'หน้านี้โหลดไม่ครบ ปุ่มบางอย่างอาจกดไม่ได้',
          reload: 'โหลดใหม่',
          backup: 'ใช้ลิงก์สำรอง',
          dismiss: 'ปิด'
        }
      : {
          message: 'This page did not load completely — some controls may not work.',
          reload: 'Reload',
          backup: 'Use backup link',
          dismiss: 'Dismiss'
        };
  };

  var show = function () {
    if (shown || !document.body) return;
    shown = true;

    var t = strings();

    var bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.setAttribute('aria-live', 'assertive');
    // Above the sticky header (z-50) and the fullscreen announcement
    // overlay (z-120) — this has to be reachable whatever else is on screen.
    bar.style.position = 'fixed';
    bar.style.zIndex = '2147483000';
    // Pinned to both edges with auto margins rather than a centring
    // translate: a flex container with no width collapses to its content,
    // which on a 375px phone left the bar ~188px wide with the message
    // wrapped over three lines. This spans the viewport on small screens and
    // caps at a readable measure on large ones.
    bar.style.left = '16px';
    bar.style.right = '16px';
    bar.style.margin = '0 auto';
    bar.style.maxWidth = '560px';
    bar.style.bottom = 'calc(16px + env(safe-area-inset-bottom, 0px))';
    bar.style.boxSizing = 'border-box';
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.alignItems = 'center';
    bar.style.gap = '12px';
    bar.style.padding = '12px 16px';
    bar.style.borderRadius = '12px';
    // Fixed dark palette rather than the theme tokens: the stylesheet that
    // defines those may be the thing that failed to load.
    bar.style.background = '#0f172a';
    bar.style.color = '#f8fafc';
    bar.style.border = '1px solid #334155';
    bar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
    bar.style.font = '500 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    var msg = document.createElement('span');
    msg.textContent = t.message;
    msg.style.flex = '1 1 200px';
    bar.appendChild(msg);

    var reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = t.reload;
    reload.style.cursor = 'pointer';
    reload.style.border = '0';
    reload.style.borderRadius = '8px';
    reload.style.padding = '8px 14px';
    reload.style.background = '#3b82f6';
    reload.style.color = '#ffffff';
    reload.style.font = 'inherit';
    reload.style.fontWeight = '600';
    reload.style.minHeight = '40px';
    reload.onclick = function () { window.location.reload(); };
    bar.appendChild(reload);

    // Only offer the backup domain when we're not already on it — reload
    // already covers that case, and the button would otherwise link to itself.
    if (window.location.origin.toLowerCase() !== BACKUP_ORIGIN) {
      var backup = document.createElement('a');
      backup.href = BACKUP_ORIGIN + window.location.pathname + window.location.search;
      backup.textContent = t.backup;
      backup.style.cursor = 'pointer';
      backup.style.textDecoration = 'none';
      backup.style.display = 'inline-flex';
      backup.style.alignItems = 'center';
      backup.style.border = '1px solid #475569';
      backup.style.borderRadius = '8px';
      backup.style.padding = '8px 14px';
      backup.style.background = 'transparent';
      backup.style.color = '#93c5fd';
      backup.style.font = 'inherit';
      backup.style.fontWeight = '600';
      backup.style.minHeight = '40px';
      backup.style.boxSizing = 'border-box';
      bar.appendChild(backup);
    }

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = t.dismiss;
    dismiss.setAttribute('aria-label', t.dismiss);
    dismiss.style.cursor = 'pointer';
    dismiss.style.border = '1px solid #475569';
    dismiss.style.borderRadius = '8px';
    dismiss.style.padding = '8px 12px';
    dismiss.style.background = 'transparent';
    dismiss.style.color = '#cbd5e1';
    dismiss.style.font = 'inherit';
    dismiss.style.minHeight = '40px';
    dismiss.onclick = function () { if (bar.parentNode) bar.parentNode.removeChild(bar); };
    bar.appendChild(dismiss);

    document.body.appendChild(bar);
  };

  var onFailure = function () {
    if (document.body) {
      show();
    } else {
      document.addEventListener('DOMContentLoaded', show, { once: true });
    }
  };

  // Turbopack rejects the import() promise with "Failed to load chunk … from
  // module …" — the retry storm fires this repeatedly, hence the shown guard.
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    if (isChunkFailure(r && r.message ? r.message : String(r))) onFailure();
  });

  // A <script>/<link> that 404s or is rate-limited fires a non-bubbling error
  // event, so this listener has to capture.
  window.addEventListener('error', function (e) {
    var el = e && e.target;
    if (el && el !== window && el.tagName) {
      var url = String(el.src || el.href || '');
      if (url.indexOf('/_next/static/') !== -1) onFailure();
      return;
    }
    if (e && isChunkFailure(e.message)) onFailure();
  }, true);
})();
`;
