import { Alert, Platform } from 'react-native';

/**
 * Polyfill Alert.alert for React Native Web.
 * react-native-web leaves Alert.alert as an empty function: class Alert { static alert() {} }.
 * This ensures that standard Alert.alert calls and their callbacks execute on web.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // @ts-ignore
  if (!window.__epresensi_alert_patched) {
    // @ts-ignore
    window.__epresensi_alert_patched = true;

    Alert.alert = (title: string, message?: string, buttons?: any[]) => {
      const fullText = [title, message].filter(Boolean).join('\n\n');

      if (!buttons || buttons.length === 0) {
        window.alert(fullText);
        return;
      }

      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionBtns = buttons.filter((b) => b.style !== 'cancel');
      const primaryBtn = actionBtns[actionBtns.length - 1] || buttons[0];

      if (buttons.length > 1 && cancelBtn) {
        const ok = window.confirm(fullText);
        if (ok) {
          primaryBtn.onPress?.();
        } else {
          cancelBtn.onPress?.();
        }
      } else {
        window.alert(fullText);
        buttons[0]?.onPress?.();
      }
    };
  }
}
