// Keep the unmodified Bangumi tuple catalog and merge editorial dossiers by verified ID.
(() => {
  const original = window.FY_CATALOG_V4.catalog.filter(a => !a.id.includes('-reel-'));
  const editorials = new Map(original.map(a => [a.id, a]));
  original[0].episodeGuide.push(...[{"ep": 2, "title": "野狗阔步", "jp": "野良犬のストラット Stray Dog Strut", "runtime": "00:22:17", "staff": "分镜 / 演出 / 作监资料待核对", "score": "未评分", "badge": "Bangumi 章节档案补录", "note": "脚本：横手美智子  絵コンテ：渡辺信一郎  演出：佐藤育郎  作画監督：竹内浩志\r\n\r\n賞金首は格闘家の連続ペット窃盗犯。なぜかスパイクたちだけでなく、動物研究所もその男の行方を追っていた……。一匹の犬を巡ってチャイナタウンで巻き起こる大騒動！\r\n\r\n第1話から一転、コミカルタッチで描かれたビバップ号の愛犬となるアインの登場秘話。音楽の使われ方も素晴らしく、スパイクのブルース・リーに関するウンチクも冴える！\r\n\r\n注：标题取自 Stray Cats 的单曲 Stray Cat Strut 。 来源：Bangumi Episode 7027。", "source": "https://bgm.tv/ep/7027"}, {"ep": 3, "title": "酒馆女郎", "jp": "ホンキィ・トンク・ウィメン Honky Tonk Women", "runtime": "00:24:42", "staff": "分镜 / 演出 / 作监资料待核对", "score": "未评分", "badge": "Bangumi 章节档案补录", "note": "脚本：山口亮太/信本敬子  絵コンテ：赤根和樹  演出：森邦宏  作画監督：本橋秀之  メカ作画監督：後藤雅巳\r\n\r\n一攫千金を狙ってカジノにやって来たスパイクとジェット。人違いから裏取引に巻き込まれたスパイクたちは、手にした一枚のチップをネタにカジノのオーナー、ゴードンから大金をせしめようとするが……\r\n\r\n女イカサマ師・フェイの初登場話。愛機レッドテイルを自在に操り、転んでもタダでは起きないフェイの胡散臭い魅力が爆発のエピソードです！\r\n\r\n注：标题取自 The Rolling Stones 的同名歌曲。 来源：Bangumi Episode 7028。", "source": "https://bgm.tv/ep/7028"}, {"ep": 4, "title": "网关曳步舞", "jp": "ゲイトウェイ・シャッフル Gateway Shuffle", "runtime": "00:24:41", "staff": "分镜 / 演出 / 作监资料待核对", "score": "未评分", "badge": "Bangumi 章节档案补录", "note": "脚本：村井さだゆき  絵コンテ：武井良幸  演出：武井良幸  作画監督：しんぼたくろう  メカ作画監督：後藤雅巳\r\n\r\n過激な環境保護団体「スペース・ウォリアーズ」の女リーダー、トゥインクルを捕えたスパイクだが、換金しようとした矢先、彼女の賞金が突然取り消されてしまった。渋々トゥインクルを解放するスパイク。だが、トゥインクルは報復のため位相差空間内からウイルスミサイルを発射するのだった……\r\n\r\n迫り来るミサイルとスパイクの競走は手に汗握る！\r\n\r\n注：曳步舞（Shuffle），由于发源地是澳大利亚墨尔本，故也被叫做墨尔本曳步舞（MelbourneShuffle），早期为了区分 Shuffle 这个词的多元性才加了地区的前缀，目前大多直接用 Shuffle 。曳步舞动作简洁、快速有力、节奏感强，是一种自由度很高、个性十足的舞步。结合本集内容将标题选择了这个中译。 来源：Bangumi Episode 7029。", "source": "https://bgm.tv/ep/7029"}, {"ep": 6, "title": "给恶魔的哀怜之歌", "jp": "恶魔を怜れむ歌 Sympathy For The Devil", "runtime": "00:24:42", "staff": "分镜 / 演出 / 作监资料待核对", "score": "未评分", "badge": "Bangumi 章节档案补录", "note": "脚本：信本敬子  絵コンテ：岡村天斎  演出：佐藤育郎  作画監督：竹内浩志  メカ作画監督：後藤雅巳\r\n\r\nスパイクたちが追う賞金首のジラフが何者かに殺された。調査を開始したスパイクは、ジラフが探していたゼブラという車椅子の男に辿り着く。だが、そこで口を開いたのはゼブラに付き添っていた少年のウェンだった……少年に隠された秘密とは？\r\n\r\nスパイクが天才少年ブルースハーピストの謎に迫る！オカルトチックなSF感溢れる奇妙な物語。\r\n\r\n注：标题取自 The Rolling Stones 的同名歌曲。 来源：Bangumi Episode 7031。", "source": "https://bgm.tv/ep/7031"}, {"ep": 7, "title": "重金属皇后", "jp": "ヘヴィ・メタル・クイーン Heavy Metal Queen", "runtime": "00:24:42", "staff": "分镜 / 演出 / 作监资料待核对", "score": "未评分", "badge": "Bangumi 章节档案补录", "note": "脚本：横手美智子  絵コンテ：岡村天斎  演出：森邦宏  作画監督：本橋秀之  メカ作画監督：後藤雅巳\r\n\r\n爆発物のスペシャリストで賞金首のデッカーを追っている最中、スパイクは女トラッカーのVTと出会う。一方、賞金を一人占めしようと別行動でデッカーを探していたフェイは、一度は発見するが取り逃がしてしまう。それを知ったVTは、トラック仲間からの情報でデッカーが乗った機体の追跡を開始するが……\r\n\r\n全編に流れるヘヴィ・メタルが痛快！ 来源：Bangumi Episode 7032。", "source": "https://bgm.tv/ep/7032"}]);
  original[0].episodeGuide.sort((a,b)=>a.ep-b.ep);
  const flagshipIds = new Set(original.slice(0, 20).map(a => a.id));
  const facts = new Map(window.FY_FACTS.map(row => [row[0], row]));
  const stills = {216371:'liz-key',238:'innocence-key',480441:'lookback-top',500:'mimi025',56847:'kaguyahime018',506:'baron012',512:'omoide024',311:'chihiro041',310:'mononoke010',312:'howl003',93739:'pingpong',328609:'bocchi',307:'porco',302:'totoro025',6819:'karigurashi001'};
  const extraCovers = new Set([253,340,395378,218707]);
  for (const image of Object.values(window.FY_COVER_LIBRARY)) {
    window.FY_IMAGE_SIZES[image.src] = image;
  }
  const merged = catalog.map(row => {
    const [bgmId,title,origTitle,aliases,format,date,score,votes,tags,adult] = row;
    const id = window.FY_ID_MAP[bgmId] || 'bgm-' + bgmId;
    const editorial = editorials.get(id);
    const f = facts.get(bgmId);
    const episodes = f[1] || editorial?.episodes || 0;
    const epMinutes = f[2] || editorial?.epMinutes || 0;
    const counts = f[3];
    const base = {
      id, bgmId, title, origTitle, aliases, format, date,
      year: parseInt(date) || 0, score, votes, adult: Boolean(adult),
      tags: tags.split(' · ').filter(Boolean), episodes, epMinutes,
      status: '播出状态待核对', catNo: 'BGM № ' + bgmId,
      season: date || '发行日期未收录', enTitle: '',
      director: f[4] || '资料未收录', studio: f[5] || '资料未收录',
      music: f[6] || '资料未收录', seriesComp: f[7] || '资料未收录', sakuga: f[8] || '资料未收录',
      summary: f[9] || '来源暂未收录简介。', editorialReview: '',
      fitFor: '尚未编写适看人群导读。', cautionFor: '可参考作品简介与观众留言。',
      watchScene: format, pullQuote: '', episodeGuide: [],
      styleIndex: bgmId % 12,
      palette: ['#0d0e12','#d4af37','#526876','#f4efe6']
    };
    const item = {...base,...editorial,id,bgmId,title,origTitle,aliases,format,date,
      year:parseInt(date)||0,score,votes,adult:Boolean(adult),episodes,epMinutes,
      scoreCounts:counts,bgmDist:counts.map(n => votes ? n * 100 / votes : 0),
      totalHours:episodes && epMinutes ? episodes * epMinutes / 60 : null,
      artSource:'generated',flagship:flagshipIds.has(id),
      radar:flagshipIds.has(id) ? editorial.radar : null
    };
    if (!editorial) item.summary = base.summary;
    if (stills[bgmId]) item.realStill = '/buwan-plan/assets/' + stills[bgmId] + '.jpg';
    if (covers.has(bgmId) || extraCovers.has(bgmId)) item.realPoster = '/buwan-plan/assets/' + bgmId + '.jpg';
    const newPoster = window.FY_COVER_LIBRARY[bgmId];
    const previousWidth = window.FY_IMAGE_SIZES[item.realPoster]?.width || 0;
    if (newPoster && newPoster.width > previousWidth) item.realPoster = newPoster.src;
    if (item.realStill || item.realPoster) item.artSource = 'real';
    return item;
  });
  const order = new Map(original.map((a,i) => [a.id,i]));
  merged.sort((a,b) => (order.get(a.id) ?? 1000) - (order.get(b.id) ?? 1000) || b.votes-a.votes);
  const top = merged.filter(a=>a.flagship).sort((a,b)=>b.score-a.score).slice(0,10);
  window.FY_RADAR_AVG = [0,1,2,3,4].map(i=>+(top.reduce((sum,a)=>sum+a.radar[i],0)/top.length).toFixed(1));
  window.FY_CATALOG_V4 = {catalog:merged,archiveMeta:{totalIndexedEntries:merged.length,
    ratedEntries:merged.filter(a=>a.votes>0).length,editorialCount:original.length,snapshotDate:version.slice(0,10)}};
  const engine = window.FY_VISUAL_ENGINE;

  const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  engine.renderEditorialCover = engine.renderGenerativeArtSVG;
  engine.renderGenerativeArtSVG = (item, mode = 'poster') => {
    const local = mode === 'still' ? item.realStill || item.realPoster : item.realPoster || item.realStill;
    const source = local || (window.FY_POSTERS[item.bgmId]?.[0] || '');
    return '<img class="archive-image ' + mode + '" src="' + escape(source) + '" data-work-image="' + item.bgmId +
      '" data-art-mode="' + mode + '" alt="' + escape(item.title) + '" loading="lazy" decoding="async">';
  };
  // Import legacy browser-local collections once; their original keys remain available.
  try {
    if (!localStorage.getItem('fy_v4_legacy_imported')) {
      const legacy=JSON.parse(localStorage.getItem('anime-index-v1')||'{}');
      const saved=JSON.parse(localStorage.getItem('fy_v4_guest_watchlist')||'[]');
      for (const [bgmId,value] of Object.entries(legacy)) {
        const id=window.FY_ID_MAP[bgmId]||'bgm-'+bgmId;
        if (value.saved&&!saved.some(x=>x.animeId===id)) saved.push({animeId:id,status:'want',personalScore:0});
      }
      localStorage.setItem('fy_v4_guest_watchlist',JSON.stringify(saved));
      localStorage.setItem('fy_v4_legacy_imported','1');
    }
  } catch {}
  window.FY_FULL_CATALOG_READY = true;
})();
