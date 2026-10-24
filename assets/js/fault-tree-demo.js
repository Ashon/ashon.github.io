/* Fault tree demo: layouts/shortcodes/fault-tree-demo.html, styles in
   assets/css/base/03-fault-tree.css. Loaded (deferred) by
   extend_head.html only on pages that use the shortcode.

   The tree is read from the inlined SVG, so one script serves any
   drawing: gates are [data-gate] (data-node, data-children,
   data-label), basic events are [data-event]. A toggle button is built
   per event (once per id, though an event may be drawn in several
   places), and every shape sharing a failed node's data-node gets
   .is-failed. The status line spells out each gate's verdict, listed
   in reverse drawing order: draw the tree top-down and the verdicts
   read bottom-up, the way a failure travels. A gate with
   data-verdict="off" still propagates but stays out of that line; when
   no gate is left to report, the line shows the root's data-failed text
   instead (the drawing itself then carries the explanation).

   render() re-appends failed edges inside .ft-edges so they paint
   last, and a healthy sibling's line never covers the failure path
   where edges share a segment. */
(function () {
  function setup(root) {
    var svg = root.querySelector('svg');
    var controls = root.querySelector('.fault-tree-demo-controls');
    var status = root.querySelector('.fault-tree-demo-status');
    if (!svg || !controls || !status) return;

    var gates = {}, order = [], events = [];
    svg.querySelectorAll('[data-gate]').forEach(function (el) {
      var id = el.dataset.node;
      gates[id] = {
        type: el.dataset.gate,
        children: (el.dataset.children || '').split(/\s+/).filter(Boolean),
        label: el.dataset.label || id
      };
      if (el.dataset.verdict !== 'off') order.unshift(id);
    });
    svg.querySelectorAll('[data-event]').forEach(function (el) {
      var id = el.dataset.event;
      if (events.some(function (ev) { return ev.id === id; })) return;
      events.push({ id: id, label: el.dataset.label || el.textContent.trim() });
    });
    if (!Object.keys(gates).length || !events.length) return;

    var state = {};
    function failed(id) {
      var gate = gates[id];
      if (!gate) return !!state[id];
      var hits = gate.children.filter(failed).length;
      return gate.type === 'and' ? hits === gate.children.length : hits > 0;
    }
    function verdict(id) {
      var gate = gates[id];
      var hits = gate.children.filter(failed).length;
      return gate.label + ' (' + gate.type.toUpperCase() + '): ' + gate.children.length + '개 중 ' +
        hits + '개 발생 -> ' + (failed(id) ? '발생' : '일어나지 않음');
    }

    events.forEach(function (ev) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fault-tree-demo-toggle';
      button.dataset.event = ev.id;
      button.textContent = ev.label;
      controls.appendChild(button);
    });
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'fault-tree-demo-reset';
    reset.textContent = '초기화';
    controls.appendChild(reset);
    controls.hidden = false;
    status.hidden = false;

    function render() {
      Object.keys(gates).concat(events.map(function (ev) { return ev.id; })).forEach(function (id) {
        var on = failed(id);
        svg.querySelectorAll('[data-node="' + id + '"]').forEach(function (el) {
          el.classList.toggle('is-failed', on);
        });
      });
      svg.querySelectorAll('.ft-edges .is-failed').forEach(function (el) {
        el.parentNode.appendChild(el);
      });
      controls.querySelectorAll('.fault-tree-demo-toggle').forEach(function (b) {
        b.setAttribute('aria-pressed', state[b.dataset.event] ? 'true' : 'false');
      });
      var anyFailed = events.some(function (ev) { return state[ev.id]; });
      status.textContent = !anyFailed ? root.dataset.hint
        : order.length ? order.map(verdict).join('\n')
        : root.dataset.failed || root.dataset.hint;
    }

    root.addEventListener('click', function (e) {
      var target = e.target.closest('[data-event]');
      if (target) {
        state[target.dataset.event] = !state[target.dataset.event];
        render();
      } else if (e.target.closest('.fault-tree-demo-reset')) {
        state = {};
        render();
      }
    });
    render();
  }

  function init() { document.querySelectorAll('[data-fault-tree-demo]').forEach(setup); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
