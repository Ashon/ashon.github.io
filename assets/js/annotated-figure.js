/* Annotated figure: layouts/shortcodes/annotated-figure.html, styles in
   assets/css/base/03-annotated-figure.css. Loaded (deferred) by
   extend_head.html only on pages that use the shortcode.

   Links each top-level list item to a part of the drawing (data-parts
   on the root, in list order; data-part on the SVG's elements). Hover
   (mouse) or keyboard focus previews the highlight; click, tap or
   Enter pins it, so it also works on touch screens. */
(function () {
  function setup(root) {
    var parts = (root.dataset.parts || '').split(',').map(function (s) { return s.trim(); });
    var list = root.querySelector('.annotated-figure-text > ul, .annotated-figure-text > ol');
    if (!list) return;
    var items = Array.prototype.filter.call(list.children, function (el) { return el.tagName === 'LI'; });
    var shapes = root.querySelectorAll('svg [data-part]');
    var hint = root.querySelector('.annotated-figure-hint');
    var pinned = null;
    if (hint) hint.hidden = false;

    function show(li) {
      var part = li ? li.dataset.part : null;
      root.classList.toggle('has-active', !!part);
      shapes.forEach(function (el) {
        el.classList.toggle('is-hl', !!part && el.dataset.part.split(' ').indexOf(part) >= 0);
      });
      items.forEach(function (x) { x.classList.toggle('is-active', x === li); });
    }

    items.forEach(function (li, i) {
      if (!parts[i]) return;
      li.dataset.part = parts[i];
      li.tabIndex = 0;
      li.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(li); });
      li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') show(pinned); });
      li.addEventListener('focus', function () { show(li); });
      li.addEventListener('blur', function () { show(pinned); });
      li.addEventListener('click', function () {
        pinned = pinned === li ? null : li;
        show(pinned);
      });
      li.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        li.click();
      });
    });
  }

  function init() { document.querySelectorAll('[data-annotated-figure]').forEach(setup); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
