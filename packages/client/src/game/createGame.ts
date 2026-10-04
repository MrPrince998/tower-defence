import * as Phaser from 'phaser';
import type { MapData } from '@maze/shared';
import { T } from './art';
import { GameScene } from './scenes/GameScene';
import { PreloadScene } from './scenes/PreloadScene';

export function createGame(parent: HTMLElement, map: MapData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: map.width * T,
    height: map.height * T,
    backgroundColor: '#16210f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' },
    banner: false,
    scene: [],
  });
  game.scene.add('Preload', PreloadScene);
  game.scene.add('Game', GameScene);
  game.scene.start('Preload', { map });
  return game;
}
