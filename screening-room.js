// One five-round screening game per tab, so opening a dossier never loses the round.
function createScreeningRoom({ root, works, selections, escapeHtml, artwork }) {
  const byId = new Map(works.map(work => [work.id, work]));
  const clues = new Map(selections.map(({ work, note }) => [work.id, note]));
  const titles = { year: "年代对决", clue: "线索猜片" };
  const storageKey = "buwan-screening-room-1";
  let game;

  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function newGame(mode) {
    const pool = shuffled(mode === "clue" ? [...clues.keys()].map(id => byId.get(id)) : works);
    const rounds = [];
    for (let i = 0; i < 5; i++) {
      const first = pool.pop();
      const other = mode === "year" ? pool.findIndex(w => w.year !== first.year) : 0;
      const second = pool.splice(other, 1)[0];
      const choices = [first, second];
      if (mode === "clue") choices.push(pool.pop());
      const correct = mode === "year" && Number(second.year) < Number(first.year) ? second : first;
      rounds.push({ options: shuffled(choices.map(w => w.id)), correct: correct.id });
    }
    return { mode, rounds, answers: [], index: 0 };
  }

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved && Object.hasOwn(titles, saved.mode) && saved.rounds?.length === 5 &&
        Number.isInteger(saved.index) && saved.index >= 0 && saved.index <= 5 &&
        Array.isArray(saved.answers) && [saved.index, Math.min(5,saved.index+1)].includes(saved.answers.length) &&
        saved.rounds.every((r,i) => Array.isArray(r.options) && r.options.length === (saved.mode === "clue" ? 3 : 2) &&
          r.options.includes(r.correct) && r.options.every(id => byId.has(id)) &&
          (saved.mode !== "clue" || clues.has(r.correct)) && (i >= saved.answers.length || r.options.includes(saved.answers[i])))) game = saved;
  } catch { /* Tab storage may be disabled. */ }

  function remember() {
    try {
      if (game) sessionStorage.setItem(storageKey, JSON.stringify(game));
      else sessionStorage.removeItem(storageKey);
    } catch { /* The current round still works in memory. */ }
  }

  function link(id) {
    return '<a class="game-work" href="/anime/'+encodeURIComponent(id)+'?from=play">'+escapeHtml(byId.get(id).title)+' ↗</a>';
  }

  function render() {
    if (!game) {
      root.innerHTML = '<h1>放映游戏室</h1><p class="game-intro">选一种玩法。每局五题，答完可以把遇见的作品带回片库。</p><div class="game-modes">'+
        '<button class="game-mode" data-mode="year"><img src="/buwan-plan/assets/totoro025.jpg" alt=""><span><strong>年代对决</strong><small>对照两张海报，选出更早面世的一部。</small></span></button>'+
        '<button class="game-mode" data-mode="clue"><img src="/buwan-plan/assets/chihiro041.jpg" alt=""><span><strong>线索猜片</strong><small>读一段场景描述，从三部作品里找出片名。</small></span></button></div>';
      return;
    }
    const { mode, rounds, index, answers } = game;
    const score = answers.filter((id,i) => id === rounds[i].correct).length;
    if (index === rounds.length) {
      root.innerHTML = '<h1>本场答对 '+score+' / 5 题</h1><p class="game-intro">这五部是本场的答案。点片名，可以打开作品档案。</p><ol class="game-recap">'+rounds.map((r,i) =>
        '<li><span>'+ (answers[i]===r.correct?'✓ 答对':'○ 错过') +'</span>'+link(r.correct)+'</li>').join('')+
        '</ol><div class="game-controls"><button class="btn-primary" data-mode="'+mode+'">再来一局</button><button class="btn-couture" data-action="lobby">换种玩法</button></div>';
      return;
    }
    const round = rounds[index], answered = answers.length > index;
    const prompt = mode === "year" ? "哪部更早面世？" : "这是哪部动画里的场景？";
    root.innerHTML = '<div class="game-meta"><span>'+titles[mode]+'　·　第 '+(index+1)+' / 5 题</span><span>答对 '+score+' 题</span><button class="btn-couture" data-action="lobby">重选玩法</button></div><h1>'+prompt+'</h1>'+
      (mode === "clue" ? '<blockquote class="game-clue">'+escapeHtml(clues.get(round.correct))+'</blockquote>' : '')+
      '<div class="game-options '+mode+'">'+round.options.map(id=>{
        const w=byId.get(id);
        const verdict = answered ? (id===round.correct?' ✓ 正解':id===answers[index]?' · 你的选择':'') : '';
        return '<button class="game-option'+(answered && id===round.correct?' correct':'')+'" data-answer="'+id+'" '+(answered?'disabled':'')+'>'+
          (mode === "year" ? '<span class="game-poster">'+artwork(w,"poster")+'</span>' : '')+
          '<strong>'+escapeHtml(w.title)+'</strong><small>'+(answered && mode==="year"?w.year+" 年":"")+verdict+'</small></button>';
      }).join('')+'</div>'+
      (answered ? '<div class="game-feedback" role="status">'+(answers[index]===round.correct?'答对了！':'这一题的答案是')+' '+link(round.correct)+'</div><button class="btn-primary" data-action="next">'+(index===4?'看本场片单':'下一题')+'</button>' : '');
  }

  root.addEventListener("click", e => {
    const button = e.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.mode) game = newGame(button.dataset.mode);
    else if (button.dataset.action === "lobby") game = null;
    else if (button.dataset.action === "next" && game.answers.length > game.index) game.index++;
    else if (button.dataset.answer && game.answers.length === game.index) game.answers.push(button.dataset.answer);
    else return;
    remember();
    render();
    const focus = root.querySelector('[data-action="next"]') || root.querySelector("h1");
    if (focus) { focus.tabIndex = focus.tagName === 'H1' ? -1 : 0; focus.focus({preventScroll:true}); }
  });
  return render;
}
