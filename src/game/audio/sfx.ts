/** 軽量SFX（外部音源ファイルなし） */
let ctx: AudioContext | null = null;
let seVolume = 1;
let isMuted = false;
// BGMに対してSEが小さくなり過ぎないよう、実効音量レンジを底上げする
const SE_VOLUME_MIN = 0.28;
const SE_VOLUME_MAX = 1.65;

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

type ToneType = OscillatorType;

function playTone(args: {
  type: ToneType;
  freq: number;
  durationMs: number;
  gain?: number;
  slideToFreq?: number;
}): void {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = args.type;
  o.frequency.setValueAtTime(args.freq, c.currentTime);
  if (args.slideToFreq !== undefined) {
    o.frequency.exponentialRampToValueAtTime(
      Math.max(1, args.slideToFreq),
      c.currentTime + args.durationMs / 1000,
    );
  }
  const baseGain = (args.gain ?? 0.04) * (isMuted ? 0 : seVolume);
  g.gain.setValueAtTime(baseGain, c.currentTime);
  // 炎っぽい尾を作るため、最後は自然減衰させる
  g.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, baseGain * 0.02),
    c.currentTime + args.durationMs / 1000,
  );
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + args.durationMs / 1000);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function playNoiseBurst(durationMs: number, gain = 0.03, highpassHz = 900): void {
  const c = getCtx();
  if (!c) return;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * (durationMs / 1000)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpassHz;
  const g = c.createGain();
  const baseGain = gain * (isMuted ? 0 : seVolume);
  g.gain.setValueAtTime(baseGain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, baseGain * 0.03),
    c.currentTime + durationMs / 1000,
  );
  src.connect(hp);
  hp.connect(g);
  g.connect(c.destination);
  src.start();
  src.stop(c.currentTime + durationMs / 1000);
  src.onended = () => {
    src.disconnect();
    hp.disconnect();
    g.disconnect();
  };
}

export function setSeVolume(volume: number): void {
  const normalized = Math.max(0, Math.min(1, volume));
  seVolume = SE_VOLUME_MIN + (SE_VOLUME_MAX - SE_VOLUME_MIN) * normalized;
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

/** スペシャル取得: 火花が散るような上昇系SE */
export function sfxSpecialPickup(): void {
  playTone({
    type: "triangle",
    freq: 880,
    slideToFreq: 1320,
    durationMs: 95,
    gain: 0.042,
  });
  window.setTimeout(
    () =>
      playTone({
        type: "sawtooth",
        freq: 1380,
        slideToFreq: 1680,
        durationMs: 62,
        gain: 0.032,
      }),
    34,
  );
  window.setTimeout(() => playNoiseBurst(64, 0.026, 2200), 18);
}

/** スペシャル発動: 低音の着火＋燃え上がり */
export function sfxSpecialActivate(): void {
  playTone({
    type: "sawtooth",
    freq: 240,
    slideToFreq: 150,
    durationMs: 140,
    gain: 0.068,
  });
  playNoiseBurst(220, 0.04, 700);
  window.setTimeout(
    () =>
      playTone({
        type: "triangle",
        freq: 420,
        slideToFreq: 840,
        durationMs: 155,
        gain: 0.05,
      }),
    70,
  );
  window.setTimeout(
    () =>
      playTone({
        type: "triangle",
        freq: 880,
        slideToFreq: 1220,
        durationMs: 92,
        gain: 0.026,
      }),
    140,
  );
}

/** スペシャルのオブジェクトヒット: パシュっと乾いた炎音 */
export function sfxSpecialHitObject(): void {
  playNoiseBurst(96, 0.034, 1700);
  window.setTimeout(
    () =>
      playTone({
        type: "square",
        freq: 860,
        slideToFreq: 520,
        durationMs: 58,
        gain: 0.034,
      }),
    12,
  );
}

/** スペシャルの敵ヒット: 重めの炎インパクト */
export function sfxSpecialHitEnemy(): void {
  playNoiseBurst(126, 0.042, 1200);
  playTone({
    type: "sawtooth",
    freq: 300,
    slideToFreq: 180,
    durationMs: 100,
    gain: 0.06,
  });
  window.setTimeout(
    () =>
      playTone({
        type: "triangle",
        freq: 640,
        slideToFreq: 420,
        durationMs: 74,
        gain: 0.042,
      }),
    38,
  );
  window.setTimeout(() => playNoiseBurst(56, 0.022, 2400), 84);
}
