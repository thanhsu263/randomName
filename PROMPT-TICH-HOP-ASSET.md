# Prompt cho model code game: tích hợp asset của model vẽ

Dán nguyên khối dưới đây cho model code game (cùng thư mục dự án `F:\randomName`).

```text
# BỐI CẢNH
Dự án này được làm song song bởi 2 model không biết nhau:
- Bạn (model code game) đã dựng xong game và TỰ VẼ toàn bộ hình bằng code
  (src/client/game/art/*.ts và src/client/ui/art.ts, ui/gallery.ts).
- Một model khác đã vẽ xong bộ asset 2D chính thức, nằm trong thư mục art/.

QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN: dùng bộ asset trong art/ làm hình ảnh chính thức của game,
kể cả nhân vật. Nhân vật trong art/ KHÔNG giống Xì Trum: "kid" là cậu bé đội mũ nấm xanh,
"wizard" là phù thủy áo tím mũ xanh lá. Chủ dự án ĐÃ CHẤP NHẬN điều này. Không vẽ lại,
không chỉnh màu nhân vật cho giống Xì Trum.

Nhiệm vụ: thay hình tự vẽ bằng asset trong art/ ở MỌI nơi hiển thị (màn rượt đuổi, HUD,
màn Setup, màn Kết quả), không làm hỏng logic kịch bản, random và replay.
Các hàm vẽ thủ tục giữ lại làm fallback khi thiếu file, đúng như thiết kế manifest hiện tại.

# ĐỌC TRƯỚC KHI LÀM
- art/sprites/kid_sprites.json: frame 256, groundY 250, nhìn sang phải, 5 biến thể
  (base, glasses, backpack, book, pencil). Mỗi frame có `label` = tâm, góc (độ),
  kích thước miếng vải trống trên mũ. jump/pop có `dy`, struggle có `grip`.
- art/sprites/wizard_sprites.json: frame 512, groundY 500. Mỗi frame có `sackMouth`
  {x, y, r, facing}. Lunge frame 4–5 có `sackFull` (túi đã khép).
- art/sprites/props.json: túi, chướng ngại vật (có hitbox), fx, ui.
- art/preview.png và art/sprites/preview.html để xem toàn bộ asset.
Mở từng PNG ra xem trước khi quyết định cách ghép.

# ĐÃ LÀM SẴN (đừng làm lại, chỉ kiểm tra)
Trong lúc chẩn đoán, một phiên khác đã nối sẵn phần không phụ thuộc code:
- scripts/import-art.mjs: chép art/ sang public/assets/. Script này cắt khung túi 512 về
  256 (vùng x128..384, y256..512) vì túi chỉ chiếm phần giữa-dưới khung.
  Hãy mở rộng script này cho mọi asset còn lại, thêm `npm run import:art`.
- public/assets/manifest.json đã điền path cho:
  * bg_l0..bg_l4 → bg/sgu_bg_L*.png (đã chạy, khớp với làn chạy).
  * obs_* → obstacles/obj_*.png (khung 512, anchor [0.5, 500/512]).
  * bag_idle / bag_wriggle / bag_open → sprites/sack_*.png (khung 256, grip [128, 40]).

# VIỆC CẦN LÀM

## 1. Nhân vật sinh viên (kid) thay smurf
- Map qua manifest, KHÔNG đổi key trong code:
  smurf_run←kid_run, smurf_trip←kid_trip, smurf_getup←kid_getup, smurf_jump←kid_jump,
  smurf_struggle←kid_struggle, smurf_escape_pop←kid_pop. Số frame đã khớp (8/6/4/5/4/5).
  Kiểm tra lại logic chọn frame cho trạng thái pop/dust trong Smurf.ts theo đúng nghĩa
  5 frame của kid_pop: bay, chạm đất, phủi bụi.
- Biến thể: art có SHEET TOÀN THÂN cho từng biến thể (kid_run_glasses.png...), không phải
  phụ kiện rời. Thêm khái niệm "variant" vào Look/manifest, mỗi xì trum chọn 1 biến thể.
  Khi dùng art thật thì TẮT overlay phụ kiện acc_* và TẮT ảnh mũ rời smurf_hat
  (art đã vẽ mũ sẵn trong thân).
- TẮT setTint màu lên thân khi dùng art thật: tint làm sai màu da.
  Đa dạng bằng biến thể thay cho tint.
- kid_*_cap.png là lớp mũ tách riêng, cùng khung. Dùng nếu cần vẽ chữ nằm giữa thân và mũ.
  Nếu không cần thì bỏ qua.
- Nhãn tên: miếng vải trên mũ chỉ 52x20 px ở khung 256, quá nhỏ để đọc trên máy chiếu.
  GIỮ băng rôn tên hiện tại, nhưng neo theo `label` từng frame:
  sinh headTrack [x, y, rot] từ label (đổi độ sang radian) bằng script và ghi vào manifest.
  Sao, mồ hôi và băng rôn đều bám theo track này.

## 2. Phù thủy (wizard) thay gargamel
- Map: gargamel_run←wizard_run, gargamel_lunge←wizard_lunge,
  gargamel_miss_fall←wizard_fall, gargamel_angry←wizard_stomp (8/6/6/4 frame, khớp).
- Wizard ĐÃ CẦM SẴN TÚI trong hình, nên khi dùng art thật:
  * Ẩn sprite túi rời đang treo ở tay, để tránh 2 cái túi.
  * Sinh handTrack từ sackMouth (x, y) bằng script và ghi vào manifest.
    bagMouth() và reach phải dùng sackMouth để xì trum bay đúng vào miệng túi vẽ sẵn.
    Canh lại thời điểm chụp (LUNGE_WINDUP) theo frame có sackFull đầu tiên (frame 4).
  * Trạng thái "túi có người, đang giãy": art không có wizard cầm túi đầy khi chạy.
    Đè sprite bag_wriggle lên đúng vị trí túi vẽ sẵn (theo sackMouth và r, xoay theo facing)
    khi bagCount > 0, che túi mở bên dưới. Phải trông liền mạch.
    Nếu không đạt, ghi vào báo cáo để chủ dự án nhờ model vẽ bổ sung
    "wizard_run_full" (wizard chạy cầm túi đã buộc).
  * Pha thoát túi: xì trum bật ra từ vị trí sackMouth.

## 3. Tỉ lệ và vị trí
- Kid cao khoảng 175 px trong khung 256 (chạm đất y=250). Wizard cao khoảng 470 px
  trong khung 512 (chạm đất y=500). Hiệu chỉnh SMURF_SCALE, GARG_SCALE, LANES, GARG_Y
  để chân chạm đúng mặt đường gạch của bg_l3, wizard cao khoảng 2.2–2.5 lần kid.
  Băng rôn tên vẫn đọc rõ ở 1920x1080.
- Anchor theo groundY: kid [0.5, 250/256], wizard [0.5, 500/512].
  Đọc anchor từ manifest, không hardcode (0.5, 1).
- Obstacles.ts đang hardcode setScale(0.62) và setOrigin(0.5, 1): sửa để đọc anchor
  từ manifest. Va chạm dùng hitbox trong props.json (quy đổi theo scale) thay cho ước lượng.

## 4. FX và HUD
- fx_dust (4 frame 512), fx_starburst (512), fx_speedlines (3 frame 512): thay
  fx_dust / fx_star / fx_speed tương ứng. Thêm hỗ trợ fx dạng nhiều frame nếu cần.
- ui_scroll, ui_scroll_fill, ui_scroll_marker: dựng lại thanh thời gian trong HUD từ
  3 mảnh này (dùng nine-slice hoặc ghép 2 đầu và thân kéo dãn).
  ui_button / ui_button_pressed: dùng cho nút trong canvas, hoặc làm nền nút DOM qua CSS.

## 5. Màn Setup và Kết quả (DOM)
- src/client/ui/art.ts và ui/gallery.ts đang vẽ Gargamel, Xì Trum, túi bằng code.
  Thay bằng ảnh từ public/assets: cắt 1 frame từ sheet bằng CSS background-position,
  hoặc xuất thêm ảnh đơn trong import-art.mjs.
  Gợi ý: wizard_stomp hoặc wizard_run frame 0 cho tiêu đề, kid_run cho trang trí,
  sack_open cho cảnh mở túi ở màn Kết quả.
- Đổi chữ trên giao diện nếu cần cho khớp nhân vật mới.
  Giữ tên game và dòng ghi nguồn như hiện tại.

## 6. Lỗi đã phát hiện: canvas 0x0 (màn hình đen)
Khi bắt đầu lượt, canvas có style "width: 0px; height: 0px" dù #stage và #game đã hiện
đủ kích thước. Bắn thêm window resize cũng không hết. Màn hình đen cả lượt, nhưng kịch bản
vẫn chạy và ra kết quả. Nghi do Phaser.Game được tạo lúc #stage còn hidden
(main.ts: setTimeout(() => app.game.init(), 300)), nên ScaleManager đọc parent 0x0.
Hãy sửa triệt để: tạo game khi stage đã hiển thị, hoặc gọi scale.refresh() sau
requestAnimationFrame khi unhide, và/hoặc dùng ResizeObserver trên #game.
Kiểm tra ở nhiều kích thước cửa sổ, kể cả cửa sổ hẹp dọc (~560x850) và khi thay đổi
kích thước giữa lượt.

# RÀNG BUỘC
- KHÔNG sửa file trong art/ (đó là nguồn của model vẽ). Mọi biến đổi đi qua
  scripts/import-art.mjs, xuất ra public/assets/.
- KHÔNG đổi thuật toán random, event script, seed và replay.
  Replay lượt cũ phải ra đúng kết quả.
- Mọi thông số (frame, fps, anchor, track, hitbox) nằm trong manifest.json, sinh tự động
  từ các file json của art/ bằng script. Không gõ tay số liệu vào code.
- Fallback thủ tục vẫn hoạt động khi xoá path trong manifest.

# NGHIỆM THU
1. `npm run import:art` chạy lại được từ đầu. Manifest được sinh đúng.
2. Màn rượt đuổi: không còn hình nào do code vẽ (trừ băng rôn tên, chữ, bóng đổ),
   chỉ có 1 cái túi, xì trum bay đúng vào miệng túi, chân nhân vật chạm mặt đường,
   chướng ngại vật nằm trên mặt đường.
3. Thấy đủ 5 biến thể kid trong một lượt có từ 10 người trở lên.
4. Màn Setup và Kết quả dùng hình từ art/.
5. Không còn màn hình đen. Đã kiểm tra trên 1920x1080 và cửa sổ hẹp.
6. `npm run typecheck`, `npm test`, `npm run build` đều qua.
7. Báo cáo: danh sách file đã sửa, ảnh chụp màn hình rượt đuổi (lúc chạy, lúc chộp,
   lúc thoát túi) và màn Kết quả, và mọi chỗ cần model vẽ bổ sung asset.
```

---

## Phụ lục: prompt cho model vẽ (chỉ dùng khi model code báo cần)

```text
Bổ sung cho bộ asset trong art/, giữ nguyên style, nét, màu và tỉ lệ của wizard_run.png:
- wizard_run_full.png: 8 frame 512x512, cùng chuyển động với wizard_run nhưng túi đã buộc
  miệng và phồng lên như có người bên trong. Cập nhật wizard_sprites.json: thêm anim
  run_full với sackMouth từng frame (tâm túi), sackFull = true.
Xuất cả SVG và PNG như các asset cũ, cập nhật art/sprites/preview.html.
```
