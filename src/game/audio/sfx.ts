/** 軽量SFX（外部音源ファイルなし） */
let ctx: AudioContext | null = null;

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
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  o.start();
  window.setTimeout(() => {
    o.stop();
    o.disconnect();
    g.disconnect();
  }, durationMs);
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

export function sfxSteal(): void {
  // ひったくり被害は硬貨音っぽい高めの2音で分かりやすくする
  beep(1320, 26, 0.03);
  window.setTimeout(() => beep(1760, 30, 0.028), 24);
}
