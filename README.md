# Gargamel bắt Xì Trum SGU

Mini-game gọi tên sinh viên ngẫu nhiên cho Trường Đại học Sài Gòn. Phù thủy cầm túi đuổi bắt đàn "xì trum", mỗi bạn mang tên một sinh viên trên mũ. Bạn nào bị bắt vào túi là được gọi tên. Game thiết kế để chiếu lên máy chiếu 1920x1080 trong lớp và chạy được offline.

## Cài đặt và chạy

Cần Node.js 20 trở lên.

```bash
npm install
```

```bash
npm run dev
```

Lệnh `npm run dev` chạy server API ở cổng 3000 và Vite ở cổng 5173. Mở http://localhost:5173.

Bản production:

```bash
npm run build
```

```bash
npm start
```

`npm start` chạy `node dist/server.js`, một process phục vụ cả API lẫn giao diện. Mở http://localhost:3000.

Lần đầu chạy, server tự tạo CSDL SQLite ở `data/app.db` kèm một lớp mẫu 40 sinh viên. Dùng `npm run seed -- --force` để tạo thêm một lớp mẫu.

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng server |
| `HOST` | `127.0.0.1` | Đặt `0.0.0.0` để máy khác trong mạng truy cập được |
| `DB_PATH` | `data/app.db` | Đường dẫn file SQLite |
| `ADMIN_PASSWORD` | trống | Nếu đặt, mọi thao tác ghi (tạo lớp, nhập danh sách, gọi tên…) đều hỏi mật khẩu giảng viên |
| `LOG` | trống | Đặt `1` để bật log request |

## Cách dùng

1. **Màn Setup**: chọn lớp, hoặc tạo lớp mới rồi nhập danh sách. Có thể nhập file CSV/XLSX với các cột MSSV, Họ tên, Lớp (tiêu đề cột được nhận diện tự động, kể cả cặp cột "Họ lót" + "Tên"), hoặc dán văn bản mỗi dòng một sinh viên. Sau đó chọn số người cần gọi N, thời lượng (ngẫu nhiên 30–60 giây hoặc cố định) và tỉ lệ thoát túi p (0–50%).
2. Bấm **GARGAMEL XUẤT KÍCH!** hoặc phím `Space` để bắt đầu. Trong màn rượt đuổi, phím `S` bỏ qua tới kết quả.
3. **Màn Kết quả** có các nút: sao chép danh sách, gọi tiếp, gọi lại từ đầu (bắt đầu buổi mới), xem lịch sử, xem lại lượt vừa gọi.
4. **Lịch sử**: mỗi lượt cũ có thể phát lại hoặc **Kiểm chứng**. Kiểm chứng sinh lại kịch bản từ seed ngay trong trình duyệt và so với bản đã lưu.

Tùy chọn **Ẩn thanh thời gian** ở màn Setup (mặc định tắt) giấu thanh tiến trình và số giây còn lại trong lúc rượt đuổi. Nhờ vậy, khi sắp hết giờ mà chưa bắt đủ người, khán giả không đoán được ai sắp bị bắt.

Phím tắt: `Space` bắt đầu hoặc gọi tiếp, `S` bỏ qua, `M` bật/tắt âm thanh, `F` toàn màn hình.

## Thuật toán công bằng

- Server sinh seed 256-bit bằng `crypto.randomBytes`. Từ seed đó, bộ sinh ChaCha20 (`src/shared/rng.ts`) sinh toàn bộ kịch bản trước khi chạy hoạt cảnh (`src/shared/script.ts`).
- Mỗi lần chộp chọn đều một người trong pool. Quyết định "thoát túi" chỉ dựa vào số thứ tự lần chộp, không dựa vào việc ai bị chộp, và người thoát được trả lại pool. Vì vậy kết quả cuối cùng là một tập N người ngẫu nhiên đều.
- Seed và kịch bản được lưu vào DB nên mọi lượt có thể phát lại và kiểm chứng.
- Test nằm ở `tests/` và chạy bằng `npm test`. Bộ test gồm kiểm định chi-square qua 100k lần mô phỏng, luôn ra đúng N người, không trùng, tôn trọng tuỳ chọn loại trừ người đã gọi, và test vector ChaCha20.

## Asset (hình, âm thanh)

Bộ asset chính thức nằm trong `art/`, do model vẽ cung cấp. Không sửa trực tiếp thư mục này. Khi `art/` được vẽ lại, chạy:

```bash
npm run import:art
```

Lệnh này chép asset sang `public/assets/` và **sinh lại** `public/assets/manifest.json`, gồm frame, fps, anchor, track nhãn tên, miệng túi và hitbox. Mọi số liệu đều đọc từ `art/sprites/*.json`.

- Mục nào trong manifest có `path` sẽ dùng file thật. Mục nào `path: null` sẽ dùng hình vẽ thủ tục (fallback) trong `src/client/game/art/`.
- Muốn thay một asset: thả file PNG vào `public/assets/...` rồi điền `path` trong manifest, không cần sửa code.
- Xem nhanh mọi asset tại `/?gallery`. Lọc theo tên bằng tham số, ví dụ `/?gallery=kid`.
- Nhạc nền và jingle nằm trong `public/assets/audio/`, khai báo ở mục `audio` của manifest. Hiệu ứng âm thanh còn lại được tổng hợp bằng WebAudio.

## Triển khai bằng Docker

```bash
docker build -t sgu-goi-ten .
```

```bash
docker run -p 3000:3000 -v sgu-data:/app/data -e ADMIN_PASSWORD=doimatkhau sgu-goi-ten
```

## Cấu trúc thư mục

```
src/server   Fastify, SQLite (better-sqlite3), routes, migrations
src/shared   kiểu dữ liệu, RNG ChaCha20, thuật toán & event script, đọc danh sách
src/client   giao diện (screens/, ui/, audio/) và game Phaser 3 (game/)
public/assets  asset đã nhập + manifest.json
scripts      import-art.mjs, build-server.mjs, seed.ts
tests        Vitest
art          asset gốc (nguồn, không sửa)
```

Các lệnh kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`.

Nguồn tham khảo và bản quyền xem tại [CREDITS.md](CREDITS.md).
