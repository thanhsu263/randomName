// Parallax 5 lớp, cuộn ngang liền mạch:
// L0 trời + mây + đồi xa · L1 toà nhà SGU (cột mốc, lặp theo chu kỳ) + cây/nhà xa
// L2 cây cổ thụ, nhà nấm, hàng rào, ghế đá · L3 mặt đường · L4 tiền cảnh cỏ hoa
import Phaser from 'phaser';
import type { ChaChaRng } from '@shared/rng';
import type { AssetRegistry } from '../assets';
import { DEPTH, H, W } from '../config';

interface Item {
  img: Phaser.GameObjects.Image;
  x: number; // toạ độ trong hệ của layer
  w: number;
}

class PropTrack {
  items: Item[] = [];
  offset = 0;
  nextX: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly factor: number,
    private readonly depth: number,
    startX: number,
    private readonly gen: (x: number) => { key: string; y: number; scale: number; gap: number; alpha?: number; flip?: boolean },
  ) {
    this.nextX = startX;
    this.fill();
  }

  private fill() {
    while (this.nextX < this.offset + W + 600) {
      const g = this.gen(this.nextX);
      const img = this.scene.add.image(0, g.y, g.key).setOrigin(0.5, 1).setScale(g.scale).setDepth(this.depth);
      if (g.alpha !== undefined) img.setAlpha(g.alpha);
      if (g.flip) img.setFlipX(true);
      const w = img.displayWidth;
      this.items.push({ img, x: this.nextX + w / 2, w });
      this.nextX += w + g.gap;
    }
  }

  update(dx: number) {
    this.offset += dx * this.factor;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const sx = it.x - this.offset;
      if (sx + it.w / 2 < -40) {
        it.img.destroy();
        this.items.splice(i, 1);
      } else it.img.x = sx;
    }
    this.fill();
  }
}

export class Parallax {
  private readonly tiles: { ts: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  private readonly tracks: PropTrack[] = [];

  constructor(scene: Phaser.Scene, assets: AssetRegistry, rng: ChaChaRng, reduceMotion: boolean) {
    const bg = assets.manifest.backgrounds;
    const rm = reduceMotion ? 0.5 : 1;
    const f = (key: string, def: number) => (bg[key]?.scroll ?? def) * (key === 'bg_l3' ? 1 : rm);
    const fullTile = (key: string, depth: number) => {
      const tex = scene.textures.get(key).getSourceImage();
      const ts = scene.add.tileSprite(0, 0, W, H, key).setOrigin(0, 0).setDepth(depth);
      ts.setTileScale(H / tex.height);
      this.tiles.push({ ts, factor: f(key, 1) });
    };

    // L0
    if (assets.hasReal('bg_l0')) fullTile('bg_l0', DEPTH.clouds);
    else {
      scene.add.image(0, 0, 'bg_sky').setOrigin(0, 0).setDisplaySize(W, H).setDepth(DEPTH.sky);
      const clouds = scene.add.tileSprite(0, 30, W, 420, 'bg_clouds').setOrigin(0, 0).setDepth(DEPTH.clouds);
      const hills = scene.add.tileSprite(0, 470, W, 380, 'bg_hills').setOrigin(0, 0).setDepth(DEPTH.hills);
      this.tiles.push({ ts: clouds, factor: f('bg_l0', 0.06) * 0.6 }, { ts: hills, factor: f('bg_l0', 0.06) * 1.6 });
    }

    // L1: toà nhà SGU làm cột mốc, xuất hiện lặp lại theo chu kỳ
    if (assets.hasReal('bg_l1')) fullTile('bg_l1', DEPTH.l1);
    else {
      const PERIOD = 4300;
      let nextBuilding = 380;
      const far = ['prop_tree_far', 'prop_house_red_far', 'prop_banyan_far', 'prop_house_blue_far'];
      this.tracks.push(
        new PropTrack(scene, f('bg_l1', 0.22), DEPTH.l1, -200, (x) => {
          if (x >= nextBuilding - 60) {
            nextBuilding += PERIOD;
            return { key: 'prop_sgu', y: 836, scale: 0.72, gap: 40 + rng.float() * 80 };
          }
          const key = rng.pick(far);
          return {
            key,
            y: 838,
            scale: 0.42 + rng.float() * 0.18,
            gap: Math.max(-30, Math.min(rng.range(-30, 160), nextBuilding - x - 300)),
            flip: rng.chance(0.5),
          };
        }),
      );
    }

    // L2: cây cổ thụ, nhà nấm, hàng rào, ghế đá sân trường
    if (assets.hasReal('bg_l2')) fullTile('bg_l2', DEPTH.l2);
    else {
      const kinds: [string, number, number, number][] = [
        // key, trọng số, scale min, scale max
        ['prop_banyan', 0.16, 0.7, 0.85],
        ['prop_tree', 0.18, 0.6, 0.75],
        ['prop_house_red', 0.07, 0.62, 0.72],
        ['prop_house_blue', 0.07, 0.62, 0.72],
        ['prop_house_orange', 0.06, 0.62, 0.72],
        ['prop_house_pink', 0.05, 0.62, 0.72],
        ['prop_fence', 0.14, 0.75, 0.85],
        ['prop_bench', 0.1, 0.8, 0.9],
        ['prop_well', 0.05, 0.7, 0.8],
        ['prop_lamp', 0.06, 0.8, 0.9],
        ['prop_bush', 0.06, 0.8, 1],
      ];
      const total = kinds.reduce((a, k) => a + k[1], 0);
      this.tracks.push(
        new PropTrack(scene, f('bg_l2', 0.55), DEPTH.l2, -150, () => {
          let r = rng.float() * total;
          let pick = kinds[0];
          for (const k of kinds) {
            r -= k[1];
            if (r <= 0) {
              pick = k;
              break;
            }
          }
          return {
            key: pick[0],
            y: 852,
            scale: rng.range(pick[2], pick[3]),
            gap: rng.range(60, 380),
            flip: pick[0].startsWith('prop_house') ? false : rng.chance(0.5),
          };
        }),
      );
    }

    // L3: mặt đường
    if (assets.hasReal('bg_l3')) fullTile('bg_l3', DEPTH.ground);
    else {
      const g = scene.add.tileSprite(0, 806, W, H - 806, 'bg_ground').setOrigin(0, 0).setDepth(DEPTH.ground);
      this.tiles.push({ ts: g, factor: 1 });
    }

    // L4: tiền cảnh lướt nhanh, che nhẹ nhân vật
    if (assets.hasReal('bg_l4')) fullTile('bg_l4', DEPTH.fg);
    else {
      const fg = ['fg_grass', 'fg_flowers', 'fg_fern', 'fg_grass', 'fg_leaf'];
      this.tracks.push(
        new PropTrack(scene, reduceMotion ? 1.0 : f('bg_l4', 1.45), DEPTH.fg, 200, () => {
          const key = rng.pick(fg);
          return {
            key,
            y: H + 30,
            scale: rng.range(0.8, 1.15),
            gap: rng.range(reduceMotion ? 900 : 380, reduceMotion ? 1800 : 1100),
            alpha: 0.96,
            flip: rng.chance(0.5),
          };
        }),
      );
    }
  }

  update(dx: number) {
    for (const t of this.tiles) t.ts.tilePositionX += (dx * t.factor) / t.ts.tileScaleX;
    for (const tr of this.tracks) tr.update(dx);
  }
}
