export type RuntimePlatform = "ios" | "android" | "desktop" | "unknown";

export type RuntimeProfile = {
  platform: RuntimePlatform;
  isIOS: boolean;
  isAndroid: boolean;
  isLineWebView: boolean;
  bgSwitchIntervalSec: number;
};

function detectPlatform(): RuntimePlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop";
  return "unknown";
}

function detectLineWebView(): boolean {
  const ua = navigator.userAgent;
  return /Line/i.test(ua) || /LIFF/i.test(ua);
}

export function createRuntimeProfile(): RuntimeProfile {
  const platform = detectPlatform();
  const isIOS = platform === "ios";
  const isAndroid = platform === "android";
  const isLineWebView = detectLineWebView();

  // iOS と LINE WebView は切替頻度を落として安定性を優先する
  const bgSwitchIntervalSec = isIOS || isLineWebView ? 30 : 15;

  return {
    platform,
    isIOS,
    isAndroid,
    isLineWebView,
    bgSwitchIntervalSec,
  };
}
