// ═══════════════════════════════════════════════════════
//  COLOR PICKER
//  Updates --arrow-color and --composite-color CSS vars
//  on :root so all SVG stroke references pick them up.
// ═══════════════════════════════════════════════════════

const COLOR_DEFAULTS = {
  arrow:     '#5a5a54',
  composite: '#1D9E75',
};

function initColorPicker() {
  const root = document.documentElement;

  function setColor(key, value) {
    root.style.setProperty(`--${key}-color`, value);
    const preview = document.getElementById(`preview-${key}`);
    if (preview) preview.style.background = value;
    tRenderCanvas();
    if (pPuzzle) pRenderCanvas(pSubmitted);
  }

  document.getElementById('pick-arrow').addEventListener('input', e => {
    setColor('arrow', e.target.value);
  });

  document.getElementById('pick-composite').addEventListener('input', e => {
    setColor('composite', e.target.value);
  });

  document.getElementById('color-reset').addEventListener('click', () => {
    document.getElementById('pick-arrow').value     = COLOR_DEFAULTS.arrow;
    document.getElementById('pick-composite').value = COLOR_DEFAULTS.composite;
    setColor('arrow',     COLOR_DEFAULTS.arrow);
    setColor('composite', COLOR_DEFAULTS.composite);
  });

  setColor('arrow',     COLOR_DEFAULTS.arrow);
  setColor('composite', COLOR_DEFAULTS.composite);
}


// ═══════════════════════════════════════════════════════
//  SHARED CANVAS UTILITIES
// ═══════════════════════════════════════════════════════

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickLetters(n) {
  return shuffle(ALPHABET.split('')).slice(0, n);
}

function arrowPath(pos, from, to, R, off) {
  const fp = pos[from], tp = pos[to];
  const dx = tp.x - fp.x, dy = tp.y - fp.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const sx = fp.x + ux * R, sy = fp.y + uy * R;
  const ex = tp.x - ux * (R + 7), ey = tp.y - uy * (R + 7);
  if (!off) return `M${sx} ${sy} L${ex} ${ey}`;
  const mx = (sx + ex) / 2 + (-uy * off);
  const my = (sy + ey) / 2 + (ux * off);
  return `M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`;
}

function arrowMid(pos, from, to, off) {
  const fp = pos[from], tp = pos[to];
  const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
  if (!off) return { x: mx, y: my - 14 };
  const dx = tp.x - fp.x, dy = tp.y - fp.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: mx + (-dy / len) * off, y: my + (dx / len) * off - 14 };
}

function getCSSColor(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName).trim() || '#5a5a54';
}

function buildCanvas(canvasId, nodesId, arrowsId, pos, objects,
                     userArrows, userIds, onNodeClick, R,
                     arrowStyles, idStyles, pfx) {

  const nl = document.getElementById(nodesId);
  const al = document.getElementById(arrowsId);
  nl.innerHTML = '';
  al.innerHTML = '';

  const arrowColor     = getCSSColor('--arrow-color');
  const compositeColor = getCSSColor('--composite-color');

  const svg = document.getElementById(canvasId);
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  function makeMarker(id, color) {
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '8'); m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '6'); m.setAttribute('markerHeight', '6');
    m.setAttribute('orient', 'auto-start-reverse');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M2 1L8 5L2 9');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', '1.5');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    m.appendChild(p);
    return m;
  }

  defs.innerHTML = '';
  defs.appendChild(makeMarker(`${pfx}-ah`,          arrowColor));
  defs.appendChild(makeMarker(`${pfx}-ah-composite`, compositeColor));
  defs.appendChild(makeMarker(`${pfx}-ah-green`,    '#1D9E75'));
  defs.appendChild(makeMarker(`${pfx}-ah-amber`,    '#BA7517'));
  defs.appendChild(makeMarker(`${pfx}-ah-red`,      '#A32D2D'));
  defs.appendChild(makeMarker(`${pfx}-ah-dim`,      '#9a9a90'));

  function markerFor(cls) {
    if (!cls) return `url(#${pfx}-ah)`;
    if (cls.includes('derived'))       return `url(#${pfx}-ah-composite)`;
    if (cls.includes('correct-arrow')) return `url(#${pfx}-ah-green)`;
    if (cls.includes('wrong-arrow'))   return `url(#${pfx}-ah-red)`;
    if (cls.includes('missing-arrow')) return `url(#${pfx}-ah-amber)`;
    return `url(#${pfx}-ah)`;
  }

  function strokeFor(cls) {
    if (!cls) return arrowColor;
    if (cls.includes('derived'))       return compositeColor;
    if (cls.includes('correct-arrow')) return '#1D9E75';
    if (cls.includes('wrong-arrow'))   return '#A32D2D';
    if (cls.includes('missing-arrow')) return '#BA7517';
    return arrowColor;
  }

  const cnt = {}, idx = {};
  arrowStyles.forEach(a => { const k = a.from + '>' + a.to; cnt[k] = (cnt[k] || 0) + 1; });
  arrowStyles.forEach(a => {
    const k = a.from + '>' + a.to;
    idx[k] = (idx[k] || 0);
    const i = idx[k]++;
    a.off = cnt[k] > 1 ? (i - (cnt[k] - 1) / 2) * 30 : 0;
  });

  arrowStyles.forEach(a => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', arrowPath(pos, a.from, a.to, R, a.off));
    el.setAttribute('marker-end', markerFor(a.cls));
    el.setAttribute('stroke', strokeFor(a.cls));
    el.classList.add('arrow-line', 'visible');
    if (a.cls) a.cls.split(' ').forEach(c => el.classList.add(c));
    if (a.onClick) { el.style.cursor = 'pointer'; el.addEventListener('click', a.onClick); }
    al.appendChild(el);

    if (a.label) {
      const m = arrowMid(pos, a.from, a.to, a.off);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', m.x); lbl.setAttribute('y', m.y);
      lbl.classList.add('arrow-label', 'visible');
      if (a.labelCls) a.labelCls.split(' ').forEach(c => lbl.classList.add(c));
      if (!a.labelCls || !a.labelCls.includes('missing'))
        lbl.setAttribute('fill', a.cls && a.cls.includes('derived') ? compositeColor : arrowColor);
      lbl.textContent = a.label;
      al.appendChild(lbl);
    }
  });

  idStyles.forEach(s => {
    const p = pos[s.id];
    if (!p) return;
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arc.setAttribute('d', `M${p.x - R + 4} ${p.y - 8} A${R * 0.9} ${R * 0.9} 0 1 1 ${p.x + R - 4} ${p.y - 8}`);
    const idMarker = s.cls && s.cls.includes('missing') ? `url(#${pfx}-ah-amber)`
                   : s.cls && s.cls.includes('wrong')   ? `url(#${pfx}-ah-red)`
                   :                                       `url(#${pfx}-ah-dim)`;
    arc.setAttribute('marker-end', idMarker);
    arc.classList.add('identity-arc', 'visible');
    if (s.cls) s.cls.split(' ').forEach(c => arc.classList.add(c));
    if (s.onClick) { arc.style.cursor = 'pointer'; arc.addEventListener('click', s.onClick); }
    al.appendChild(arc);

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', p.x); lbl.setAttribute('y', p.y - R - 18);
    lbl.classList.add('id-label', 'visible');
    lbl.textContent = `id_${s.id}`;
    al.appendChild(lbl);
  });

  objects.forEach(o => {
    const p = pos[o.id];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('obj-node');
    if (o.cls) o.cls.split(' ').forEach(c => g.classList.add(c));

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', R);
    g.appendChild(c);

    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', p.x); t.setAttribute('y', p.y);
    t.textContent = o.id;
    g.appendChild(t);

    if (onNodeClick) g.addEventListener('click', () => onNodeClick(o.id));
    nl.appendChild(g);
  });
}


// ═══════════════════════════════════════════════════════
//  TUTORIAL MODE
// ═══════════════════════════════════════════════════════

const TUTORIAL_LEVELS = [
  {
    title: "Place the morphism",
    desc: `Two objects exist: <strong>A</strong> and <strong>B</strong>. You are told there is a morphism from A to B, written <em>f : A → B</em>. Place it.`,
    theory: `In category theory, objects are completely opaque — we say nothing about what's inside them. A morphism <code>f : A → B</code> is just a directed relationship. Not a function, not a mapping of elements — just a structured connection with a direction.`,
    objects: [{ id: 'A', x: 0.28, y: 0.5 }, { id: 'B', x: 0.72, y: 0.5 }],
    required: [['A', 'B']], derived: [], reqIds: [],
    laws: [
      { title: 'f : A → B', body: 'A directed morphism from A to B.',
        check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') },
    ],
    feedback: {
      default: 'Click A (source), then B (target) to place the arrow.',
      done: "f : A → B placed. The arrow is the whole story — we say nothing about A or B's contents.",
    }
  },
  {
    title: "Composition is a law, not a choice",
    desc: `Given <em>f : A → B</em> and <em>g : B → C</em>, the category laws require a composite <em>g∘f : A → C</em>. Place f and g — the composite appears automatically.`,
    theory: `Composition is constitutive of what a category <em>is</em>. Whenever two morphisms chain, their composite must exist. You cannot have <code>f : A → B</code> and <code>g : B → C</code> without also having <code>g∘f : A → C</code>.`,
    objects: [{ id: 'A', x: 0.18, y: 0.5 }, { id: 'B', x: 0.5, y: 0.5 }, { id: 'C', x: 0.82, y: 0.5 }],
    required: [['A', 'B'], ['B', 'C']], derived: [['A', 'C']], reqIds: [],
    laws: [
      { title: 'f : A → B', body: 'First morphism.', check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') },
      { title: 'g : B → C', body: 'Second morphism.', check: s => s.arrows.some(a => a.from === 'B' && a.to === 'C') },
      { title: 'g∘f : A → C exists', body: 'Required by composition — appears automatically.',
        check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') && s.arrows.some(a => a.from === 'B' && a.to === 'C') },
    ],
    feedback: {
      default: 'Place f : A → B first.',
      placed_AB: "f placed. Now place g : B → C.",
      placed_BC: "g placed — g∘f : A → C appeared automatically. You didn't place it; the laws required it.",
      done: 'Composition is not a choice. Chained arrows always produce a composite.',
    }
  },
  {
    title: "Identity morphisms",
    desc: `Every object must have an identity morphism. The law: <em>f∘id_A = f</em> and <em>id_B∘f = f</em>. Place <em>f : A → B</em>, <em>id_A</em>, and <em>id_B</em>.`,
    theory: `Identity morphisms are the categorical version of "doing nothing." Every object in every category must have one. Composing any morphism with an identity leaves it unchanged: <code>f∘id_A = f</code>, <code>id_B∘f = f</code>.`,
    objects: [{ id: 'A', x: 0.3, y: 0.5 }, { id: 'B', x: 0.7, y: 0.5 }],
    required: [['A', 'B']], derived: [], reqIds: ['A', 'B'],
    laws: [
      { title: 'f : A → B', body: '', check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') },
      { title: 'id_A : A → A', body: 'Use ↻ tool, then click A.', check: s => s.ids.includes('A') },
      { title: 'id_B : B → B', body: 'Use ↻ tool, then click B.', check: s => s.ids.includes('B') },
    ],
    feedback: {
      default: 'Place f : A → B, then use ↻ to place identities on A and B.',
      placed_id: 'Identity placed. Place the remaining one.',
      done: 'A complete category snapshot: one morphism, two identities, all laws satisfied.',
    }
  },
  {
    title: "Associativity",
    desc: `Three chained morphisms — <em>f : A→B</em>, <em>g : B→C</em>, <em>h : C→D</em>. Composition must be associative: <em>h∘(g∘f) = (h∘g)∘f</em>. Place all three.`,
    theory: `Associativity means the order of bracketing doesn't matter — only the order of the arrows. <code>h∘(g∘f)</code> and <code>(h∘g)∘f</code> are the same morphism <code>A → D</code>. Long chains of transformations are unambiguous.`,
    objects: [{ id: 'A', x: 0.12, y: 0.5 }, { id: 'B', x: 0.37, y: 0.5 }, { id: 'C', x: 0.63, y: 0.5 }, { id: 'D', x: 0.88, y: 0.5 }],
    required: [['A', 'B'], ['B', 'C'], ['C', 'D']], derived: [['A', 'C'], ['B', 'D'], ['A', 'D']], reqIds: [],
    laws: [
      { title: 'f : A → B', body: '', check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') },
      { title: 'g : B → C', body: '', check: s => s.arrows.some(a => a.from === 'B' && a.to === 'C') },
      { title: 'h : C → D', body: '', check: s => s.arrows.some(a => a.from === 'C' && a.to === 'D') },
      { title: 'h∘(g∘f) = (h∘g)∘f', body: "Bracketing order doesn't change the result.",
        check: s => s.arrows.some(a => a.from === 'A' && a.to === 'B') && s.arrows.some(a => a.from === 'B' && a.to === 'C') && s.arrows.some(a => a.from === 'C' && a.to === 'D') },
    ],
    feedback: {
      default: 'Place f, g, and h one by one.',
      done: "Three composites appeared. Bracketing them differently gives the same path — that's associativity.",
    }
  },
];

const DERIVED_LABELS = { 'A>C': 'g∘f', 'B>D': 'h∘g', 'A>D': 'h∘g∘f', 'A>B': 'f', 'B>C': 'g', 'C>D': 'h' };

let tLevel = 0;
let tState = { arrows: [], ids: [] };  // arrows: [{ from, to, kind }]  kind = 'base'|'composite'
let tTool = 'arrow';                   // 'arrow' | 'composite' | 'identity' | 'erase'
let tSelecting = null;

function tlv() { return TUTORIAL_LEVELS[tLevel]; }

function tInit() {
  tState = { arrows: [], ids: [] };
  tSelecting = null;
  document.getElementById('t-next').style.display = 'none';
  document.getElementById('t-done').style.display = 'none';

  document.getElementById('t-progress').innerHTML =
    TUTORIAL_LEVELS.map((_, i) =>
      `<span class="dot ${i < tLevel ? 'done' : i === tLevel ? 'current' : ''}"></span>`
    ).join('') + `<span class="progress-label">${tLevel + 1} / ${TUTORIAL_LEVELS.length}</span>`;

  document.getElementById('t-prompt').innerHTML = `<strong>${tlv().title}.</strong> ${tlv().desc}`;
  document.getElementById('t-theory-text').innerHTML = tlv().theory;
  tRenderCanvas();
  tRenderLaws();
  tFeedback('default');
}

function tRenderCanvas() {
  const wrap = document.getElementById('t-canvas-wrap');
  const W = wrap.clientWidth || 700, H = wrap.clientHeight || 300, R = 24;
  const pos = {};
  tlv().objects.forEach(o => { pos[o.id] = { x: o.x * W, y: o.y * H }; });

  const allRequired = tlv().required.every(([a, b]) => tState.arrows.some(s => s[0] === a && s[1] === b));
  const visibleDerived = allRequired ? tlv().derived : [];

  const arrowStyles = [];
  tState.arrows.forEach(a => {
    const isComposite = a.kind === 'composite';
    arrowStyles.push({
      from: a.from, to: a.to,
      cls: isComposite ? 'derived' : '',
      labelCls: isComposite ? 'derived' : '',
      label: DERIVED_LABELS[a.from + '>' + a.to] || '',
      onClick: () => { if (tTool === 'erase') { tState.arrows = tState.arrows.filter(x => !(x.from === a.from && x.to === a.to)); tUpdate(); } }
    });
  });
  visibleDerived.forEach(([f, t]) => {
    arrowStyles.push({ from: f, to: t, cls: 'derived', label: DERIVED_LABELS[f + '>' + t] || '', labelCls: 'derived' });
  });

  const idStyles = tState.ids.map(id => ({
    id, cls: '',
    onClick: () => { if (tTool === 'erase') { tState.ids = tState.ids.filter(i => i !== id); tUpdate(); } }
  }));

  const objDefs = tlv().objects.map(o => ({ id: o.id, cls: tSelecting === o.id ? 'selected' : '' }));

  buildCanvas('t-canvas', 't-nodes', 't-arrows', pos, objDefs,
    tState.arrows, tState.ids, tHandleClick, R, arrowStyles, idStyles, 't');
}

function tHandleClick(id) {
  if (tTool === 'identity') {
    if (!tState.ids.includes(id)) tState.ids.push(id);
    tUpdate(); return;
  }
  if (tTool === 'erase') return;
  if (tTool === 'arrow' || tTool === 'composite') {
    if (!tSelecting) {
      tSelecting = id; tRenderCanvas();
      tSetRawFeedback('info', `Source: ${id}. Now click the target.`); return;
    }
    if (tSelecting === id) { tSelecting = null; tRenderCanvas(); tFeedback('default'); return; }
    const from = tSelecting, to = id;
    const kind = tTool === 'composite' ? 'composite' : 'base';
    tSelecting = null;

    if (tlv().derived.some(d => d[0] === from && d[1] === to)) {
      tSetRawFeedback('hint', `${from}→${to} appears automatically from composition — don't place it manually.`);
      tRenderCanvas(); return;
    }
    if (!tlv().required.some(r => r[0] === from && r[1] === to)) {
      tSetRawFeedback('hint', `That arrow isn't part of this puzzle.`);
      tRenderCanvas(); return;
    }
    if (tState.arrows.some(a => a.from === from && a.to === to)) {
      tSetRawFeedback('info', `${from}→${to} already placed.`); tRenderCanvas(); return;
    }
    tState.arrows.push({ from, to, kind });
    tUpdate();
  }
}

function tUpdate() { tRenderCanvas(); tRenderLaws(); tCheckDone(); }

function tRenderLaws() {
  document.getElementById('t-laws').innerHTML = tlv().laws.map(l => {
    const sat = l.check(tState);
    return `<div class="law-card ${sat ? 'satisfied' : ''}">
      <div class="law-title">${sat ? '✓ ' : ''}${l.title}</div>
      ${l.body ? `<div class="law-body">${l.body}</div>` : ''}
    </div>`;
  }).join('');
}

function tCheckDone() {
  const done = tlv().laws.every(l => l.check(tState));
  if (!done) {
    const fb = tlv().feedback;
    if (fb.placed_BC && tState.arrows.some(a => a.from === 'B' && a.to === 'C'))
      tSetRawFeedback('success', fb.placed_BC);
    else if (fb.placed_AB && tState.arrows.some(a => a.from === 'A' && a.to === 'B'))
      tSetRawFeedback('info', fb.placed_AB);
    else if (fb.placed_id && tState.ids.length > 0)
      tSetRawFeedback('info', fb.placed_id);
    return;
  }
  tSetRawFeedback('success', tlv().feedback.done);
  if (tLevel < TUTORIAL_LEVELS.length - 1)
    document.getElementById('t-next').style.display = 'inline-block';
  else
    document.getElementById('t-done').style.display = 'block';
}

function tFeedback(key) {
  const msg = tlv().feedback[key] || tlv().feedback.default || '';
  tSetRawFeedback('info', msg);
}

function tSetRawFeedback(type, msg) {
  const bar = document.getElementById('t-feedback');
  const icons = { info: '◦', success: '✓', hint: '△' };
  bar.className = 'feedback-bar ' + (type === 'info' ? '' : type);
  bar.innerHTML = `<span class="feedback-icon">${icons[type] || '◦'}</span><span>${msg}</span>`;
}

function tSetTool(t) {
  tTool = t; tSelecting = null;
  ['arrow', 'identity', 'erase'].forEach(x =>
    document.getElementById('t-btn-' + x).classList.toggle('active', x === t));
  tRenderCanvas();
  const hints = { arrow: 'Click source, then target.', identity: 'Click an object to place its identity.', erase: 'Click an arrow or identity arc to remove it.' };
  tSetRawFeedback('info', hints[t]);
}

function tReset() { tInit(); }

function tNext() {
  if (tLevel < TUTORIAL_LEVELS.length - 1) { tLevel++; tInit(); }
}


// ═══════════════════════════════════════════════════════
//  PRACTICE MODE
// ═══════════════════════════════════════════════════════

const DIFFICULTIES = {
  easy:   { objects: 2, chains: 1, extraMorphisms: 0, requireIds: false },
  medium: { objects: 3, chains: 1, extraMorphisms: 1, requireIds: true },
  hard:   { objects: 4, chains: 2, extraMorphisms: 1, requireIds: true },
};

let pDiff = 'easy';
let pPuzzle = null;
let pState = { arrows: [], ids: [] };  // arrows: [{ from, to, kind }]
let pTool = 'arrow';                   // 'arrow' | 'composite' | 'identity' | 'erase'
let pSelecting = null;
let pSubmitted = false;
let pScore = { streak: 0, correct: 0, wrong: 0 };

function pSetDiff(d, btn) {
  pDiff = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pNew();
}

function generatePuzzle(diff) {
  const cfg = DIFFICULTIES[diff];
  const letters = pickLetters(cfg.objects);
  const chain = shuffle(letters.slice());
  const baseMorphisms = [];
  const morphNames = 'fghkmnpqrs'.split('');
  let nameIdx = 0;

  let pos = 0;
  for (let c = 0; c < cfg.chains; c++) {
    const len = cfg.objects <= 2 ? 2 : (cfg.objects === 3 ? 3 : Math.floor(cfg.objects / cfg.chains) + 1);
    const segment = chain.slice(pos, pos + Math.min(len, chain.length - pos));
    if (segment.length < 2) break;
    for (let i = 0; i < segment.length - 1; i++) {
      const from = segment[i], to = segment[i + 1];
      if (!baseMorphisms.some(m => m[0] === from && m[1] === to))
        baseMorphisms.push([from, to, morphNames[nameIdx++] || 'f']);
    }
    pos += segment.length - 1;
    if (pos >= chain.length - 1) break;
  }

  if (cfg.extraMorphisms > 0) {
    const used = new Set(baseMorphisms.flatMap(([f, t]) => [f, t]));
    const unused = letters.filter(l => !used.has(l));
    if (unused.length >= 2) {
      baseMorphisms.push([unused[0], unused[1], morphNames[nameIdx++] || 'g']);
    } else {
      const pairs = [];
      for (let i = 0; i < letters.length; i++)
        for (let j = 0; j < letters.length; j++)
          if (i !== j && !baseMorphisms.some(m => m[0] === letters[i] && m[1] === letters[j]))
            pairs.push([letters[i], letters[j]]);
      if (pairs.length) {
        const [f, t] = pairs[Math.floor(Math.random() * pairs.length)];
        baseMorphisms.push([f, t, morphNames[nameIdx++] || 'g']);
      }
    }
  }

  function closure(morphs) {
    const all = morphs.map(m => [m[0], m[1]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [f1, t1] of all)
        for (const [f2, t2] of all)
          if (t1 === f2 && !all.some(a => a[0] === f1 && a[1] === t2)) {
            all.push([f1, t2]); changed = true;
          }
    }
    return all;
  }

  const allArrows = closure(baseMorphisms);
  const correctArrows = allArrows.map(([f, t]) => [f, t]);
  const correctIds = cfg.requireIds ? letters : [];

  const morphDesc = baseMorphisms.map(([f, t, n]) => `<em>${n} : ${f} → ${t}</em>`).join(', ');
  let desc = `Objects: <strong>${letters.join(', ')}</strong>.<br>Morphisms: ${morphDesc}.<br>`;
  if (allArrows.length > baseMorphisms.length)
    desc += `<span style="color:var(--text-3);font-size:0.85em">Remember: composition is a law — place composites too.</span><br>`;
  if (cfg.requireIds)
    desc += `<span style="color:var(--text-3);font-size:0.85em">Place identity morphisms on all objects.</span><br>`;
  desc += `<span style="color:var(--text-3);font-size:0.82em">Place <em>all</em> required arrows, then click <strong>check</strong>.</span>`;

  const angles = shuffle(Array.from({ length: letters.length }, (_, i) => i));
  const objects = letters.map((id, i) => ({
    id,
    x: 0.5 + 0.32 * Math.cos(2 * Math.PI * angles[i] / letters.length - Math.PI / 2),
    y: 0.5 + 0.35 * Math.sin(2 * Math.PI * angles[i] / letters.length - Math.PI / 2),
  }));

  return { objects, letters, correctArrows, correctIds, description: desc, baseMorphisms };
}

function pNew() {
  pPuzzle = generatePuzzle(pDiff);
  pState = { arrows: [], ids: [] };
  pTool = 'arrow'; pSelecting = null; pSubmitted = false;
  document.getElementById('p-prompt').innerHTML = pPuzzle.description;
  document.getElementById('p-legend').style.display = 'none';
  document.getElementById('p-reveal-btn').style.display = 'none';
  pSetRawFeedback('info', 'Place all arrows described above, then click "check".');
  pRenderCanvas();
  pUpdateScore();
}

function pRenderCanvas(resultMode) {
  const wrap = document.getElementById('p-canvas-wrap');
  const W = wrap.clientWidth || 700, H = wrap.clientHeight || 300, R = 24;
  const pos = {};
  pPuzzle.objects.forEach(o => { pos[o.id] = { x: o.x * W, y: o.y * H }; });

  const arrowStyles = [], idStyles = [];

  if (!resultMode) {
    pState.arrows.forEach(a => {
      const isComposite = a.kind === 'composite';
      arrowStyles.push({
        from: a.from, to: a.to,
        cls: isComposite ? 'derived' : '',
        labelCls: isComposite ? 'derived' : '',
        label: '',
        onClick: () => { if (pTool === 'erase') { pState.arrows = pState.arrows.filter(x => !(x.from === a.from && x.to === a.to)); pRenderCanvas(); } }
      });
    });
    pState.ids.forEach(id => {
      idStyles.push({ id, cls: '', onClick: () => { if (pTool === 'erase') { pState.ids = pState.ids.filter(i => i !== id); pRenderCanvas(); } } });
    });
  } else {
    const correct = pPuzzle.correctArrows, correctIds = pPuzzle.correctIds;
    const placed = pState.arrows, placedIds = pState.ids;
    placed.forEach(a => {
      arrowStyles.push({ from: a.from, to: a.to, cls: correct.some(c => c[0] === a.from && c[1] === a.to) ? 'correct-arrow' : 'wrong-arrow', label: '' });
    });
    correct.forEach(([f, t]) => {
      if (!placed.some(p => p.from === f && p.to === t))
        arrowStyles.push({ from: f, to: t, cls: 'missing-arrow', label: '?', labelCls: 'missing' });
    });
    placedIds.forEach(id => { idStyles.push({ id, cls: (correctIds.includes(id) || correctIds.length === 0) ? 'correct-id' : 'wrong-id' }); });
    correctIds.forEach(id => { if (!placedIds.includes(id)) idStyles.push({ id, cls: 'missing-id' }); });
  }

  const objDefs = pPuzzle.objects.map(o => ({ id: o.id, cls: pSelecting === o.id ? 'selected' : '' }));
  buildCanvas('p-canvas', 'p-nodes', 'p-arrows', pos, objDefs,
    pState.arrows, pState.ids, resultMode ? null : pHandleClick, R, arrowStyles, idStyles, 'p');
}

function pHandleClick(id) {
  if (pSubmitted) return;
  if (pTool === 'identity') { if (!pState.ids.includes(id)) pState.ids.push(id); pRenderCanvas(); return; }
  if (pTool === 'erase') return;
  if (!pSelecting) { pSelecting = id; pRenderCanvas(); pSetRawFeedback('info', `Source: ${id}. Now click the target.`); return; }
  if (pSelecting === id) { pSelecting = null; pRenderCanvas(); pSetRawFeedback('info', 'Place arrows, then click "check".'); return; }
  const from = pSelecting, to = id; pSelecting = null;
  if (!pState.arrows.some(a => a[0] === from && a[1] === to)) pState.arrows.push([from, to]);
  pRenderCanvas();
}

function pSubmit() {
  if (!pPuzzle || pSubmitted) return;
  pSubmitted = true;
  const correct = pPuzzle.correctArrows, correctIds = pPuzzle.correctIds;
  const placed = pState.arrows, placedIds = pState.ids;
  const missingArrows = correct.filter(([f, t]) => !placed.some(p => p[0] === f && p[1] === t));
  const extraArrows   = placed.filter(([f, t]) => !correct.some(c => c[0] === f && c[1] === t));
  const missingIds    = correctIds.filter(id => !placedIds.includes(id));
  const perfect = missingArrows.length === 0 && extraArrows.length === 0 && missingIds.length === 0;

  pRenderCanvas(true);
  document.getElementById('p-legend').style.display = 'flex';

  if (perfect) {
    pScore.streak++; pScore.correct++;
    pSetRawFeedback('success', 'Correct. All arrows and identities placed exactly right.');
  } else {
    pScore.streak = 0; pScore.wrong++;
    const parts = [];
    if (missingArrows.length) parts.push(`${missingArrows.length} missing arrow${missingArrows.length > 1 ? 's' : ''} (amber)`);
    if (extraArrows.length)   parts.push(`${extraArrows.length} extra arrow${extraArrows.length > 1 ? 's' : ''} (red)`);
    if (missingIds.length)    parts.push(`${missingIds.length} missing identity${missingIds.length > 1 ? 'ies' : ''}`);
    pSetRawFeedback('error', 'Not quite. ' + parts.join(', ') + '.');
    document.getElementById('p-reveal-btn').style.display = 'inline-block';
  }
  pUpdateScore();
}

function pReveal() {
  pState.arrows = pPuzzle.correctArrows.map(([f, t]) => [f, t]);
  pState.ids = pPuzzle.correctIds.slice();
  pRenderCanvas(true);
  pSetRawFeedback('info', 'Full solution shown. Study the composites — they are required by the composition law.');
  document.getElementById('p-reveal-btn').style.display = 'none';
}

function pUpdateScore() {
  document.getElementById('p-streak').textContent  = pScore.streak;
  document.getElementById('p-correct').textContent = pScore.correct;
  document.getElementById('p-wrong').textContent   = pScore.wrong;
}

function pSetRawFeedback(type, msg) {
  const bar = document.getElementById('p-feedback');
  const icons = { info: '◦', success: '✓', hint: '△', error: '✕' };
  bar.className = 'feedback-bar ' + (type === 'info' ? '' : type);
  bar.innerHTML = `<span class="feedback-icon">${icons[type] || '◦'}</span><span>${msg}</span>`;
}

function pSetTool(t) {
  pTool = t; pSelecting = null;
  ['arrow', 'identity', 'erase'].forEach(x =>
    document.getElementById('p-btn-' + x).classList.toggle('active', x === t));
  pRenderCanvas();
  const hints = { arrow: 'Click source, then target.', identity: 'Click an object to place its identity.', erase: 'Click an arrow to remove it.' };
  pSetRawFeedback('info', hints[t]);
}

function pReset() {
  pState = { arrows: [], ids: [] };
  pSelecting = null; pSubmitted = false;
  document.getElementById('p-legend').style.display = 'none';
  document.getElementById('p-reveal-btn').style.display = 'none';
  pRenderCanvas();
  pSetRawFeedback('info', 'Place all arrows described above, then click "check".');
}


// ═══════════════════════════════════════════════════════
//  EXPOSE GLOBALS & BOOT
// ═══════════════════════════════════════════════════════

window.tSetTool = tSetTool;
window.tReset   = tReset;
window.tNext    = tNext;

window.pSetTool = pSetTool;
window.pSetDiff = pSetDiff;
window.pNew     = pNew;
window.pReset   = pReset;
window.pSubmit  = pSubmit;
window.pReveal  = pReveal;

window.addEventListener('resize', () => {
  tRenderCanvas();
  if (pPuzzle) pRenderCanvas(pSubmitted);
});

initColorPicker();
tInit();
pNew();
