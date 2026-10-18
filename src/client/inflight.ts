// Chống gọi trùng: nếu đã có một lời gọi giống hệt đang chờ kết quả thì dùng lại chính lời gọi đó,
// thay vì gửi thêm. Dùng cho các yêu cầu ghi (vd. bấm "XUẤT KÍCH" liên tục trước khi server kịp trả lời).
export class InFlight {
  private readonly pending = new Map<string, Promise<unknown>>();

  /** Chạy `fn` nếu chưa có lời gọi cùng `key` đang chờ; ngược lại trả về lời gọi đang chờ. */
  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.pending.get(key);
    if (hit) return hit as Promise<T>;
    const p = fn().finally(() => {
      if (this.pending.get(key) === p) this.pending.delete(key);
    });
    this.pending.set(key, p);
    return p;
  }

  get size(): number {
    return this.pending.size;
  }
}
