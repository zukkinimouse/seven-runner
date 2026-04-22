/** 経過秒数からスクロール速度（px/s）を返す */
export function scrollSpeedForElapsedSeconds(elapsedSec: number): number {
  if (elapsedSec < 20) return 190;
  if (elapsedSec < 45) return 220;
  if (elapsedSec < 80) return 255;
  if (elapsedSec < 130) return 295;
  return 330;
}

/** 0〜1 の難易度係数（チャンク選出・敵出現率に使用） */
export function difficultyTForElapsedSeconds(elapsedSec: number): number {
  return Math.min(1, elapsedSec / 120);
}
