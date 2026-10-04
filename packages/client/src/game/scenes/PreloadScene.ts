import * as Phaser from 'phaser';
import type { MapData } from '@maze/shared';
import { artDefinitions, drawGround } from '../art';
import { T } from '../art';

/** Bakes every procedural texture once, then starts the game scene. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(data: { map: MapData }) {
    for (const def of artDefinitions()) {
      if (this.textures.exists(def.key)) continue;
      const tex = this.textures.createCanvas(def.key, def.w, def.h);
      if (!tex) continue;
      def.draw(tex.getContext());
      tex.refresh();
    }
    const groundKey = `ground_${data.map.id}`;
    if (!this.textures.exists(groundKey)) {
      const tex = this.textures.createCanvas(groundKey, data.map.width * T, data.map.height * T);
      if (tex) {
        drawGround(tex.getContext(), data.map);
        tex.refresh();
      }
    }
    this.scene.start('Game', data);
  }
}
