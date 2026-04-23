/** 軽量SFX（外部音源ファイルなし） */
let ctx: AudioContext | null = null;
let seVolume = 1;
let isMuted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, durationMs: number, gain = 0.05): void {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.value = isMuted ? 0 : gain * seVolume;
  o.connect(g);
  g.connect(c.destination);
  o.start();
  window.setTimeout(() => {
    o.stop();
    o.disconnect();
    g.disconnect();
  }, durationMs);
}

export function setSeVolume(volume: number): void {
  seVolume = Math.max(0, Math.min(1, volume));
}

export function getSeVolume(): number {
  return seVolume;
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function sfxJump(): void {
  beep(520, 60, 0.03);
}

export function sfxPickup(): void {
  beep(880, 40, 0.03);
  window.setTimeout(() => beep(1320, 35, 0.025), 35);
}

export function sfxHit(): void {
  beep(140, 120, 0.06);
}

export function sfxBreak(): void {
  beep(220, 55, 0.038);
  window.setTimeout(() => beep(180, 45, 0.03), 28);
}

export function sfxAttack(): void {
  beep(560, 32, 0.03);
  window.setTimeout(() => beep(760, 26, 0.026), 20);
}

export function sfxAttackHit(): void {
  beep(980, 26, 0.028);
  window.setTimeout(() => beep(760, 22, 0.022), 18);
}

/** ひったくり犯撃破（炎ヒットとは別の、低め〜中音の3連） */
export function sfxSnatcherDefeat(): void {
  beep(160, 100, 0.052);
  window.setTimeout(() => beep(300, 55, 0.042), 40);
  window.setTimeout(() => beep(520, 40, 0.034), 100);
}

/** 栄養ドリンク出現のポップな通知音 */
export function sfxEnergyPop(): void {
  beep(1040, 22, 0.035);
  window.setTimeout(() => beep(1440, 28, 0.03), 14);
  window.setTimeout(() => beep(880, 18, 0.024), 38);
}

/** 落下障害物の予兆SE */
export function sfxFallingWarning(): void {
  beep(560, 34, 0.03);
  window.setTimeout(() => beep(760, 26, 0.027), 44);
}

/** 腐敗アイテム取得時のマイナス感SE */
export function sfxSpoiledPickup(): void {
  beep(240, 55, 0.04);
  window.setTimeout(() => beep(180, 70, 0.038), 40);
}

/** リザルト行が出るときの「チャリン」 */
export function sfxResultCoinTick(): void {
  beep(1240, 24, 0.03);
  window.setTimeout(() => beep(1660, 20, 0.024), 18);
}

/** 合計金額が確定表示されるときの豪華SE */
export function sfxResultTotalBig(): void {
  beep(440, 70, 0.042);
  window.setTimeout(() => beep(660, 80, 0.04), 48);
  window.setTimeout(() => beep(990, 96, 0.036), 104);
}

/** ランク表示時のシャキーンSE */
export function sfxResultRankShine(): void {
  beep(760, 24, 0.03);
  window.setTimeout(() => beep(1220, 34, 0.03), 18);
  window.setTimeout(() => beep(1680, 40, 0.026), 46);
}

export function sfxSteal(): void {
  // ひったくり被害は硬貨音っぽい高めの2音で分かりやすくする
  beep(1320, 26, 0.03);
  window.setTimeout(() => beep(1760, 30, 0.028), 24);
}
