import Phaser from "phaser";
import type { PlayerMode } from "../game/entities/player-controller";
import {
  tryJump,
  trySlide,
  tryAttack,
} from "../game/entities/player-controller";
import { sfxAttack, sfxJump } from "../game/audio/sfx";

/** PCキーボード入力 */
export function handleDesktopKeyboard(
  player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  mode: PlayerMode,
  keys: {
    space?: Phaser.Input.Keyboard.Key;
    up?: Phaser.Input.Keyboard.Key;
    down?: Phaser.Input.Keyboard.Key;
    x?: Phaser.Input.Keyboard.Key;
    shift?: Phaser.Input.Keyboard.Key;
  },
  now: number,
): void {
  const { space, up, down, x, shift } = keys;
  if (space && Phaser.Input.Keyboard.JustDown(space)) {
    tryJump(player, mode, now);
    sfxJump();
  }
  if (up && Phaser.Input.Keyboard.JustDown(up)) {
    tryJump(player, mode, now);
    sfxJump();
  }
  if (down && Phaser.Input.Keyboard.JustDown(down)) trySlide(player, mode, now);
  const attackPressed =
    (x && Phaser.Input.Keyboard.JustDown(x)) ||
    (shift && Phaser.Input.Keyboard.JustDown(shift));
  if (attackPressed) {
    const attacked = tryAttack(mode, now);
    if (attacked) sfxAttack();
  }
}
