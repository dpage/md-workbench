const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// Icon sizes needed for each platform
const SIZES = {
  // macOS needs these sizes for .icns
  mac: [16, 32, 64, 128, 256, 512, 1024],
  // Windows needs these sizes for .ico
  win: [16, 24, 32, 48, 64, 128, 256],
  // Linux uses PNG files at various sizes
  linux: [16, 32, 48, 64, 128, 256, 512],
};

async function generatePNG(size, outputPath) {
  await sharp(SVG_PATH)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
}

async function generateMacIcon() {
  console.log('\nGenerating macOS icon...');
  const iconsetDir = path.join(ICONS_DIR, 'icon.iconset');

  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // Generate all required sizes for macOS iconset
  const macSizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  for (const { size, name } of macSizes) {
    await generatePNG(size, path.join(iconsetDir, name));
  }

  // Use iconutil to create .icns file (macOS only)
  if (process.platform === 'darwin') {
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(ICONS_DIR, 'icon.icns')}"`);
      console.log('Generated: icon.icns');
    } catch (error) {
      console.error('Failed to generate .icns file. Make sure you are on macOS.');
    }
  } else {
    console.log('Skipping .icns generation (not on macOS). Use macOS to generate the final .icns file.');
  }
}

async function generateWindowsIcon() {
  console.log('\nGenerating Windows icon...');

  // Generate PNGs for Windows ICO
  const pngFiles = [];
  for (const size of SIZES.win) {
    const pngPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await generatePNG(size, pngPath);
    pngFiles.push(pngPath);
  }

  // Use png-to-ico to create .ico file
  try {
    const pngToIco = require('png-to-ico');
    const icoBuffer = await pngToIco(pngFiles);
    fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
    console.log('Generated: icon.ico');
  } catch (error) {
    console.error('Failed to generate .ico file:', error.message);
  }
}

async function generateLinuxIcons() {
  console.log('\nGenerating Linux icons...');

  for (const size of SIZES.linux) {
    const pngPath = path.join(ICONS_DIR, `${size}x${size}.png`);
    await generatePNG(size, pngPath);
  }
}

async function generateMainPNG() {
  console.log('\nGenerating main PNG icon...');
  // Generate a high-res PNG for general use
  await generatePNG(1024, path.join(ICONS_DIR, 'icon.png'));
}

async function main() {
  console.log('Icon Generation Script');
  console.log('======================');
  console.log(`Source SVG: ${SVG_PATH}`);
  console.log(`Output directory: ${ICONS_DIR}`);

  if (!fs.existsSync(SVG_PATH)) {
    console.error('Error: SVG source file not found!');
    process.exit(1);
  }

  try {
    await generateMainPNG();
    await generateMacIcon();
    await generateWindowsIcon();
    await generateLinuxIcons();

    console.log('\nIcon generation complete!');
    console.log('\nGenerated files:');
    const files = fs.readdirSync(ICONS_DIR);
    files.forEach(file => {
      if (!file.endsWith('.iconset')) {
        console.log(`  - ${file}`);
      }
    });
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
