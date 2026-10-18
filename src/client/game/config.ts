// Hằng số bố cục và cân chỉnh của màn rượt đuổi (toạ độ logic 1920x1080).
export const W = 1920;
export const H = 1080;
/** Bước mô phỏng cố định (giây) — giúp phát lại xác định, không phụ thuộc FPS. */
export const STEP = 1 / 60;

/**
 * Toạ độ chân của 3 làn chạy (xa → gần). Khớp dải gạch/đất của nền bg_l3
 * (mép cỏ ~y 930, mặt đường ~y 965–1080; cỏ tiền cảnh bg_l4 che nhẹ từ ~y 1045).
 */
export const LANES = [988, 1010, 1032];
export const LANE_SCALE = [0.95, 0.975, 1];
/** Tỉ lệ hiển thị so với khung 256 → kid (~175 px trong khung) cao ≈ 166 px. */
export const SMURF_SCALE = 0.95;
/** Tỉ lệ hiển thị so với khung 512 → wizard (~470 px trong khung) cao ≈ 390 px ≈ 2.35 lần kid. */
export const GARG_SCALE = 0.83;
export const GARG_Y = 1034;
/** Tỉ lệ chướng ngại vật thật (khung 512) — cùng thang với vật cản mặt đường. */
export const OBSTACLE_SCALE = 0.5;
/** Tỉ lệ chướng ngại vật vẽ thủ tục (khung 220x160). */
export const OBSTACLE_SCALE_PROC = 0.62;
export const OBSTACLE_Y = 1000;
export const GARG_BASE_X = 330;
/** Vị trí (x) mục tiêu bị chộp. */
export const CATCH_X = 720;
export const HERD_MIN = 850;
export const HERD_MAX = 1830;
/** Tốc độ cuộn nền cơ bản (px/s ở layer mặt đường). */
export const BASE_SPEED = 520;
export const DEFAULT_MAX_VISIBLE = 11;

export const LABEL_FONT_SIZE = 38;
/** Băng rôn tên của làn xa được nâng cao hơn để không chồng lên làn gần (px mỗi làn). */
export const LABEL_LANE_STAGGER = 24;
export const FONT_DISPLAY = '"Baloo 2", "Be Vietnam Pro", sans-serif';

export const DEPTH = {
  sky: 0,
  clouds: 1,
  hills: 2,
  l1: 3,
  l2: 4,
  ground: 5,
  obstacle: 6,
  actors: 10, // + y
  fx: 1500,
  fg: 2000,
  labels: 2500,
  pop: 3000,
};
