import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rentalrosy.realm',
  appName: 'Habico',
  webDir: '.output/public',
  backgroundColor: '#0f0f11',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
