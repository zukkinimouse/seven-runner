import Phaser from "phaser";

export type TouchHandlers = {
  onJump: () => void;
  onAttack: () => void;
};

export type TouchControlsUi = {
  setAttackCooldownRemainingMs: (remainingMs: number) => void;
};

type TouchButtonStyle = {
  label: string;
  fontSize: string;
  fillColor: number;
};

/** スマホ向けタッチ（最低44px相当のヒット領域） */
export function createTouchControls(
  scene: Phaser.Scene,
  handlers: TouchHandlers,
): TouchControlsUi {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const isMobileLayout = w <= 768;
  // スマホ版は等倍のまま、操作しやすいように少しだけ拡大する
  const buttonSize = isMobileLayout ? 103 : 68;
  const edgePadding = isMobileLayout ? 14 : 10;
  const buttonGap = isMobileLayout ? 14 : 10;
  const buttonYBase = h - edgePadding - buttonSize / 2;
  const buttonX = w - edgePadding - buttonSize / 2;
  const baseFontFamily = '"Arial Black", "Trebuchet MS", sans-serif';

  const jumpZone = scene.add
    .rectangle(w * 0.28, h * 0.74, w * 0.56, h * 0.38, 0x000000, 0)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  const createActionButton = (
    x: number,
    y: number,
    style: TouchButtonStyle,
  ): { button: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text } => {
    const radius = buttonSize / 2;
    const button = scene.add
      .circle(x, y, radius, style.fillColor, 0.56)
      .setScrollFactor(0)
      .setStrokeStyle(3, 0xf8fafc, 0.95)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });
    const text = scene.add
      .text(x, y, style.label, {
        fontSize: style.fontSize,
        color: "#f8fafc",
        fontFamily: baseFontFamily,
        stroke: "#0f172a",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setAlign("center");

    const setPressed = (pressed: boolean): void => {
      button.setFillStyle(style.fillColor, pressed ? 0.85 : 0.56);
      // 等倍表示を維持しつつ、押下感はアルファのみで表現する
      button.setScale(1);
      text.setScale(1);
    };

    button.on("pointerdown", () => setPressed(true));
    button.on("pointerup", () => setPressed(false));
    button.on("pointerout", () => setPressed(false));

    return { button, text };
  };

  const jumpButton = createActionButton(buttonX, buttonYBase, {
    label: "JUMP",
    fontSize: isMobileLayout ? "22px" : "16px",
    fillColor: 0x0f766e,
  });
  const attackButton = createActionButton(
    buttonX,
    buttonYBase - buttonSize - buttonGap,
    {
      label: "ATTACK",
      fontSize: isMobileLayout ? "16px" : "14px",
      fillColor: 0x7c3aed,
    },
  );
  // クールタイム中の秒数は円内中央に重ねて表示する
  const attackCooldownText = scene.add
    .text(attackButton.button.x, attackButton.button.y + 6, "", {
      fontSize: isMobileLayout ? "24px" : "18px",
      color: "#e5e7eb",
      fontFamily: baseFontFamily,
      stroke: "#1f2937",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(163)
    .setVisible(false);

  jumpZone.on("pointerdown", () => handlers.onJump());
  jumpButton.button.on("pointerdown", () => handlers.onJump());
  attackButton.button.on("pointerdown", () => handlers.onAttack());

  return {
    setAttackCooldownRemainingMs: (remainingMs: number) => {
      const isCoolingDown = remainingMs > 0;
      attackButton.button.setFillStyle(isCoolingDown ? 0x4b5563 : 0x7c3aed, 0.72);
      attackButton.text.setAlpha(isCoolingDown ? 0.38 : 1);
      attackCooldownText.setVisible(isCoolingDown);
      if (!isCoolingDown) return;
      attackCooldownText.setText(`${(remainingMs / 1000).toFixed(1)}s`);
    },
  };
}
