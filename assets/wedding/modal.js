
const Modal = (rootId) => {
  let rootElem = document.getElementById(rootId);
  let body = document.body;

  let current = undefined;

  const initialize = () => {
    rootElem.onclick = (e) => {
      if (e.target !== rootElem) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      closeModal();
    };

    rootElem.style.visibility = 'hidden';
  };

  const openRoot = () => {
    body.classList.add('modal-open');
    rootElem.style.opacity = 1;
    rootElem.style.visibility = 'visible';
  };

  const closeRoot = () => {
    body.classList.remove('modal-open');
    rootElem.style.opacity = 0;
    setTimeout(() => {
      rootElem.style.visibility = 'hidden';
    }, 200);
  };

  const openModal = (elem) => {
    rootElem.appendChild(elem);
    current = elem;

    openRoot();
  };

  const closeModal = () => {
    closeRoot();

    rootElem.removeChild(current);
    current = undefined;
  };

  initialize();

  const createModal = (inner) => {
    let elem = document.createElement('div');
    elem.className = 'modal-window';

    let content = document.createElement('div');
    content.innerHTML = inner;
    elem.appendChild(content);

    let footer = document.createElement('div');
    footer.style.padding = '10px 0';
    footer.style.marginTop = '10px';
    footer.style.textAlign = 'center';
    let close = document.createElement('a');
    close.innerText = '닫기';
    close.onclick = closeModal;

    footer.appendChild(close);
    elem.appendChild(footer);

    return elem
  };

  return {
    body: body,
    root: rootElem,
    open: openModal,
    close: closeModal,
    create: createModal
  };
};