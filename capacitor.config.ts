import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cilegon.tamsar',
  appName: 'TAMSAR_pulomerak',
  webDir: 'public',
  server: {
    url: 'https://tamansari-merak.vercel.app',
    cleartext: false
  }
};

export default config;