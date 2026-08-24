// External file on purpose: an inline <script> here would need the
// per-request CSP nonce, which a static file in public/ cannot carry — the
// first version of this page was inline and got blocked, which told us
// nothing except that CSP works. Served from the same origin, so 'self'
// covers it.
(function () {
  var violations = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    violations.push({
      violatedDirective: e.violatedDirective,
      effectiveDirective: e.effectiveDirective,
      blockedURI: e.blockedURI,
      sample: e.sample,
      lineNumber: e.lineNumber
    });
  });

  var errors = [];
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && e.target.tagName) {
      errors.push('RESOURCE FAILED: <' + e.target.tagName.toLowerCase() + '> ' +
        (e.target.src || e.target.href || ''));
    } else {
      errors.push(String(e.message) + ' @ ' +
        String(e.filename) + ':' + e.lineno + ':' + e.colno);
    }
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    errors.push('UNHANDLED REJECTION: ' + String(e.reason));
  });

  function show(report) {
    document.getElementById('out').textContent = JSON.stringify(report, null, 2);
  }

  function run() {
    var host = document.getElementById('probe-host');
    var report = {};
    report.userAgent = navigator.userAgent;
    report.origin = location.origin;

    // style ATTRIBUTE — what CSP style-src-attr / style-src governs.
    var a = document.createElement('div');
    a.setAttribute('style', 'color: rgb(1, 2, 3)');
    host.appendChild(a);
    report.styleAttribute_applied = getComputedStyle(a).color === 'rgb(1, 2, 3)';

    // CSSOM write — CSP never blocks this; a control for the probe above.
    var b = document.createElement('div');
    b.style.color = 'rgb(4, 5, 6)';
    host.appendChild(b);
    report.cssomWrite_applied = getComputedStyle(b).color === 'rgb(4, 5, 6)';

    // Injected <style> element with no nonce.
    var s = document.createElement('style');
    s.textContent = '.csp-probe-3 { color: rgb(7, 8, 9); }';
    document.head.appendChild(s);
    var c = document.createElement('div');
    c.className = 'csp-probe-3';
    host.appendChild(c);
    report.injectedStyleElement_applied =
      getComputedStyle(c).color === 'rgb(7, 8, 9)';

    // What CSP did this browser actually receive? The Headers API joins
    // duplicate header values with ", " — so if the upstream proxy appends a
    // second Content-Security-Policy, it shows up here as one comma-joined
    // string. That is the difference we could not otherwise see from JS.
    fetch('/login', { credentials: 'omit' })
      .then(function (r) {
        report.loginStatus = r.status;
        report.cspHeaderAsSeenByBrowser =
          r.headers.get('content-security-policy');
        report.xFrameOptions = r.headers.get('x-frame-options');
        return r.text();
      })
      .then(function (html) {
        report.loginHtmlBytes = html.length;
        // Pull a real app chunk out of the page and try to actually execute
        // it, so we learn whether the app's own JS runs in THIS browser.
        var m = html.match(/\/_next\/static\/chunks\/[^"']+?\.js[^"']*/);
        if (!m) { report.chunkTest = 'no chunk url found'; return finish(report); }
        report.chunkUrl = m[0];
        var tag = document.createElement('script');
        tag.src = m[0];
        tag.onload = function () { report.chunkTest = 'LOADED AND EXECUTED'; finish(report); };
        tag.onerror = function () { report.chunkTest = 'FAILED TO LOAD/EXECUTE'; finish(report); };
        document.head.appendChild(tag);
        setTimeout(function () {
          if (!report.chunkTest) { report.chunkTest = 'TIMEOUT'; finish(report); }
        }, 8000);
      })
      .catch(function (err) {
        report.fetchError = String(err);
        finish(report);
      });

    // Show partial results immediately in case the async part never returns.
    show(report);
  }

  function finish(report) {
    setTimeout(function () {
      report.cspViolations = violations;
      report.jsErrors = errors;
      report.styleSheetCount = document.styleSheets.length;
      show(report);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
