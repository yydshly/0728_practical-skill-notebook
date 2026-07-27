const wrapIndex = (index, length) => (index % length + length) % length;
const ARCHIVE_CONTROLLER = "__isleRouteArchiveController";

function cardMarkup(route, index) {
  return `
    <article class="route-card" role="listitem" data-route-index="${index}">
      <img src="${route.image}" width="1200" height="900" loading="lazy" decoding="async" alt="${route.title}的岛屿场景" />
      <div class="route-card-copy">
        <p class="eyebrow">${route.index} / 航线</p>
        <h3>${route.title}</h3>
        <p>${route.subtitle}</p>
        <button type="button" data-route-detail="${index}" aria-expanded="false" aria-controls="route-detail-${index}">了解「${route.title}」</button>
        <p id="route-detail-${index}" class="route-detail" hidden>${route.detail}</p>
      </div>
    </article>`;
}

export function createRouteArchive({ root, routes }) {
  root[ARCHIVE_CONTROLLER]?.destroy();

  const track = root.querySelector("#route-track");
  const previousButton = root.querySelector("#route-prev");
  const nextButton = root.querySelector("#route-next");
  const status = root.querySelector("#route-status");
  const count = root.querySelector(".route-count span");
  let activeIndex = 0;
  let dragStartX = null;
  let dragDistance = 0;
  let resizeObserver = null;

  track.innerHTML = routes.map(cardMarkup).join("");
  const cards = [...track.querySelectorAll(".route-card")];

  function updateOffset() {
    const firstCard = cards[0];
    if (!firstCard) return;
    const gap = Number.parseFloat(window.getComputedStyle(track).gap) || 0;
    root.style.setProperty("--route-offset", `${-activeIndex * (firstCard.getBoundingClientRect().width + gap)}px`);
  }

  function updateActive({ announce = false } = {}) {
    cards.forEach((card, index) => {
      const isActive = index === activeIndex;
      if (isActive) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
      card.dataset.active = String(isActive);
      if (!isActive) {
        const detail = card.querySelector(".route-detail");
        const button = card.querySelector("[data-route-detail]");
        detail.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });

    root.style.setProperty("--route-index", String(activeIndex));
    count.textContent = routes[activeIndex].index;
    updateOffset();

    if (announce) {
      status.textContent = `路线 ${activeIndex + 1}，共 ${routes.length} 条：${routes[activeIndex].title}`;
    }
  }

  function goTo(index, options) {
    activeIndex = wrapIndex(index, routes.length);
    updateActive(options);
  }

  function next(options = { announce: true }) {
    goTo(activeIndex + 1, options);
  }

  function previous(options = { announce: true }) {
    goTo(activeIndex - 1, options);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    }
    if (event.key === "Home") {
      event.preventDefault();
      goTo(0, { announce: true });
    }
    if (event.key === "End") {
      event.preventDefault();
      goTo(routes.length - 1, { announce: true });
    }
  }

  function onTrackClick(event) {
    const button = event.target.closest("[data-route-detail]");
    if (!button) return;
    const index = Number(button.dataset.routeDetail);
    const card = cards[index];
    const detail = card.querySelector(".route-detail");
    const expanded = button.getAttribute("aria-expanded") === "true";

    goTo(index, { announce: true });
    button.setAttribute("aria-expanded", String(!expanded));
    detail.hidden = expanded;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    dragStartX = event.clientX;
    dragDistance = 0;
    track.setPointerCapture?.(event.pointerId);
    root.dataset.dragging = "true";
  }

  function onPointerMove(event) {
    if (dragStartX === null) return;
    dragDistance = event.clientX - dragStartX;
    root.style.setProperty("--route-drag-x", `${dragDistance}px`);
  }

  function onPointerEnd(event) {
    if (dragStartX === null) return;
    const width = cards[0]?.getBoundingClientRect().width || 400;
    const threshold = Math.min(72, width * 0.18);
    if (dragDistance <= -threshold) next();
    if (dragDistance >= threshold) previous();
    track.releasePointerCapture?.(event.pointerId);
    dragStartX = null;
    dragDistance = 0;
    root.style.setProperty("--route-drag-x", "0px");
    delete root.dataset.dragging;
  }

  function onPreviousClick() { previous(); }
  function onNextClick() { next(); }

  previousButton.addEventListener("click", onPreviousClick);
  nextButton.addEventListener("click", onNextClick);
  root.addEventListener("keydown", onKeyDown);
  track.addEventListener("click", onTrackClick);
  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerEnd);
  track.addEventListener("pointercancel", onPointerEnd);

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(updateOffset);
    resizeObserver.observe(root);
  }

  updateActive();

  const controller = {
    next,
    previous,
    goTo,
    getIndex: () => activeIndex,
    destroy() {
      previousButton.removeEventListener("click", onPreviousClick);
      nextButton.removeEventListener("click", onNextClick);
      root.removeEventListener("keydown", onKeyDown);
      track.removeEventListener("click", onTrackClick);
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerEnd);
      track.removeEventListener("pointercancel", onPointerEnd);
      resizeObserver?.disconnect();
      if (root[ARCHIVE_CONTROLLER] === controller) {
        delete root[ARCHIVE_CONTROLLER];
      }
    },
  };

  root[ARCHIVE_CONTROLLER] = controller;
  return controller;
}
