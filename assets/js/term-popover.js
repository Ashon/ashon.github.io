/* Term popovers: layouts/shortcodes/term.html, styles in
   assets/css/base/03-term-popover.css. Loaded (deferred) by
   extend_head.html only on pages that use the shortcode.

   The Popover API handles open/close, light dismiss and focus; this
   places the popover under its term (flipping above when there's no
   room), keeps it attached while scrolling, and adds a hover preview
   for mouse users. A hover-opened popover closes when the pointer
   leaves both term and popover; clicking the term pins it open instead
   of toggling it shut. */
(function () {
  var GAP = 8;

  function place(trigger, pop) {
    var r = trigger.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(GAP, r.left + r.width / 2 - w / 2), innerWidth - w - GAP);
    var top = r.bottom + GAP;
    if (top + h > innerHeight - GAP && r.top - GAP - h > GAP) top = r.top - GAP - h;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function setup(pop) {
    var trigger = document.querySelector('[popovertarget="' + pop.id + '"]');
    if (!trigger) return;
    var hoverTimer, leaveTimer;
    var isOpen = function () { return pop.matches(':popover-open'); };

    pop.addEventListener('beforetoggle', function (e) {
      if (e.newState === 'open') pop.style.visibility = 'hidden';
      else delete pop.dataset.hover;
    });
    pop.addEventListener('toggle', function (e) {
      if (e.newState !== 'open') return;
      place(trigger, pop);
      pop.style.visibility = '';
    });

    trigger.addEventListener('click', function (e) {
      clearTimeout(hoverTimer); /* a click beats a pending hover preview */
      if (isOpen() && pop.dataset.hover) {
        e.preventDefault(); /* pin a hover preview instead of closing it */
        delete pop.dataset.hover;
      }
    });

    function hoverIn(e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(leaveTimer);
      if (isOpen()) return;
      hoverTimer = setTimeout(function () {
        if (isOpen()) return;
        pop.showPopover();
        pop.dataset.hover = '1';
      }, 150);
    }
    function hoverOut(e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      leaveTimer = setTimeout(function () {
        if (isOpen() && pop.dataset.hover) pop.hidePopover();
      }, 200);
    }
    [trigger, pop].forEach(function (el) {
      el.addEventListener('pointerenter', hoverIn);
      el.addEventListener('pointerleave', hoverOut);
    });

    var queued = false;
    function follow() {
      if (!isOpen() || queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; if (isOpen()) place(trigger, pop); });
    }
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', follow);
  }

  function init() {
    if (!('showPopover' in HTMLElement.prototype)) return;
    document.querySelectorAll('.term-popover').forEach(setup);
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
