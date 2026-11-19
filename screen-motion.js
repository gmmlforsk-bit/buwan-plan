// Invisible samples participate in sizing at the current font, width and zoom.
// A slide change then only repaints the text, without moving the controls below it.
const ScreenMotion = (() => {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const fades = new WeakMap();

  function brighten(node, duration = 180) {
    if (!node || preference.matches || !node.animate) return;
    fades.get(node)?.cancel();
    const animation = node.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration, easing: "cubic-bezier(.2,.65,.35,1)"
    });
    fades.set(node, animation);
  }

  function caption(element, value, field, fade) {
    let visible = element.querySelector(".caption-value");
    if (!visible) {
      visible = document.createElement("span");
      visible.className = "caption-value";
      const fragment = document.createDocumentFragment();
      for (const sample of new Set(window.FY_EXHIBITION.map(film => film[field]))) {
        const measure = document.createElement("span");
        measure.className = "caption-size";
        measure.setAttribute("aria-hidden","true");
        measure.dataset.sample = sample;
        fragment.append(measure);
      }
      element.classList.add("caption-slot");
      element.replaceChildren(visible, fragment);
    }
    if (visible.textContent === value) return;
    visible.textContent = value;
    if (fade) brighten(visible, 230);
  }

  function swapArt(frame, next) {
    const images = [...frame.querySelectorAll("img")];
    const old = images.find(img => !img.classList.contains("art-pending") && !img.classList.contains("leaving"))
      || images.find(img => img.classList.contains("leaving"));
    const priorAlt = next.alt;
    if (!old) {
      frame.replaceChildren(next);
      return;
    }
    for (const img of images) if (img !== old) img.remove();
    old.getAnimations?.().forEach(animation => animation.cancel());
    old.classList.add("leaving");
    old.alt = "";
    next.classList.add("art-pending");
    frame.prepend(next);
    const reveal = () => {
      if (next.parentNode !== frame || !next.classList.contains("art-pending")) return;
      next.classList.remove("art-pending");
      next.alt = priorAlt;
      if (preference.matches || !old.animate) return old.remove();
      const dissolve = old.animate([{opacity:1},{opacity:0}], {duration:320, easing:"ease-in-out",fill:"forwards"});
      dissolve.onfinish = () => old.remove();
    };
    if (next.decode) next.decode().then(reveal, () => {
      if (next.complete) reveal();
      else next.addEventListener("load",reveal,{once:true});
    });
    else if (next.complete) reveal();
    else next.addEventListener("load",reveal,{once:true});
  }
  return { brighten, caption, swapArt };
})();
