/**
 * afterPack hook for electron-builder
 *
 * This script runs after packaging but before signing.
 * Originally used for macOS 26+ Liquid Glass icon compilation.
 * Currently a no-op placeholder.
 */

exports.default = async function(context) {
  console.log('afterPack: Skipping Liquid Glass icon compilation');
  // No-op for now
};
