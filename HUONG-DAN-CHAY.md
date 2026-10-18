# Hướng dẫn chạy

Chọn **một** trong hai cách. Không chạy cả hai cùng lúc, vì cả hai đều dùng cổng 3000.

## Cách 1: Docker (dùng trên lớp)

1. Mở **Docker Desktop** và chờ biểu tượng cá voi báo đã chạy.
2. Khởi động container có sẵn:
   ```bash
   docker start sgu-goi-ten
   ```
3. Mở http://localhost:3000
4. Tắt khi dùng xong:
   ```bash
   docker stop sgu-goi-ten
   ```

Dữ liệu (lớp, sinh viên, lịch sử gọi tên) nằm trong volume `sgu-data`, nên không mất khi tắt container hoặc build lại.

**Khi code thay đổi** thì phải build lại image và tạo lại container, nếu không sẽ vẫn chạy bản cũ:
```bash
docker build -t sgu-goi-ten .
docker rm -f sgu-goi-ten
docker run -d -p 3000:3000 -v sgu-data:/app/data --name sgu-goi-ten sgu-goi-ten
```
Nếu muốn bắt buộc nhập mật khẩu giảng viên, thêm `-e ADMIN_PASSWORD=matkhau` vào lệnh `docker run`. Sau khi cập nhật, bấm **Ctrl+F5** trên trình duyệt để tải bản mới.

## Cách 2: Không dùng Docker (cần Node.js 20+)

Mở terminal tại thư mục `F:\randomName`.

- **Chạy bản chính thức** (sau khi đổi code thì build lại trước):
  ```bash
  npm run build
  npm start
  ```
  Mở http://localhost:3000. Bấm `Ctrl+C` trong terminal để tắt.
  Dữ liệu lưu ở `data/pgdata` (PostgreSQL nhúng — PGlite), tách riêng với dữ liệu của bản Docker.
  Dữ liệu của phiên bản cũ (file `data/app.db`) đã được chép sang; muốn chép lại: `npm run migrate:sqlite -- data/app.db --replace`.

- **Chạy để phát triển** (sửa code thấy ngay):
  ```bash
  npm run dev
  ```
  Mở http://localhost:5173. Bấm `Ctrl+C` để tắt.

Lần đầu chạy trên máy mới thì cài thư viện trước bằng `npm install`.

## Khi gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop chưa chạy. Mở Docker Desktop rồi chạy lại lệnh. |
| Không thấy tính năng mới | Build lại (xem trên), rồi bấm **Ctrl+F5**. |
| `EADDRINUSE` / cổng 3000 bận | Một server khác đang chạy. Tắt nó (`docker stop sgu-goi-ten`, hoặc `Ctrl+C` ở terminal kia). |
| Muốn xoá sạch dữ liệu bản Docker | `docker rm -f sgu-goi-ten`, rồi `docker volume rm sgu-data` (**mất toàn bộ lịch sử**). |

## Phím tắt trong game

`Space` bắt đầu / gọi tiếp · `S` bỏ qua tới kết quả · `M` tắt/bật âm thanh · `F` toàn màn hình.
