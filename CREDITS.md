# Ghi nguồn

Dự án học tập và giải trí nội bộ của Trường Đại học Sài Gòn, **phi thương mại**.

- **Xì Trum (The Smurfs) và Gargamel** © Peyo / IMPS. Ý tưởng "phù thủy bắt xì trum" lấy cảm hứng từ truyện của Peyo.
- **Nhạc nền và jingle** (`public/assets/audio/`) trích từ game *Smurfs Epic Run* © Ubisoft. Các file gồm: Menu_loop, Music_Forest, Music_Plain, Music_Mountain, Music_Ice, Music_King_Smurf, Music_OffGame, Jingle_Level_Up, Jingle_Save_Activation, Jingle_EndOfRun_Win, Jingle_EndOfRun_Lose.
- **Hình ảnh** (nền làng nấm với toà nhà chính SGU, nhân vật sinh viên đội mũ nấm, phù thủy, túi, chướng ngại vật, hiệu ứng, UI) do model vẽ asset tạo trong thư mục `art/`. Đây là hình vẽ mới, nhập vào game qua `scripts/import-art.mjs`.
- **Hình dự phòng** (`src/client/game/art/`) được vẽ thủ tục bằng Canvas 2D trong code của dự án.
- **Hiệu ứng âm thanh** (bước chạy, vấp, "phụp" vào túi, bật ra, tiếng cười, trống dồn) được tổng hợp bằng WebAudio, không dùng file ngoài.
- **Phông chữ**: Baloo 2 (Ek Type) và Be Vietnam Pro (Lâm Bảo, Tony Le, ViệtAnh Nguyễn) theo giấy phép SIL Open Font License 1.1. Phông được nhúng cục bộ qua gói `@fontsource`.
- **Thư viện**: Phaser 3 (MIT), Fastify (MIT), better-sqlite3 (MIT), zod (MIT), SheetJS Community Edition (Apache-2.0), Vite (MIT).
- **Tham khảo cảm giác chơi**: gamevui.vn "Xì Trum thám hiểm" và *Smurfs Epic Run* (Ubisoft).
