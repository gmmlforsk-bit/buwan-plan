// Keep the exhibition usable while the full catalog is loading.
(() => {
  const shelf = document.getElementById("startupShelf");
  const films = window.FY_EXHIBITION;
  if (!shelf || !films?.length || !shelf.querySelector("[data-playbar]")) return;
  const element = name => shelf.querySelector("[data-"+name+"]");
  let index = 0;
  let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer;
  function show(next) {
    const changed = next !== index;
    index = (next + films.length) % films.length;
    shelf.dataset.slide = String(index);
    const film = films[index];
    for (const key of ["group","meta"]) element(key).textContent = film[key];
    for (const key of ["title","orig","note"]) ScreenMotion.caption(element(key),film[key],key,changed);
    if (changed) {
      const image = new Image();
      image.dataset.image = "";
      image.alt = film.title;
      image.src = film.src;
      ScreenMotion.swapArt(shelf.querySelector(".hero-artwork"), image);
    }
    for (const a of shelf.querySelectorAll("[data-work]")) a.href = "/anime/"+film.id+"?from=home";
    element("position").textContent = String(index+1).padStart(2,"0")+" / "+films.length;
  }
  function schedule() {
    clearInterval(timer);
    element("pause").textContent = paused ? "继续" : "暂停";
    if (!paused) timer = setInterval(() => {
      if (document.body.dataset.interactive === "true") return clearInterval(timer);
      if (!document.hidden && shelf.getBoundingClientRect().bottom > 0 && !shelf.contains(document.activeElement)) show(index+1);
    }, 3800);
  }
  element("playbar").hidden = false;
  for (const b of shelf.querySelectorAll("[data-step]")) b.onclick=()=>{show(index+Number(b.dataset.step));schedule();};
  element("pause").onclick=()=>{paused=!paused;shelf.dataset.paused=String(paused);schedule();};
  shelf.querySelector('a[href="#opening-selection"]').addEventListener("click",()=>{shelf.querySelector("details").open=true;});
  show(0);
  schedule();
})();
