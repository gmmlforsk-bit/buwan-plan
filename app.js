(() => {
  if (!window.FY_EXHIBITION || !window.FY_FULL_CATALOG_READY || typeof searchArchive !== "function") return;
  const featuredLists = window.FY_CURATED_LISTS || [];
  const { archiveMeta, catalog } = window.FY_CATALOG_V4;
  const {
    renderGenerativeArtSVG,
    renderPolygonRadarHTML,
    renderBangumiHistogramHTML,
    renderConstellationGraphSVG
  } = window.FY_VISUAL_ENGINE;

  const animeById = Object.fromEntries(catalog.map((a) => [a.id, a]));
  const listById = Object.fromEntries(featuredLists.map((l) => [l.id, l]));

  if (location.pathname === "/index.html") history.replaceState(history.state, "", "/" + location.search + location.hash);
  let initialAccount;
  const publicPages = new Set(["/", "/find", "/lists", "/play"]);
  let reviewRequest;
  function readCriticism() {
    if (!reviewRequest) {
      reviewRequest = fetch("/catalog/criticism.json").then(response => {
        if (!response.ok) throw new Error("暂时无法读取影评");
        return response.json();
      }).catch(() => { reviewRequest = null; return {}; });
    }
    return reviewRequest;
  }
  function critiqueCard(note) {
    const source = note.source ? `<a class="critique-source" href="${esc(note.source)}" target="_blank" rel="noopener">本集官方资料 ↗</a>` : "";
    return `<article class="critique-card">${note.ep ? '<small>第 '+note.ep+' 集</small>' : ""}<h4>${esc(note.title)}</h4><p>${esc(note.body)}</p>${source}</article>`;
  }
  function audiencePanel(work) {
    const counts = work.scoreCounts || [];
    const sum = values => values.reduce((a, b) => a + b, 0);
    const total = sum(counts);
    const bands = [[0, 3, "8–10 分"], [3, 6, "5–7 分"], [6, 10, "1–4 分"]];
    const breakdown = total ? `<span>馆藏快照 · ${total.toLocaleString()} 票</span>
      <dl>${bands.map(([start, end, label]) => {
        const votes = sum(counts.slice(start, end));
        return `<div><dt>${label}</dt><dd>${(100 * votes / total).toFixed(1)}%</dd></div>`;
      }).join("")}</dl>` : "";
    return `<aside id="audienceSnapshot" class="audience-snapshot"><div><strong>Bangumi 观众评分</strong> ${breakdown}</div>
      <a href="https://bgm.tv/subject/${work.bgmId}/comments" target="_blank" rel="noopener noreferrer">去 Bangumi 读观众短评 ↗</a></aside>`;
  }
  const scrollCache = new Map();
  history.scrollRestoration = "manual";
  let routeSequence = 0;
  let currentRouteKey = "/";
  let currentUser = null;
  let bootstrapData = {
    user: null,
    unreadCount: 0,
    watchlist: [],
    savedLists: [],
    episodeProgress: {},
    recentDiscussions: [],
    personas: [],
    customLists: []
  };

  const HERO_SELECTIONS = window.FY_EXHIBITION;
  const heroPool = HERO_SELECTIONS
    .map(sel => ({ ...sel, work: catalog.find(a => a.bgmId === sel.bgmId) }))
    .filter(sel => sel.work);
  const today = new Date().toLocaleDateString("sv-SE");
  const gameWorks = catalog.filter(work => !work.adult && work.realPoster && work.year > 0 && work.date <= today);
  const renderGame = createScreeningRoom({ root: document.getElementById("gameRoom"), works: gameWorks,
    selections: heroPool, escapeHtml: esc, artwork: renderGenerativeArtSVG });
  const slideInterval = 3800;
  let heroIdx = Number(document.getElementById("startupShelf").dataset.slide || 0);
  let previousHeroId;
  let heroPaused = document.getElementById("startupShelf").dataset.paused === undefined ? matchMedia("(prefers-reduced-motion: reduce)").matches : document.getElementById("startupShelf").dataset.paused === "true";
  let heroElapsed = 0;
  let heroVisible = false;
  const listLayouts = new Map();
  let activeEditorialLine = "全部";
  let catalogCompactMode = true;

  let matchedItems = [...catalog];
  let searchSequence = 0;
  let currentPage = 1;
  let pageSize = 12;
  let activeDecadeGroup = 0;
  let rouletteWinner = catalog[0];
  let rouletteTimer = null;

  const GUEST_WATCHLIST_KEY = "fy_v4_guest_watchlist";
  const GUEST_LISTS_KEY = "fy_v4_guest_lists";
  const GUEST_EP_PROGRESS_KEY = "fy_v4_ep_progress";

  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getGuestWatchlist() {
    try { return JSON.parse(localStorage.getItem(GUEST_WATCHLIST_KEY) || "[]"); }
    catch { return []; }
  }
  function setGuestWatchlist(items) {
    localStorage.setItem(GUEST_WATCHLIST_KEY, JSON.stringify(items));
  }
  function getGuestLists() {
    try { return JSON.parse(localStorage.getItem(GUEST_LISTS_KEY) || "[]"); }
    catch { return []; }
  }
  function setGuestLists(ids) {
    localStorage.setItem(GUEST_LISTS_KEY, JSON.stringify(ids));
  }
  function getLocalEpProgress() {
    try { return JSON.parse(localStorage.getItem(GUEST_EP_PROGRESS_KEY) || "{}"); }
    catch { return {}; }
  }
  function setLocalEpProgress(map) {
    localStorage.setItem(GUEST_EP_PROGRESS_KEY, JSON.stringify(map));
  }

  function getWatchedEpisodesFor(animeId) {
    const baseId = animeId.split("-reel-")[0];
    if (currentUser) return bootstrapData.episodeProgress?.[baseId] || [];
    const local = getLocalEpProgress();
    return local[baseId] || [];
  }

  async function saveWatchedEpisodesFor(animeId, epArray) {
    const baseId = animeId.split("-reel-")[0];
    const local = getLocalEpProgress();
    if (!currentUser) { local[baseId] = epArray; setLocalEpProgress(local); }
    if (currentUser) {
      const response = await fetch("/api/me/episode-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: baseId, episodes: epArray })
      });
      if (!response.ok) { alert("进度保存失败，请重试。"); return; }
      if (bootstrapData.episodeProgress) bootstrapData.episodeProgress[baseId] = epArray;
      localStorage.setItem(GUEST_EP_PROGRESS_KEY + ":" + currentUser.username, JSON.stringify(bootstrapData.episodeProgress));
    }
  }

  function getEffectiveWatchlist() {
    if (currentUser) return bootstrapData.watchlist;
    return getGuestWatchlist().map((x) => ({
      anime_id: x.animeId,
      status: x.status,
      personal_score: x.personalScore || 0
    }));
  }

  function calcTotalHours(anime) {
    return anime.totalHours == null ? null : +anime.totalHours.toFixed(2);
  }

  function statusLabel(st) {
    return { want: "想看", watching: "在看", watched: "看过", dropped: "搁置" }[st] || "想看";
  }

  function calcTasteAffinity(username) {
    const persona = bootstrapData.personas.find(p => p.username === username);
    const mine = new Set(getEffectiveWatchlist().map(x => x.anime_id));
    const theirs = new Set(persona?.anime_ids || []);
    const union = new Set([...mine, ...theirs]);
    if (!mine.size || !theirs.size) return '—';
    return Math.round([...mine].filter(id => theirs.has(id)).length / union.size * 100);
  }

  function renderThresholdPills(anime) {
    const hours = calcTotalHours(anime);
    return `
      <div class="threshold-pills">
        <span class="pill pill-gold">${esc(anime.format)} · ${anime.year}</span>
        <span class="pill">${hours == null ? "集数或时长未收录" : anime.episodes + " 话 × " + anime.epMinutes + "m · 共约 " + hours + " 小时"}</span>
        ${anime.status && !anime.status.includes("待核对")?`<span class="pill">${esc(anime.status)}</span>`:""}
        <span class="pill pill-coral">BGM ★ ${anime.score.toFixed(1)} (${(anime.votes || 0).toLocaleString()} 人)</span>

      </div>
    `;
  }

  const EDITORIAL_LINE_MAP = {
    "friday-night-two": "按观看对象",
    "walk-along-map": "按审美",
    "late-night-band": "按审美",
    "coffee-and-ruins": "按讨论问题",
    "editing-as-magic": "按主创",
    "ninety-min-youth": "按时间",
    "cyberpunk-philosophers": "按审美",
    "ensemble-puzzles": "按讨论问题",
    "everyday-alchemy": "按讨论问题",
    "rakugo-and-ukiyoe": "按审美",
    "time-and-farewell": "按补完路线",
    "sleepless-ova-shelter": "按时间"
  };

  function getListEditorialLine(list) {
    return list.editorialLine || EDITORIAL_LINE_MAP[list.id] || "按审美";
  }

  function bookmarkIcon(filled = false) {
    return `<svg class="icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  }

  function renderHero() {
    const entry = heroPool[heroIdx];
    const film = entry?.work;
    if (!film) return;
    const pal = film.palette || ["#faf8f3", "#a3362c", "#376771", "#252522"];
    document.documentElement.style.setProperty("--ambient-hue-1", `${pal[1]}28`);
    document.documentElement.style.setProperty("--ambient-hue-2", `${pal[2]}24`);

    $("heroCatNo").textContent = entry.group || "本期选映";
    $("heroKicker").textContent = [film.year, film.format].filter(Boolean).join("  /  ");
    const changed = previousHeroId !== film.id;
    ScreenMotion.caption($("heroTitle"),film.title,"title",Boolean(previousHeroId));
    ScreenMotion.caption($("heroOrig"),film.origTitle,"orig",Boolean(previousHeroId));
    ScreenMotion.caption($("heroSummary"),entry.note,"note",Boolean(previousHeroId));

    const artWrap = $("heroArtwork");
    previousHeroId = film.id;
    $("heroPause").textContent = heroPaused ? "继续" : "暂停";
    const hasRealImg = Boolean(film.realStill || film.realPoster);
    const framed = !film.realStill || (window.FY_IMAGE_SIZES[film.realStill]?.width || 0) < 1280;
    artWrap.classList.toggle("framed", framed);
    if (changed && hasRealImg) {
      const art = new Image();
      art.alt = film.title;
      art.fetchPriority = "high";
      const asset = window.FY_IMAGE_SIZES[film.realStill || film.realPoster];
      if (asset?.mobile && film.realStill) {
        art.sizes = "(max-width: 800px) calc(100vw - 32px), min(66vw, 1130px)";
        art.srcset = asset.mobile + " 800w, " + film.realStill + " " + asset.width + "w";
      }
      art.dataset.workImage = film.bgmId;
      art.dataset.artMode = "still";
      art.src = film.realStill || film.realPoster;
      ScreenMotion.swapArt(artWrap, art);
    } else if (changed) {
      artWrap.innerHTML = renderGenerativeArtSVG(film, "still");
    }
    artWrap.setAttribute("aria-label", "查看" + film.title);
    if (changed) {
      heroElapsed = 0;
      $("heroClock").style.transform = "scaleX(0)";
    }
    $("heroPos").textContent = `${String(heroIdx + 1).padStart(2, "0")} / ${String(heroPool.length).padStart(2, "0")}`;

    const nextEntry = heroPool[(heroIdx + 1) % heroPool.length];
    const nextWork = nextEntry?.work;
    if ($("heroNextUp") && nextWork) {
      const nextSrc = nextWork.realStill || nextWork.realPoster;
      if (nextSrc) { const preload = new Image(); preload.src = nextSrc; }
      $("heroNextUp").innerHTML = `
        <span class="hero-next-up-thumb">${nextSrc ? `<img src="${nextSrc}" alt="">` : "NEXT"}</span>
        <span class="hero-next-up-label">下一部：${esc(nextWork.title)}</span>
      `;
      $("heroNextUp").onclick = () => { heroIdx = (heroIdx + 1) % heroPool.length; renderHero(); };
    }

    const myEntry = getEffectiveWatchlist().find((w) => w.anime_id === film.id);
    const wantBtn = $("heroQuickWantBtn");
    wantBtn.innerHTML = `${bookmarkIcon(Boolean(myEntry))}<span>${myEntry ? `已标为「${statusLabel(myEntry.status)}」` : "收入想看"}</span>`;
    wantBtn.classList.toggle("is-active", Boolean(myEntry));

    $("heroOpenBtn").onclick = () => navigate(`/anime/${film.id}?from=home`);
    $("heroArtwork").onclick = () => navigate(`/anime/${film.id}?from=home`);
    wantBtn.onclick = () => toggleWatchStatus(film.id, "want", 0, () => renderHero());
    if ($("heroAll25Btn")) $("heroAll25Btn").onclick = () => openAll25Modal();
    $("heroRouletteBtn").onclick = () => openTonightRoulette();

    $("heroDots").innerHTML = heroPool
      .map(
        (item, idx) =>
          `<button type="button" class="hero-dot ${idx === heroIdx ? "is-active" : ""}" aria-label="切换至 ${esc(item.work.title)}" data-idx="${idx}"></button>`
      )
      .join("");
    $("heroDots").querySelectorAll("[data-idx]").forEach((btn) => {
      btn.onclick = () => {
        heroIdx = Number(btn.dataset.idx);
        renderHero();
      };
    });
  }

  function openAll25Modal() {
    const groups = [...new Set(heroPool.map(item => item.group))];
    $("all25Body").innerHTML = groups.map(group => {
      const items = heroPool.map((item, idx) => ({ ...item, idx })).filter(item => item.group === group);
      return `
        <div>
          <h4 class="all25-group-title">${esc(group)} (${items.length} 部)</h4>
          <div class="all25-grid">
            ${items.map(it => {
              const w = it.work;
              const src = w.realStill || w.realPoster;
              return `
                <button type="button" class="all25-item ${it.idx === heroIdx ? "is-current" : ""}" data-jump-hero="${it.idx}">
                  <div class="all25-thumb">${src ? `<img data-work-image="${w.bgmId}" src="${src}" alt="${esc(w.title)}" loading="lazy">` : `<span>编辑封面</span>`}</div>
                  <div class="typo-t4-timecode" style="color:var(--gold-leaf);font-size:11px;">${String(it.idx + 1).padStart(2, "0")} · ${w.year}</div>
                  <strong style="font-size:13px;line-height:1.3;">${esc(w.title)}</strong>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
    $("all25Body").querySelectorAll("[data-jump-hero]").forEach(btn => {
      btn.onclick = () => {
        heroIdx = Number(btn.dataset.jumpHero);
        renderHero();
        $("all25Dialog").close();
      };
    });
    if (!$("all25Dialog").open) $("all25Dialog").showModal();
  }

  function startHeroAutoPlay() {
    const stage = $("heroStage");
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }, { threshold: 0.35 }).observe(stage);
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(), delta = Math.min(200, now - last);
      last = now;
      const img = $("heroArtwork").querySelector("img");
      const mediaReady = !img || img.complete;
      if (heroPaused || !heroVisible || currentRouteKey !== "/" || document.hidden ||
          document.querySelector("dialog[open]") || (matchMedia("(hover: hover)").matches && stage.querySelector(".playbar:hover")) || stage.querySelector(":focus-visible") ||
          !mediaReady) return;
      heroElapsed += delta;
      $("heroClock").style.transform = "scaleX(" + Math.min(1, heroElapsed / slideInterval) + ")";
      if (heroElapsed >= slideInterval) { heroIdx = (heroIdx + 1) % heroPool.length; renderHero(); }
    }, 75);
    let touchStart;
    stage.addEventListener("touchstart", e => { touchStart = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", e => {
      const distance = e.changedTouches[0].clientX - touchStart;
      if (Math.abs(distance) > 55) { heroIdx = (heroIdx + (distance < 0 ? 1 : -1) + heroPool.length) % heroPool.length; renderHero(); }
    });
  }

  function renderContinueHomeStrip() {
    const strip = $("continueHomeStrip");
    if (!strip) return;
    const progress = currentUser ? (bootstrapData.episodeProgress || {}) : getLocalEpProgress();
    const wlist = getEffectiveWatchlist();
    const ongoing = [...new Set([...wlist.filter(w => w.status === "watching").map(w => w.anime_id), ...Object.keys(progress)])]
      .map(id => animeById[id])
      .filter(w => w && nextEpisode(w) && (getWatchedEpisodesFor(w.id).length || wlist.some(row => row.anime_id === w.id && row.status === "watching")));

    if (!ongoing.length) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    strip.innerHTML = `
      <strong style="font-size:13px;color:var(--gold-leaf);">接着看</strong>
      <div class="continue-home-links">
        ${ongoing.slice(0, 4).map(w => `
          <a class="continue-pill" href="/anime/${w.id}?from=home#episodes">
            <span>《${esc(w.title)}》</span>
            <span class="typo-t4-timecode" style="color:var(--ink-ash);">上次看到第 ${Math.max(1, nextEpisode(w) - 1)} 集 · 下一集 EP.${nextEpisode(w)} →</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  function renderTonightDecisionSection() {
    const box = $("tonightDecisionSection");
    if (!box) return;
    const candidates = [
      { id: "look-back", diff: "两个女孩伏案作画的纯粹线条与青春震颤" },
      { id: "ghost-in-the-shell", diff: "1995 年手绘赛璐珞赛博朋克哲学里程碑" },
      { id: "bgm-302", diff: "不需要任何门槛的夏日森林与雨夜等车名场面" }
    ].map(c => ({ ...c, work: animeById[c.id] })).filter(c => c.work && c.work.totalHours != null && c.work.totalHours <= 1.5);

    if (!candidates.length) return;
    box.innerHTML = `
      <div class="section-header" style="margin-bottom:8px;">
        <div>
          <h2 class="section-title">今晚，还有 90 分钟。</h2>
          <p class="muted-sm">任选一部，今晚就能看到片尾。</p>
        </div>
        <button type="button" id="decisionGo90Btn" class="btn-couture">按 90 分钟内筛选全库 →</button>
      </div>
      <div class="decision-grid">
        ${candidates.map(c => {
          const w = c.work;
          const mins = Math.round((w.totalHours || 0) * 60);
          return `
            <article class="decision-card" data-decision-id="${w.id}">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <span class="pill pill-gold">${mins} 分钟看完</span>
                  <span class="typo-t4-timecode" style="color:var(--gold-leaf);">BGM ★ ${w.score.toFixed(1)}</span>
                </div>
                <h3>《${esc(w.title)}》</h3>
                <p class="muted-sm" style="margin:6px 0 0;">${esc(c.diff)}</p>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border-hairline);font-size:12px;">
                <span class="typo-t4-timecode">${w.year} · ${esc(w.director)}</span>
                <span class="accent-text">查看作品 →</span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;

    $("decisionGo90Btn").onclick = () => {
      $("filterDuration").value = "1.5";
      navigate("/find");
      runCatalogFilter({ resetPage: true });
    };
    box.querySelectorAll("[data-decision-id]").forEach(el => {
      el.onclick = () => navigate(`/anime/${el.dataset.decisionId}?from=home`);
    });
  }

  function renderEpisodeSpotlightSection() {
    const box = $("episodeSpotlightSection");
    if (!box) return;
    const work = animeById["ping-pong"] || animeById["bocchi-the-rock"] || catalog.find(a => (a.episodeGuide || []).length > 0);
    const ep = (work?.episodeGuide || []).find(g => g.ep === 6) || (work?.episodeGuide || [])[0];
    if (!work || !ep) return;
    const src = work.realStill || work.realPoster;

    box.innerHTML = `
      <div class="section-header" style="margin-bottom:8px;">
        <div>
          <h2 class="section-title">一集怎么看：《${esc(work.title)}》第 ${ep.ep} 话「${esc(ep.title)}」</h2>
          <p class="muted-sm" style="margin:4px 0 0;">从具体一集的调度与分镜切入，看主创怎样在 23 分钟里把情绪推到顶点。</p>
        </div>
        <button type="button" id="spotlightGoEpBtn" class="btn-couture">进入分集与同集讨论 →</button>
      </div>
      <div class="spotlight-grid">
        <div class="spotlight-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="pill pill-coral">EP.${String(ep.ep).padStart(2, "0")} · ${esc(ep.badge || "核心回")}</span>
            <span class="typo-t4-timecode">单集 ★ ${ep.score}</span>
          </div>
          <div class="typo-t4-timecode" style="color:var(--gold-champagne);margin-bottom:10px;">${esc(ep.staff)}</div>
          <p class="typo-t3-editorial" style="margin:0;">${esc(ep.note)}</p>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button type="button" class="btn-primary btn-sm" id="spotlightOpenCommentsBtn">查看第 ${ep.ep} 话讨论</button>
            <button type="button" class="btn-couture btn-sm" id="spotlightOpenEpisodesBtn">标记追番进度</button>
          </div>
        </div>
        <div class="dossier-still" style="cursor:pointer;" id="spotlightImgWrap">
          ${src ? `<img data-work-image="${work.bgmId}" class="archive-image still" src="${src}" alt="${esc(work.title)}" loading="lazy">` : renderGenerativeArtSVG(work, "still")}
        </div>
      </div>
    `;

    const goComments = () => navigate(`/anime/${work.id}?from=home&ep=${ep.ep}#comments`);
    const goEpisodes = () => navigate(`/anime/${work.id}?from=home#episodes`);
    $("spotlightGoEpBtn").onclick = goComments;
    $("spotlightOpenCommentsBtn").onclick = goComments;
    $("spotlightOpenEpisodesBtn").onclick = goEpisodes;
    $("spotlightImgWrap").onclick = goEpisodes;
  }

  function renderCuratedSection() {
    const lead = listById["issue-43"] || featuredLists[0];
    $("navIssueCount").textContent = String(featuredLists.length);
    const full = location.pathname === "/lists";
    const lines = ["全部", "按时间", "按观看对象", "按审美", "按主创", "按讨论问题", "按补完路线"];
    const directory = [...featuredLists].reverse();
    const visible = full ? directory.filter(list => activeEditorialLine === "全部" || getListEditorialLine(list) === activeEditorialLine) : [];
    const filterLists = () => {
      const term = $("issueSearch").value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll("[data-list-id]").forEach(link => {
        const list = listById[link.dataset.listId];
        const words = [list.title,list.subtitle,list.editorialLine,...list.items.map(item=>animeById[item.animeId]?.title)].join(" ").toLowerCase();
        link.hidden = Boolean(full && term && !words.includes(term));
        if (!link.hidden) shown++;
      });
      $("issueSearchResult").textContent = term ? (shown ? "找到 "+shown+" 期" : "没有匹配的片单，试试其他片名或主题。") : "";
    };
    $("issueSearch").oninput = filterLists;
    $("toggleAllIssuesBtn").textContent = "全部 " + featuredLists.length + " 期 →";
    $("curatedSection").querySelector("h2").textContent = full ? "片单目录" : "本周片单";
    $("editorialLineTabs").innerHTML = lines.map(line => {
      const count = line === "全部" ? featuredLists.length : featuredLists.filter(l => getListEditorialLine(l) === line).length;
      return `<button class="chip-btn ${line === activeEditorialLine ? "is-active" : ""}" data-line="${line}" aria-pressed="${line===activeEditorialLine}">${line} · ${count}</button>`;
    }).join("");
    $("editorialLineTabs").onclick = e => { if(e.target.dataset.line){activeEditorialLine=e.target.dataset.line;renderCuratedSection();} };
    $("asymmetricFeatured").innerHTML = !full || activeEditorialLine === "全部" ?
      `<a class="weekly-feature" href="/list/${lead.id}" data-list-id="${lead.id}"><img src="/assets/karigurashi001.jpg" alt="借东西的小人阿丽埃蒂中的庭院小径" loading="lazy"><div><span class="archive-code">本周选单 · ${esc(lead.editorialLine)}</span><h3>${esc(lead.title)}</h3><p>${esc(lead.lead)}</p><strong>阅读片单 ↗</strong></div></a>` : "";
    if (!full) {
      const picks = ["issue-97","issue-113","issue-120"].map(id => listById[id]);
      $("asymmetricFeatured").insertAdjacentHTML("beforeend", `<nav class="more-issues" aria-label="更多主题片单">${picks.map(l =>
        `<a href="/list/${l.id}" data-list-id="${l.id}"><small>${esc(l.editorialLine)}</small><strong>${esc(l.title)}</strong><span aria-hidden="true">↗</span></a>`).join("")}</nav>`);
    }
    $("secondaryListsRow").innerHTML = visible.filter(l => !(activeEditorialLine === "全部" && l.id === lead.id)).map(list =>
      `<a class="issue-row" href="/list/${list.id}" data-list-id="${list.id}"><small>${esc(getListEditorialLine(list))}</small><div><h3>${esc(list.title)}</h3><p>${esc(list.subtitle || list.lead)}</p></div><span>${list.items.length} 部　↗</span></a>`).join("");
    filterLists();
    document.querySelectorAll("[data-list-id]").forEach(link => {link.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();navigate(link.pathname);};});
  }

  function renderSocialSection() {
    const discussions = bootstrapData.recentDiscussions || [];
    const feedBox = $("recentDiscussionsList");
    feedBox.innerHTML = discussions
      .slice(0, 3)
      .map((d) => {
        const anime = animeById[d.anime_id];
        const epTag = d.episode_num > 0 ? `EP.${String(d.episode_num).padStart(2, "0")} 考据` : "全片深评";
        return `
          <article class="dialogue-card" data-anime-id="${d.anime_id}" data-ep="${d.episode_num || 0}" data-comment="${d.id}">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <span class="user-chip" data-user-link="${esc(d.username)}">
                  <span class="avatar-dot" style="background:${d.avatar_color || "#d4af37"}">${esc(d.nickname.slice(0, 1))}</span>
                  <strong>${esc(d.nickname)}</strong>
                </span>
                <span class="pill pill-gold">${epTag}</span>
              </div>
              <div style="margin:6px 0 4px;">
                <strong class="typo-t2-auteur" style="font-size:13.5px;">《${esc(anime ? anime.title : d.anime_id)}》</strong>
              </div>
              <p class="dialogue-text">${esc(d.is_spoiler ? "含剧透，进入作品讨论后展开" : d.content)}</p>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-ash);padding-top:6px;border-top:1px solid var(--border-subtle);">
              <span class="typo-t4-timecode">${esc(d.created_at.slice(0, 16))}</span>
              <span class="typo-t4-timecode" style="color:var(--gold-champagne);">♥ ${d.likes || 0} 同感 · 直达讨论 →</span>
            </div>
          </article>
        `;
      })
      .join("");

    feedBox.querySelectorAll(".dialogue-card").forEach((card) => {
      card.onclick = (e) => {
        const userChip = e.target.closest("[data-user-link]");
        if (userChip) {
          e.stopPropagation();
          navigate(`/user/${userChip.dataset.userLink}`);
          return;
        }
        navigate(`/anime/${card.dataset.animeId}?from=recent&ep=${card.dataset.ep}#comment-${card.dataset.comment}`);
      };
    });

    const personasBox = $("residentPersonasList");
    const personas = bootstrapData.personas || [];
    personasBox.innerHTML = personas
      .map((p) => {
        const affinity = calcTasteAffinity(p.username);
        return `
          <div class="persona-card" data-username="${esc(p.username)}">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="avatar-dot" style="background:${p.avatar_color}">${esc(p.nickname.slice(0, 1))}</span>
                <strong>${esc(p.nickname)}</strong>
                <span class="pill" style="font-size:10px;">${esc(p.role_badge)}</span>
              </div>
              <p class="muted-sm" style="margin:4px 0;">${esc(p.bio)}</p>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                ${(p.taste_tags || []).slice(0, 4).map((t) => `<span class="typo-t4-timecode" style="font-size:10.5px;color:var(--gold-champagne);">#${esc(t)}</span>`).join(" ")}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div class="typo-t4-timecode" style="color:var(--gold-leaf);font-weight:700;">${affinity==="—"?"共同记录不足":"重合度 "+affinity+"%"}</div>
              <div class="typo-t4-timecode">${p.watched_count} 部 · ${p.comment_count} 评</div>
              <span class="accent-text" style="font-size:11.5px;">访问片架 →</span>
            </div>
          </div>
        `;
      })
      .join("");

    personasBox.querySelectorAll("[data-username]").forEach((el) => {
      el.onclick = () => navigate(`/user/${el.dataset.username}`);
    });
  }

  for (const value of [...new Set(catalog.map(a => a.format))]) {
    if (![...$("filterFormat").options].some(o=>o.value===value)) $("filterFormat").add(new Option(value,value));
  }
  for (const value of [...new Set(catalog.map(a => Math.floor(a.year/10)*10).filter(Boolean))].sort((a,b)=>b-a)) {
    if (![...$("filterDecade").options].some(o=>o.value===String(value))) $("filterDecade").add(new Option(value+' 年代',value));
  }
  let worker;
  let searchIndex;
  function applyResults(ids, requestId) {
    if (requestId !== searchSequence) return;
    matchedItems = ids.map(id => animeById[id]);
    currentPage = Math.min(currentPage, getTotalPages());
    renderCatalogAndDeck();
  }

  function initializeSearch() {
    if (searchIndex) return;
    searchIndex = catalog.map(item => ({
      id:item.id, format:item.format, adult:item.adult, editorialReview:Boolean(item.editorialReview),
      totalHours:item.totalHours, score:item.score, votes:item.votes, year:item.year,
      decade:Math.floor((item.year || 2000)/10)*10,
      searchBlob:[item.title,item.origTitle,item.enTitle,item.aliases,item.director,item.studio,
        item.sakuga,item.music,...(item.tags || [])].filter(Boolean).join(" ").toLowerCase()
    }));
    try {
      worker = new Worker("/search-worker.js?build=reader1");
      worker.onmessage = ({data}) => applyResults(data.ids, data.requestId);
      worker.onerror = event => {
        event.preventDefault();
        worker?.terminate();
        worker = null;
        runCatalogFilter();
      };
      worker.postMessage({type:"INIT", payload:searchIndex});
    } catch {
      worker?.terminate();
      worker = null;
    }
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(matchedItems.length / pageSize));
  }

  function getPageStats(pageNumber) {
    const total = getTotalPages();
    const safePage = Math.max(1, Math.min(total, pageNumber));
    const start = (safePage - 1) * pageSize;
    const slice = matchedItems.slice(start, start + pageSize);
    if (!slice.length) return { first: "—", last: "—", min: "—", max: "—", avg: "—", count: 0 };
    const scores = slice.filter(i => i.votes > 0 && i.score > 0).map(i => i.score);
    return {
      first: slice[0].title.split(" · ")[0],
      last: slice[slice.length - 1].title.split(" · ")[0],
      min: scores.length ? Math.min(...scores).toFixed(1) : "—",
      max: scores.length ? Math.max(...scores).toFixed(1) : "—",
      avg: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—",
      count: slice.length
    };
  }

  function runCatalogFilter({ resetPage = false } = {}) {
    if (resetPage) {
      currentPage = 1;
      activeDecadeGroup = 0;
    }
    const q = ($("catalogQuery").value || $("topQuery").value || "").trim();
    initializeSearch();
    const message = {
      type: "SEARCH",
      requestId: ++searchSequence,
      payload: {
        query: q,
        format: $("filterFormat").value,
        decade: $("filterDecade").value,
        maxHours: $("filterDuration").value,
        sort: $("filterSort").value,
        onlyEditorial: $("filterEditorial").checked,
        adult: $("filterAdult").checked
      }
    };
    if (worker) worker.postMessage(message);
    else applyResults(searchArchive(searchIndex, message.payload), message.requestId);
  }

  function updateScrubBanner(targetPage) {
    const st = getPageStats(targetPage);
    $("scrubPageTag").textContent = `P.${String(targetPage).padStart(3, "0")}`;
    $("scrubFirstLast").textContent = `《${st.first}》 → 《${st.last}》`;
    $("scrubScoreSpan").textContent = `★ ${st.min}–${st.max} (均值 ${st.avg})`;
  }

  function renderCatalogAndDeck() {
    const controls=["filterFormat","filterDuration","filterDecade","filterSort","filterEditorial","filterAdult"];
    const chosen=controls.filter(id=>{const el=$(id);return el.type==="checkbox"?el.checked:el.value && !(id==="filterSort" && el.value==="votes");});
    $("activeFilters").innerHTML=chosen.map(id=>`<button type="button" class="chip-btn" data-clear="${id}">${esc($(id).selectedOptions?.[0]?.textContent || $(id).parentNode.textContent.trim())} ×</button>`).join("");
    $("activeFilters").onclick=e=>{if(e.target.dataset.clear){const el=$(e.target.dataset.clear);if(el.type==="checkbox")el.checked=false;else el.selectedIndex=0;runCatalogFilter({resetPage:true});}};
    const total = matchedItems.length;
    const totalPages = getTotalPages();
    const startIdx = (currentPage - 1) * pageSize;
    const slice = matchedItems.slice(startIdx, startIdx + pageSize);

    $("catalogStatsBanner").textContent = `全库 ${archiveMeta.totalIndexedEntries.toLocaleString()} 条 · 匹配 ${total.toLocaleString()} 部 · PAGE ${String(currentPage).padStart(3, "0")}/${String(totalPages).padStart(3, "0")}`;
    $("pageReadout").textContent = `PAGE ${String(currentPage).padStart(3, "0")} / ${String(totalPages).padStart(3, "0")}`;

    const slider = $("pageScrubSlider");
    slider.max = String(totalPages);
    slider.value = String(currentPage);
    updateScrubBanner(currentPage);

    $("btnPrevPage").disabled = currentPage <= 1;
    $("btnNextPage").disabled = currentPage >= totalPages;
    $("btnPrevDecade").disabled = currentPage <= 1;
    $("btnNextDecade").disabled = currentPage >= totalPages;

    $("inlinePageSizePills").querySelectorAll(".size-pill").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.size) === pageSize);
    });

    const grid = $("catalogGrid");
    grid.classList.toggle("dense-grid", pageSize >= 36 && !catalogCompactMode);
    grid.classList.toggle("compact-index", catalogCompactMode);
    if ($("catalogViewToggle")) $("catalogViewToggle").textContent = catalogCompactMode ? "海报画廊" : "紧凑索引";

    grid.innerHTML = slice
      .map((item) => {
        const watchedEps = getWatchedEpisodesFor(item.id);
        const pct = Math.round((watchedEps.length / (item.episodes || 1)) * 100);
        const hours = calcTotalHours(item);
        return `
          <article class="film-card" data-anime-id="${item.id}">
            <div class="poster-frame">
              ${renderGenerativeArtSVG(item, "poster")}
            </div>
            <div class="card-body">
              <div>
                <h3 class="card-title-cn">${esc(item.title)}</h3>
                <span class="shelf-score">★ ${item.score ? item.score.toFixed(1) : "尚无评分"}</span>
                <p class="card-title-orig">${esc(item.origTitle)} · ${item.year} · ${esc(item.director)}</p>
                <div class="threshold-pills" style="margin:6px 0;">
                  <span class="pill">${esc(item.format)}</span>
                  <span class="pill">${item.episodes}话 · ${hours == null ? "时长待补充" : hours + "h"}</span>
                </div>
              </div>
              <div>
                <div class="ticket-stub-divider"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;" class="typo-t4-timecode">
                  <span>${esc(item.catNo)}</span>
                  <span style="color:${pct > 0 ? "var(--emerald-archive)" : "var(--gold-champagne)"};">
                    ${pct > 0 ? `已打卡 ${pct}%` : "查看作品 ›"}
                  </span>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    if(!total){grid.innerHTML='<div class="viz-panel">没有找到匹配作品。 <button class="chip-btn" id="clearEmpty">清除筛选</button></div>';$("clearEmpty").onclick=()=>document.querySelector('[data-quick-tag=""]').click();}
    grid.querySelectorAll(".film-card").forEach((card) => {

      card.onclick = () => navigate(`/anime/${card.dataset.animeId}?from=search`);
    });

    if (location.pathname === "/find") ScreenMotion.brighten(grid);
    $("paginationBottomBar").innerHTML = `
      <span class="typo-t4-timecode">当前位于第 ${currentPage} / ${totalPages} 页（每页 ${pageSize} 部，共 ${total} 部）</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn-couture" id="botPrevBtn" ${currentPage <= 1 ? "disabled" : ""}>‹ 上一页</button>
        <button type="button" class="btn-couture btn-roulette" id="botOpenMatrixBtn">▦ 高级选页 (${currentPage}/${totalPages})</button>
        <button type="button" class="btn-couture" id="botNextBtn" ${currentPage >= totalPages ? "disabled" : ""}>下一页 ›</button>
      </div>
    `;
    $("botPrevBtn").onclick = () => goToPage(currentPage - 1);
    $("botNextBtn").onclick = () => goToPage(currentPage + 1);
    $("botOpenMatrixBtn").onclick = () => openPagePickerWindow();
  }

  function goToPage(targetPage) {
    if(location.pathname!=="/find")navigate("/find");
    const total = getTotalPages();
    currentPage = Math.max(1, Math.min(total, targetPage));
    activeDecadeGroup = Math.floor((currentPage - 1) / 10);
    renderCatalogAndDeck();
    // Keep the pagination controls under the pointer. From the bottom controls,
    // jump directly to the new results instead of sweeping past the entire page.
    if ($("catalogGrid").getBoundingClientRect().bottom <= Math.max(0,window.innerHeight) &&
        $("catalogGrid").getBoundingClientRect().top < 0) {
      $("catalogGrid").scrollIntoView({block:"start",behavior:"instant"});
    }
  }

  function openPagePickerWindow() {
    const totalPages = getTotalPages();
    $("directPageInput").max = String(totalPages);
    $("directPageInput").value = String(currentPage);
    $("directPageMaxLabel").textContent = `/ 共 ${totalPages} 页`;

    const modalSlider = $("modalPageSlider");
    modalSlider.max = String(totalPages);
    modalSlider.value = String(currentPage);

    const updateModalSliderText = (p) => {
      const st = getPageStats(p);
      $("modalSliderPreview").textContent = `P.${String(p).padStart(3, "0")} · 《${st.first}》→《${st.last}》 (★ ${st.min}–${st.max})`;
    };
    updateModalSliderText(currentPage);

    modalSlider.oninput = () => updateModalSliderText(Number(modalSlider.value));
    modalSlider.onchange = () => {
      currentPage = Number(modalSlider.value);
      activeDecadeGroup = Math.floor((currentPage - 1) / 10);
      renderCatalogAndDeck();
      renderModalMatrixContent();
    };

    $("modalPageSizeGroup").querySelectorAll(".size-pill").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.size) === pageSize);
      btn.onclick = () => {
        pageSize = Number(btn.dataset.size);
        currentPage = 1;
        activeDecadeGroup = 0;
        renderCatalogAndDeck();
        openPagePickerWindow();
      };
    });

    renderModalMatrixContent();
    if (!$("pagePickerDialog").open) $("pagePickerDialog").showModal();
    const activeTab = $("modalDecadeTabs").querySelector(".active");
    if (activeTab) $("modalDecadeTabs").scrollLeft = activeTab.offsetLeft - $("modalDecadeTabs").offsetLeft;
  }

  function renderModalMatrixContent() {
    const totalPages = getTotalPages();
    const groupSize = 10;
    const totalGroups = Math.ceil(totalPages / groupSize);
    if (activeDecadeGroup >= totalGroups) activeDecadeGroup = Math.max(0, totalGroups - 1);

    let tabsHtml = "";
    for (let g = 0; g < totalGroups; g++) {
      const pStart = g * groupSize + 1;
      const pEnd = Math.min(totalPages, (g + 1) * groupSize);
      tabsHtml += `
        <button type="button" class="tier-tab ${g === activeDecadeGroup ? "active" : ""}" data-group="${g}">
          REEL P.${String(pStart).padStart(2, "0")}–P.${String(pEnd).padStart(2, "0")}
        </button>
      `;
    }
    $("modalDecadeTabs").innerHTML = tabsHtml;
    $("modalDecadeTabs").querySelectorAll("[data-group]").forEach((btn) => {
      btn.onclick = () => {
        activeDecadeGroup = Number(btn.dataset.group);
        renderModalMatrixContent();
      };
    });

    const startPage = activeDecadeGroup * groupSize + 1;
    const endPage = Math.min(totalPages, startPage + groupSize - 1);
    let cardsHtml = "";
    for (let p = startPage; p <= endPage; p++) {
      const st = getPageStats(p);
      const heatPct = Number(st.avg) * 10 || 0;
      cardsHtml += `
        <button type="button" class="matrix-page-card ${p === currentPage ? "current" : ""}" data-pick-page="${p}">
          <div style="display:flex;justify-content:space-between;" class="typo-t4-timecode">
            <span style="color:var(--gold-leaf);">P.${String(p).padStart(3, "0")}</span>
            <span>★ ${st.avg}</span>
          </div>
          <div style="font-size:12.5px;color:var(--ink-ivory);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${esc(st.first)}》起</div>
          <div class="typo-t4-timecode" style="font-size:10.5px;">★ ${st.min}–${st.max} (${st.count}部)</div>
          <div class="matrix-heat-bar"><div class="matrix-heat-fill" style="width:${heatPct}%;"></div></div>
        </button>
      `;
    }
    $("pageMatrixGrid").innerHTML = cardsHtml;
    $("pageMatrixGrid").querySelectorAll("[data-pick-page]").forEach((card) => {
      card.onclick = () => {
        const p = Number(card.dataset.pickPage);
        $("pagePickerDialog").close();
        goToPage(p);
      };
    });
  }

  $("directPageJumpForm").onsubmit = (e) => {
    e.preventDefault();
    const target = Number($("directPageInput").value) || 1;
    $("pagePickerDialog").close();
    goToPage(target);
  };
  $("closePagePicker").onclick = () => $("pagePickerDialog").close();

  function openTonightRoulette() {
    if (!$("rouletteDialog").open) $("rouletteDialog").showModal();
    runRouletteSpin();
  }

  function runRouletteSpin() {
    clearInterval(rouletteTimer);
    const row = $("rouletteCardsRow");
    const statusText = $("rouletteStatusText");
    const pool = matchedItems;
    rouletteWinner = null;
    $("btnOpenWinnerDetail").disabled = true;
    if(!pool.length){row.replaceChildren();statusText.textContent="当前条件没有匹配作品，请调整筛选。";return;}
    let ticks = 0;
    const maxTicks = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 8;
    statusText.textContent = "正在从匹配的作品中抽选…";

    rouletteTimer = setInterval(() => {
      ticks++;
      const picks = [];
      const used = new Set();
      while (picks.length < Math.min(3,pool.length)) {
        const cand = pool[Math.floor(Math.random() * pool.length)];
        if (!used.has(cand.id)) {
          used.add(cand.id);
          picks.push(cand);
        }
      }
      const isFinal = ticks >= maxTicks;
      if (isFinal) {
        clearInterval(rouletteTimer);
        rouletteWinner = picks[1] || picks[0];
        $("btnOpenWinnerDetail").disabled=false;
        statusText.innerHTML = `今晚推荐 <strong style="color:var(--gold-leaf);">《${esc(rouletteWinner.title)}》 (★ ${rouletteWinner.score.toFixed(1)} · ${esc(rouletteWinner.watchScene)})</strong>`;
      }

      row.innerHTML = picks
        .map((item, idx) => {
          const cls = isFinal ? (item === rouletteWinner ? "winner" : "dimmed") : "";
          return `
            <div class="tarot-slot ${cls}" data-pick-id="${item.id}">
              <div style="aspect-ratio:2/2.8;">${renderGenerativeArtSVG(item, "poster")}</div>
              <div style="padding:10px 12px;text-align:left;">
                <div class="typo-t4-timecode" style="color:var(--gold-leaf);">TAROT 0${idx + 1} · ★ ${item.score.toFixed(1)}</div>
                <div style="font-family:var(--font-cjk-serif);font-size:14px;margin-top:2px;">${esc(item.title)}</div>
              </div>
            </div>
          `;
        })
        .join("");

      if (isFinal) {
        row.querySelectorAll("[data-pick-id]").forEach((slot) => {
          slot.onclick = () => {
            $("rouletteDialog").close();
            navigate(`/anime/${slot.dataset.pickId}?from=roulette`);
          };
        });
      }
    }, 90);
  }

  $("closeRouletteBtn").onclick = () => $("rouletteDialog").close();
  $("btnRespinRoulette").onclick = () => runRouletteSpin();
  $("btnOpenWinnerDetail").onclick = () => {
    $("rouletteDialog").close();
    navigate(`/anime/${rouletteWinner.id}?from=roulette`);
  };

  function showOnlyView(viewId) {
    ["viewPlay", "viewHome", "viewList", "viewAnime", "viewUser", "viewCommunity", "viewMine"].forEach((id) => {
      $(id).hidden = id !== viewId;
    });
    $("navHome").classList.toggle("is-active", viewId === "viewHome" && location.pathname === "/");
    $("navCommunity").classList.toggle("is-active", viewId === "viewCommunity");
    $("navPlay").classList.toggle("is-active", viewId === "viewPlay");
    $("navMine").classList.toggle("is-active", viewId === "viewMine");
  }

  function navigate(path, { replace = false } = {}) {
    if (!replace && routeSequence && path === currentRouteKey) {
      window.scrollTo({top:0, behavior:"instant"});
      return;
    }
    scrollCache.set(currentRouteKey, window.scrollY);
    if (replace) history.replaceState({ path }, "", path);
    else history.pushState({ path, internal: true, source: currentRouteKey }, "", path);
    renderRoute(path, { isBack: false });
  }

  window.addEventListener("popstate", () => {
    scrollCache.set(currentRouteKey, window.scrollY);
    renderRoute(location.pathname + location.search + location.hash, { isBack: true });
  });

  async function renderRoute(fullPath, { isBack }) {
    const routeId = ++routeSequence;
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    currentRouteKey = fullPath;
    const url = new URL(fullPath, location.origin);
    const pathname = url.pathname;
    if (initialAccount && !publicPages.has(pathname)) {
      showOnlyView(null);
      $("routeLoading").hidden = false;
      await initialAccount;
      if (routeId !== routeSequence) return;
    }
    $("routeLoading").hidden = true;

    document.body.dataset.page = pathname === "/find" ? "find" : pathname === "/lists" ? "lists" : pathname === "/" ? "home" : "inside";
    $("navCatalog").classList.toggle("is-active",pathname==="/find");
    $("navLists").classList.toggle("is-active",pathname==="/lists");
    $("toggleAllIssuesBtn").textContent="全部片单 →";
    $("curatedSection").querySelector("h2").textContent=pathname==="/lists"?"全部片单":"编辑选单";
    if (pathname === "/" || pathname === "/lists") renderCuratedSection();
    let ready;
    if (pathname.startsWith("/list/")) {
      renderListPage(pathname.split("/")[2]);
      showOnlyView("viewList");
    } else if (pathname.startsWith("/anime/")) {
      showOnlyView("viewAnime");
      ready = renderAnimeDossierPage(pathname.split("/")[2], url.searchParams.get("from") || "", Number(url.searchParams.get("ep") || 0));
    } else if (pathname.startsWith("/user/")) {
      showOnlyView("viewUser");
      $("userBarTitle").textContent = "映友书架";
      $("userContent").textContent = "正在打开映友书架…";
      ready = renderUserProfilePage(pathname.split("/")[2]);
    } else if (pathname === "/community") {
      renderCommunityPage();
      showOnlyView("viewCommunity");
    } else if (pathname === "/play") {
      renderGame();
      showOnlyView("viewPlay");
    } else if (pathname === "/mine") {
      showOnlyView("viewMine");
      $("mineContent").textContent = "正在打开我的书架…";
      ready = renderMinePage();
    } else {
      showOnlyView("viewHome");
    }

    if (!isBack && routeId > 1) {
      const surface = pathname === "/" ? $("heroStage") : pathname === "/find" ? $("catalogSection") :
        pathname === "/lists" ? $("curatedSection") : document.querySelector(".subview:not([hidden]) .subview-container, #viewPlay:not([hidden]) .game-room");
      ScreenMotion.brighten(surface, 200);
    }
    const savedY = isBack ? scrollCache.get(fullPath) : undefined;
    window.scrollTo({ top: savedY ?? 0, behavior: "instant" });
    try {
      await ready;
    } catch {
      if (routeId !== routeSequence) return;
      const box = pathname === "/mine" ? $("mineContent") : pathname.startsWith("/user/") ? $("userContent") : null;
      if (box) box.textContent = "暂时无法读取书架，请刷新重试。";
      return;
    }
    if (routeId !== routeSequence) return;
    if (savedY !== undefined && (pathname === "/mine" || pathname.startsWith("/user/") || url.hash)) {
      window.scrollTo({ top: savedY, behavior: "instant" });
    } else if (savedY === undefined && url.hash) {
      const target = url.hash === "#comments" ? $("commentsSectionAnchor") :
        url.hash === "#episodes" ? $("epProgressDeckBox") : $(url.hash.slice(1));
      target?.scrollIntoView({block:"center", behavior:"instant"});
    }
  }

  function getDefaultListLayout(list) {
    const line = getListEditorialLine(list);
    if (line === "按时间") return "compact";
    if (line === "按审美" || line === "按主创") return "compare";
    return "route";
  }

  function renderListPage(listId, layoutMode) {
    let list = listById[listId];
    if (!list) {
      const custom = (bootstrapData.customLists || []).find((c) => c.id === listId);
      if (custom) {
        list = {
          id: custom.id,
          code: "COMMUNITY CURATED · 映友共创片单",
          title: custom.title,
          subtitle: custom.subtitle,
          badge: "社区共创",
          updatedAt: custom.created_at?.slice(0, 10) || "2026-11-18",
          curator: custom.nickname,
          curatorRole: custom.role_badge || "常驻映友",
          readingTime: `${custom.likes || 0} 人同感`,
          lead: custom.lead,
          essay: custom.lead,
          pullQuote: `“${custom.lead.slice(0, 40)}…”`,
          items: custom.items || []
        };
      } else {
        $("listContent").innerHTML='<p>没有找到这张片单。<a href="/lists">浏览全部片单 →</a></p>';return;
      }
    }

    $("listBarCode").textContent = list.code;
    $("listBarTitle").textContent = list.title;
    $("listBackBtn").textContent="← 返回"+({"/":"首页","/mine":"我的书架","/community":"讨论"}[history.state?.source] || "片单");
    $("listBackBtn").onclick = () => history.state?.internal ? history.back() : navigate("/lists");

    const savedSet = new Set(currentUser ? bootstrapData.savedLists : getGuestLists());
    const isSaved = savedSet.has(list.id);
    const activeLayout = layoutMode || listLayouts.get(list.id) || getDefaultListLayout(list);
    listLayouts.set(list.id,activeLayout);
    const missingHours=list.items.filter(it=>animeById[it.animeId]?.totalHours==null).length;
    const totalHours = list.items
      .reduce((sum, it) => sum + (animeById[it.animeId] ? calcTotalHours(animeById[it.animeId]) : 0), 0)
      .toFixed(1);

    const renderListItems = () => {
      if (activeLayout === "compare") {
        return `
          <div class="list-compare-grid">
            ${list.items
              .map((entry, idx) => {
                const a = animeById[entry.animeId];
                if (!a) return "";
                const hours = calcTotalHours(a);
                return `
                  <article class="viz-panel list-work-card" style="display:flex;flex-direction:column;gap:14px;cursor:pointer;margin-bottom:0;" data-open-anime="${a.id}">
                    <div class="dossier-still">${renderGenerativeArtSVG(a, "still")}</div>
                    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
                      <div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                          <span class="archive-code tabular">0${idx + 1} · ${esc(entry.watchOrderNote || "对照条目")}</span>
                          <span class="tabular" style="color:var(--gold-leaf);font-weight:700;">★ ${a.score.toFixed(1)}</span>
                        </div>
                        <h2 style="font-family:var(--font-cjk-serif);margin:8px 0 4px;font-size:20px;">《${esc(a.title)}》</h2>
                        <div class="threshold-pills" style="margin:6px 0;">
                          <span class="pill pill-gold">${esc(a.format)} · ${a.year}</span>
                          <span class="pill">${hours == null ? "时长待补充" : `${a.episodes}话 · ${hours}h`}</span>
                        </div>
                        <p class="typo-t3-editorial" style="font-size:13.5px;margin:6px 0 0;">${esc(entry.reason)}</p>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border-hairline);font-size:12px;">
                        <span class="typo-t4-timecode">${esc(a.director)} · ${esc(a.studio)}</span>
                        <span class="accent-text">查看作品 →</span>
                      </div>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        `;
      }

      if (activeLayout === "compact") {
        return `
          <div class="list-compact-table">
            ${list.items
              .map((entry, idx) => {
                const a = animeById[entry.animeId];
                if (!a) return "";
                const hours = calcTotalHours(a);
                return `
                  <article class="list-compact-row" data-open-anime="${a.id}">
                    <span class="archive-code tabular" style="color:var(--gold-leaf);font-weight:700;">0${idx + 1}</span>
                    <div>
                      <strong style="font-family:var(--font-cjk-serif);font-size:16px;">《${esc(a.title)}》</strong>
                      <div class="muted-sm">${a.year} · ${esc(a.format)} · ${esc(a.director)}</div>
                    </div>
                    <div class="typo-t3-editorial" style="font-size:13px;">${esc(entry.reason)}</div>
                    <div style="text-align:right;white-space:nowrap;">
                      <div class="typo-t4-timecode" style="color:var(--gold-leaf);font-weight:700;">★ ${a.score.toFixed(1)}</div>
                      <div class="typo-t4-timecode">${hours == null ? "时长待补充" : `${a.episodes}话 · ${hours}h`}</div>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        `;
      }

      return list.items
        .map((entry, idx) => {
          const a = animeById[entry.animeId];
          if (!a) return "";
          return `
            <article class="viz-panel list-work-card" style="display:grid;grid-template-columns:4.2fr 7.8fr;gap:24px;align-items:center;cursor:pointer;" data-open-anime="${a.id}">
              <div class="dossier-still">${renderGenerativeArtSVG(a, "still")}</div>
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                  <span class="archive-code tabular">STOP 0${idx + 1} · ${esc(entry.watchOrderNote || "选映条目")}</span>
                  <span class="tabular" style="color:var(--gold-leaf);font-weight:700;">BGM ★ ${a.score.toFixed(1)}</span>
                </div>
                <h2 style="font-family:var(--font-cjk-serif);margin:10px 0 4px;font-size:23px;">《${esc(a.title)}》 <small class="muted-sm">${esc(a.origTitle)}</small></h2>
                ${renderThresholdPills(a)}
                <blockquote class="hero-quote" style="font-size:14px;">策展按语：${esc(entry.reason)}</blockquote>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                  <span class="typo-t4-timecode">监督：${esc(a.director)} · 制作：${esc(a.studio)}</span>
                  <span class="accent-text" style="font-size:13px;font-weight:600;">查看作品 →</span>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    };

    const openingWork = animeById[list.items[0]?.animeId];
    const cover = openingWork && (openingWork.realStill || openingWork.realPoster || "/artwork/" + openingWork.bgmId);
    $("listContent").innerHTML = `
      <div class="viz-panel list-opening">
        <div class="list-spread">
          <div class="list-intro">
            <span class="archive-code">${esc(getListEditorialLine(list))}　／　${list.items.length} 部选映</span>
            <h1>${esc(list.title)}</h1>
            <p class="list-deck">${esc(list.subtitle || list.lead)}</p>
            ${list.lead && list.subtitle && list.lead !== list.items[0]?.reason && list.lead !== list.subtitle ? `<p class="list-invitation">${esc(list.lead)}</p>` : ""}
            <button type="button" id="toggleSaveListBtn" class="btn-couture ${isSaved ? "is-active" : ""}">
              ${bookmarkIcon(isSaved)}<span>${isSaved ? "已收藏" : "收藏整张片单"}</span>
            </button>
          </div>
          ${cover ? `<figure class="list-cover ${openingWork.realStill ? "wide" : "portrait"}"><img data-work-image="${openingWork.bgmId}" src="${esc(cover)}" alt="${esc(openingWork.title)}"><figcaption>首部选映　／　${esc(openingWork.title)}</figcaption></figure>` : ""}
        </div>
        <div class="list-reading">
          ${openingWork ? `<div class="list-start"><strong>从《${esc(openingWork.title)}》开始</strong><p>${esc(list.items[0].reason)}</p></div>` : ""}
          ${list.essay && list.essay !== list.subtitle && list.essay !== list.lead ? `<details class="editor-note"><summary>读策展手记</summary><p>${esc(list.essay)}</p></details>` : ""}
          <small>${esc(list.curator || "编辑部")}　·　最后校订 ${esc(list.updatedAt || "待记录")}　·　已知全片合计 ${totalHours} 小时${missingHours ? "（"+missingHours+" 部时长待补）" : ""}</small>
        </div>
      </div>

      <div style="margin-top:26px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div class="eyebrow" style="margin:0;">SEQUENTIAL VIEWING ORDER · 从《${esc(animeById[list.items[0]?.animeId]?.title || "首部作品")}》开始</div>
          <div class="list-layout-tabs" role="group" aria-label="片单排版模式" style="margin:0;">
            <button type="button" class="chip-btn ${activeLayout === "route" ? "is-active" : ""}" data-list-layout="route">观看路线（纵向图文）</button>
            <button type="button" class="chip-btn ${activeLayout === "compare" ? "is-active" : ""}" data-list-layout="compare">风格对照（双列网格）</button>
            <button type="button" class="chip-btn ${activeLayout === "compact" ? "is-active" : ""}" data-list-layout="compact">短时清单（紧凑行表）</button>
          </div>
        </div>
        ${renderListItems()}
      </div>
    `;

    $("listContent").querySelectorAll("[data-list-layout]").forEach((btn) => {
      btn.onclick = () => renderListPage(list.id, btn.dataset.listLayout);
    });

    $("toggleSaveListBtn").onclick = async () => {
      const local = new Set(getGuestLists());
      const next = !isSaved;
      if (next) local.add(list.id);
      else local.delete(list.id);
      if(!currentUser)setGuestLists([...local]);
      if (currentUser) {
        await fetch("/api/me/saved-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId: list.id, saved: next })
        });
        await loadBootstrap();
      }
      if (location.pathname === "/list/"+list.id) renderListPage(list.id, activeLayout);
    };

    $("listContent").querySelectorAll("[data-open-anime]").forEach((el) => {
      el.onclick = () => navigate(`/anime/${el.dataset.openAnime}?from=${list.id}`);
    });
  }

  async function renderAnimeDossierPage(animeId, from, initialEpFilter = 0) {
    const visit = routeSequence;
    const a = animeById[animeId] || catalog.find(item => String(item.bgmId) === animeId);
    if (!a) { $("animeContent").textContent = "未找到该作品"; return; }
    const baseId = a.id.split("-reel-")[0];
    const baseWork = animeById[baseId] || a;
    const allEpisodeOptions = Array.from({length:a.episodes || 0}, (_,i) => {
      const ep = i+1, guide = (baseWork.episodeGuide || []).find(g=>g.ep===ep);
      return `<option value="${ep}" ${initialEpFilter===ep?'selected':''}>EP.${String(ep).padStart(2,'0')}${guide?' · '+esc(guide.title):''}</option>`;
    }).join('');

    $("animeBarCatNo").textContent = a.catNo || "ARCHIVE";
    $("animeBarTitle").textContent = `${a.title} (${a.year})`;

    const backBtn = $("animeBackBtn");
    const sourceList=listById[from] || bootstrapData.customLists.find(l=>l.id===from);
    const sourceNames={search:"搜索结果",home:"首页",mine:"我的书架",community:"讨论",recent:"最近讨论",play:"游戏室",roulette:"选片结果",user:"映友主页"};
    backBtn.hidden=false;
    backBtn.textContent="← "+(sourceList?"返回「"+sourceList.title+"」":"返回"+(sourceNames[from]||"首页"));
    const fallback=sourceList?"/list/"+sourceList.id:({play:"/play",search:"/find",mine:"/mine",community:"/community",user:"/community",roulette:"/find"}[from] || "/");
    backBtn.onclick=()=>history.state?.internal?history.back():navigate(fallback);

    const myEntry = getEffectiveWatchlist().find((w) => w.anime_id === baseId || w.anime_id === a.id);
    const myStatus = myEntry?.status || "";
    const myScore = myEntry?.personal_score || 0;

    let showRadarAvg = true;
    let activeCreatorRole = "director";
    const radarObj = renderPolygonRadarHTML(baseWork, showRadarAvg);
    const bgmObj = renderBangumiHistogramHTML(baseWork);

    $("animeContent").innerHTML = `
      <div class="dossier-hero sprocket-strip">
        <div class="dossier-still">${renderGenerativeArtSVG(a, "still")}</div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="archive-code tabular">${esc(a.catNo)}</span>
            <span class="pill pill-gold">${esc(a.season || `${a.year}年`)}</span>
            <span class="pill">${esc(a.watchScene)}</span>
          </div>
          <h1 class="typo-t1-marquee">${esc(a.title)}</h1>
          <div class="typo-t2-auteur" style="margin:4px 0 10px;">${esc([a.origTitle,a.enTitle].filter(Boolean).join(" · "))}</div>
          ${renderThresholdPills(a)}
          <blockquote class="hero-quote">${esc(a.pullQuote)}</blockquote>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-hairline);">
            ${["want", "watching", "watched", "dropped"]
              .map(
                (st) =>
                  `<button type="button" class="btn-couture ${myStatus === st ? "is-active" : ""}" data-mark-status="${st}">${
                    myStatus === st ? "✓ " : "+ "
                  }${statusLabel(st)}</button>`
              )
              .join("")}
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
              <span class="typo-t4-timecode">我的评定：</span>
              <select id="personalScoreSelect" style="background:var(--bg-abyss);border:1px solid var(--border-strong);border-radius:4px;padding:5px 8px;font-size:12px;">
                <option value="0">未打分</option>
                ${[10,9,8,7,6,5,4,3,2,1].map((s) => `<option value="${s}" ${myScore === s ? "selected" : ""}>★ ${s} 分</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
      </div>

      <section class="viz-panel">
        <div class="panel-header">
          <h3 class="panel-title"><span>01 ·</span> 作品导读</h3>
          <span class="typo-t4-timecode">EDITORIAL CRITIQUE & AUDIENCE FIT</span>
        </div>
        <p class="typo-t3-editorial" style="margin-top:0;">${esc(baseWork.summary)}</p>
        ${
          baseWork.editorialReview
            ? `<div style="margin:14px 0;padding:18px;background:var(--bg-celluloid);border-left:3px solid var(--gold-leaf);border-radius:4px;">
                <div class="eyebrow" style="margin-bottom:6px;">CURATOR'S ESSAY · 馆藏试读笔记</div>
                <p class="dropcap typo-t3-editorial" style="margin:0;color:var(--ink-ivory);">${esc(baseWork.editorialReview)}</p>
              </div>`
            : ""
        }
        <div id="reviews" class="critique-section" hidden></div>
        <div class="viz-grid-2col" style="margin-bottom:0;margin-top:14px;">
          <div style="padding:14px;background:var(--bg-vault);border:1px solid var(--border-subtle);border-radius:4px;">
            <strong style="color:var(--emerald-archive);font-size:13px;">适合谁看</strong>
            <p class="typo-t3-editorial" style="margin:6px 0 0;font-size:13px;">${esc(baseWork.fitFor)}</p>
          </div>
          <div style="padding:14px;background:var(--bg-celluloid);border:1px solid var(--border-subtle);border-radius:4px;">
            <strong style="color:var(--amber-tungsten);font-size:13px;">看之前知道</strong>
            <p class="typo-t3-editorial" style="margin:6px 0 0;font-size:13px;">${esc(baseWork.cautionFor)}</p>
          </div>
        </div>
      </section>

      <div class="viz-grid-2col">
        <section class="viz-panel" style="margin-bottom:0;">
          <div class="panel-header">
            <h3 class="panel-title"><span>02 ·</span> 五维视听美学雷达 · 策展主观坐标</h3>
            <button type="button" id="toggleRadarAvgBtn" class="btn-couture is-active" style="padding:3px 9px;font-size:11px;">叠层对比: TOP 10 策展均值</button>
          </div>
          <div class="radar-stage">
            <div class="radar-svg-wrap" id="dossierRadarSvg">${radarObj.svg}</div>
            <div class="radar-legend-list" id="dossierRadarLegend">${radarObj.legend}</div>
          </div>
        </section>

        <section class="viz-panel" style="margin-bottom:0;">
          <div class="panel-header">
            <h3 class="panel-title"><span>03 ·</span> Bangumi 10★–1★ 评分分布直方图</h3>
            <span class="typo-t4-timecode" style="color:var(--gold-leaf);">${bgmObj.stdDevTag}</span>
          </div>
          <div class="bgm-summary-row">${bgmObj.summaryHtml}</div>
          <div class="bgm-bars-container">${bgmObj.barsHtml}</div>
        </section>
      </div>

      <section class="viz-panel">
        <div class="panel-header">
          <h3 class="panel-title"><span>04 ·</span> 主创与代表作</h3>
          <span class="typo-t4-timecode" id="constellationActiveLabel"></span>
        </div>
        <div class="constellation-layout">
          <div class="graph-canvas-box" id="constellationSvgBox"></div>
          <div class="creator-inspector" id="creatorInspectorBox"></div>
        </div>
      </section>

      <section class="viz-panel">
        <div class="panel-header">
          <h3 class="panel-title"><span>05 ·</span> 观看进度</h3>
          <div style="display:flex;gap:8px;">
            <button type="button" id="btnCheckAllEps" class="btn-couture" style="padding:4px 10px;font-size:11.5px;">✓ 全部点亮已看</button>
            <button type="button" id="btnResetEps" class="btn-couture" style="padding:4px 10px;font-size:11.5px;">↺ 重置本片进度</button>
          </div>
        </div>
        <div id="epProgressDeckBox"></div>

        <div class="eyebrow" style="margin:18px 0 10px;">关键单集 · 导入策展考据（待核对，含剧情内容）</div>
        <div id="epDossierCardsList">
          ${(baseWork.episodeGuide || [])
            .map(
              (ep) => `
            <div class="ep-dossier-card">
              <div class="ep-num-badge">EP.${String(ep.ep).padStart(2, "0")}</div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                  <div>
                    <strong style="font-family:var(--font-cjk-serif);font-size:16.5px;">《${esc(ep.title)}》</strong>
                    <span class="muted-sm" style="margin-left:6px;">${esc(ep.jp || "")} (${esc(ep.runtime || "24:00")})</span>
                    <span class="pill pill-gold" style="margin-left:6px;">${esc(ep.badge)}</span>
                  </div>
                  <span class="typo-t4-timecode" style="color:var(--gold-leaf);font-weight:700;">单集 ★ ${ep.score}</span>
                </div>
                <div class="typo-t4-timecode" style="color:var(--gold-champagne);margin:4px 0 6px;">${esc(ep.staff)}</div>
                <p class="typo-t3-editorial" style="margin:0;font-size:13.5px;">${esc(ep.note)}</p>
                ${ep.source ? `<a class="episode-source" href="${esc(ep.source)}" target="_blank" rel="noopener noreferrer">Bangumi 章节来源 ↗</a>` : ""}
                <div style="margin-top:8px;">
                  <button type="button" class="chip-btn" data-filter-ep="${ep.ep}">筛选 / 撰写 EP.${String(ep.ep).padStart(2, "0")} 讨论 →</button>
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </section>

      <section id="commentsSectionAnchor" class="viz-panel">
        <div class="panel-header">
          <h3 class="panel-title"><span>06 ·</span> 讨论</h3>
          <select id="discussionEpisodeFilter" aria-label="按单集筛选讨论" style="max-width:100%;padding:8px;background:var(--bg-vault);border:1px solid var(--border-subtle);border-radius:4px">
            <option value="0">全部集数的讨论</option>${allEpisodeOptions}</select>
          <div id="epCommentFilterGroup" class="segmented-pills">
            <button type="button" class="size-pill ${initialEpFilter === 0 ? "active" : ""}" data-ep-tab="0">全部讨论</button>
            ${(baseWork.episodeGuide || [])
              .map(
                (ep) =>
                  `<button type="button" class="size-pill ${initialEpFilter === ep.ep ? "active" : ""}" data-ep-tab="${ep.ep}">EP.${String(
                    ep.ep
                  ).padStart(2, "0")}</button>`
              )
              .join("")}
          </div>
        </div>

        <div id="discussionCritiques" hidden></div>
        ${audiencePanel(a)}
        <form id="commentPostForm" class="modal-form" style="margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid var(--border-hairline);">
          <input type="hidden" id="replyParentId" value="">
          <div id="replyingBanner" class="pill pill-coral" hidden style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;">
            <span id="replyingText"></span>
            <button type="button" id="cancelReplyBtn">取消回复 ×</button>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <select id="commentEpSelect" style="flex:1;min-width:160px;">
              <option value="0">针对全片发表总评</option>
              ${allEpisodeOptions}
            </select>
            <select id="commentRatingSelect" style="width:135px;">
              <option value="0">不评分</option>
              ${Array.from({length:10},(_,i)=>`<option value="${10-i}">${10-i} 分</option>`).join("")}
            </select>
            <label class="toggle-label" style="font-size:12px;">
              <input type="checkbox" id="commentSpoilerCheck">
              <span>含关键剧透（默认毛玻璃遮罩）</span>
            </label>
          </div>
          <textarea id="commentTextarea" rows="3" placeholder="${
            currentUser
              ? `以「${currentUser.nickname}」身份撰写分镜考据或观后感...`
              : "写下你的观后感…"
          }"></textarea>
          <p id="commentPostError" class="error-banner" role="alert" hidden></p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="typo-t4-timecode">${
              currentUser ? `当前署名：${esc(currentUser.nickname)} (${esc(currentUser.role_badge)})` : "访客 · 登录后可发表"
            }</span>
            <button type="submit" class="btn-primary btn-sm">发表评论</button>
          </div>
        </form>

        <div id="animeCommentsContainer">正在读取馆内讨论...</div>
      </section>
    `;

    const [head, overview, ratings, creators, episodes, discussion] = [...$("animeContent").children];
    const panels={overview:[overview],episodes:[episodes],comments:[discussion],archive:[ratings,creators]};
    const nav=document.createElement("nav");nav.className="work-tabs";nav.setAttribute("aria-label","作品内容");
    nav.innerHTML=Object.entries({overview:"概览",episodes:"分集",comments:"讨论",archive:"资料"}).map(([key,label])=>`<button type="button" data-panel="${key}">${label}</button>`).join("");
    head.after(nav);
    function openPanel(key){
      if (key === "episodes" && episodes.dataset.unavailable === "true") key = "overview";
      for(const [name,nodes] of Object.entries(panels)) for(const node of nodes) node.hidden=name!==key || node.dataset.unavailable==="true";
      for(const button of nav.children)button.setAttribute("aria-pressed",String(button.dataset.panel===key));
      history.replaceState({...history.state,panel:key},"",location.href);
    }
    nav.onclick=e=>{
      const key=e.target.dataset.panel;
      if (!key || e.target.getAttribute("aria-pressed")==="true") return;
      openPanel(key);
      for (const panel of panels[key]) if (!panel.hidden) ScreenMotion.brighten(panel);
    };
    if (a.episodes <= 1 && !baseWork.episodeGuide?.length) {
      nav.querySelector('[data-panel="episodes"]').hidden = true;
      episodes.dataset.unavailable = "true";
    }
    openPanel(location.hash === "#reviews" ? "overview" : history.state?.panel || (location.hash.includes("comment")?"comments":location.hash==="#episodes"?"episodes":"overview"));
    if(!a.flagship && !baseWork.radar)ratings.firstElementChild.hidden=true;
    if(!a.flagship && [a.director,a.studio,a.music,a.sakuga].every(v=>!v||v==="资料未收录")) creators.dataset.unavailable="true";
    const range=document.createElement("form");range.className="ep-range";
    if(a.episodes){
      range.innerHTML=`<label>标记看到第 <input type="number" min="1" max="${a.episodes}" value="${nextEpisode(a)||a.episodes}" required> 集</label><button class="btn-couture">保存进度</button>`;
      $("epProgressDeckBox").before(range);
      range.onsubmit=async e=>{e.preventDefault();const end=Number(range.querySelector("input").value);await saveWatchedEpisodesFor(a.id,Array.from({length:end},(_,i)=>i+1));updateEpisodeProgressUI();};
    }
    $("toggleRadarAvgBtn").onclick = (e) => {
      showRadarAvg = !showRadarAvg;
      e.currentTarget.classList.toggle("is-active", showRadarAvg);
      const nextRadar = renderPolygonRadarHTML(baseWork, showRadarAvg);
      $("dossierRadarSvg").innerHTML = nextRadar.svg;
    };

    const updateConstellation = () => {
      const graphObj = renderConstellationGraphSVG(baseWork, activeCreatorRole);
      const activeCreator = graphObj.activeCreator;
      $("constellationSvgBox").innerHTML = graphObj.svg;
      $("constellationActiveLabel").textContent = `ACTIVE NODE: ${activeCreator.role} · ${activeCreator.name}`;
      $("creatorInspectorBox").innerHTML = `
        <div>
          <div class="typo-t4-timecode" style="color:var(--gold-leaf);">${esc(activeCreator.role)}</div>
          <h4 class="typo-t2-auteur" style="font-size:1.15rem;margin:2px 0;">${esc(activeCreator.name)}</h4>
          <p class="typo-t3-editorial" style="font-size:12px;margin:4px 0;">点击左侧星系图中的不同职位节点可即时切换关系网；点击下方作品可联动检索馆藏：</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${(activeCreator.works || [])
            .map(
              (w) => `
            <div class="rep-work-item" data-search-work="${esc(w.split(" (")[0])}">
              <span style="font-size:13px;">《${esc(w.split(" (")[0])}》</span>
              <span class="typo-t4-timecode" style="color:var(--gold-champagne);">${w.includes("(") ? esc(w.slice(w.indexOf("("))) : "检索"} ›</span>
            </div>
          `
            )
            .join("")}
        </div>
      `;

      $("constellationSvgBox").querySelectorAll(".creator-node").forEach((node) => {
        node.onclick = () => {
          activeCreatorRole = node.getAttribute("data-role-key");
          updateConstellation();
        };
      });

      document.querySelectorAll("[data-search-work], .sub-work-node").forEach((el) => {
        el.onclick = () => {
          const kw = el.getAttribute("data-search-work") || el.getAttribute("data-work-query") || "";
          const found = catalog.find((item) => item.title.includes(kw) || kw.includes(item.title.split(" · ")[0]));
          if (found) {
            navigate(`/anime/${found.id}?from=${a.id}`);
          } else {
            $("topQuery").value = kw;
            $("catalogQuery").value = kw;
            navigate("/find");
            runCatalogFilter({ resetPage: true });
          }
        };
      });
    };
    updateConstellation();

    let episodeGroup=Math.floor(((nextEpisode(a)||1)-1)/48);
    const updateEpisodeProgressUI = () => {
      if (visit !== routeSequence) return;
      const watchedArr = getWatchedEpisodesFor(a.id);
      const watchedSet = new Set(watchedArr);
      const totalEps = a.episodes || 0;
      const watchedCount = watchedSet.size;
      const pct = (totalEps ? Math.round((watchedCount / totalEps) * 100) : 0);
      const r = 22;
      const circum = 2 * Math.PI * r;
      const dashOffset = circum * (1 - pct / 100);

      let cellsHtml = "";
      for (let ep = episodeGroup*48+1; ep <= Math.min(totalEps,(episodeGroup+1)*48); ep++) {
        const isWatched = watchedSet.has(ep);
        const guideMatch = (baseWork.episodeGuide || []).find((g) => g.ep === ep);
        const epTitle = guideMatch ? guideMatch.title : `第 ${ep} 话`;
        cellsHtml += `
          <div class="ep-cell ${isWatched ? "watched" : ""}" data-checkin-ep="${ep}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="typo-t4-timecode" style="color:${isWatched ? "var(--gold-leaf)" : "var(--ink-ash)"};">EP.${String(ep).padStart(2, "0")}</span>
              <span style="width:7px;height:7px;border-radius:50%;background:${isWatched ? "var(--gold-leaf)" : "rgba(255,255,255,0.18)"};"></span>
            </div>
            <div style="font-size:12px;color:var(--ink-ivory);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px;">${esc(epTitle)}</div>
            <div class="typo-t4-timecode" style="font-size:10px;margin-top:2px;">${isWatched ? "已打卡 ✓" : "点击点亮"}</div>
          </div>
        `;
      }

      $("epProgressDeckBox").innerHTML = `
        <div class="ep-ring-summary">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5"/>
            <circle cx="28" cy="28" r="${r}" fill="none" stroke="#a3362c" stroke-width="5"
              stroke-dasharray="${circum.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"
              transform="rotate(-90 28 28)" stroke-linecap="round"/>
            <text x="28" y="32" text-anchor="middle" fill="#292923" font-family="monospace" font-size="11" font-weight="700">${pct}%</text>
          </svg>
          <div>
            <div style="font-size:14px;font-weight:600;">已点亮 ${watchedCount} / ${totalEps} 话 · 累计观影 ${a.epMinutes ? watchedCount * a.epMinutes + " 分钟" : "时长待补充"}</div>
            <div class="typo-t4-timecode">单击格子切换已看状态 · 按住 Shift 点击可一键连选点亮至该集</div>
          </div>
        </div>
        ${totalEps>48?`<label>集段 <select id="epGroup">${Array.from({length:Math.ceil(totalEps/48)},(_,g)=>`<option value="${g}" ${g===episodeGroup?"selected":""}>${g*48+1}–${Math.min(totalEps,(g+1)*48)} 集</option>`).join("")}</select></label>`:""}
        <div class="ep-grid-matrix">${cellsHtml}</div>
      `;

      if($("epGroup"))$("epGroup").onchange=e=>{episodeGroup=Number(e.target.value);updateEpisodeProgressUI();};
      $("epProgressDeckBox").querySelectorAll("[data-checkin-ep]").forEach((cell) => {
        cell.onclick = async (ev) => {
          const epNum = Number(cell.dataset.checkinEp);
          const curSet = new Set(getWatchedEpisodesFor(a.id));
          if (ev.shiftKey) {
            for (let k = 1; k <= epNum; k++) curSet.add(k);
          } else {
            if (curSet.has(epNum)) curSet.delete(epNum);
            else curSet.add(epNum);
          }
          await saveWatchedEpisodesFor(a.id, [...curSet].sort((x, y) => x - y));
          updateEpisodeProgressUI();
        };
      });
    };
    updateEpisodeProgressUI();

    $("btnCheckAllEps").onclick = async () => {
      const all = Array.from({ length: a.episodes || 0 }, (_, i) => i + 1);
      await saveWatchedEpisodesFor(a.id, all);
      updateEpisodeProgressUI();
    };
    $("btnResetEps").onclick = async () => {
      await saveWatchedEpisodesFor(a.id, []);
      updateEpisodeProgressUI();
    };

    $("animeContent").querySelectorAll("[data-mark-status]").forEach((btn) => {
      btn.onclick = () => {
        const st = btn.dataset.markStatus;
        const nextSt = myStatus === st ? "" : st;
        const sc = Number($("personalScoreSelect").value || 0);
        toggleWatchStatus(baseId, nextSt, sc, () => renderAnimeDossierPage(a.id, from, initialEpFilter));
      };
    });
    $("personalScoreSelect").onchange = () => {
      const sc = Number($("personalScoreSelect").value || 0);
      toggleWatchStatus(baseId, myStatus || "watched", sc, () => renderAnimeDossierPage(a.id, from, initialEpFilter));
    };

    let activeEpFilter = initialEpFilter;
    let workNotes = [];
    const reviewBox = $("reviews");
    const discussionBox = $("discussionCritiques");
    function drawDiscussionCritiques() {
      const filtered = activeEpFilter ? workNotes.filter(note => note.ep === activeEpFilter) : workNotes;
      discussionBox.hidden = !filtered.length;
      if (!filtered.length) { discussionBox.replaceChildren(); return; }
      discussionBox.innerHTML = `<details class="critique-fold" ${activeEpFilter ? "open" : ""}><summary>编辑短评 · ${activeEpFilter ? "第 "+activeEpFilter+" 集" : "全片与分集"}（${filtered.length} 篇）</summary>
        <div class="critique-grid">${filtered.map(critiqueCard).join("")}</div></details>`;
    }
    const notesReady = readCriticism().then(library => {
      if (!reviewBox.isConnected || visit !== routeSequence) return;
      workNotes = library[a.bgmId] || [];
      const general = workNotes.filter(note => !note.ep);
      const episodeCount = workNotes.length - general.length;
      if (general.length) {
        reviewBox.innerHTML = `<h3>编辑短评</h3><div class="critique-grid">${general.map(critiqueCard).join("")}</div>` +
          (episodeCount ? `<button type="button" class="btn-couture" data-read-episodes>读分集短评（${episodeCount} 篇）</button>` : "");
        const readEpisodes = reviewBox.querySelector("[data-read-episodes]");
        if (readEpisodes) readEpisodes.onclick = () => {
          activeEpFilter = 0;
          openPanel("comments");
          refreshComments();
          discussionBox.querySelector("details").open = true;
          discussionBox.scrollIntoView({block:"start",behavior:"instant"});
        };
      } else {
        const picks = featuredLists.flatMap(list => {
          const item = list.items.find(entry => entry.animeId === a.id && entry.reason);
          return item ? [{list, text:item.reason}] : [];
        }).slice(0,3);
        if (picks.length) reviewBox.innerHTML = `<h3>片单里的观看笔记</h3>` + picks.map(({list,text})=>
          `<article class="critique-card"><a href="/list/${esc(list.id)}">${esc(list.title)} ↗</a><p>${esc(text)}</p></article>`).join("");
      }
      reviewBox.hidden = !reviewBox.childElementCount;
      drawDiscussionCritiques();
    });
    const refreshComments = () => {
      if (visit !== routeSequence) return;
      drawDiscussionCritiques();
      $("audienceSnapshot").hidden = activeEpFilter !== 0;
      $("epCommentFilterGroup").querySelectorAll("[data-ep-tab]").forEach(tab => {
        tab.classList.toggle("active", Number(tab.dataset.epTab) === activeEpFilter);
      });
      $("discussionEpisodeFilter").value = String(activeEpFilter);
      $("commentEpSelect").value = String(activeEpFilter);
      return loadAndRenderAnimeComments(baseId, activeEpFilter);
    };
    $("discussionEpisodeFilter").onchange = (event) => {
      activeEpFilter = Number(event.target.value);
      refreshComments();
    };

    $("animeContent").querySelectorAll("[data-filter-ep]").forEach((btn) => {
      btn.onclick = () => {
        openPanel("comments");
        activeEpFilter = Number(btn.dataset.filterEp);
        refreshComments();
        $("commentsSectionAnchor").scrollIntoView({ behavior: "smooth" });
      };
    });

    $("epCommentFilterGroup").querySelectorAll("[data-ep-tab]").forEach((btn) => {
      btn.onclick = () => {
        activeEpFilter = Number(btn.dataset.epTab);
        refreshComments();
      };
    });

    $("cancelReplyBtn").onclick = () => {
      $("replyParentId").value = "";
      $("replyingBanner").hidden = true;
    };

    $("commentPostForm").onsubmit = async (e) => {
      e.preventDefault();
      if (!currentUser) return openAuthModal("login");
      const content = $("commentTextarea").value.trim();
      if (!content) return;
      $("commentPostError").hidden = true;
      const response = await fetch(`/api/anime/${baseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parentId: $("replyParentId").value ? Number($("replyParentId").value) : null,
          episodeNum: Number($("commentEpSelect").value || 0),
          rating: Number($("commentRatingSelect").value || 0),
          isSpoiler: $("commentSpoilerCheck").checked
        })
      }).catch(() => null);
      if (visit !== routeSequence) return;
      if (!response?.ok) {
        const detail = await response?.json().catch(() => ({}));
        $("commentPostError").textContent = detail?.error || "留言未能发送，请重试。";
        $("commentPostError").hidden = false;
        return;
      }
      $("commentTextarea").value = "";
      $("replyParentId").value = "";
      $("replyingBanner").hidden = true;
      await loadBootstrap();
      refreshComments();
    };

    await Promise.all([refreshComments(), notesReady]);
  }

  let commentSequence = 0;
  async function loadAndRenderAnimeComments(animeId, epFilter = 0) {
    const request = ++commentSequence;
    const box = $("animeCommentsContainer");
    try {
      const res = await fetch(`/api/anime/${animeId}/comments`);
      const data = await res.json();
      if (request !== commentSequence || !box.isConnected) return;
      const all = data.comments || [];
      const filtered = epFilter > 0 ? all.filter((c) => Number(c.episode_num) === epFilter) : all;

      if (!filtered.length) {
        box.innerHTML = `<div style="padding:20px;border:1px dashed var(--border-hairline);text-align:center;" class="muted-sm">该集暂无独立随记，欢迎在上方写下第一条分镜考据或观后感！</div>`;
        return;
      }

      const roots = filtered.filter((c) => !c.parent_id);
      const repliesByParent = {};
      all.forEach((c) => {
        if (c.parent_id) {
          repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || [];
          repliesByParent[c.parent_id].push(c);
        }
      });

      const renderList = roots.length ? roots : filtered;
      box.innerHTML = renderList
        .slice()
        .reverse()
        .map((c) => {
          const replies = repliesByParent[c.id] || [];
          return `
            <div class="comment-card" id="comment-${c.id}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="user-chip" style="cursor:pointer;" data-user-profile="${esc(c.username)}">
                  <span class="avatar-dot" style="background:${c.avatar_color || "#d4af37"}">${esc(c.nickname.slice(0, 1))}</span>
                  <strong>${esc(c.nickname)}</strong>
                  <span class="pill" style="font-size:10px;">${esc(c.role_badge || "常驻映友")}</span>
                </span>
                <div class="threshold-pills" style="margin:0;">
                  ${c.episode_num > 0 ? `<span class="pill pill-gold">EP.${String(c.episode_num).padStart(2, "0")} 考据</span>` : `<span class="pill">全片深评</span>`}
                  ${c.rating ? `<span class="pill pill-coral">★ ${c.rating}</span>` : ""}
                  <span class="typo-t4-timecode">${esc(c.created_at.slice(0, 16))}</span>
                </div>
              </div>

              ${
                c.is_spoiler
                  ? `<div style="margin:8px 0;"><span class="pill pill-coral" style="font-size:10.5px;">含剧透 · 点击下方毛玻璃文字展开阅读</span><p class="spoiler-blur typo-t3-editorial" style="margin:6px 0 0;">${esc(c.content)}</p></div>`
                  : `<p class="typo-t3-editorial" style="margin:10px 0 8px;color:var(--ink-ivory);">${esc(c.content)}</p>`
              }

              <div style="display:flex;gap:12px;align-items:center;">
                <button type="button" class="chip-btn" data-like-comment="${c.id}">♥ 有同感 (${c.likes || 0})</button>
                <button type="button" class="chip-btn" data-reply-comment="${c.id}" data-reply-nick="${esc(c.nickname)}" data-reply-episode="${c.episode_num}">↩ 楼中楼回复</button>
              </div>

              ${replies
                .map(
                  (r) => `
                <div class="comment-reply" id="comment-${r.id}">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                    <span class="user-chip" style="cursor:pointer;" data-user-profile="${esc(r.username)}">
                      <strong style="color:var(--gold-leaf);">${esc(r.nickname)}</strong>
                      <span class="muted-sm">${esc(r.role_badge || "")}</span>
                    </span>
                    <span class="typo-t4-timecode">${esc(r.created_at.slice(0, 16))}</span>
                  </div>
                  <p class="typo-t3-editorial ${r.is_spoiler ? "spoiler-blur" : ""}" style="margin:0;font-size:13px;">${esc(r.content)}</p>
                </div>
              `
                )
                .join("")}
            </div>
          `;
        })
        .join("");

      box.querySelectorAll(".spoiler-blur").forEach((el) => {
        el.onclick = () => el.classList.toggle("is-revealed");
      });
      box.querySelectorAll("[data-user-profile]").forEach((el) => {
        el.onclick = () => navigate(`/user/${el.dataset.userProfile}`);
      });
      box.querySelectorAll("[data-like-comment]").forEach((btn) => {
        btn.onclick = async () => {
          if (!currentUser) return openAuthModal("login");
          await fetch(`/api/comments/${btn.dataset.likeComment}/like`, { method: "POST" });
          if (box.isConnected && request === commentSequence) loadAndRenderAnimeComments(animeId, epFilter);
        };
      });
      box.querySelectorAll("[data-reply-comment]").forEach((btn) => {
        btn.onclick = () => {
          $("replyParentId").value = btn.dataset.replyComment;
          $("commentEpSelect").value = btn.dataset.replyEpisode;
          $("replyingText").textContent = `正在回复 @${btn.dataset.replyNick} 的馆内笔记`;
          $("replyingBanner").hidden = false;
          $("commentTextarea").focus();
        };
      });
    } catch {
      if (request !== commentSequence || !box.isConnected) return;
      box.innerHTML = `<div class="muted-sm">读取讨论失败。</div>`;
    }
  }

  async function renderUserProfilePage(username) {
    const visit = routeSequence;
    $("userBackBtn").onclick = () => history.state?.internal ? history.back() : navigate("/community");
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
    if (visit !== routeSequence) return;
    if (!res.ok) {
      $("userContent").innerHTML = `<div class="viz-panel">未找到该映友档案。</div>`;
      return;
    }
    const data = await res.json();
    if (visit !== routeSequence) return;
    const p = data.profile;
    $("userBarTitle").textContent = `${p.nickname} 的书架`;
    const affinity = calcTasteAffinity(p.username);

    $("userContent").innerHTML = `
      <div class="viz-panel sprocket-strip" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;padding:28px;">
        <div style="display:flex;align-items:center;gap:18px;">
          <div class="avatar-dot" style="width:62px;height:62px;font-size:24px;background:${p.avatar_color};">${esc(p.nickname.slice(0, 1))}</div>
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="font-family:var(--font-cjk-serif);margin:0;font-size:26px;">${esc(p.nickname)}</h1>
              <span class="pill pill-gold">${esc(p.role_badge)}</span>
              <span class="pill pill-coral">${affinity==="—"?"共同记录不足":"重合度 "+affinity+"%"}</span>
            </div>
            <p class="typo-t3-editorial" style="margin:6px 0;">${esc(p.bio)}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${(p.taste_tags || []).map((t) => `<span class="pill">#${esc(t)}</span>`).join("")}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="typo-t4-timecode" style="margin-bottom:10px;">关注 ${data.followingCount} · 同好粉丝 ${data.followersCount}</div>
          <div style="display:flex;gap:8px;">
            <button type="button" id="switchToThisPersonaBtn" class="btn-couture">⚡ 切换为 TA 的视角体验</button>
            <button type="button" id="followUserBtn" class="btn-primary btn-sm">${data.isFollowing ? "✓ 已关注同好" : "+ 关注同好"}</button>
          </div>
        </div>
      </div>

      <div class="viz-grid-2col">
        <div class="viz-panel">
          <div class="panel-header"><h3 class="panel-title">TA 发表的分集考据与长评 (${data.comments.length})</h3></div>
          ${data.comments
            .map((c) => {
              const a = animeById[c.anime_id];
              return `
                <div class="comment-card" style="cursor:pointer;" data-open-anime="${c.anime_id}" data-comment="${c.id}" data-episode="${c.episode_num||0}">
                  <div style="display:flex;justify-content:space-between;">
                    <strong class="typo-t2-auteur">《${esc(a ? a.title : c.anime_id)}》 ${c.episode_num ? `· EP.${c.episode_num}` : ""}</strong>
                    <span class="typo-t4-timecode">${c.rating ? "★ "+c.rating : "未评分"} · ♥ ${c.likes}</span>
                  </div>
                  <p class="typo-t3-editorial" style="margin:6px 0 0;font-size:13.5px;">${esc(c.is_spoiler ? "含剧透，进入作品讨论后展开" : c.content)}</p>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="viz-panel">
          <div class="panel-header"><h3 class="panel-title">TA 的馆藏书架 (${data.watchlist.length})</h3></div>
          ${data.watchlist
            .map((w) => {
              const a = animeById[w.anime_id];
              return `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;" data-open-anime="${w.anime_id}">
                  <span>《${esc(a ? a.title : w.anime_id)}》</span>
                  <span class="typo-t4-timecode" style="color:var(--gold-champagne);">${statusLabel(w.status)} · ★ ${w.personal_score || "未评"}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    $("switchToThisPersonaBtn").hidden = true;
    const publicLists=(bootstrapData.customLists||[]).filter(l=>l.username===p.username);
    $("userContent").insertAdjacentHTML("beforeend",`<section class="viz-panel"><h2>公开片单</h2>${publicLists.map(l=>`<a class="continue-row" href="/list/${l.id}">${esc(l.title)} →</a>`).join("") || "还没有发布片单。"}</section>`);
    $("switchToThisPersonaBtn").onclick = () => quickSwitchPersona(p.username);
    $("followUserBtn").onclick = async () => {
      if (!currentUser) return openAuthModal("login");
      await fetch("/api/me/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: p.id })
      });
      if (visit === routeSequence) renderUserProfilePage(username);
    };
    $("userContent").querySelectorAll("[data-open-anime]").forEach((el) => {
      el.onclick = () => navigate(`/anime/${el.dataset.openAnime}?from=user${el.dataset.comment?"&ep="+el.dataset.episode+"#comment-"+el.dataset.comment:""}`);
    });
  }

  function renderCommunityPage() {
    const customLists = bootstrapData.customLists || [];
    const personas = bootstrapData.personas || [];
    $("communityContent").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="eyebrow">CINEPHILE AGORA · 12位常驻馆员与映友共创片单</div>
          <h1 class="typo-t1-marquee" style="font-size:2rem;">讨论</h1>
        </div>
        <button type="button" id="commCreateListBtn" class="btn-primary">+ 发布我的主题片单</button>
      </div>

      <div class="secondary-lists-grid" style="margin-bottom:32px;">
        ${customLists
          .map(
            (cl) => `
          <article class="compact-list-card" data-custom-list="${cl.id}">
            <div>
              <div class="list-kicker-row">
                <span class="user-chip">
                  <span class="avatar-dot" style="background:${cl.avatar_color || "#d4af37"}">${esc(cl.nickname.slice(0, 1))}</span>
                  <strong>${esc(cl.nickname)}</strong>
                </span>
                <span class="pill pill-gold">♥ ${cl.likes || 0} 同感</span>
              </div>
              <h3>${esc(cl.title)}</h3>
              <p class="typo-t3-editorial" style="font-size:13px;">${esc(cl.lead)}</p>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:12px;" class="typo-t4-timecode">
              <span>收录 ${(cl.items || []).length} 部</span>
              <span class="accent-text">展映此共创单 →</span>
            </div>
          </article>
        `
          )
          .join("")}
      </div>

      <div class="viz-panel">
        <div class="panel-header"><h3 class="panel-title">映友主页</h3></div>
        <div class="secondary-lists-grid">
          ${personas
            .map(
              (p) => `
            <div class="persona-card" data-username="${esc(p.username)}">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="avatar-dot" style="background:${p.avatar_color}">${esc(p.nickname.slice(0, 1))}</span>
                  <strong>${esc(p.nickname)}</strong>
                </div>
                <div class="typo-t4-timecode" style="color:var(--gold-leaf);margin:4px 0;">${esc(p.role_badge)}</div>
                <p class="muted-sm" style="margin:0;">${esc(p.bio)}</p>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    const feed=document.createElement("section");feed.className="discussion-feed";
    feed.innerHTML=(bootstrapData.recentDiscussions||[]).map(d=>`<a class="continue-row" href="/anime/${d.anime_id}?from=community&ep=${d.episode_num||0}#comment-${d.id}"><div><strong>${esc(animeById[d.anime_id]?.title||d.anime_id)}</strong> · ${d.episode_num?"第 "+d.episode_num+" 集":"全片"}<p>${d.is_spoiler?"含剧透 · 打开讨论查看":esc(d.content)}</p><small>${esc(d.nickname)}</small></div></a>`).join("");
    $("communityContent").firstElementChild.after(feed);
    const shelf = document.createElement("section");
    shelf.className = "critique-section community-critiques";
    shelf.hidden = true;
    feed.before(shelf);
    readCriticism().then(library => {
      if (!shelf.isConnected) return;
      const reviewed = catalog.filter(work => library[work.bgmId]?.length);
      if (!reviewed.length) return;
      const bocchi = animeById["bocchi-the-rock"];
      const first = library[bocchi.bgmId]?.[0];
      shelf.innerHTML = `<h2>编辑影评</h2>` + (first ?
        `<a class="critique-feature" href="/anime/${bocchi.id}?from=community#reviews"><strong>《${esc(bocchi.title)}》 · ${esc(first.title)}</strong><p>${esc(first.body)}</p></a>` : "") +
        `<details class="critique-fold"><summary>按作品读影评（${reviewed.length} 部）</summary><div class="review-links">${reviewed.map(work=>
          `<a href="/anime/${work.id}?from=community#reviews">${esc(work.title)}</a>`).join("")}</div></details>`;
      shelf.hidden = false;
    });
    $("commCreateListBtn").onclick = () => openCreateListModal();
    $("communityContent").querySelectorAll("[data-custom-list]").forEach((el) => {
      el.onclick = () => navigate(`/list/${el.dataset.customList}`);
    });
    $("communityContent").querySelectorAll("[data-username]").forEach((el) => {
      el.onclick = () => navigate(`/user/${el.dataset.username}`);
    });
  }

  function nextEpisode(work){
    const watched=new Set(getWatchedEpisodesFor(work.id));
    for(let n=1;n<=work.episodes;n++)if(!watched.has(n))return n;
    return 0;
  }
  async function renderMinePage() {
    const visit = routeSequence;
    const order={watching:0,want:1,watched:2,dropped:3};
    const wlist = [...getEffectiveWatchlist()].sort((a,b)=>order[a.status]-order[b.status]);
    let notifications = [];
    if (currentUser) {
      const res = await fetch("/api/me/overview");
      if (res.ok) {
        const d = await res.json();
        notifications = d.notifications || [];
      }
      if (visit !== routeSequence) return;
      await fetch("/api/me/notifications/read", { method: "POST" });
      if (visit !== routeSequence) return;
      $("unreadBadge").hidden = true;
    }

    $("mineContent").innerHTML = `
      <div class="viz-panel sprocket-strip" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
        <div>
          <div class="eyebrow">PERSONAL SCREENING VAULT · 跨设备同步与消息中心</div>
          <h1 class="typo-t1-marquee" style="font-size:1.9rem;">${
            currentUser ? `${esc(currentUser.nickname)} 的书架` : "我的书架"
          }</h1>
          <p class="typo-t3-editorial" style="margin:4px 0 0;">${
            currentUser
              ? `@${esc(currentUser.username)} · ${esc(currentUser.role_badge)} · ${esc(currentUser.bio)}`
              : "访客记录保存在这个浏览器。注册后可用账号保存。"
          }</p>
        </div>
        <button type="button" id="mineAuthBtn" class="btn-primary">${
          currentUser ? "创建公开片单" : "注册并保存记录"
        }</button>
      </div>

      <div class="viz-grid-2col">
        <div class="viz-panel">
          <div class="panel-header"><h3 class="panel-title">我的作品 (${wlist.length} 部)</h3></div>
          ${
            wlist.length
              ? wlist
                  .map((w) => {
                    const a = animeById[w.anime_id];
                    return `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;" data-open-anime="${w.anime_id}">
                        <div>
                          <strong class="typo-t2-auteur">《${esc(a ? a.title : w.anime_id)}》</strong>
                          <span class="muted-sm" style="margin-left:8px;">${a ? `${a.year} · ${a.director}` : ""}</span>
                        </div>
                        <div class="threshold-pills" style="margin:0;">
                          <span class="pill pill-gold">${statusLabel(w.status)}</span>
                          ${w.personal_score ? `<span class="pill pill-coral">★ ${w.personal_score}</span>` : ""}
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<p class="muted-sm">书架还是空的。<a href="/find">去找一部作品 →</a></p>`
          }
        </div>

        <div class="viz-panel">
          <div class="panel-header"><h3 class="panel-title">收到的楼中楼回复提醒 (${notifications.length})</h3></div>
          ${
            notifications.length
              ? notifications
                  .map(
                    (n) => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;" data-open-anime="${n.anime_id}" data-comment="${n.comment_id}">
                  <div style="font-size:12.5px;"><strong style="color:var(--gold-leaf);">${esc(n.from_nickname)}</strong> 在《${esc(
                      animeById[n.anime_id]?.title || n.anime_id
                    )}》回应了你：</div>
                  <p class="typo-t3-editorial" style="margin:4px 0 0;font-size:13px;">${esc(n.snippet)}</p>
                </div>
              `
                  )
                  .join("")
              : `<p class="muted-sm">暂时没有回复。</p>`
          }
        </div>
      </div>
    `;

    const progress=currentUser?bootstrapData.episodeProgress:getLocalEpProgress();
    const ongoing=[...new Set([...wlist.filter(w=>w.status==="watching").map(w=>w.anime_id),...Object.keys(progress)])]
      .map(id=>animeById[id]).filter(w=>w && nextEpisode(w) && (getWatchedEpisodesFor(w.id).length || wlist.some(row=>row.anime_id===w.id&&row.status==="watching")));
    const shelf=$("mineContent").querySelector(".viz-grid-2col");
    shelf.insertAdjacentHTML("beforebegin",`<section class="viz-panel"><h2>接着看</h2>${ongoing.map(w=>`<a class="continue-row" href="/anime/${w.id}?from=mine#episodes"><strong>${esc(w.title)}</strong><span>下一集 · 第 ${nextEpisode(w)} 集 →</span></a>`).join("") || '<a href="/find">去找一部想看的动画 →</a>'}</section>`);
    const myLists=(bootstrapData.customLists||[]).filter(l=>l.username===currentUser?.username);
    const savedIds=currentUser?bootstrapData.savedLists:getGuestLists();
    const saved=[...featuredLists,...(bootstrapData.customLists||[])].filter(l=>savedIds?.includes(l.id));
    shelf.insertAdjacentHTML("afterend",`<section class="viz-panel"><h2>我的片单</h2>${[...new Map([...myLists,...saved].map(l=>[l.id,l])).values()].map(l=>`<a class="continue-row" href="/list/${l.id}">${esc(l.title)} →</a>`).join("") || "还没有收藏或发布片单。"}</section>`);
    if(currentUser){
      const edit=document.createElement("details");edit.className="profile-edit";edit.innerHTML=`<summary>编辑个人签名</summary><form><label>公开签名<input maxlength="200" value="${esc(currentUser.bio)}"></label><button class="btn-couture">保存</button></form>`;
      shelf.after(edit);edit.querySelector("form").onsubmit=async e=>{e.preventDefault();const response=await fetch("/api/me/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bio:edit.querySelector("input").value.trim()})});if(!response.ok)return showNotice("保存失败，请重试");await loadBootstrap();await renderMinePage();showNotice("签名已保存");};
    }
    $("mineAuthBtn").onclick = () => (currentUser ? openCreateListModal() : openAuthModal("register"));
    $("mineContent").querySelectorAll("[data-open-anime]").forEach((el) => {
      el.onclick = () => navigate(`/anime/${el.dataset.openAnime}?from=mine${el.dataset.comment ? "#comment-"+el.dataset.comment : ""}`);
    });
  }

  async function toggleWatchStatus(animeId, status, personalScore = 0, cb) {
    const visit = routeSequence;
    const list = getGuestWatchlist().filter((x) => x.animeId !== animeId);
    if (status) list.push({ animeId, status, personalScore });
    if(!currentUser)setGuestWatchlist(list);

    if (currentUser) {
      await fetch("/api/me/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, status, personalScore })
      });
      await loadBootstrap();
    }
    if (cb && visit === routeSequence) cb();
  }

  let noticeTimer;
  function showNotice(message){$("notice").textContent=message;$("notice").hidden=false; clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$("notice").hidden=true,6000);}
  let authMode = "login";
  function openAuthModal(mode = "login") {
    authMode = mode;
    $("tabLoginBtn").classList.toggle("active", mode === "login");
    $("tabRegisterBtn").classList.toggle("active", mode === "register");
    $("authNicknameWrap").hidden = mode !== "register";
    $("authBioWrap").hidden = true;
    $("authHint").hidden = mode !== "register";
    $("authNickname").required=mode==="register";
    $("authPassword").autocomplete=mode==="register"?"new-password":"current-password";
    $("authModalTitle").textContent=mode==="register"?"创建账号":"登录补完计划";
    $("authSubmitBtn").textContent = mode === "login" ? "登录" : "创建账号";
    $("authErrorMsg").hidden = true;

    if (!$("authDialog").open) $("authDialog").showModal();
  }

  $("showPassword").onclick=()=>{
    const input=$("authPassword");input.type=input.type==="password"?"text":"password";
    $("showPassword").textContent=input.type==="password"?"显示密码":"隐藏密码";
  };
  $("tabLoginBtn").onclick = () => openAuthModal("login");
  $("tabRegisterBtn").onclick = () => openAuthModal("register");
  $("closeAuthDialog").onclick = () => {pendingCreate=false;$("authDialog").close();};
  $("authDialog").oncancel=()=>{pendingCreate=false;};

  $("authForm").onsubmit = async (e) => {
    e.preventDefault();
    const url = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("authUsername").value.trim(),
        password: $("authPassword").value,
        nickname: $("authNickname").value.trim(),
        bio: $("authBio").value.trim(),
        guestWatchlist: getGuestWatchlist(),
        guestLists: getGuestLists(),
        guestEpisodeProgress: getLocalEpProgress()
      })
    });
    const data = await res.json();
    if (!res.ok) {
      $("authErrorMsg").textContent = data.error || "操作失败";
      $("authErrorMsg").hidden = false;
      return;
    }
    const form=$("commentPostForm");
    const resume=form && location.pathname.startsWith("/anime/") ? ["commentTextarea","commentEpSelect","discussionEpisodeFilter","commentRatingSelect","replyParentId","replyingText"].map(id=>[id,$(id).value ?? $(id).textContent]) : [];
    const spoiler=$("commentSpoilerCheck")?.checked, replyVisible=$("replyingBanner") && !$("replyingBanner").hidden;
    const y=scrollY;
    $("authDialog").close();$("authPassword").value="";
    await loadBootstrap();renderSocialSection();renderHero();
    scrollCache.set(currentRouteKey,y);
    await renderRoute(currentRouteKey, { isBack: true });
    if(resume.length){
      for(const [id,value] of resume){if(id==="replyingText")$(id).textContent=value;else $(id).value=value;}
      const ep=$("commentEpSelect").value;
      $("discussionEpisodeFilter").dispatchEvent(new Event("change"));$("commentEpSelect").value=ep;
      $("commentSpoilerCheck").checked=spoiler;$("replyingBanner").hidden=!replyVisible;
    }
    if(pendingCreate){pendingCreate=false;openCreateListModal();}
    if(authMode==="register") showNotice("已注册 · 已保存 "+bootstrapData.watchlist.length+" 部作品、"+Object.values(bootstrapData.episodeProgress).reduce((n,a)=>n+a.length,0)+" 集进度");
  };

  async function quickSwitchPersona(username) {
    if (!username) {
      await fetch("/api/auth/logout", { method: "POST" });
    } else {
      await fetch("/api/auth/quick-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
    }
    await loadBootstrap();
    renderHero();
    renderSocialSection();renderCatalogAndDeck();
    renderRoute(currentRouteKey, { isBack: false });
  }

  let listDraft;
  const draftKey = () => "completion-list-draft:" + currentUser.username;
  function saveListDraft(){
    for(const [key,id] of [["title","newListTitle"],["subtitle","newListSubtitle"],["lead","newListLead"]]) listDraft[key]=$(id).value;
    localStorage.setItem(draftKey(),JSON.stringify(listDraft));
  }
  function renderListEditor(){
    const term=$("listSearch").value.trim().toLowerCase();
    const picks=new Set(listDraft.items.map(it=>it.animeId));
    const matches=[];
    for(const work of catalog){
      if(!picks.has(work.id) && (!term || [work.title,work.origTitle,work.aliases].join(" ").toLowerCase().includes(term))) matches.push(work);
      if(matches.length===8) break;
    }
    $("listResults").innerHTML=matches.map(work=>`<button type="button" class="chip-btn" data-add="${work.id}">＋ ${esc(work.title)}</button>`).join("") || "没有更多匹配作品";
    $("newListAnimeSelector").innerHTML=listDraft.items.map((item,i)=>`<div class="edit-item"><strong>${i+1}. ${esc(animeById[item.animeId].title)}</strong>
      <div><button type="button" data-up="${i}" ${i===0?"disabled":""}>上移</button> <button type="button" data-down="${i}" ${i===listDraft.items.length-1?"disabled":""}>下移</button> <button type="button" data-remove="${i}">移除</button></div>
      <input data-reason="${i}" aria-label="入选理由" placeholder="为什么推荐这部？" value="${esc(item.reason)}"></div>`).join("") || "尚未添加作品";
  }
  function openCreateListModal() {
    if(!currentUser){pendingCreate=true;return openAuthModal("login");}
    listDraft=JSON.parse(localStorage.getItem(draftKey()) || '{"items":[]}');
    for(const [key,id] of [["title","newListTitle"],["subtitle","newListSubtitle"],["lead","newListLead"]]) $(id).value=listDraft[key] || "";
    $("previewBody").hidden=true;$("listSearch").value="";renderListEditor();$("createListDialog").showModal();
  }
  let pendingCreate=false;
  $("listSearch").oninput=renderListEditor;
  $("previewList").onclick=()=>{saveListDraft();$("previewBody").innerHTML=`<h3>${esc(listDraft.title||"未命名片单")}</h3><p>${esc(listDraft.lead)}</p><ol>${listDraft.items.map(it=>`<li>${esc(animeById[it.animeId].title)} · ${esc(it.reason)}</li>`).join("")}</ol>`;$("previewBody").hidden=false;};
  $("createListForm").oninput=e=>{
    $("previewBody").hidden=true;
    if(e.target.hasAttribute("data-reason"))listDraft.items[Number(e.target.dataset.reason)].reason=e.target.value;
    saveListDraft();
  };
  $("createListForm").onclick=e=>{
    const d=e.target.dataset,items=listDraft.items;
    if(d.add)items.push({animeId:d.add,reason:"",watchOrderNote:"映友推荐"});
    else if(d.remove!==undefined)items.splice(+d.remove,1);
    else if(d.up!==undefined)items.splice(+d.up-1,0,items.splice(+d.up,1)[0]);
    else if(d.down!==undefined)items.splice(+d.down+1,0,items.splice(+d.down,1)[0]);
    else return;
    $("previewBody").hidden=true;saveListDraft();renderListEditor();
  };
  $("closeCreateListDialog").onclick=()=>$("createListDialog").close();
  $("createListForm").onsubmit=async e=>{
    e.preventDefault();const items=listDraft.items;
    if (!items.length) return showNotice("请先添加一部作品");
    const res = await fetch("/api/custom-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: $("newListTitle").value.trim(),
        subtitle: $("newListSubtitle").value.trim(),
        lead: $("newListLead").value.trim(),
        items
      })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.removeItem(draftKey());$("createListDialog").close();
      await loadBootstrap();
      navigate(`/list/${data.id}`);
    } else {showNotice("发布失败，草稿已保存。");}
  };

  async function loadBootstrap(signal) {
    try {
      const res = await fetch("/api/bootstrap", {signal});
      if (!res.ok) throw new Error("账号信息暂时不可用");
      const data = await res.json();
      if (!Array.isArray(data.personas)) throw new Error("账号信息不完整");
      bootstrapData = data;
      currentUser = bootstrapData.user;
      const unread = bootstrapData.unreadCount || 0;
      $("unreadBadge").hidden = unread <= 0;
      $("unreadBadge").textContent = String(unread);
      $("navAuthBtn").textContent = currentUser ? `${bootstrapData.personas.some(p=>p.username===currentUser.username && p.is_demo)?"示例 · ":""}${currentUser.nickname} · 退出` : "登录";

      const sel = $("personaSelect");
      const personas = (bootstrapData.personas || []).filter(p => p.is_demo);
      sel.innerHTML =
        `<option value="">访客模式 (未登录)</option>` +
        personas
          .map(
            (p) =>
              `<option value="${esc(p.username)}" ${currentUser && currentUser.username === p.username ? "selected" : ""}>${esc(
                p.nickname
              )} (${esc(p.role_badge.split(" · ")[0])})</option>`
          )
          .join("");
    } catch {
      currentUser = null;
    }
  }


  $("personaSelect").onchange = () => quickSwitchPersona($("personaSelect").value);
  $("navAuthBtn").onclick = () => (currentUser ? quickSwitchPersona("") : openAuthModal("login"));
  $("btnTopRoulette").onclick = () => openTonightRoulette();
  $("toggleAllIssuesBtn").onclick = () => navigate("/lists");
  $("navPlay").onclick = () => navigate("/play");
  $("navLists").onclick = () => navigate("/lists");

  $("inlinePageSizePills").querySelectorAll(".size-pill").forEach((btn) => {
    btn.onclick = () => {
      pageSize = Number(btn.dataset.size);
      currentPage = 1;
      activeDecadeGroup = 0;
      renderCatalogAndDeck();
    };
  });
  $("btnPrevPage").onclick = () => goToPage(currentPage - 1);
  $("btnNextPage").onclick = () => goToPage(currentPage + 1);
  $("btnPrevDecade").onclick = () => goToPage(currentPage - 10);
  $("btnNextDecade").onclick = () => goToPage(currentPage + 10);
  $("btnOpenPageModal").onclick = () => openPagePickerWindow();

  const scrubSlider = $("pageScrubSlider");
  scrubSlider.oninput = () => updateScrubBanner(Number(scrubSlider.value));
  scrubSlider.onchange = () => goToPage(Number(scrubSlider.value));

  $("heroPrev").onclick = () => { heroIdx = (heroIdx - 1 + heroPool.length) % heroPool.length; renderHero(); };
  $("heroNext").onclick = () => { heroIdx = (heroIdx + 1) % heroPool.length; renderHero(); };
  $("heroPause").onclick = () => {
    heroPaused = !heroPaused;
    $("heroPause").textContent = heroPaused ? "继续" : "暂停";
    if(!heroPaused)$("heroPause").blur();
  };

  let debounceTimer = null;
  const onSearchInput = (val) => {
    $("topQuery").value = val;
    $("catalogQuery").value = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (currentRouteKey !== "/find") navigate("/find");
      runCatalogFilter({ resetPage: true });
    }, 140);
  };
  $("topQuery").addEventListener("input", (e) => onSearchInput(e.target.value));
  $("catalogQuery").addEventListener("input", (e) => onSearchInput(e.target.value));

  ["filterFormat", "filterDecade", "filterDuration", "filterSort", "filterEditorial", "filterAdult"].forEach((id) => {
    $(id).addEventListener("change", () => runCatalogFilter({ resetPage: true }));
  });

  document.querySelectorAll("[data-quick-tag]").forEach((btn) => {
    btn.onclick = () => {
      const tag = btn.dataset.quickTag;
      if(!tag){for(const id of ["filterFormat","filterDuration","filterDecade","filterSort"])$(id).selectedIndex=0; for(const id of ["filterEditorial","filterAdult"])$(id).checked=false;}
      $("topQuery").value = tag;
      $("catalogQuery").value = tag;
      runCatalogFilter({ resetPage: true });
    };
  });

  document.querySelectorAll("[data-close-home]").forEach((btn) => {
    btn.onclick = () => navigate("/");
  });
  document.addEventListener("click",e=>{
    const link=e.target.closest("a[href^='/']");
    if(!link||link.closest("[data-native]")||link.id==="brandHome"||link.target||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.defaultPrevented)return;
    e.preventDefault();navigate(link.pathname+link.search+link.hash);
  });
  document.addEventListener("keydown",e=>{
    if((e.key==="Enter"||e.key===" ") && e.target.matches("[role=button]:not(button)")){e.preventDefault();e.target.click();}
  });
  const interactive="[data-decision-id],.film-card,[data-list-id],.dialogue-card,.persona-card,.ep-cell,[data-open-anime],[data-custom-list],[data-username],.tarot-slot,.spoiler-blur,[data-user-profile]";
  const enhance=root=>{for(const el of root.querySelectorAll(interactive)){if(!el.matches("button,a,input")){el.tabIndex=0;el.setAttribute("role","button");}}};
  new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1){if(n.matches(interactive)){n.tabIndex=0;n.setAttribute("role","button");}enhance(n);}}).observe(document.body,{childList:true,subtree:true});
  $("brandHome").onclick = (e) => { e.preventDefault(); navigate("/"); };
  $("navHome").onclick = () => navigate("/");
  $("navCatalog").onclick = () => navigate("/find");
  $("navCommunity").onclick = () => navigate("/community");
  $("goCommunityBtn").onclick = () => navigate("/community");
  $("openCreateListBtn").onclick = () => openCreateListModal();
  $("navMine").onclick = () => navigate("/mine");

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    const anyModalOpen = Boolean(document.querySelector("dialog[open]"));
    if (e.key === "Escape" && !anyModalOpen && currentRouteKey !== "/") {
      navigate("/");
      return;
    }
    if (anyModalOpen) return;

    if (e.key === "/") {
      e.preventDefault();
      $("topQuery").focus();
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      openPagePickerWindow();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      openTonightRoulette();
    } else if (currentRouteKey === "/find" && e.key === "ArrowLeft") {
      goToPage(currentPage - (e.shiftKey ? 10 : 1));
    } else if (currentRouteKey === "/find" && e.key === "ArrowRight") {
      goToPage(currentPage + (e.shiftKey ? 10 : 1));
    }
  });

  if ($("catalogViewToggle")) {
    $("catalogViewToggle").onclick = () => {
      catalogCompactMode = !catalogCompactMode;
      renderCatalogAndDeck();
    };
  }
  if ($("closeAll25Dialog")) {
    $("closeAll25Dialog").onclick = () => $("all25Dialog").close();
  }

  new ResizeObserver(entries => {
    document.documentElement.style.setProperty('--topbar-height', entries[0].target.getBoundingClientRect().height+'px');
  }).observe(document.querySelector('.topbar'));
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const id = img.dataset.workImage;
    if (!id || img.classList.contains("leaving")) return;
    const subject = animeById[window.FY_ID_MAP[id] || "bgm-" + id];
    if (!subject) return;
    const backup = "/artwork/" + id;
    if (img.getAttribute("src") !== backup) {
      img.removeAttribute("srcset");
      img.src = backup;
      return;
    }
    const cover = document.createElement("figure");
    cover.className = "editorial-fallback";
    cover.innerHTML = window.FY_VISUAL_ENGINE.renderEditorialCover({
      ...subject, palette: ["#173525","#87b193","#446d52","#c1d4c2"]
    }, img.dataset.artMode || "poster");
    const caption = document.createElement("figcaption");
    caption.textContent = "编辑绘制封面";
    cover.append(caption);
    img.closest(".hero-artwork")?.querySelector("img.leaving")?.remove();
    img.replaceWith(cover);
  }, true);

  $("footerStats").textContent = `全库收录 ${archiveMeta.totalIndexedEntries.toLocaleString()} 个动画条目（${archiveMeta.ratedEntries.toLocaleString()} 个含 Bangumi 评分）· 20 部旗舰档案 · ${featuredLists.length} 期策展。`;

  if (location.pathname === "/find") {
    const params = new URLSearchParams(location.search);
    $("catalogQuery").value = $("topQuery").value = params.get("q") || "";
    currentPage = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  }
  renderHero();
  startHeroAutoPlay();
  renderTonightDecisionSection();
  renderCuratedSection();
  renderEpisodeSpotlightSection();
  renderContinueHomeStrip();
  const accountController = new AbortController();
  const accountTimer = setTimeout(() => accountController.abort(), 5000);
  $("heroQuickWantBtn").disabled = $("navAuthBtn").disabled = true;
  initialAccount = loadBootstrap(accountController.signal).finally(() => {
    clearTimeout(accountTimer);
    initialAccount = null;
    $("heroQuickWantBtn").disabled = $("navAuthBtn").disabled = false;
    renderHero();
    renderContinueHomeStrip();
    renderSocialSection();
  });
  document.querySelector(".topbar").inert = false;
  renderRoute(location.pathname + location.search + location.hash, { isBack: false }).then(() => {
    document.body.dataset.interactive = "true";
    $("startupShelf").remove();
    setTimeout(() => runCatalogFilter(), 0);
  });
})();
