// 《四叠半补完计划》v4 · 12流派生成式SVG艺术海报引擎 + 五维多边形雷达图 + Bangumi评分分布直方图 + 主创星系图谱
(() => {
  const ART_STYLES = [
    { id: "BAUHAUS_CONSTRUCT", name: "01 · 包豪斯正交几何", en: "BAUHAUS ORTHOGONAL" },
    { id: "CYBER_WIREFRAME_HORIZON", name: "02 · 赛博透视天际线", en: "CYBER WIREFRAME" },
    { id: "NOUVELLE_VAGUE_DIPTYCH", name: "03 · 新浪潮错位双联画", en: "NOUVELLE VAGUE" },
    { id: "MECHA_TACTICAL_HUD", name: "04 · 特务机关战术HUD", en: "TACTICAL HEX HUD" },
    { id: "MONO_NO_AWARE_ECLIPSE", name: "05 · 物哀金缮日食", en: "KINSUGI ECLIPSE" },
    { id: "GIALLO_PRISM_SHARDS", name: "06 · 铅黄折光棱镜", en: "GIALLO PRISM" },
    { id: "ASTRAL_ASTROLABE_ORRERY", name: "07 · 星盘黄道赤经仪", en: "ASTRAL ORRERY" },
    { id: "BRUTALIST_TYPO_MONOLITH", name: "08 · 粗野主义建筑体块", en: "BRUTALIST MONOLITH" },
    { id: "ANALOG_OSCILLOSCOPE_WAVE", name: "09 · 示波器李萨如声波", en: "LISSAJOUS WAVE" },
    { id: "UKIYO_WAVE_INTERFERENCE", name: "10 · 浮世绘莫尔干涉波", en: "MOIRÉ INTERFERENCE" },
    { id: "DE_STIJL_NEOPLASTIC_GRID", name: "11 · 风格派非对称矩阵", en: "DE STIJL GRID" },
    { id: "CHRONO_APERTURE_IRIS", name: "12 · 机械快门时间码环", en: "CHRONO APERTURE" }
  ];

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hashStr(s) {
    let h = 2166136261;
    const str = String(s || "fy");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function renderGenerativeArtSVG(item, mode = "poster") {
    const W = mode === "poster" ? 400 : 960;
    const H = mode === "poster" ? 560 : 520;
    const cx = W / 2;
    const cy = H / 2;
    const pal = Array.isArray(item.palette) && item.palette.length >= 4
      ? item.palette
      : ["#0c101c", "#d9534f", "#2b5876", "#f0c27b"];
    const [cBg, cPrimary, cSecondary, cAccent] = pal;
    const styleIdx = (item.styleIndex ?? hashStr(item.id)) % 12;
    const styleMeta = ART_STYLES[styleIdx];
    const seed = (hashStr(item.id) % 97) + (item.year || 2000);
    const uid = `svg_${mode}_${String(item.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

    let geometryMarkup = "";
    switch (styleIdx) {
      case 0:
        geometryMarkup = `
          <rect x="${W * 0.09}" y="${H * 0.09}" width="${W * 0.82}" height="${H * 0.82}" fill="none" stroke="${cPrimary}" stroke-width="1.2" stroke-opacity="0.4"/>
          <circle cx="${cx}" cy="${H * 0.42}" r="${Math.min(W, H) * 0.28}" fill="url(#grad1_${uid})" fill-opacity="0.88"/>
          <path d="M ${W * 0.1} ${H * 0.72} L ${W * 0.9} ${H * 0.24} L ${W * 0.9} ${H * 0.72} Z" fill="${cSecondary}" fill-opacity="0.55"/>
          <rect x="${W * 0.18}" y="${H * 0.16}" width="${W * 0.24}" height="${H * 0.56}" fill="${cAccent}" fill-opacity="0.26"/>
          <line x1="0" y1="${H * 0.42}" x2="${W}" y2="${H * 0.42}" stroke="${cAccent}" stroke-width="1" stroke-dasharray="6 4"/>
        `;
        break;
      case 1: {
        const horizonY = H * 0.46;
        let gridLines = "";
        for (let i = -7; i <= 7; i++) {
          gridLines += `<line x1="${cx + i * 18}" y1="${horizonY}" x2="${cx + i * 135}" y2="${H}" stroke="${cPrimary}" stroke-width="1" stroke-opacity="0.45"/>`;
        }
        for (let j = 1; j <= 7; j++) {
          const yPos = horizonY + Math.pow(j / 7, 1.8) * (H - horizonY);
          gridLines += `<line x1="0" y1="${yPos.toFixed(1)}" x2="${W}" y2="${yPos.toFixed(1)}" stroke="${cSecondary}" stroke-width="1" stroke-opacity="${(0.2 + j * 0.08).toFixed(2)}"/>`;
        }
        geometryMarkup = `
          <circle cx="${cx}" cy="${horizonY - 18}" r="${Math.min(W, H) * 0.24}" fill="url(#grad1_${uid})"/>
          <rect x="0" y="${horizonY}" width="${W}" height="${H - horizonY}" fill="${cBg}" fill-opacity="0.82"/>
          ${gridLines}
          <polygon points="${cx},${horizonY - 85} ${cx - 82},${horizonY + 24} ${cx + 82},${horizonY + 24}" fill="none" stroke="${cAccent}" stroke-width="2"/>
        `;
        break;
      }
      case 2:
        geometryMarkup = `
          <rect x="${W * 0.08}" y="${H * 0.09}" width="${W * 0.52}" height="${H * 0.42}" fill="url(#grad1_${uid})" fill-opacity="0.85"/>
          <rect x="${W * 0.38}" y="${H * 0.36}" width="${W * 0.54}" height="${H * 0.44}" fill="url(#grad2_${uid})" fill-opacity="0.85"/>
          <circle cx="${W * 0.35}" cy="${H * 0.32}" r="${Math.min(W, H) * 0.16}" fill="none" stroke="${cAccent}" stroke-width="2.2"/>
          <line x1="${W * 0.08}" y1="${H * 0.55}" x2="${W * 0.92}" y2="${H * 0.55}" stroke="${cPrimary}" stroke-width="1.5" stroke-dasharray="3 3"/>
        `;
        break;
      case 3: {
        const r = Math.min(W, H) * 0.3;
        geometryMarkup = `
          <polygon points="${cx},${cy - r} ${cx + r * 0.866},${cy - r * 0.5} ${cx + r * 0.866},${cy + r * 0.5} ${cx},${cy + r} ${cx - r * 0.866},${cy + r * 0.5} ${cx - r * 0.866},${cy - r * 0.5}" fill="none" stroke="${cPrimary}" stroke-width="2"/>
          <polygon points="${cx},${cy - r * 0.65} ${cx + r * 0.56},${cy - r * 0.32} ${cx + r * 0.56},${cy + r * 0.32} ${cx},${cy + r * 0.65} ${cx - r * 0.56},${cy + r * 0.32} ${cx - r * 0.56},${cy - r * 0.32}" fill="url(#grad1_${uid})" fill-opacity="0.45" stroke="${cAccent}" stroke-width="1.2" stroke-dasharray="8 4"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="none" stroke="${cSecondary}" stroke-width="1" stroke-dasharray="4 8"/>
        `;
        break;
      }
      case 4: {
        const r = Math.min(W, H) * 0.27;
        geometryMarkup = `
          <circle cx="${cx}" cy="${cy * 0.88}" r="${r * 1.15}" fill="${cPrimary}" fill-opacity="0.22"/>
          <circle cx="${cx}" cy="${cy * 0.88}" r="${r}" fill="url(#grad1_${uid})"/>
          <circle cx="${cx + r * 0.22}" cy="${cy * 0.84}" r="${r * 0.82}" fill="${cBg}"/>
          <path d="M ${W * 0.15} ${H * 0.68} Q ${W * 0.42} ${H * 0.52} ${W * 0.58} ${H * 0.64} T ${W * 0.88} ${H * 0.44}" fill="none" stroke="${cAccent}" stroke-width="2.4"/>
        `;
        break;
      }
      case 5:
        geometryMarkup = `
          <polygon points="0,${H * 0.15} ${W},${H * 0.45} ${W},${H * 0.85} 0,${H * 0.55}" fill="url(#grad1_${uid})" fill-opacity="0.75"/>
          <polygon points="${W * 0.18},0 ${W * 0.88},0 ${W * 0.42},${H} ${W * 0.05},${H}" fill="${cSecondary}" fill-opacity="0.45"/>
          <polygon points="${cx},${H * 0.18} ${cx + 115},${H * 0.68} ${cx - 115},${H * 0.68}" fill="none" stroke="${cAccent}" stroke-width="2.2"/>
        `;
        break;
      case 6: {
        const r = Math.min(W, H) * 0.32;
        geometryMarkup = `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cPrimary}" stroke-width="1.4" stroke-opacity="0.7"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="${cAccent}" stroke-width="1" stroke-dasharray="3 6"/>
          <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.15}" ry="${r * 0.42}" transform="rotate(-28 ${cx} ${cy})" fill="none" stroke="${cSecondary}" stroke-width="1.5"/>
          <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.15}" ry="${r * 0.42}" transform="rotate(32 ${cx} ${cy})" fill="none" stroke="${cPrimary}" stroke-width="1.2" stroke-opacity="0.65"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.24}" fill="url(#grad1_${uid})"/>
        `;
        break;
      }
      case 7:
        geometryMarkup = `
          <rect x="${W * 0.12}" y="${H * 0.14}" width="${W * 0.34}" height="${H * 0.62}" fill="url(#grad1_${uid})"/>
          <rect x="${W * 0.5}" y="${H * 0.24}" width="${W * 0.36}" height="${H * 0.52}" fill="${cSecondary}" fill-opacity="0.75"/>
          <text x="${cx}" y="${cy + 36}" text-anchor="middle" font-family="serif" font-size="${Math.min(W, H) * 0.42}" font-weight="900" fill="none" stroke="${cAccent}" stroke-width="2" stroke-opacity="0.38">${esc(item.title.slice(0, 1))}</text>
        `;
        break;
      case 8: {
        let wavePath = `M ${W * 0.08} ${cy}`;
        for (let x = 0; x <= 32; x++) {
          const px = W * 0.08 + (x / 32) * (W * 0.84);
          const py = cy + Math.sin(x * 0.55 + seed) * (H * 0.2) * Math.cos(x * 0.2);
          wavePath += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        geometryMarkup = `
          <circle cx="${cx}" cy="${cy}" r="${Math.min(W, H) * 0.3}" fill="url(#grad1_${uid})" fill-opacity="0.32"/>
          <path d="${wavePath}" fill="none" stroke="${cAccent}" stroke-width="2.4"/>
          <ellipse cx="${cx}" cy="${cy}" rx="${W * 0.34}" ry="${H * 0.18}" fill="none" stroke="${cPrimary}" stroke-width="1.2" stroke-dasharray="5 5"/>
        `;
        break;
      }
      case 9: {
        let arcs = "";
        for (let k = 1; k <= 6; k++) {
          arcs += `<circle cx="${W * 0.3}" cy="${H * 0.62}" r="${k * 34}" fill="none" stroke="${cPrimary}" stroke-width="1.3" stroke-opacity="0.55"/>`;
          arcs += `<circle cx="${W * 0.7}" cy="${H * 0.35}" r="${k * 34}" fill="none" stroke="${cAccent}" stroke-width="1.3" stroke-opacity="0.45"/>`;
        }
        geometryMarkup = `
          <rect x="${W * 0.1}" y="${H * 0.1}" width="${W * 0.8}" height="${H * 0.8}" fill="url(#grad1_${uid})" fill-opacity="0.35"/>
          ${arcs}
        `;
        break;
      }
      case 10:
        geometryMarkup = `
          <rect x="${W * 0.08}" y="${H * 0.1}" width="${W * 0.46}" height="${H * 0.36}" fill="${cPrimary}" fill-opacity="0.82"/>
          <rect x="${W * 0.58}" y="${H * 0.1}" width="${W * 0.34}" height="${H * 0.58}" fill="${cSecondary}" fill-opacity="0.65"/>
          <rect x="${W * 0.08}" y="${H * 0.5}" width="${W * 0.46}" height="${H * 0.3}" fill="url(#grad1_${uid})"/>
          <rect x="${W * 0.58}" y="${H * 0.72}" width="${W * 0.34}" height="${H * 0.09}" fill="${cAccent}" fill-opacity="0.9"/>
        `;
        break;
      default: {
        const r = Math.min(W, H) * 0.3;
        let ticks = "";
        for (let a = 0; a < 360; a += 15) {
          const rad = (a * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * r;
          const y1 = cy + Math.sin(rad) * r;
          const x2 = cx + Math.cos(rad) * (r * 1.1);
          const y2 = cy + Math.sin(rad) * (r * 1.1);
          ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${cAccent}" stroke-width="1.5"/>`;
        }
        geometryMarkup = `
          <circle cx="${cx}" cy="${cy}" r="${r * 0.88}" fill="url(#grad1_${uid})" fill-opacity="0.65"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.44}" fill="${cBg}" stroke="${cPrimary}" stroke-width="2"/>
          ${ticks}
        `;
        break;
      }
    }

    const cleanTitle = item.title.split(" · ")[0];
    return `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="grad1_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${cPrimary}"/>
            <stop offset="100%" stop-color="${cSecondary}"/>
          </linearGradient>
          <linearGradient id="grad2_${uid}" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${cAccent}"/>
            <stop offset="100%" stop-color="${cBg}"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="${cBg}"/>
        ${geometryMarkup}
        <rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="#f4efe6" stroke-opacity="0.16" stroke-width="1"/>
        <text x="26" y="38" fill="#d4af37" font-family="monospace" font-size="11" letter-spacing="2">${esc(item.catNo || "ARCHIVE")} · ${item.year}</text>
        <text x="${W - 26}" y="82" fill="#f4efe6" fill-opacity="0.22" font-family="serif" font-size="16" writing-mode="vertical-rl" letter-spacing="4">${esc((item.origTitle || "").slice(0, 11))}</text>
        <rect x="0" y="${H * 0.64}" width="${W}" height="${H * 0.36}" fill="url(#grad2_${uid})" fill-opacity="0.62"/>
        <text x="26" y="${H - 46}" fill="#f4efe6" font-family="serif" font-size="${mode === "poster" ? 22 : 30}" font-weight="700" letter-spacing="2">${esc(cleanTitle)}</text>
        <text x="26" y="${H - 24}" fill="#d4af37" font-family="monospace" font-size="10" letter-spacing="1.5">DIR. ${esc(item.director)} · ${styleMeta.en}</text>
      </svg>
    `;
  }

  // 真多边形五维视听美学雷达图
  function renderPolygonRadarHTML(work, showAvg = true) {
    if (!Array.isArray(work.radar)) return {svg:"<p>尚无策展美学坐标</p>",legend:""};
    const rVals = work.radar;
    const axes = [
      { label: "作画张力", sub: "SAKUGA", val: rVals[0], avg: (window.FY_RADAR_AVG || [88,89,86,87,88])[0] },
      { label: "演出分镜", sub: "DIRECTION", val: rVals[1], avg: (window.FY_RADAR_AVG || [88,89,86,87,88])[1] },
      { label: "叙事密度", sub: "NARRATIVE", val: rVals[2], avg: (window.FY_RADAR_AVG || [88,89,86,87,88])[2] },
      { label: "声效配乐", sub: "SCORE", val: rVals[3], avg: (window.FY_RADAR_AVG || [88,89,86,87,88])[3] },
      { label: "美术设定", sub: "ART DESIGN", val: rVals[4], avg: (window.FY_RADAR_AVG || [88,89,86,87,88])[4] }
    ];
    const size = 270;
    const cx = size / 2;
    const cy = size / 2 + 6;
    const maxR = 92;
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

    const polar = (idx, ratio) => {
      const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
      return [+(cx + Math.cos(angle) * maxR * ratio).toFixed(1), +(cy + Math.sin(angle) * maxR * ratio).toFixed(1)];
    };

    const webPolygons = levels
      .map((lv) => {
        const pts = axes.map((_, i) => polar(i, lv).join(",")).join(" ");
        return `<polygon points="${pts}" fill="none" stroke="#a5d2ad" stroke-opacity="${lv === 1 ? 0.38 : 0.14}" stroke-width="1"/>`;
      })
      .join("");

    const axisLines = axes
      .map((ax, i) => {
        const [xEnd, yEnd] = polar(i, 1.0);
        const [xLbl, yLbl] = polar(i, 1.24);
        return `
          <line x1="${cx}" y1="${cy}" x2="${xEnd}" y2="${yEnd}" stroke="#dfefde" stroke-opacity="0.16" stroke-width="1" stroke-dasharray="3 3"/>
          <text x="${xLbl}" y="${yLbl}" text-anchor="middle" dominant-baseline="middle" fill="#dfefde" font-size="11" font-weight="600">${ax.label}</text>
          <text x="${xLbl}" y="${yLbl + 12}" text-anchor="middle" dominant-baseline="middle" fill="#a5d2ad" font-family="monospace" font-size="9">${ax.val}/100</text>
        `;
      })
      .join("");

    const avgPts = axes.map((ax, i) => polar(i, ax.avg / 100).join(",")).join(" ");
    const avgPoly = showAvg
      ? `<polygon points="${avgPts}" fill="#4ea8af" fill-opacity="0.14" stroke="#4ea8af" stroke-width="1.5" stroke-dasharray="4 3"/>`
      : "";

    const workPts = axes.map((ax, i) => polar(i, ax.val / 100).join(",")).join(" ");
    const vertices = axes
      .map((ax, i) => {
        const [vx, vy] = polar(i, ax.val / 100);
        return `<circle cx="${vx}" cy="${vy}" r="4.5" fill="#a5d2ad" stroke="#070709" stroke-width="1.5"><title>${ax.label}: ${ax.val}</title></circle>`;
      })
      .join("");

    const legendRows = axes
      .map((ax) => {
        const diff = ax.val - ax.avg;
        return `
          <div class="radar-metric-row">
            <span>${ax.label} <small class="tabular muted-sm">(${ax.sub})</small></span>
            <span class="tabular" style="color:var(--gold-champagne);">
              <strong>${ax.val}</strong>
              <small style="color:${diff >= 0 ? "var(--emerald-archive)" : "var(--amber-tungsten)"};">(${diff >= 0 ? "+" : ""}${diff})</small>
            </span>
          </div>
        `;
      })
      .join("");

    return {
      svg: `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${webPolygons}${axisLines}${avgPoly}<polygon points="${workPts}" fill="#a5d2ad" fill-opacity="0.28" stroke="#a5d2ad" stroke-width="2.2"/>${vertices}</svg>`,
      legend: legendRows
    };
  }

  // Bangumi 10星-1星分布直方图与标准差计算
  function renderBangumiHistogramHTML(work) {
    if (!work.votes) return {stdDevTag:"暂无评分",summaryHtml:"暂无社区评分",barsHtml:""};
    const dist = Array.isArray(work.bgmDist) && work.bgmDist.length === 10
      ? work.bgmDist
      : [55, 28, 10, 3, 1.5, 0.8, 0.6, 0.5, 0.3, 0.3];
    const maxPct = Math.max(...dist);
    const totalVotes = work.votes || 0;

    let mean = 0;
    dist.forEach((pct, idx) => { mean += (10 - idx) * (pct / 100); });
    let variance = 0;
    dist.forEach((pct, idx) => { variance += (pct / 100) * Math.pow(10 - idx - mean, 2); });
    const stdDev = Math.sqrt(variance).toFixed(2);

    const barsHtml = dist
      .map((pct, idx) => {
        const star = 10 - idx;
        const widthRatio = Math.max(2, (pct / maxPct) * 100).toFixed(1);
        const count = work.scoreCounts ? work.scoreCounts[idx] : Math.round((pct / 100) * totalVotes);
        const barColor =
          star >= 9
            ? "linear-gradient(90deg, var(--gold-leaf), var(--amber-tungsten))"
            : star >= 7
            ? "linear-gradient(90deg, var(--cyan-nitrate), var(--gold-champagne))"
            : "rgba(70,239,230,0.28)";
        return `
          <div class="bgm-bar-row">
            <span style="color:var(--gold-champagne);text-align:right;">${star} ★</span>
            <div class="bgm-bar-track"><div class="bgm-bar-fill" style="width:${widthRatio}%;background:${barColor};"></div></div>
            <span style="text-align:right;">${pct.toFixed(1)}% (${count})</span>
          </div>
        `;
      })
      .join("");

    return {
      stdDevTag: `σ = ${stdDev} · 社区评分标准差`,
      summaryHtml: `
        <div class="bgm-big-score">${work.score.toFixed(1)}</div>
        <div>
          <div style="color:var(--gold-champagne);font-size:0.88rem;font-weight:600;">
            Bangumi 快照评分 · 9★–10★ 占比 ${(dist[0] + dist[1]).toFixed(1)}%
          </div>
          <div class="tabular muted-sm" style="margin-top:3px;">
            SAMPLE ${totalVotes.toLocaleString()} VOTES · 标准差 σ=${stdDev}
          </div>
        </div>
      `,
      barsHtml
    };
  }

  // 主创与工作室交互星系图谱
  function renderConstellationGraphSVG(work, activeRoleKey = "director") {
    const staff = work.staffGraph || {
      director: { name: work.director, role: "监督", works: [work.title] },
      script: { name: work.seriesComp || work.director, role: "系列构成", works: [work.title] },
      sakuga: { name: work.sakuga || "作画班", role: "总作监", works: [work.title] },
      music: { name: work.music || "原声", role: "音乐", works: [work.title] },
      studio: { name: work.studio || "制作社", role: "动画制作", works: [work.title] }
    };

    const roles = [
      { key: "director", angle: -90, color: "#a5d2ad" },
      { key: "script", angle: -18, color: "#4ea8af" },
      { key: "sakuga", angle: 54, color: "#e07a38" },
      { key: "music", angle: 126, color: "#b8334a" },
      { key: "studio", angle: 198, color: "#45a176" }
    ];

    const W = 560;
    const H = 320;
    const cx = W * 0.44;
    const cy = H * 0.5;
    const radius = 102;

    let linesSvg = "";
    let nodesSvg = "";
    const activeCreator = staff[activeRoleKey] || staff.director;

    roles.forEach((r) => {
      const person = staff[r.key] || { name: "-", role: r.key, works: [] };
      const rad = (r.angle * Math.PI) / 180;
      const nx = cx + Math.cos(rad) * radius;
      const ny = cy + Math.sin(rad) * radius;
      const isSelected = r.key === activeRoleKey;

      linesSvg += `
        <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"
          stroke="${isSelected ? r.color : "rgba(70,239,230,0.22)"}"
          stroke-width="${isSelected ? 2.4 : 1.2}"
          stroke-dasharray="${isSelected ? "none" : "4 4"}"/>
      `;

      if (isSelected && person.works) {
        person.works.forEach((repTitle, wIdx) => {
          const subAngle = r.angle + (wIdx - (person.works.length - 1) / 2) * 28;
          const subRad = (subAngle * Math.PI) / 180;
          const sx = Math.max(58, Math.min(W - 65, nx + Math.cos(subRad) * 84));
          const sy = Math.max(26, Math.min(H - 26, ny + Math.sin(subRad) * 66));

          linesSvg += `<line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${r.color}" stroke-width="1.2" stroke-opacity="0.75"/>`;
          nodesSvg += `
            <g class="sub-work-node" data-work-query="${esc(repTitle.split(" (")[0])}" style="cursor:pointer;">
              <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6" fill="#152d20" stroke="${r.color}" stroke-width="2"/>
              <text x="${sx.toFixed(1)}" y="${(sy - 10).toFixed(1)}" text-anchor="middle" fill="#dfefde" font-size="10">${esc(repTitle.split(" (")[0])}</text>
            </g>
          `;
        });
      }

      nodesSvg += `
        <g class="creator-node" data-role-key="${r.key}" style="cursor:pointer;">
          <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${isSelected ? 24 : 19}"
            fill="${isSelected ? r.color : "#13151b"}" stroke="${r.color}" stroke-width="${isSelected ? 3 : 1.6}"/>
          <text x="${nx.toFixed(1)}" y="${(ny - 2).toFixed(1)}" text-anchor="middle"
            fill="${isSelected ? "#070709" : "#dfefde"}" font-size="10" font-weight="700">${esc(person.name.slice(0, 5))}</text>
          <text x="${nx.toFixed(1)}" y="${(ny + 10).toFixed(1)}" text-anchor="middle"
            fill="${isSelected ? "#070709" : "#a5d2ad"}" font-size="8">${esc(person.role.split(" ")[0])}</text>
        </g>
      `;
    });

    const centerNodeSvg = `
      <circle cx="${cx}" cy="${cy}" r="34" fill="#254431" stroke="#a5d2ad" stroke-width="2.2"/>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="#dfefde" font-size="11" font-weight="700">${esc(work.title.split(" · ")[0].slice(0, 6))}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" fill="#a5d2ad" font-family="monospace" font-size="9">★ ${work.score.toFixed(1)}</text>
    `;

    return {
      svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${linesSvg}${centerNodeSvg}${nodesSvg}</svg>`,
      activeCreator
    };
  }

  window.FY_VISUAL_ENGINE = {
    ART_STYLES,
    renderGenerativeArtSVG,
    renderPolygonRadarHTML,
    renderBangumiHistogramHTML,
    renderConstellationGraphSVG
  };
})();
