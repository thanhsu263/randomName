# Hướng dẫn deploy lên Vercel + Neon

## Kiến trúc

- **Giao diện**: file tĩnh (`dist/public`), phát qua CDN của Vercel.
- **API**: chạy trong **1 Vercel Function** (`/api/*`). Bên trong là Fastify, đóng gói sẵn bởi `npm run build:vercel` theo Build Output API v3.
- **CSDL**: **Neon** (PostgreSQL serverless), nối qua driver HTTP `@neondatabase/serverless`. Bảng tự được tạo ở lần chạy đầu.

Khi chạy trên máy hoặc bằng Docker, app dùng **PGlite** (PostgreSQL nhúng, lưu ở `data/pgdata`), cùng kiểu SQL với Neon. Xem `HUONG-DAN-CHAY.md`.

---

## Bước 1: Đưa code lên GitHub

Repo: https://github.com/thanhsu263/randomName. Nên để repo **Private**, vì repo có nhạc © Ubisoft.

## Bước 2: Tạo project trên Vercel

1. Vào https://vercel.com → đăng nhập bằng GitHub.
2. **Add New… → Project** → **Import** repo `randomName`. Nếu không thấy repo private, bấm *Adjust GitHub App Permissions* để cấp quyền.
3. Màn **Configure Project**:
   - **Framework Preset**: `Other`
   - Build / Install / Output: để mặc định. File `vercel.json` đã khai báo `npm ci` và `npm run build:vercel`.
   - **Environment Variables**: thêm `ADMIN_PASSWORD` = mật khẩu giảng viên (**bắt buộc**, vì web công khai).
4. Bấm **Deploy**. Lần deploy đầu sẽ báo lỗi CSDL khi gọi API, vì chưa có Neon. Làm tiếp bước 3.

## Bước 3: Gắn Neon từ Vercel Marketplace

1. Trong project trên Vercel → tab **Storage** → **Create Database** → chọn **Neon** (Serverless Postgres) → **Continue**.
2. Chọn:
   - Region: **Singapore (ap-southeast-1)**, gần Việt Nam.
   - Plan: **Free**.
3. Bấm **Create** rồi **Connect** vào project `randomName`, tick cả Production và Preview.
   Vercel tự thêm biến `DATABASE_URL` (cùng `POSTGRES_URL`…) vào project. App đọc `DATABASE_URL`.
4. Vào **Deployments** → bản mới nhất → **⋯ → Redeploy**. Vercel chỉ áp dụng biến môi trường mới cho các lần deploy sau khi thêm.
5. (Nên làm) **Settings → Functions → Function Region**: chọn `Singapore (sin1)` cho gần Neon.

Nếu đã có tài khoản Neon riêng, có thể bỏ qua Marketplace. Vào https://console.neon.tech, tạo project, copy **connection string** (`postgresql://...neon.tech/...?sslmode=require`), rồi tự thêm biến `DATABASE_URL` trong **Settings → Environment Variables** của Vercel.

## Bước 4: Kiểm tra

- Mở `https://<địa-chỉ>.vercel.app/api/health` → phải thấy `{"ok":true}`.
- Mở trang chủ → màn Setup có lớp mẫu 40 SV (tự tạo khi CSDL trống).
- Bấm **GARGAMEL XUẤT KÍCH!** → trình duyệt hỏi mật khẩu giảng viên → nhập `ADMIN_PASSWORD`.

Từ đó, mỗi lần `git push` lên `main`, Vercel tự build và deploy lại.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối Neon. Vercel tự thêm khi gắn Neon. Có biến này thì app dùng Neon. |
| `ADMIN_PASSWORD` | Mật khẩu cho mọi thao tác ghi (tạo/xoá lớp, nhập danh sách, gọi tên) |
| `SEED_SAMPLE` | Đặt `0` để không tự tạo lớp mẫu khi CSDL trống |

## Chuyển dữ liệu đang có lên Neon (tuỳ chọn)

Muốn mang lớp và lịch sử gọi tên từ file SQLite cũ (`data/app.db`) lên Neon, chạy trên máy của bạn:

1. Lấy connection string của Neon: Vercel → Storage → Neon → **.env.local** / **Show secret**, hoặc từ Neon Console.
2. Mở terminal ở thư mục dự án (PowerShell):
   ```powershell
   $env:DATABASE_URL = "postgresql://...neon.tech/...?sslmode=require"
   npm run migrate:sqlite -- data/app.db --replace
   ```
   `--replace` xoá dữ liệu đang có ở Neon (ví dụ lớp mẫu tự tạo) rồi chép toàn bộ sang. Id của lớp, sinh viên và lượt gọi được giữ nguyên, nên lịch sử và replay vẫn khớp.

## Gặp lỗi

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| API trả `Máy chủ chưa cấu hình xong CSDL` | Chưa gắn Neon hoặc chưa Redeploy sau khi gắn (bước 3). |
| Lỗi 401 khi gọi tên | Nhập đúng `ADMIN_PASSWORD`. |
| Lần mở đầu tiên sau thời gian dài hơi chậm | Gói Free của Neon tự "ngủ" khi không dùng, nên request đầu mất thêm khoảng 0,5–1 giây để đánh thức. |
| Xem log lỗi | Vercel → project → **Logs**. |

## Chạy thử bản Vercel trên máy (tuỳ chọn)

```bash
npm run build:vercel
```

Lệnh này tạo `.vercel/output/` giống hệt thứ Vercel deploy. Nếu đã cài Vercel CLI (`npm i -g vercel`), có thể deploy thẳng bằng `vercel deploy --prebuilt`.

---

## Phương án khác: Docker (Render / Railway)

Dockerfile dùng PGlite lưu trong volume `/app/data`, hoặc Neon nếu đặt `DATABASE_URL`.

- **Railway**: New Project → Deploy from GitHub repo → thêm biến `ADMIN_PASSWORD` → Attach Volume tại `/app/data` → Generate Domain.
- **Render**: New Web Service → Runtime Docker → thêm biến `ADMIN_PASSWORD` → Add Disk tại `/app/data` (cần gói trả phí).
