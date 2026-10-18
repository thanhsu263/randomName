// Màn "đang chờ": biểu tượng loading tự vẽ theo phong cách tranh của game (nét mực đen dày, màu phẳng),
// kèm lớp chắn: trong lúc chờ server, mọi nút và phím đều bị khoá nên không thể bấm nhiều lần.
//
//   const end = beginLoading({ message: 'Đang xử lý…', block: true });
//   try { await ... } finally { end(); }
//
// Nhiều nơi có thể "giữ" màn loading cùng lúc (đếm số người giữ); màn chỉ tắt khi tất cả đã nhả.
const INK = '#1b1a2b';
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Holder {
  message: string;
  block: boolean;
}

const holders = new Set<Holder>();
let root: HTMLElement | null = null;
let textEl: HTMLElement | null = null;
let inertTargets: HTMLElement[] = [];

/** Đường viền ngôi sao nhiều cánh (giống hình nổ "starburst" trong art). */
function starPoints(cx: number, cy: number, points: number, rOuter: number, rInner: number, rot = 0): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Biểu tượng: ngôi sao nổ xoay + 3 chấm nảy (xanh xì trum, trắng, đỏ nấm). */
function buildSpinner(): SVGSVGElement {
  const s = svg('svg', { viewBox: '0 0 160 170', class: 'loading-svg', 'aria-hidden': 'true' });
  const burst = svg('g', { class: 'loading-burst' });
  const ink = { stroke: INK, 'stroke-width': 6, 'stroke-linejoin': 'round' };
  burst.append(
    svg('polygon', { points: starPoints(80, 70, 12, 62, 38, 0.1), fill: '#ffd23f', ...ink }),
    svg('polygon', { points: starPoints(80, 70, 8, 40, 26, 0.35), fill: '#ff9a2e', ...ink, 'stroke-width': 5 }),
    svg('circle', { cx: 80, cy: 70, r: 17, fill: '#fff6d0', stroke: INK, 'stroke-width': 5 }),
    svg('circle', { cx: 76, cy: 65, r: 5, fill: '#ffffff' }),
  );
  s.append(burst);
  const dots = svg('g', { class: 'loading-dots' });
  [
    [50, '#3b9be6'],
    [80, '#ffffff'],
    [110, '#e23b2e'],
  ].forEach(([x, fill], i) => {
    const c = svg('circle', { cx: x as number, cy: 150, r: 9, fill: fill as string, stroke: INK, 'stroke-width': 4.5, class: `loading-dot d${i}` });
    dots.append(c);
  });
  s.append(dots);
  return s;
}

function ensureRoot(): HTMLElement {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'loading-overlay';
  root.setAttribute('role', 'alert');
  root.setAttribute('aria-live', 'assertive');
  root.hidden = true;
  const box = document.createElement('div');
  box.className = 'loading-box parchment';
  textEl = document.createElement('div');
  textEl.className = 'loading-text';
  box.append(buildSpinner(), textEl);
  root.append(box);
  document.body.append(root);
  return root;
}

function sync() {
  const el = ensureRoot();
  const list = [...holders];
  const blocking = list.some((h) => h.block);
  el.hidden = list.length === 0;
  el.classList.toggle('block', blocking);
  if (textEl) textEl.textContent = list.length ? list[list.length - 1].message : '';
  // khoá thao tác bằng chuột/phím trên toàn bộ giao diện phía sau (inert = không focus, không click được)
  if (blocking && inertTargets.length === 0) {
    inertTargets = ['screen', 'stage'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    inertTargets.push(...(Array.from(document.querySelectorAll('.toolbar')) as HTMLElement[]));
    for (const t of inertTargets) t.setAttribute('inert', '');
    (document.activeElement as HTMLElement | null)?.blur?.();
  } else if (!blocking && inertTargets.length) {
    for (const t of inertTargets) t.removeAttribute('inert');
    inertTargets = [];
  }
}

export interface LoadingOptions {
  message?: string;
  /** true = chặn mọi thao tác trong lúc chờ (dùng cho yêu cầu ghi / bắt đầu lượt) */
  block?: boolean;
}

/** Bật màn loading; trả về hàm nhả (gọi nhiều lần vẫn an toàn). */
export function beginLoading(opts: LoadingOptions = {}): () => void {
  const h: Holder = { message: opts.message ?? 'Đang xử lý', block: opts.block ?? false };
  holders.add(h);
  sync();
  return () => {
    if (holders.delete(h)) sync();
  };
}

/** Đang có màn loading chặn thao tác? (phím tắt kiểm tra cái này) */
export function isBlocking(): boolean {
  for (const h of holders) if (h.block) return true;
  return false;
}
