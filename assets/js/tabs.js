/* Tabs component: layouts/shortcodes/tabs.html + tab.html, styles in
   assets/css/base/03-tabs.css. Loaded (deferred) by extend_head.html
   only on pages that use the shortcode.

   Builds a tab list from each panel's data-tab-label and wires the
   WAI-ARIA tabs pattern: one tab in the tab order (roving tabindex),
   Left/Right to move with wrap-around, Home/End to jump, selection
   follows focus. Until this runs, panels show stacked under their
   labels. Inactive panels are out of flow, invisible and inert, so the
   card is as tall as the active panel. The list sits in a full-width
   .tab-bar that, on phones, stays pinned under the header while the
   card scrolls.

   A switch by the reader crossfades the panels: .is-switching turns
   the CSS transitions on for --tabs-fade, then comes off again, so
   setting up the first panel never animates. The card's height changes
   at once; animating it stretches the grid rows and makes the tab list
   wobble. */
(function () {
  var seq = 0;

  function fadeMs(root) {
    var value = getComputedStyle(root).getPropertyValue('--tabs-fade').trim();
    var n = parseFloat(value) || 0;
    return /ms$/.test(value) ? n : n * 1000;
  }

  function setupTabs(root) {
    var panels = Array.prototype.filter.call(root.children, function (el) {
      return el.classList.contains('tab-panel');
    });
    if (panels.length < 2) return;

    var list = document.createElement('div');
    list.className = 'tab-list';
    list.setAttribute('role', 'tablist');
    if (root.dataset.tabsLabel) list.setAttribute('aria-label', root.dataset.tabsLabel);

    var tabs = panels.map(function (panel) {
      var id = 'tabs-' + (++seq);
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.id = id + '-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', id + '-panel');
      tab.textContent = panel.dataset.tabLabel;
      panel.id = id + '-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      list.appendChild(tab);
      return tab;
    });
    var bar = document.createElement('div');
    bar.className = 'tab-bar';
    bar.appendChild(list);
    root.insertBefore(bar, root.firstChild);
    root.classList.add('is-ready');

    var current = -1;
    var settle = null;

    function select(index, focus) {
      if (focus) tabs[index].focus();
      if (index === current) return;
      var fade = current >= 0 ? fadeMs(root) : 0;
      clearTimeout(settle);
      root.classList.toggle('is-switching', fade > 0);
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        panels[i].classList.toggle('is-active', on);
        panels[i].inert = !on;
      });
      current = index;
      if (fade > 0) {
        settle = setTimeout(function () {
          root.classList.remove('is-switching');
        }, fade + 50);
      }
    }

    list.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (tab) select(tabs.indexOf(tab));
    });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = tabs.length, next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % n;
      else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    });
    select(0);
  }

  function init() { document.querySelectorAll('[data-tabs]').forEach(setupTabs); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
