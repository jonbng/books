const {
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * Make the app's Android theme entirely ours, so no inherited Android default
 * (the navy `colorPrimary`, the green `colorControlActivated`, teal ripples) can
 * leak into stock controls — switches, checkboxes, radios, progress bars, text
 * cursors, ripples. Every control color is set explicitly, in light and dark,
 * mirroring the JS palette in `src/constants/theme.ts`.
 *
 * Runs on every prebuild, so the warm theme is durable (no hand-editing res/).
 */
const LIGHT = {
  colorPrimary: '#C0694A', // clay accent
  controlHighlight: '#33C0694A', // ~20% clay ripple
  controlNormal: '#8A8175', // warm gray (unchecked controls/icons)
};
const NIGHT = {
  colorPrimary: '#D98A63', // lifted clay for dark
  controlHighlight: '#33D98A63',
  controlNormal: '#B0A492',
};

// AppTheme attribute → color resource. `@color/colorPrimary` resolves to the
// light or night value automatically (DayNight theme).
const THEME_ITEMS = {
  colorPrimary: '@color/colorPrimary',
  colorPrimaryDark: '@color/colorPrimary',
  colorAccent: '@color/colorPrimary',
  colorControlActivated: '@color/colorPrimary',
  colorControlHighlight: '@color/controlHighlight',
  colorControlNormal: '@color/controlNormal',
};

function applyColors(modResults, colors) {
  for (const [name, value] of Object.entries(colors)) {
    modResults = AndroidConfig.Colors.setColorItem({ $: { name }, _: value }, modResults);
  }
  return modResults;
}

module.exports = function withWarmAndroidTheme(config) {
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = applyColors(cfg.modResults, LIGHT);
    return cfg;
  });
  config = withAndroidColorsNight(config, (cfg) => {
    cfg.modResults = applyColors(cfg.modResults, NIGHT);
    return cfg;
  });
  config = withAndroidStyles(config, (cfg) => {
    for (const [name, value] of Object.entries(THEME_ITEMS)) {
      cfg.modResults = AndroidConfig.Styles.setStylesItem({
        xml: cfg.modResults,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
        item: { _: value, $: { name } },
      });
    }
    return cfg;
  });
  return config;
};
