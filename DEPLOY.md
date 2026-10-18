# Hướng dẫn deploy

## Kiến trúc khi chạy trên Vercel

- **Giao diện**: các file tĩnh (`dist/public`), phát qua CDN của Vercel.
- **API**: chạy trong **1 Vercel Function** (`/api/*`). Bên trong là Fastify, đóng gói sẵn bởi `npm run build:vercel` theo Build Output API v3.
- **CSDL**: **Turso**, tức SQLite chạy trên mạng (libSQL). Schema giống hệt bản cục bộ.

Cùng một bộ code vẫn chạy được cục bộ và bằng Docker với file SQLite. Xem `HUONG-DAN-CHAY.md`.

---

## Bước 1: Tạo CSDL Turso (miễn phí)

1. Vào https://turso.tech → **Sign up** bằng GitHub.
2. **Create Database**:
   - Name: `sgu-goi-ten`
   - Location: chọn **Singapore** (gần Việt Nam). Nên chọn cùng khu vực với Vercel ở bước 3.
3. Mở database vừa tạo:
   - Copy **Database URL**, dạng `libsql://sgu-goi-ten-<tên>.turso.io`.
   - Bấm **Create Token** (quyền Read & Write, không hết hạn) → copy **token**.

Không cần tạo bảng thủ công: app tự tạo bảng và lớp mẫu 40 SV ở lần chạy đầu.

## Bước 2: Đưa code lên GitHub

Code đã ở https://github.com/thanhsu263/randomName. Nên để repo **Private**, vì repo có nhạc © Ubisoft.

## Bước 3: Tạo project trên Vercel

1. Vào https://vercel.com → **Sign up / Log in** bằng GitHub.
2. **Add New… → Project** → **Import** repo `randomName`. Nếu không thấy repo private, bấm *Adjust GitHub App Permissions* để cấp quyền.
3. Màn **Configure Project**:
   - **Framework Preset**: `Other`
   - **Build Command / Install Command / Output Directory**: để mặc định. File `vercel.json` trong repo đã khai báo `npm ci` và `npm run build:vercel`.
   - **Environment Variables**: thêm 3 biến

     | Name | Value |
     |---|---|
     | `TURSO_DATABASE_URL` | `libsql://sgu-goi-ten-<tên>.turso.io` |
     | `TURSO_AUTH_TOKEN` | token đã copy ở bước 1 |
     | `ADMIN_PASSWORD` | mật khẩu giảng viên (**bắt buộc**, vì web công khai) |

4. Bấm **Deploy** và chờ khoảng 1–2 phút. Vercel cấp địa chỉ dạng `https://random-name-xxxx.vercel.app`.
5. (Nên làm) **Settings → Functions → Function Region**: chọn `Singapore (sin1)` cho gần Turso, giúp API nhanh hơn.

Từ đó, mỗi lần `git push` lên nhánh `main`, Vercel tự build và deploy lại. Push lên nhánh khác sẽ tạo bản Preview riêng.

## Bước 4: Kiểm tra

- Mở `https://<địa-chỉ>.vercel.app/api/health` → phải thấy `{"ok":true}`.
- Mở trang chủ → màn Setup hiện lớp mẫu 40 SV.
- Bấm **GARGAMEL XUẤT KÍCH!** → trình duyệt hỏi mật khẩu giảng viên → nhập `ADMIN_PASSWORD`.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `TURSO_DATABASE_URL` | URL Turso. Có biến này thì app dùng Turso thay cho file SQLite. |
| `TURSO_AUTH_TOKEN` | Token của Turso |
| `ADMIN_PASSWORD` | Mật khẩu cho mọi thao tác ghi (tạo/xoá lớp, nhập danh sách, gọi tên) |
| `SEED_SAMPLE` | Đặt `0` để không tự tạo lớp mẫu khi CSDL trống |

## Chuyển dữ liệu từ máy lên Turso (tuỳ chọn)

Nếu muốn mang lớp và lịch sử gọi tên đang có trong `data/app.db` lên Turso, cài Turso CLI (https://docs.turso.tech/cli/installation) rồi chạy:

```bash
turso db import data/app.db
```

Lệnh này tạo một database **mới** từ file. Sau đó lấy URL và token của database mới đó cho bước 3.

## Gặp lỗi

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| API trả `Máy chủ chưa cấu hình xong CSDL` | Thiếu hoặc sai `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`. Sửa trong **Settings → Environment Variables**, rồi **Deployments → Redeploy**. |
| Lỗi 401 khi gọi tên | Nhập đúng `ADMIN_PASSWORD`. |
| Sửa biến môi trường mà không có tác dụng | Vercel chỉ áp dụng biến mới khi deploy lại: vào **Redeploy**. |
| Xem log lỗi | Vercel → project → **Logs** (hoặc **Deployments → Functions**). |

## Chạy thử bản Vercel trên máy (tuỳ chọn)

```bash
npm run build:vercel
```

Lệnh này tạo `.vercel/output/` giống hệt thứ Vercel deploy. Nếu đã cài Vercel CLI (`npm i -g vercel`), có thể deploy thẳng từ máy bằng `vercel deploy --prebuilt`.

---

## Phương án khác: Docker (Render / Railway)

Vẫn dùng được nếu không muốn dùng Vercel. Dockerfile dùng file SQLite trong volume `/app/data`, hoặc Turso nếu đặt `TURSO_DATABASE_URL`. Các bước:

- **Railway**: New Project → Deploy from GitHub repo → thêm biến `ADMIN_PASSWORD` → Attach Volume tại `/app/data` → Generate Domain.
- **Render**: New Web Service → Runtime Docker → thêm biến `ADMIN_PASSWORD` → Add Disk tại `/app/data` (cần gói trả phí).
