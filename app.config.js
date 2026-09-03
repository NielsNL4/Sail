const mapboxDownloadsToken = process.env.MAPBOX_DOWNLOADS_TOKEN;

// @rnmapbox/maps reads this variable during native dependency installation.
// Keep the source variable private instead of embedding it in plugin options.
if (mapboxDownloadsToken) {
  process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN = mapboxDownloadsToken;
}

module.exports = {
  name: 'Sail',
  slug: 'sail',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.dutchwaters.sail',
    supportsTablet: true,
  },
  android: {
    package: 'com.dutchwaters.sail',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Sail gebruikt je locatie om je positie op de kaart te tonen.',
      },
    ],
    '@rnmapbox/maps',
  ],
};
