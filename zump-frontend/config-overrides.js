const path = require('path');

module.exports = function override(config, env) {
  // Ignore React Native dependencies that are not needed for web
  config.resolve.alias = {
    ...config.resolve.alias,
    '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/utils/stub-async-storage.js'),
  };

  return config;
};

