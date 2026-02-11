const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Tell Metro to only watch the mobile folder, not parent directories
config.watchFolders = [__dirname];

// Ensure node_modules resolution stays within mobile folder
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
