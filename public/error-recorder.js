// TEMPORARY DEBUG AID — remove once the iOS/cocolabs interaction bug is closed.
//
// Records anything that goes wrong on the *real* app pages into localStorage
// so it can be read back on /csp-check.html. iOS Safari has no console you
// can reach without a Mac + Web Inspector, and the failure only reproduces
// on that device against cocolabs.computing.kku.ac.th, so this is how we see
// what the phone sees.
//
// Loaded as an external file from public/ (script-src 'self'), so it needs no
// CSP nonce and works on every route.
(function () {
  var KEY = '__diag_errors';
  var MAX = 40;

  function push(entry) {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      entry.at = new Date().toISOString();
      entry.page = location.pathname;
      list.push(entry);
      if (list.length > MAX) list = list.slice(-MAX);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* storage unavailable — nothing useful we can do from here */
    }
  }

  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && e.target.tagName) {
      push({
        kind: 'resource',
        tag: e.target.tagName.toLowerCase(),
        url: String(e.target.src || e.target.href || '')
      });
    } else {
      push({
        kind: 'error',
        message: String(e.message),
        source: String(e.filename) + ':' + e.lineno + ':' + e.colno,
        stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 600) : null
      });
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    push({
      kind: 'rejection',
      message: r && r.message ? String(r.message) : String(r),
      stack: r && r.stack ? String(r.stack).slice(0, 600) : null
    });
  });

  document.addEventListener('securitypolicyviolation', function (e) {
    push({
      kind: 'csp',
      violatedDirective: e.violatedDirective,
      blockedURI: e.blockedURI,
      sample: e.sample,
      source: String(e.sourceFile) + ':' + e.lineNumber
    });
  });

  // Snapshot whether React actually came alive on this page. If hydration
  // silently bails, the DOM keeps the server-rendered markup — which still
  // looks right and still has working <a> links, but no event handlers. That
  // is exactly the reported symptom, so measure it rather than guess.
  function snapshot(label) {
    try {
      push({
        kind: 'snapshot',
        label: label,
        pressableCount: document.querySelectorAll('[data-react-aria-pressable]').length,
        buttonCount: document.querySelectorAll('button').length,
        // Next.js exposes this once the client runtime boots.
        hasNextRuntime: typeof window.next !== 'undefined',
        hasReactRoot: !!document.querySelector('[data-reactroot]') ||
          !!(document.body && document.body.firstElementChild),
        styleSheetCount: document.styleSheets.length,
        bodyBytes: document.body ? document.body.innerHTML.length : 0,
        visualViewportWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null,
        devicePixelRatio: window.devicePixelRatio
      });
    } catch (e) { /* ignore */ }
  }

  window.addEventListener('load', function () {
    snapshot('load');
    setTimeout(function () { snapshot('load+4s'); }, 4000);
  });
})();
