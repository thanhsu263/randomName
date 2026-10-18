# HANDOFF — Gargamel bắt Xì Trum SGU

Cập nhật: 2026-10-18. Đọc file này trước khi làm tiếp.
Đặc tả gốc: `PROMPT.md` (Phần A: website, Phần B: asset). Yêu cầu đợt 2 ("dùng asset trong `art/`") được dán trong chat, tóm tắt ở mục 3.

## 1. Trạng thái nhanh

| Hạng mục | Trạng thái |
|---|---|
| `npm run typecheck` | ✅ qua |
| `npm test` (Vitest, 23 test: chi-square 100k, đúng N, không trùng, loại trừ, API, roster) | ✅ qua |
| `npm run build` → `dist/server.js` + `dist/public` | ✅ qua, đã smoke-test bản production phục vụ asset |
| `npm run lint` | ✅ qua |
| `npm run import:art` | ✅ chạy lại từ đầu, manifest sinh lại giống hệt (đã so 0 khác biệt) |
| README.md, CREDITS.md, Dockerfile | ✅ đã viết; image build và chạy thử OK (426 MB) |
| Báo cáo đợt 2 | ✅ `docs/BAO-CAO-DOT-2.md` |
| Git | Thư mục chưa phải git repo; chưa commit gì |

Mốc theo đặc tả gốc: M1–M4 xong. M5 (asset thật, âm thanh, polish) phần lớn xong. Tài liệu và Dockerfile đã có.

## 2. Kiến trúc (đã có)

- **Server** `src/server/`: Fastify + better-sqlite3 + zod. `app.ts` chứa routes, `repo.ts` truy cập DB, `db.ts` migrations, `sampleData.ts` lớp mẫu 40 SV. Server tự sinh seed (crypto) và kịch bản rồi lưu. `ADMIN_PASSWORD` bảo vệ route ghi qua header `x-admin-password`. Dev chạy cổng 3000 (`--port=3000`), Vite chạy 5173 và proxy `/api/`.
- **Shared** `src/shared/`: `rng.ts` (ChaCha20 + Noise1D), `script.ts` (thuật toán công bằng + event script + `verifyScript`), `roster.ts` (đọc CSV/XLSX/text, nhãn tên trùng thì thêm 2 số cuối MSSV), `types.ts`.
- **Client** `src/client/`: `app.ts` điều phối màn hình. `screens/` gồm setup, result, history, importDialog. `audio/AudioManager.ts` phát nhạc MP3 gốc và tổng hợp SFX bằng WebAudio. `ui/` gồm dom, modal, art.ts (cắt frame bằng CSS) và gallery.ts (`/?gallery`).
- **Game** `src/client/game/`: `GameHost.ts`, `scenes.ts` (Boot, Chase, HUD), `Director.ts` (biến kịch bản thành cue), `actors/Smurf.ts`, `actors/Gargamel.ts`, `world/Parallax.ts`, `world/Obstacles.ts`, `fx.ts`, `assets.ts` (registry + fallback thủ tục), `config.ts`, `art/*` (bản vẽ thủ tục, chỉ dùng làm fallback).
- Mô phỏng chạy theo bước cố định 1/60 s. Mọi random hình ảnh lấy từ ChaCha luồng 1/2 của seed, nên replay ra đúng diễn biến. Kết quả chỉ phụ thuộc script đã lưu.

## 3. Đợt 2: dùng asset `art/` (đã làm)

- `scripts/import-art.mjs` (`npm run import:art`) chép `art/` sang `public/assets/{bg,sprites,obstacles,fx,ui}` và **sinh** `manifest.json` từ `art/sprites/*.json`. Script không sửa `art/`.
  - Kid thay `smurf_*` (giữ nguyên key trong code). Mỗi sprite có `variants` (base/glasses/backpack/book/pencil) và `headTrack` lấy từ `label` (độ đã đổi sang rad). Các thông số khác: `labelOffset [0,0]`, `dyTrack`, `gripTrack`, `bakedHat`, `noTint`, anchor `[0.5, 250/256]`.
  - Wizard thay `gargamel_*`. `handTrack` lấy từ `sackMouth` (khung `sackFull` dùng lại vị trí khung trước), kèm `bagInHand`, `sackFull`, `slamFrame` (=4), `sackRadius`, anchor `[0.5, 500/512]`.
  - Túi: cắt khung 512 về 256. `grip` tính tự động từ bbox alpha.
  - Obstacles có `anchor` và `hitbox`. FX `fx_dust` (4 khung), `fx_star`←starburst, `fx_speed`←speedlines (3 khung). UI `ui_scroll*`, `ui_button*` có `bbox`, `track`, `label`.
- Code:
  - `assets.ts`: AnimDef có thêm variants, real, labelOffset, bakedHat, noTint, bagInHand, sackFull, slamFrame, frameW/H. Placeholder thủ tục chỉ sinh khi thiếu file.
  - `Smurf.ts`: chọn texture theo biến thể. Với art thật thì tắt tint, mũ rời, phụ kiện, mồ hôi và sao vẽ bằng code. Anchor đọc từ manifest. Nhãn neo theo headTrack, so le theo làn (`LABEL_LANE_STAGGER`). Frame pop/dust đúng nghĩa kid_pop. Khi bị chộp chỉ nghiêng nhẹ, vẽ đè lên wizard.
  - `Director.ts`: biến thể xoay vòng từ điểm ngẫu nhiên, nên 5 người đầu đủ 5 biến thể (đã kiểm). Va chạm dùng hitbox. Vồ hụt truyền `miss=true` để không hiện khung túi đầy.
  - `Gargamel.ts`: `catchFrame` = slamFrame−1 với art thật. Giữ khung miệng túi mở `CATCH_HOLD` = 0.3 s trong lúc xì trum bay vào. Ẩn túi rời. Khi `bagCount>0` (trừ lúc vồ và khung sackFull), đè `bag_wriggle` lên miệng túi, xoay theo facing, cỡ 4.1·r. `bagMouth()` và `reach` lấy từ sackMouth.
  - `Obstacles.ts`: anchor, scale và hitbox theo manifest. `aim.x` là vị trí mép trái hitbox.
  - `fx.ts`: sprite nhiều khung, starburst, overlay vệt tốc độ.
  - HUD (`scenes.ts`): thanh thời gian ghép từ `ui_scroll` (nine-slice), `ui_scroll_fill`, `ui_scroll_marker`. Bảng đếm dùng `ui_button`.
  - `config.ts`: `LANES [988,1010,1032]`, `SMURF_SCALE 0.95` (kid ≈166 px), `GARG_SCALE 0.83` (wizard ≈390 px, ≈2.35 lần kid), `GARG_Y 1034`, `OBSTACLE_SCALE 0.5`, `LABEL_FONT_SIZE 38`, maxVisible mặc định **11** (trước là 14, giảm vì nhãn chồng nhau).
  - DOM: `ui/art.ts` có `spriteEl` / `setSpriteFrame` cắt frame bằng CSS. Setup dùng wizard_stomp và kid_run. Kết quả dùng sack_wriggle → sack_open, wizard_stomp, kid_pop trên thẻ. Gallery hiển thị asset thật.
- **Lỗi canvas 0x0 / màn đen**: `GameHost` thêm ResizeObserver trên `#game`, chỉ refresh khi parent >0, và refresh lại sau khung hình khi `run()`. `nextFrame` có timeout 60 ms phòng khi rAF bị dừng. Đã kiểm ở 1920x1080, cửa sổ hẹp 557x849 và khi đổi cỡ giữa lượt.
- Ảnh báo cáo: `docs/screenshots/01-dang-chay.jpg`, `02-luc-chop.jpg`, `03-thoat-tui.jpg`, `04-ket-qua.jpg`. Ảnh 04 chụp trước khi phóng to hình kid trên thẻ, nên chụp lại.

## 3b. Tính năng thêm 2026-10-18: ẩn thanh thời gian

- `Settings.hideTimer` (mặc định `false`) có ô tích ở màn Setup. Giá trị được truyền qua `ChaseData.hideTimer` → `HudData.hideTimer`.
- HUD ghi lại các đối tượng tạo từ đầu `create()` tới `timeText` (cuộn giấy, thanh đầy, nấm đánh dấu, chữ "còn … giây"), ẩn chúng, rồi tháo tham chiếu `fill`/`marker`/`bar` để `update()` bỏ qua. Bảng "Đã bắt x/N" vẫn hiện. Logic cũ không đổi.

## 3c. Chuyển sang Vercel + Turso (2026-10-18)

- Thay `better-sqlite3` bằng `@libsql/client`. `db.ts` mở `file:` cục bộ, `:memory:`, hoặc Turso (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`), xem `dbConfigFromEnv()`. Migration chạy lặp lại an toàn (bảng `schema_version`), và tương thích file DB cũ.
- `repo.ts` chuyển hết sang async. Thao tác nhiều câu chạy bằng `db.batch(..., 'write')`. `startOfTodayVN()` tính "buổi mới mỗi ngày" theo giờ Việt Nam, không theo múi giờ máy chủ.
- `src/vercel/handler.ts` là Vercel Function bọc Fastify (route `/api/*` → `/api?__p=*`, hàm `restoreUrl` khôi phục URL gốc).
- `scripts/build-vercel.mjs` (lệnh `npm run build:vercel`) tạo `.vercel/output` theo Build Output API v3, bundle API bằng `@libsql/client/web` (không module native). `vercel.json` khai báo lệnh build.
- Đã kiểm thử: bundle chạy với libsql-server cục bộ (Docker) qua HTTP; bản `npm start` đọc được `data/app.db` cũ; Docker image chạy được. **Chưa deploy thật lên Vercel/Turso** vì cần tài khoản của chủ dự án; làm theo DEPLOY.md.

## 4. VIỆC CÒN LẠI

1. (Đã xong) Docker: image build và chạy được. Stage build cài python3/make/g++ để biên dịch better-sqlite3. Lúc build cần mạng vì `xlsx` tải từ cdn.sheetjs.com.
2. Kiểm tra thủ công khi pane trình duyệt hiển thị thật: âm thanh, phím Space/S/M/F, toàn màn hình, phát lại từ màn Lịch sử, nút "Gọi tiếp".
3. Chờ model vẽ `wizard_run_full` (xem mục 6). Khi có file thì thêm vào `import-art.mjs` và cho `renderBagInHand` dùng sheet đó thay cho việc đè túi.
4. Tuỳ chọn polish: nhãn tên vẫn hơi dày khi nhiều người chạy sát nhau.
5. Thư mục chưa là git repo. Nếu khởi tạo git, nhớ loại `*.xapk` (393 MB, đã có trong `.gitignore`).

## 5. File đã sửa/tạo ở đợt 2

`scripts/import-art.mjs`, `package.json` (script `import:art`), `public/assets/manifest.json` (sinh tự động), `public/assets/{bg,sprites,obstacles,fx,ui}/*`,
`src/client/game/{assets.ts,config.ts,fx.ts,GameHost.ts,scenes.ts,Director.ts}`, `src/client/game/actors/{Smurf.ts,Gargamel.ts}`,
`src/client/game/world/{Obstacles.ts,Parallax.ts}`, `src/client/ui/{art.ts,gallery.ts}`, `src/client/screens/{setup.ts,result.ts}`,
`src/client/{main.ts,state.ts,styles.css}`, `docs/screenshots/*`.

## 6. Cần model vẽ bổ sung (ghi vào báo cáo)

- **`wizard_run_full`**: wizard chạy, tay cầm túi đã buộc và có người bên trong giãy. Hiện code đang đè `bag_wriggle` lên túi mở nên vẫn lộ vành túi. Nên vẽ thêm `wizard_stomp_full` và `wizard_fall_full` tương tự.
- Tuỳ chọn: miếng vải tên trên mũ kid (52x20 px) quá nhỏ cho máy chiếu nên code vẫn dùng băng rôn riêng. Nếu muốn dùng patch vẽ sẵn thì cần vẽ to gấp khoảng 3 lần.
- `kid_*_cap.png` chưa dùng.

## 7. Mẹo kiểm thử trong môi trường agent

- Pane trình duyệt thường bị ẩn, khi đó rAF dừng và game đứng hình. Đây không phải lỗi app. Ở chế độ dev có `window.__game` (Phaser.Game) và `window.__app` (App).
- Muốn chụp một khoảnh khắc: `__game.loop.sleep()` rồi lặp `__game.step(now += 16.667, 16.667)` tới khi `__game.scene.getScene('chase').t >= T`, sau đó `__game.renderer.snapshot(img => …)`. Tween dùng `Date.now()`, nên phải tăng đồng hồ ảo, ví dụ monkeypatch `Date.now` cộng thêm 16.667 mỗi bước. Nếu không, chữ HUD sẽ không biến mất.
- Bỏ qua chế độ giả lập viewport 1920x1080 của pane: ảnh chụp bị co lỗi. Nên chụp snapshot canvas rồi phóng to bằng CSS.
- Muốn thử fallback: sao lưu manifest, đặt mọi `path` = null, tải lại trang, rồi chạy lại `npm run import:art` để khôi phục.
- `.claude/launch.json` có cấu hình `dev` (npm run dev, cổng 5173).
