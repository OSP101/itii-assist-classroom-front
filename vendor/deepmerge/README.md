# Patched deepmerge

Vendored from TehShrike/deepmerge 4.3.1 (MIT), preserving its API and type declarations.
Upstream: https://github.com/TehShrike/deepmerge/tree/v4.3.1

CVE-2026-93753 / GHSA-gcqx-w48m-w2h4 has no published patched upstream release as of 2026-11-10.
This fork rejects `__proto__`, `constructor`, and `prototype` in both target and source copy loops before reading or assigning their values. This prevents returned-object prototype poisoning for null-prototype, nested null/primitive and own-key targets. Other merge behavior remains upstream behavior.

Reference and reproduction: https://github.com/TehShrike/deepmerge/issues/273
The npm override selects this local package; it does not falsify the upstream version or suppress npm advisories.
Regression and HeroUI compatibility tests live in scripts/tests/dependency-security.test.cjs.
Remove the override when an upstream release fixes this issue and those tests pass.
