# Báo cáo đợt 2: chuyển sang bộ asset `art/`

## Kết quả nghiệm thu

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | `npm run import:art` chạy lại được từ đầu, manifest sinh đúng | ✅ Chạy lại cho manifest giống hệt bản trước (đã so: 0 khác biệt). Toàn bộ thông số lấy từ `art/sprites/*.json`. |
| 2 | Màn rượt đuổi chỉ còn hình từ art (trừ băng rôn tên, chữ, bóng đổ), 1 cái túi, xì trum bay đúng vào miệng túi, chân nhân vật và chướng ngại nằm trên mặt đường | ✅ Đạt. Còn 1 điểm chưa hoàn hảo, xem mục "Cần vẽ bổ sung". |
| 3 | Đủ 5 biến thể kid trong lượt có từ 10 người trở lên | ✅ Biến thể được gán xoay vòng nên 5 người đầu tiên xuất hiện có đủ 5 biến thể. Đã kiểm tra trên lượt 11 người. |
| 4 | Màn Setup và Kết quả dùng hình từ art | ✅ |
| 5 | Không còn màn hình đen, đã kiểm tra 1920x1080 và cửa sổ hẹp | ✅ Kiểm tra ở 1920x1080, ở 557x849 và khi đổi kích thước giữa lượt. |
| 6 | `npm run typecheck`, `npm test`, `npm run build` đều qua | ✅ Cả `npm run lint` cũng qua. |

Khi xoá `path` trong manifest, game quay về hình vẽ thủ tục và vẫn chạy đúng (đã thử). Phát lại một lượt cũ cho ra đúng diễn biến và đúng kết quả.

## Ảnh chụp

- `docs/screenshots/01-dang-chay.jpg`: lúc đàn đang chạy, phù thủy vung túi.
- `docs/screenshots/02-luc-chop.jpg`: lúc chộp ("BẮT ĐƯỢC Anh!").
- `docs/screenshots/03-thoat-tui.jpg`: lúc thoát túi ("THOÁT RỒI!", kid lộn nhào bật ra).
- `docs/screenshots/04-ket-qua.jpg`: màn Kết quả.

## File đã sửa hoặc tạo

- `scripts/import-art.mjs`, `package.json` (thêm `import:art`, bỏ `pack:atlas` vì script này chưa có).
- `public/assets/manifest.json` (sinh tự động) và `public/assets/{bg,sprites,obstacles,fx,ui}/*`.
- `src/client/game/`: `assets.ts`, `config.ts`, `fx.ts`, `GameHost.ts`, `scenes.ts` (HUD), `Director.ts`, `actors/Smurf.ts`, `actors/Gargamel.ts`, `world/Obstacles.ts`, `world/Parallax.ts`.
- `src/client/ui/art.ts`, `src/client/ui/gallery.ts`, `src/client/screens/setup.ts`, `src/client/screens/result.ts`, `src/client/screens/importDialog.ts`.
- `src/client/main.ts`, `src/client/state.ts`, `src/client/styles.css`.
- `README.md`, `CREDITS.md`, `Dockerfile`, `.dockerignore`.

## Thay đổi hành vi cần biết

- Số nhân vật tối đa trên màn hình mặc định giảm **từ 14 xuống 11**, vì với nhân vật mới băng rôn tên bị chồng nhiều. Con số này vẫn chỉnh được ở màn Setup (6–20).
- Băng rôn tên giữ cỡ chữ 38 px, neo vào miếng vải trên mũ của từng khung hình. Băng rôn của làn xa được nâng cao hơn để đỡ chồng lên làn gần.

## Cần model vẽ bổ sung

1. **`wizard_run_full`** (ưu tiên): phù thủy chạy, tay cầm túi đã buộc, bên trong có người đang giãy. Art hiện chỉ có túi mở khi chạy. Code đang đè sprite `sack_wriggle` lên miệng túi, trông gần liền mạch nhưng vẫn lộ một chút vành túi mở phía sau nút buộc. Nên vẽ thêm `wizard_stomp_full` và `wizard_fall_full` theo cùng cách.
2. Tuỳ chọn: miếng vải tên trên mũ kid chỉ 52x20 px ở khung 256, quá nhỏ để chữ đọc rõ trên máy chiếu. Vì vậy game vẫn dùng băng rôn riêng. Nếu muốn chữ nằm ngay trên mũ, cần patch to hơn khoảng 3 lần.
3. `kid_*_cap.png` (lớp mũ tách riêng) hiện chưa dùng tới.

## Chưa kiểm tra được

- Âm thanh và thao tác bàn phím chưa được nghe và bấm thử thủ công, vì pane trình duyệt của agent bị ẩn.
