/**
 * Workaround: expo-modules-jsi 58.0.21/58.0.22 fails to compile with Xcode 26.2
 *   error: sending 'slot' risks causing data races
 * Build the Expo module pods in Swift 5 mode so that check is a warning.
 * Remove this plugin once Expo ships a fixed expo-modules-jsi.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# [with-swift5-expo-jsi]';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('ExpoModules')
        target.build_configurations.each do |config|
          config.build_settings['SWIFT_VERSION'] = '5.0'
          config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        end
      end
    end
`;

module.exports = function withSwift5ExpoJsi(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        if (!/post_install do \|installer\|/.test(src)) {
          throw new Error('[with-swift5-expo-jsi] post_install block not found in Podfile');
        }
        src = src.replace(/post_install do \|installer\|\n/, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};
