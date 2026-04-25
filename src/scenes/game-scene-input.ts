import Phaser from "phaser";
import type { PlayerMode } from "../game/entities/player-controller";
import {
  tryJump,
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
    x?: Phaser.Input.Keyboard.Key;
    shift?: Phaser.Input.Keyboard.Key;
  },
  now: number,
): void {
  const { space, up, x, shift } = keys;
  if (space && Phaser.Input.Keyboard.JustDown(space)) {
    tryJump(player, mode, now);
    sfxJump();
  }
  if (up && Phaser.Input.Keyboard.JustDown(up)) {
    tryJump(player, mode, now);
    sfxJump();
  }
  const attackPressed =
    (x && Phaser.Input.Keyboard.JustDown(x)) ||
    (shift && Phaser.Input.Keyboard.JustDown(shift));
  if (attackPressed) {
    const attacked = tryAttack(mode, now);
    if (attacked) sfxAttack();
  }
}
