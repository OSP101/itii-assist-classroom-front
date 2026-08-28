/**
 * Publishes the visual viewport's height as `--visual-viewport-height`.
 *
 * `interactiveWidget: "resizes-content"` (app/layout.tsx) already shrinks the
 * layout viewport — and with it `100dvh` — when Android's on-screen keyboard
 * opens. iOS Safari doesn't implement that hint: there the keyboard leaves
 * `100dvh` at its full height and simply covers the bottom of the page.
 *
 * globals.css caps mobile modals at `var(--visual-viewport-height, 100dvh)`
 * for exactly that case, so while nothing sets the variable the cap silently
 * falls back to the unshrunken height and a modal's sticky footer sits behind
 * the iOS keyboard.
 *
 * Returns a cleanup function. Where `visualViewport` is unsupported it is a
 * no-op and the variable stays unset, leaving the CSS fallback in charge.
 */
export function trackVisualViewportHeight(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    return () => {};
  }

  const root = document.documentElement;
  let frame = 0;

  const publish = () => {
    frame = 0;
    // A CSSOM write, so unlike a <style> element this is not governed by
    // style-src and needs no nonce.
    root.style.setProperty("--visual-viewport-height", `${viewport.height}px`);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(publish);
  };

  publish();

  // iOS pans the visual viewport as the keyboard opens, which reports as
  // `scroll` rather than `resize` — miss it and the height goes stale mid-pan.
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);

  return () => {
    if (frame) {
      window.cancelAnimationFrame(frame);
    }
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    root.style.removeProperty("--visual-viewport-height");
  };
}
