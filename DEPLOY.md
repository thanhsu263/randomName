# Hướng dẫn deploy

## Vì sao không deploy nguyên trạng lên Vercel

App là **một server Fastify chạy liên tục**, lưu dữ liệu bằng **SQLite trong file** (`data/app.db`, thư viện native `better-sqlite3`). Vercel không hợp với kiểu app này vì:

- Vercel chỉ chạy hàm serverless ngắn hạn, không có server chạy liên tục.
- Ổ đĩa trên Vercel không giữ lại được: lớp học và lịch sử gọi tên sẽ mất ngẫu nhiên.
- Module native `better-sqlite3` dễ lỗi khi build trên Vercel.

Vì vậy nên dùng một nền tảng **chạy được Docker và có ổ đĩa lưu trữ (volume)**. Repo đã có sẵn `Dockerfile`, nên không cần sửa code. Cách A và B bên dưới đều theo hướng này.

---

## Cách A: Render (giao diện web, dễ nhất)

1. Đăng nhập https://render.com bằng tài khoản GitHub.
2. **New +** → **Web Service** → chọn repo `thanhsu263/randomName`.
3. Cấu hình:
   - **Language/Runtime**: `Docker`. Render tự nhận `Dockerfile`.
   - **Branch**: `main`
   - **Instance type**: `Starter` trở lên. Gói Free không gắn được ổ đĩa, dữ liệu sẽ mất mỗi lần khởi động lại.
4. **Environment Variables**:
   - `DB_PATH` = `/app/data/app.db`
   - `ADMIN_PASSWORD` = *(mật khẩu giảng viên, nên đặt vì web công khai)*
   - Không cần đặt `PORT`. Render tự truyền và app đọc biến này.
5. **Advanced** → **Add Disk**:
   - Mount path: `/app/data`
   - Size: `1 GB` là đủ
6. **Create Web Service**. Chờ build xong (khoảng 3–5 phút), Render cấp địa chỉ dạng `https://randomname-xxxx.onrender.com`.

Mỗi lần `git push` lên `main`, Render tự build và deploy lại.

## Cách B: Railway

1. Đăng nhập https://railway.app bằng GitHub → **New Project** → **Deploy from GitHub repo** → chọn `randomName`. Railway tự dùng `Dockerfile`.
2. Tab **Variables**: thêm `DB_PATH=/app/data/app.db` và `ADMIN_PASSWORD=...`.
3. Chuột phải vào service → **Attach Volume** → mount path `/app/data`.
4. Tab **Settings** → **Networking** → **Generate Domain** để có địa chỉ truy cập.

## Lưu ý chung

- **Bắt buộc đặt `ADMIN_PASSWORD`** khi đưa lên Internet. Nếu không, ai có link cũng có thể tạo, xoá lớp và gọi tên.
- Lần đầu chạy, app tự tạo lớp mẫu 40 SV. Có thể xoá lớp mẫu trong giao diện.
- **Bản quyền**: repo chứa nhạc *Smurfs Epic Run* © Ubisoft và hình tượng Peyo. Hãy để **repo ở chế độ Private**, và chỉ chia sẻ link web cho nội bộ lớp học.
- Build cần Internet, vì gói `xlsx` được tải từ cdn.sheetjs.com. Các nền tảng trên đều có sẵn.

---

## Nếu bắt buộc dùng Vercel

Có 2 lựa chọn, đều phải sửa code:

1. **Vercel chỉ cho giao diện + API ở Render/Railway**: deploy thư mục `dist/public` lên Vercel, server vẫn chạy theo cách A hoặc B. Cần sửa client gọi API theo địa chỉ tuyệt đối (biến `VITE_API_URL`) và bật CORS trên server.
2. **Chuyển hẳn sang Vercel**: thay SQLite bằng CSDL trên mạng (Turso/libSQL hoặc Neon Postgres), viết lại các route `/api/*` thành Vercel Functions, rồi deploy giao diện như site tĩnh của Vite.

Hai lựa chọn này cần thêm công sửa code. Báo lại nếu muốn làm.
