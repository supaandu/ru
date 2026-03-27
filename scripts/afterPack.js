const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  // Only run on macOS builds
  if (process.platform !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`Ad-hoc signing: ${appPath}`);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
};
