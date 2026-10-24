/* Compact viewBox for inline SVGs on narrow screens. A figure drawn with
   room for side labels can shrink past legibility on a phone, so an
   <svg data-viewbox-compact="..."> swaps to that tighter viewBox below
   640px (or below data-viewbox-compact-below, in px) and gets
   .is-compact, so CSS can hide what no longer fits. Used by the
   annotated-figure and fault-tree-demo shortcodes; extend_head.html
   loads it (deferred) on pages that use them. */
(function () {
  function setup(svg) {
    var below = parseInt(svg.dataset.viewboxCompactBelow, 10) || 640;
    var mq = window.matchMedia('(max-width: ' + below + 'px)');
    var wide = svg.getAttribute('viewBox');
    function apply() {
      svg.setAttribute('viewBox', mq.matches ? svg.dataset.viewboxCompact : wide);
      svg.classList.toggle('is-compact', mq.matches);
    }
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }

  function init() { document.querySelectorAll('svg[data-viewbox-compact]').forEach(setup); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
