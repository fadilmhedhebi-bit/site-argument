import { Capacitor } from '@capacitor/core';

// No-op on web: ces plugins natifs n'existent que dans le wrapper Capacitor.
export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  await SplashScreen.hide().catch(() => {});
}
