import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.storywriter.app',
    appName: 'Story Writer',
    webDir: 'www',
    plugins: {
        GoogleAuth: {
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
            androidClientId: '1063763764497-pnq2dpsbcge2nbq25756an9g16rg20pi.apps.googleusercontent.com',
            forceCodeForRefreshToken: true,
        },
    },
};

export default config;
