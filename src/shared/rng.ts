/**
 * RNG xác định (deterministic) dựa trên ChaCha20.
 *
 * - Seed 256-bit được sinh bằng nguồn ngẫu nhiên mật mã (crypto.randomBytes ở server,
 *   crypto.getRandomValues ở client) nên không đoán trước được.
 * - Từ seed, luồng số ChaCha20 là xác định: cùng seed → cùng kịch bản, nhờ đó có thể
 *   phát lại (replay) và kiểm chứng (verify) mọi lượt gọi tên.
 * - Không dùng Math.random ở bất kỳ đâu trong việc chọn người.
 */

const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function rotl(v: number, c: number): number {
  return ((v << c) | (v >>> (32 - c))) >>> 0;
}

function quarter(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[a] = (x[a] + x[b]) >>> 0;
  x[d] = rotl(x[d] ^ x[a], 16);
  x[c] = (x[c] + x[d]) >>> 0;
  x[b] = rotl(x[b] ^ x[c], 12);
  x[a] = (x[a] + x[b]) >>> 0;
  x[d] = rotl(x[d] ^ x[a], 8);
  x[c] = (x[c] + x[d]) >>> 0;
  x[b] = rotl(x[b] ^ x[c], 7);
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) throw new Error('Seed không hợp lệ');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Sinh seed 256-bit (64 ký tự hex) bằng Web Crypto (có sẵn cả trong Node 20+ và trình duyệt). */
export function randomSeedHex(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export class ChaChaRng {
  private readonly state = new Uint32Array(16);
  private readonly block = new Uint32Array(16);
  private readonly work = new Uint32Array(16);
  private idx = 16;

  /**
   * @param seedHex 64 ký tự hex (256 bit)
   * @param stream số hiệu luồng (nonce). 0 = luồng kịch bản, 1 = luồng hình ảnh/hiệu ứng.
   */
  constructor(seedHex: string, stream = 0) {
    const key = hexToBytes(seedHex);
    if (key.length !== 32) throw new Error('Seed phải dài 32 byte (64 ký tự hex)');
    const s = this.state;
    s.set(SIGMA, 0);
    for (let i = 0; i < 8; i++) {
      s[4 + i] = (key[i * 4] | (key[i * 4 + 1] << 8) | (key[i * 4 + 2] << 16) | (key[i * 4 + 3] << 24)) >>> 0;
    }
    s[12] = 0; // block counter (low)
    s[13] = 0; // block counter (high)
    s[14] = stream >>> 0;
    s[15] = 0;
  }

  private refill(): void {
    const x = this.work;
    x.set(this.state);
    for (let i = 0; i < 10; i++) {
      quarter(x, 0, 4, 8, 12);
      quarter(x, 1, 5, 9, 13);
      quarter(x, 2, 6, 10, 14);
      quarter(x, 3, 7, 11, 15);
      quarter(x, 0, 5, 10, 15);
      quarter(x, 1, 6, 11, 12);
      quarter(x, 2, 7, 8, 13);
      quarter(x, 3, 4, 9, 14);
    }
    for (let i = 0; i < 16; i++) this.block[i] = (x[i] + this.state[i]) >>> 0;
    this.state[12] = (this.state[12] + 1) >>> 0;
    if (this.state[12] === 0) this.state[13] = (this.state[13] + 1) >>> 0;
    this.idx = 0;
  }

  /** Số nguyên 32-bit không dấu. */
  nextU32(): number {
    if (this.idx >= 16) this.refill();
    return this.block[this.idx++];
  }

  /** Số thực đều trong [0, 1) với 53 bit ngẫu nhiên. */
  float(): number {
    const hi = this.nextU32() >>> 5; // 27 bit
    const lo = this.nextU32() >>> 6; // 26 bit
    return (hi * 67108864 + lo) / 9007199254740992;
  }

  /** Số nguyên đều trong [0, n), không lệch (rejection sampling). */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new Error(`int(n) không hợp lệ: ${n}`);
    const limit = Math.floor(0x100000000 / n) * n;
    for (;;) {
      const v = this.nextU32();
      if (v < limit) return v % n;
    }
  }

  /** Số thực đều trong [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.float();
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Nhiễu 1D dạng gradient (Perlin) có seed, dùng cho tốc độ chạy tự nhiên. */
export class Noise1D {
  private readonly perm = new Uint8Array(512);
  private readonly grad = new Float64Array(256);

  constructor(rng: ChaChaRng) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p.push(i);
    rng.shuffle(p);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) this.grad[i] = rng.range(-1, 1);
  }

  /** Giá trị trong khoảng xấp xỉ [-1, 1]. */
  at(x: number): number {
    const xi = Math.floor(x);
    const xf = x - xi;
    const g0 = this.grad[this.perm[xi & 255]];
    const g1 = this.grad[this.perm[(xi + 1) & 255]];
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v0 = g0 * xf;
    const v1 = g1 * (xf - 1);
    return (v0 + (v1 - v0) * u) * 2;
  }
}
