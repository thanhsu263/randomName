import { describe, expect, it } from 'vitest';
import { InFlight } from '../src/client/inflight';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe('InFlight (chống bấm nút nhiều lần)', () => {
  it('bấm 5 lần liên tục chỉ gọi server 1 lần, mọi lần bấm nhận cùng kết quả', async () => {
    const f = new InFlight();
    const d = deferred<number>();
    let calls = 0;
    const call = () =>
      f.run('POST /api/draws', () => {
        calls++;
        return d.promise;
      });
    const all = [call(), call(), call(), call(), call()];
    expect(calls).toBe(1);
    expect(f.size).toBe(1);
    d.resolve(42);
    expect(await Promise.all(all)).toEqual([42, 42, 42, 42, 42]);
    expect(f.size).toBe(0);
  });

  it('xong rồi thì cho phép gọi lại; yêu cầu khác key không bị gộp', async () => {
    const f = new InFlight();
    let calls = 0;
    const fn = () => Promise.resolve(++calls);
    expect(await f.run('a', fn)).toBe(1);
    expect(await f.run('a', fn)).toBe(2);
    const d = deferred<string>();
    const p1 = f.run('a', () => d.promise);
    const p2 = f.run('b', () => Promise.resolve('b'));
    expect(await p2).toBe('b');
    d.resolve('a');
    expect(await p1).toBe('a');
  });

  it('lỗi cũng nhả khoá để thử lại được', async () => {
    const f = new InFlight();
    const d = deferred<number>();
    const p = f.run('x', () => d.promise);
    const q = f.run('x', () => Promise.resolve(1)); // gộp vào p
    d.reject(new Error('mất mạng'));
    await expect(p).rejects.toThrow('mất mạng');
    await expect(q).rejects.toThrow('mất mạng');
    expect(await f.run('x', () => Promise.resolve(7))).toBe(7);
  });
});
