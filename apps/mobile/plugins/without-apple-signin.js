// Personal (free) Apple teams cannot sign apps with "Sign In with Apple".
// expo-apple-authentication adds that entitlement on every prebuild; remove it
// until the project has a paid Apple Developer account. Delete this plugin then.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['com.apple.developer.applesignin'];
    return c;
  });
};
