import { entryPitch, entryStaffBounds } from './engine.js?v=1.5.0';

const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 350;
const HEIGHT = 170;
const LEFT = 14;
const NOTE_X = 174;
const NOTE_COLORS = { normal: '#172f35', correct: '#26735d', incorrect: '#b33f34' };
let fontReady;

function svgElement(tag, attrs) {
  const element = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

/** Project a viewport click to a diatonic position in a centered, fitted SVG. */
function staffStepAtPoint(rect, clientX, clientY, bottomY, stepHeight, bottomStep, minStep, maxStep) {
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  if (!(scale > 0)) return null;
  const x = (clientX - rect.left - (rect.width - WIDTH * scale) / 2) / scale;
  const y = (clientY - rect.top - (rect.height - HEIGHT * scale) / 2) / scale;
  if (x < LEFT || x > WIDTH - LEFT || y < 0 || y > HEIGHT) return null;
  const step = bottomStep + Math.round((bottomY - y) / stepHeight);
  return Math.min(maxStep, Math.max(minStep, step));
}

/**
 * Mount the response staff. The caller owns the entry, handles onStep and
 * onAccidental, and updates {step, accidental, valueText, locked, tone}.
 * Passing step:null keeps the staff blank. Up/Down first places a middle-line
 * note and then moves it by one staff step. Mount after the exercise is visible.
 */
export async function mountEntryStaff(container, options) {
  const vf = window.VexFlow;
  if (!vf?.Renderer) throw new Error('The local notation library could not be loaded.');
  if (!fontReady) {
    vf.setFonts('Bravura', 'Academico');
    fontReady = document.fonts.load('40px Bravura');
  }
  await fontReady;

  const { minStep, maxStep } = entryStaffBounds(options.clef);
  const bottomStep = minStep + 8;
  const middleStep = bottomStep + 4;
  // Handling input on the host makes the staff editable over its whole viewBox,
  // without changing the geometry when an accidental or ledger line appears.
  const host = document.createElement('div');
  host.className = 'entry-staff';
  host.setAttribute('role', options.readOnly ? 'img' : 'slider');
  if (!options.readOnly) {
    host.setAttribute('aria-orientation', 'vertical');
    host.setAttribute('aria-valuemin', minStep);
    host.setAttribute('aria-valuemax', maxStep);
    host.setAttribute('aria-keyshortcuts', options.onAccidental
      ? 'ArrowUp ArrowDown ArrowLeft ArrowRight' : 'ArrowUp ArrowDown');
    if (options.describedBy) host.setAttribute('aria-describedby', options.describedBy);
    host.tabIndex = 0;
  }
  Object.assign(host.style, { width: '100%', height: '100%', minHeight: '0', touchAction: 'manipulation' });
  container.replaceChildren(host);

  const renderer = new vf.Renderer(host, vf.Renderer.Backends.SVG);
  renderer.resize(WIDTH, HEIGHT);
  host.style.width = '100%';
  host.style.height = '100%';
  const context = renderer.getContext();
  context.setFillStyle(NOTE_COLORS.normal).setStrokeStyle(NOTE_COLORS.normal);
  // VexFlow adds its own spacing above the staff; aim for a middle line at y85.
  const stave = new vf.Stave(LEFT, 25, WIDTH - 2 * LEFT).addClef(options.clef).setContext(context);
  stave.setBegBarType(vf.Barline.type.SINGLE);
  stave.setEndBarType(vf.Barline.type.SINGLE);
  stave.draw();
  const bottomY = stave.getYForLine(4);
  const stepHeight = (bottomY - stave.getYForLine(0)) / 8;

  const svg = host.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  Object.assign(svg.style, { width: '100%', height: '100%', display: 'block' });
  const ghost = svgElement('g', { opacity: '0.37', 'pointer-events': 'none' });
  const note = svgElement('g', { 'pointer-events': 'none' });
  svg.append(ghost, note);

  let state = { step: null, accidental: 0, locked: false, tone: 'normal', ...options };
  const yFor = step => bottomY - (step - bottomStep) * stepHeight;

  function paint(target, step, accidental, color) {
    target.replaceChildren();
    if (step == null) return;
    const y = yFor(step);
    target.setAttribute('fill', color);
    const ledger = ledgerStep => svgElement('line', {
      x1: NOTE_X - 11, x2: NOTE_X + 11, y1: yFor(ledgerStep), y2: yFor(ledgerStep),
      stroke: color, 'stroke-width': 1.2,
    });
    for (let s = bottomStep - 2; s >= step; s -= 2) target.append(ledger(s));
    for (let s = bottomStep + 10; s <= step; s += 2) target.append(ledger(s));

    const up = step < middleStep;
    target.append(svgElement('line', {
      x1: NOTE_X + (up ? 5 : -5), x2: NOTE_X + (up ? 5 : -5),
      y1: y, y2: y + (up ? -31 : 31), stroke: color, 'stroke-width': 1.25,
    }));
    const head = svgElement('text', {
      x: NOTE_X - 6, y, 'font-family': 'Bravura', 'font-size': 40,
    });
    head.textContent = vf.Glyphs.noteheadBlack;
    target.append(head);

    const accidentalGlyph = {
      '-2': vf.Glyphs.accidentalDoubleFlat, '-1': vf.Glyphs.accidentalFlat,
      1: vf.Glyphs.accidentalSharp, 2: vf.Glyphs.accidentalDoubleSharp,
    }[accidental];
    if (accidentalGlyph) {
      const text = svgElement('text', {
        x: NOTE_X - (accidental === -2 ? 31 : 20), y,
        'font-family': 'Bravura', 'font-size': 40,
      });
      text.textContent = accidentalGlyph;
      target.append(text);
    }
  }

  let ghostStep;
  function clearGhost() {
    ghostStep = undefined;
    ghost.replaceChildren();
  }

  function update(changes = {}) {
    state = { ...state, ...changes };
    host.setAttribute('aria-label', state.label ?? 'Answer staff');
    if (!state.readOnly) {
      host.dataset.locked = String(state.locked);
      host.setAttribute('aria-disabled', String(state.locked));
      host.setAttribute('aria-valuenow', state.step ?? middleStep);
      host.setAttribute('aria-valuetext', state.valueText ?? (state.step == null
        ? 'No note entered'
        : entryPitch(state.step, state.accidental)?.key ?? ''));
      host.style.cursor = state.locked ? 'default' : 'crosshair';
    }
    clearGhost();
    paint(note, state.step, state.accidental, NOTE_COLORS[state.tone] ?? NOTE_COLORS.normal);
  }

  const stepAt = e => staffStepAtPoint(svg.getBoundingClientRect(), e.clientX, e.clientY, bottomY, stepHeight, bottomStep, minStep, maxStep);
  host.addEventListener('click', e => {
    if (state.readOnly || state.locked || e.button !== 0) return;
    const step = stepAt(e);
    if (step == null) return;
    host.focus({ preventScroll: true });
    state.onStep(step);
  });
  host.addEventListener('pointermove', e => {
    if (state.readOnly || state.locked || e.pointerType === 'touch') return;
    const step = stepAt(e);
    if (step === ghostStep) return;
    ghostStep = step;
    paint(ghost, step === state.step ? null : step, state.accidental, NOTE_COLORS.normal);
  });
  host.addEventListener('pointerleave', clearGhost);
  host.addEventListener('keydown', e => {
    if (state.readOnly || state.locked || e.altKey || e.ctrlKey || e.metaKey) return;
    const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    const horizontal = state.onAccidental && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
    if (!vertical && !horizontal) return;
    e.preventDefault();
    e.stopPropagation();
    if (horizontal) {
      const accidental = state.accidental + (e.key === 'ArrowRight' ? 1 : -1);
      state.onAccidental(Math.min(1, Math.max(-1, accidental)));
      return;
    }
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const step = state.step == null ? middleStep : state.step + direction;
    state.onStep(Math.min(maxStep, Math.max(minStep, step)));
  });

  update();
  return {
    update,
    focus() { host.focus({ preventScroll: true }); },
    destroy() { host.remove(); },
  };
}
