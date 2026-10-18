# Bộ prompt cho dự án "Gargamel Bắt Xì Trum SGU"

Gồm 2 phần:
- **Phần A**: prompt để model code dựng toàn bộ website. Dán nguyên khối, kèm 5 ảnh tham khảo.
- **Phần B**: prompt để model sinh ảnh vẽ asset 2D: background SGU, sprite xì trum, Gargamel, túi, chướng ngại vật.

> Phạm vi sử dụng: website phục vụ học tập và giải trí trong SGU, phi thương mại. Nhân vật Xì Trum và Gargamel © Peyo / IMPS. Nhạc trong `reference/audio/` lấy từ game Smurfs Epic Run © Ubisoft. Ghi nguồn đầy đủ trong CREDITS.md và ở chân trang website.
>
> Tài liệu tham khảo trong thư mục dự án:
> - `sgu.jpg`, `style.jpg`, `style2.jpg`, `OIP.webp`, `gargamel.jpg`
> - `reference/epic-run-icon.png`: tư thế chạy nhảy của Tí Vua trong Smurfs Epic Run
> - `reference/audio/*.mp3`: 11 bản nhạc và jingle gốc của game, dùng trực tiếp được
> - File `.xapk`: game Smurfs Epic Run là game **3D** (engine Spark2 của Ubisoft). Mô hình, texture và âm thanh hiệu ứng nằm trong các file `.spd` đã **mã hoá**, nên không có sprite 2D để lấy ra. Game chỉ dùng để tham khảo gameplay, nhịp chạy và các chủ đề màn chơi (Village, ForestEdge, ForestDeep...).

---

## PHẦN A — Prompt dựng website (dán cho model code)

```text
# VAI TRÒ
Bạn là senior full-stack engineer kiêm game developer 2D. Hãy xây dựng hoàn chỉnh, chạy được ngay,
một website "random gọi tên sinh viên" dạng mini-game cho Trường Đại học Sài Gòn (SGU).

# BỐI CẢNH
- Sinh viên SGU được ví như Xì Trum vì đồng phục và logo trường đều màu xanh dương.
- Website mô phỏng cảnh lão phù thủy Gargamel cầm túi vải đuổi bắt đàn xì trum chạy trong
  "làng xì trum phiên bản SGU". Mỗi xì trum mang tên một sinh viên trên mũ.
  Bị bắt vào túi nghĩa là sinh viên đó được gọi tên.
- Website được chiếu lên máy chiếu trong lớp học (1920x1080), giảng viên điều khiển.
- Ảnh tham khảo đính kèm:
  1) sgu.jpg: toà nhà chính SGU (tường vàng, mái ngói đỏ, tháp đồng hồ, cửa vòm, biển
     "Trường Đại học Sài Gòn", cây cổ thụ, sân gạch). Đây là background chính.
  2) style.jpg, style2.jpg, OIP.webp: phong cách làng xì trum (nhà nấm, hàng rào gỗ, giếng, hoa,
     nét mực đen dày, màu phẳng tươi).
  3) gargamel.jpg: tư thế Gargamel đuổi bắt xì trum.
  4) Game tham khảo cảm giác chạy, nhảy và parallax: https://gamevui.vn/xi-trum-tham-hiem/game
     và Smurfs Epic Run (Ubisoft). reference/epic-run-icon.png là tư thế chạy nhảy mẫu.
  5) reference/audio/: nhạc gốc của Smurfs Epic Run (Music_Forest, Music_Plain, Music_Mountain,
     Music_Ice, Music_King_Smurf, Menu_loop, Music_OffGame, các Jingle_*). Dùng trực tiếp làm nhạc.
- Phạm vi: dự án học tập và giải trí nội bộ, phi thương mại. Được dùng hình tượng Xì Trum và
  Gargamel theo phong cách Peyo. Ghi nguồn đầy đủ (Peyo/IMPS, Ubisoft) trong CREDITS.md và
  ở chân trang website.

# STACK BẮT BUỘC (monolith, 1 repo, 1 process)
- Node.js 20+ và TypeScript (strict) cho toàn bộ dự án.
- Backend: Fastify (hoặc Express). Phục vụ REST API và static frontend đã build trong cùng 1 process.
- Frontend: Vite + TypeScript. Dùng Phaser 3 cho màn rượt đuổi. Các màn setup và kết quả dùng
  HTML/CSS thuần hoặc Preact nhẹ.
- Lưu trữ: SQLite (better-sqlite3) cho danh sách lớp, sinh viên, lịch sử gọi tên.
- Import danh sách: CSV và XLSX (SheetJS), hoặc dán text mỗi dòng 1 sinh viên.
- Một lệnh chạy dev: `npm run dev`. Build: `npm run build`. Production: `npm start` chạy 1 file
  `dist/server.js` phục vụ toàn bộ app. Kèm Dockerfile.
- Không phụ thuộc dịch vụ ngoài lúc chạy, vì phòng học có thể không có internet.
  Font và asset phải nằm trong repo.

# CẤU TRÚC THƯ MỤC GỢI Ý
/src/server        (Fastify, routes, db, migrations)
/src/shared        (types dùng chung, thuật toán random và script sự kiện)
/src/client        (Vite app: screens/, game/ (Phaser scenes), ui/, audio/)
/public/assets     (bg/, sprites/, obstacles/, ui/, audio/, fonts/) + assets/manifest.json
/scripts           (đóng gói texture atlas, seed dữ liệu mẫu)

# LUỒNG MÀN HÌNH
1. Màn Setup (theme làng xì trum SGU, chữ to dễ đọc trên máy chiếu):
   - Chọn lớp, hoặc tạo lớp mới và import danh sách (cột: MSSV, Họ tên, Lớp).
   - Số sinh viên cần gọi N: slider và ô nhập, từ 1 đến số SV khả dụng.
   - Thời lượng màn chạy: random trong khoảng 30–60s (mặc định) hoặc cố định một giá trị trong khoảng đó.
   - Tỉ lệ thoát túi p: 0–50%, mặc định 20%.
   - Tuỳ chọn "Không gọi lại người đã được gọi trong buổi này" (mặc định bật).
   - Âm thanh bật/tắt, chế độ giảm chuyển động (reduce motion).
   - Nút lớn "GARGAMEL XUẤT KÍCH!".
2. Màn Rượt đuổi (Phaser, chi tiết bên dưới). Có nút "Bỏ qua" để tua thẳng tới kết quả.
3. Màn Kết quả: túi của Gargamel mở ra, lần lượt hiện thẻ tên từng SV bị bắt (MSSV, họ tên đầy đủ,
   số thứ tự). Có các nút: Sao chép danh sách, Gọi tiếp, Gọi lại từ đầu, Xem lịch sử.
   Lưu kết quả vào DB.

# THUẬT TOÁN RANDOM — CÔNG BẰNG VÀ CÓ THỂ KIỂM CHỨNG
- Dùng crypto.getRandomValues (client) hoặc crypto.randomInt (server). KHÔNG dùng Math.random
  cho việc chọn người.
- Trước khi chạy animation, sinh sẵn toàn bộ "kịch bản sự kiện" (event script) bằng RNG:
    pool = danh sách SV khả dụng; caught = []
    lặp cho tới khi caught đủ N:
      chọn đều ngẫu nhiên 1 SV trong pool, sinh sự kiện CATCH(sv, t)
      với xác suất p (và nếu còn quỹ thời gian): sinh ESCAPE(sv, t + Δ) và trả sv về pool
      ngược lại: chuyển sv sang caught
  Mỗi lần chọn đều đồng xác suất nên kết quả cuối vẫn là tập con N phần tử ngẫu nhiên đều.
  Twist thoát túi chỉ ảnh hưởng tới diễn biến, không làm lệch xác suất.
- Giới hạn tổng số lần thoát (ví dụ tối đa ceil(N/2) + 1) để vừa thời lượng.
- Phân bổ mốc thời gian: lần bắt đầu tiên sau khoảng 15–25% thời lượng. Các lần bắt rải đều có
  dao động. Lần bắt cuối cùng nằm trong 3–6 giây cuối để tạo cao trào.
- Lưu seed và event script vào lịch sử để có thể phát lại (replay) đúng y hệt.
- Viết unit test (Vitest): phân phối đều qua 100k lần mô phỏng (chi-square), luôn ra đúng N người,
  không trùng người, tôn trọng tuỳ chọn loại trừ người đã gọi.

# MÀN RƯỢT ĐUỔI (phần quan trọng nhất)
## Bố cục và camera
- Side-scrolling ngang. Đàn xì trum chạy sang phải, Gargamel đuổi từ bên trái.
  Camera bám theo đàn, Gargamel thường ở mép trái 1/4 màn hình và lao lên khi chộp.
- Parallax 5 lớp, tile ngang liền mạch:
  L0 bầu trời và mây (chậm nhất)
  L1 toà nhà chính SGU vẽ lại theo phong cách làng xì trum (xem Phần B), xuất hiện như cột mốc
     và lặp lại theo chu kỳ
  L2 cây cổ thụ, nhà nấm, hàng rào gỗ, ghế đá sân trường
  L3 mặt đường chạy (sân gạch hoặc đường đất) có chướng ngại vật
  L4 tiền cảnh: cỏ, hoa, lá lướt nhanh, có thể che nhẹ nhân vật
- Thanh tiến trình thời gian dạng cuộn giấy da ở góc trên. Bộ đếm "Đã bắt: x/N". Biểu tượng túi rung
  mỗi khi có xì trum bên trong.

## Xì trum (sinh viên)
- Trên màn hình chỉ render tối đa khoảng 14 xì trum cùng lúc (cấu hình được). Nếu lớp đông, đàn
  được thay phiên: xì trum chạy vượt khỏi khung bên phải và xì trum mới chạy vào. Mọi SV sẽ bị bắt
  theo kịch bản phải có mặt trên màn hình ít nhất vài giây trước khi bị bắt.
- Tên gắn trên mũ: nhãn vải hoặc băng rôn nhỏ trên mũ trắng, hiển thị TÊN GỌI (từ cuối của họ tên
  tiếng Việt). Nếu trùng tên trong lớp, thêm 2 số cuối MSSV. Font hỗ trợ tiếng Việt đầy đủ dấu
  (Baloo 2 hoặc Be Vietnam Pro, nhúng local). Chữ có viền để đọc được trên mọi nền.
- Đa dạng ngoại hình bằng phụ kiện: kính, sách, balo, bút chì, huy hiệu logo SGU nhỏ.
  Có tint nhẹ để phân biệt nhưng vẫn giữ màu xanh xì trum.
- State machine mỗi xì trum: RUN → (TRIP → FALL → GETUP) → RUN → CAUGHT → IN_BAG → (ESCAPE → RUN).
- Tốc độ: mỗi con có baseSpeed riêng cộng nhiễu Perlin, giúp đàn co giãn, vượt nhau, tụt lại
  một cách tự nhiên.

## Nhịp độ hồi hộp (tension curve)
- Tốc độ toàn cảnh tăng giảm theo "nhịp": có đoạn dồn dập, có đoạn thả chậm.
  Ngay trước mỗi lần chộp thì tăng tốc, zoom camera nhẹ, nhạc dồn trống.
- Con mục tiêu tiếp theo được kịch bản hoá từ từ tụt về phía sau, hoặc vấp chướng ngại vật,
  để Gargamel bắt kịp. Phải trông tự nhiên, không được lộ trước quá sớm (≥ 2–3 giây).
- Thỉnh thoảng có "pha hụt": Gargamel vồ trượt, ngã chúi, hoặc chính lão vấp rễ cây.
  Pha hụt chỉ để tạo kịch tính, không ảnh hưởng kết quả.
- Slow-motion khoảng 0.5s ở khoảnh khắc túi chụp xuống. Hiện chữ nổi tên SV
  "BẮT ĐƯỢC <Tên>!" với hiệu ứng pop.

## Chướng ngại vật
- Rễ cây, hòn đá, cây nấm, vũng nước, xô gỗ, cọc hàng rào đổ. Spawn theo nhịp, không spawn sát
  nhau quá.
- Xì trum chạm chướng ngại có xác suất vấp: hiện sao xoay quanh đầu, ngã, lồm cồm bò dậy.
  Có xác suất nhảy qua thành công. Chướng ngại vật cũng là "đạo cụ" để kịch bản cho mục tiêu
  bị chậm lại.

## Twist thoát túi
- Sự kiện ESCAPE: túi phồng và giãy (squash and stretch), Gargamel loạng choạng, xì trum bật ra
  theo đường parabol, phủi bụi rồi chạy tiếp. Hiện chữ "THOÁT RỒI!" và Gargamel giậm chân tức giận.
- Con đã thoát có thể bị bắt lại sau, đúng theo kịch bản.

## Âm thanh
- Chép reference/audio/*.mp3 vào public/assets/audio/ và khai báo trong manifest:
  Menu_loop cho màn Setup. Màn rượt đuổi random một trong Music_Forest, Music_Plain hoặc
  Music_Mountain. Tăng playbackRate nhẹ (1.0 → 1.1) ở 10 giây cuối.
  Mỗi lần bắt được phát Jingle_Level_Up ngắn (âm lượng thấp, có thể cắt 1–2s đầu).
  Mỗi lần xì trum thoát túi phát Jingle_Save_Activation.
  Màn kết quả phát Jingle_EndOfRun_Win, rồi chuyển sang Music_OffGame.
- SFX còn thiếu (bước chạy, vấp, "phụp" vào túi, bật ra, tiếng cười Gargamel) lấy từ nguồn
  royalty-free hoặc tổng hợp bằng WebAudio. Ghi nguồn trong CREDITS.md.

# ASSET VÀ PLACEHOLDER
- Toàn bộ asset là 2D raster (PNG nền trong suốt) đóng gói thành texture atlas.
  Khai báo trong public/assets/manifest.json gồm key, đường dẫn, kích thước frame, số frame, fps,
  anchor.
- QUAN TRỌNG: khi chưa có asset thật, game PHẢI chạy được với placeholder vẽ bằng Phaser Graphics
  (xì trum = thân tròn xanh + mũ trắng, Gargamel = hình đen + giày đỏ, túi = hình nâu).
  Thay asset thật chỉ cần thả file đúng tên vào thư mục và cập nhật manifest, không cần sửa code.
- Spec sprite (khung vuông, nhân vật đứng giữa đáy khung, anchor (0.5, 1)):
  smurf_run 8f, smurf_trip 6f, smurf_getup 4f, smurf_jump 5f, smurf_struggle 4f,
  smurf_escape_pop 5f, mỗi frame 256x256.
  Mũ tách thành layer riêng (smurf_hat) để gắn nhãn tên và lắc theo nhịp chạy.
  gargamel_run 8f, gargamel_lunge 6f, gargamel_miss_fall 6f, gargamel_angry 4f, mỗi frame 512x512.
  bag_idle 1f, bag_wriggle 6f, bag_open 4f.
  Background: các layer rộng 3840x1080, tile ngang liền mạch.
- Game Smurfs Epic Run là game 3D, hình ảnh đã mã hoá, nên KHÔNG có sprite 2D để lấy ra.
  Sprite 2D vẽ mới theo Phần B. Nhân vật giữ đúng hình tượng Xì Trum và Gargamel của Peyo.

# YÊU CẦU PHI CHỨC NĂNG
- 60 FPS ổn định trên PC phòng học cấu hình thấp (Intel iGPU) ở 1920x1080.
  Scale responsive theo tỉ lệ 16:9 (letterbox).
- Có nút toàn màn hình (Fullscreen API). Phím tắt: Space để bắt đầu, S để bỏ qua, M để tắt tiếng.
- Toàn bộ giao diện tiếng Việt.
- Chế độ reduce motion: tắt rung, slow-mo và giảm parallax.
- API (Fastify, validate bằng zod hoặc TypeBox):
  GET/POST/DELETE /api/classes, POST /api/classes/:id/import,
  GET /api/classes/:id/students, POST /api/draws (lưu seed, script, kết quả),
  GET /api/draws?classId=. Tuỳ chọn bảo vệ các route ghi bằng mật khẩu giảng viên
  (biến môi trường ADMIN_PASSWORD).
- Có dữ liệu mẫu: 1 lớp gồm 40 SV tên tiếng Việt giả lập.
- Code sạch, chia module rõ ràng. ESLint và Prettier. README hướng dẫn cài đặt, chạy, thay asset,
  deploy.

# CÁCH LÀM VIỆC
Làm theo các mốc, mỗi mốc phải chạy được trước khi sang mốc sau:
  M1: Khung monolith (server, client, build, DB, import CSV/XLSX, màn Setup).
  M2: Thuật toán random, event script và unit test.
  M3: Màn rượt đuổi với placeholder: parallax, đàn chạy, Gargamel, bắt, thoát, vấp,
      tension curve, timeline 30–60s khớp kịch bản.
  M4: Màn kết quả, lịch sử, replay.
  M5: Nạp asset thật qua manifest, âm thanh, polish hiệu ứng (squash/stretch, particle bụi,
      screen shake nhẹ).
Cuối mỗi mốc, liệt kê file đã tạo hoặc sửa và cách kiểm tra.

# TIÊU CHÍ NGHIỆM THU
- Chọn N = 5, p = 30% → màn chạy kéo dài trong khoảng 30–60s, có ít nhất 1 pha thoát túi (khi p > 0
  và đủ thời gian), kết thúc với đúng 5 SV khác nhau. Kết quả khớp với lịch sử lưu trong DB.
- Replay một lượt cũ cho ra đúng diễn biến và đúng kết quả.
- Tên tiếng Việt có dấu hiển thị đúng và đọc rõ trên mũ từ cuối lớp học.
- Không có lỗi console. Chạy offline được sau khi build.
```

---

## PHẦN B — Prompt sinh asset 2D (dán cho model sinh ảnh)

Dùng chung phần **Style chung** ở đầu mỗi prompt để các asset đồng bộ. Nếu công cụ hỗ trợ ảnh tham chiếu (image-to-image hoặc style reference), đính kèm `sgu.jpg` cho background và `style.jpg`/`style2.jpg` làm style reference.

### Style chung (prefix)

```text
2D hand-drawn Franco-Belgian comic style (ligne claire), thick clean black ink outlines,
flat vibrant colors with simple cel shading, cheerful whimsical fairy-tale village mood,
similar to classic European comic illustrations of a mushroom village.
Original artwork, no logos or watermarks, no text unless specified.
```

### B1. Background toà nhà chính SGU (layer L1)

```text
[Style chung]
Redraw the attached photo of Saigon University's main building as a 2D cartoon background,
KEEP THE EXACT ARCHITECTURE: symmetrical two-story French colonial building, warm yellow walls
with white trim, red clay tile hip roofs, central bay with a small clock tower and square red-tiled cap,
round clock face, arched ground-floor windows and doors with striped arch decorations,
green wooden louvered shutters, small balustrade balconies on the second floor,
round blue emblem on the central gable, central entrance with a sign.
Transform only the STYLE into a magical mushroom-village look: slightly wobbly hand-drawn lines,
softly rounded proportions, a few giant colorful mushrooms (red with white dots, blue, orange)
growing beside the building, small wooden fences, wildflowers, a stone well in the yard,
the big old banyan trees on both sides drawn as storybook trees with twisting roots.
Flat side view (orthographic, eye-level), building centered, sunny afternoon, light blue sky.
Wide panorama 3840x1080, transparent sky (only building + nearby props),
left and right edges must tile seamlessly.
```

Sau khi có ảnh, cắt thành các layer riêng: bầu trời (L0), toà nhà (L1), cây và nhà nấm (L2), mặt đất (L3), tiền cảnh (L4).

### B2. Các layer còn lại

```text
[Style chung]
Seamless horizontally tileable 2D side-scrolling game layer, 3840x1080, transparent background.
(a) L0: soft blue sky with puffy cartoon clouds and distant forest silhouette.
(b) L2: row of storybook trees, colorful mushroom houses with wooden doors and chimneys,
    wooden fences, stone benches like a university courtyard.
(c) L3: running path of warm red-orange courtyard bricks blending into a dirt path, grass edges.
(d) L4: foreground tall grass, daisies, ferns, leaves (only bottom 25% of the image filled).
```

### B3. Sprite sheet xì trum sinh viên

```text
[Style chung]
A classic Smurf in Peyo's comic style: tiny blue-skinned character, about 3 apples tall,
big round nose, white floppy phrygian cap, white trousers with a small tail, white shoes,
cheerful face, with a small round blue university badge on the trousers.
Running pose reference: attached epic-run-icon.png (dynamic, leaning forward, knees high).
Sprite sheet, side view facing right, transparent background, each frame 256x256,
character bottom-centered, consistent size across frames, frames in a single row:
- run cycle 8 frames (panicked happy running, arms swinging)
- trip and fall 6 frames (stumbling over a root, falling face down, stars around head)
- get up 4 frames
- jump 5 frames
- struggling (held by the back) 4 frames
- popping out of a sack 5 frames (flying arc, landing, brushing off dust)
Also export the cap as a separate layer with an empty fabric name label area on the front.
Variations: glasses, small backpack, book under arm, pencil behind ear.
```

### B4. Sprite sheet Gargamel (phù thủy)

```text
[Style chung]
Gargamel in Peyo's comic style (see attached gargamel.jpg): tall skinny bald old wizard with
a few strands of black hair, large hooked nose, bushy eyebrows, bad teeth, long shabby black robe
with patches, oversized bright red shoes, holding an open brown burlap sack, comically evil grin. Side view facing right, transparent background, frames 512x512,
bottom-centered, single row per animation:
- run 8 frames (hunched, long strides, sack swinging)
- lunge and grab with sack 6 frames
- miss and fall face-first 6 frames
- angry stomp 4 frames
```

### B5. Túi, chướng ngại vật, UI

```text
[Style chung]
Transparent background game assets, each on its own 512x512 canvas:
- brown burlap sack: idle, wriggling (6 frames with bulges shaped like small figures), opening (4 frames)
- obstacles: twisted tree root arching out of the ground, mossy rock, small red-white-dot mushroom,
  muddy puddle, tipped wooden bucket, fallen fence post
- UI: parchment scroll progress bar, wooden sign button, star burst, dust puff particles,
  "speed lines" effect
```

### Mẹo khi sinh asset

- Một số model sinh ảnh từ chối khi prompt có tên nhân vật có bản quyền ("Smurf", "Gargamel", "Peyo"). Khi đó, bỏ tên riêng, giữ nguyên phần mô tả ngoại hình, và đính kèm ảnh tham khảo (`gargamel.jpg`, `epic-run-icon.png`, `style.jpg`) làm style/character reference.
- Sinh từng animation riêng rồi ghép lại bằng TexturePacker hoặc free-tex-packer. Giữ nhân vật cùng kích thước và cùng điểm chạm đất ở mọi frame.
- Model sinh ảnh thường vẽ sprite sheet không đều. Cách ổn hơn: sinh 1 tư thế chuẩn, dựng animation bằng Spine hoặc DragonBones (cắt rời tay, chân, mũ), rồi xuất ra frame PNG.
- Muốn giữ đúng kiến trúc SGU, dùng image-to-image hoặc ControlNet (lineart/canny) từ `sgu.jpg` với độ biến đổi vừa phải (khoảng 0.5–0.65).
