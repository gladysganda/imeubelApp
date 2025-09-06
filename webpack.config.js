// webpack.config.js
const createExpoWebpackConfigAsync = require("@expo/webpack-config");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Force the native module to resolve to our web stub
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "react-native-bluetooth-escpos-printer":
      require("path").resolve(__dirname, "shims/react-native-bluetooth-escpos-printer.web.js"),
  };

  return config;
};
