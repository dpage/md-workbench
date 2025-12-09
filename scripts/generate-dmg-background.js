#!/usr/bin/env node
/**
 * Convert the DMG background SVG to PNG
 * Run with: node scripts/generate-dmg-background.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../build/dmg-background.svg');
const pngPath = path.join(__dirname, '../build/dmg-background.png');
const tiffPath = path.join(__dirname, '../build/dmg-background.tiff');

async function convert() {
  console.log('Converting DMG background SVG to PNG and TIFF...');

  const svgBuffer = fs.readFileSync(svgPath);

  // Convert to PNG at 1x resolution (DMG window will scale)
  await sharp(svgBuffer, { density: 72 })
    .resize(540, 380)
    .png()
    .toFile(pngPath);

  console.log(`Created: ${pngPath}`);

  // Also create TIFF at 1x resolution
  await sharp(svgBuffer, { density: 72 })
    .resize(540, 380)
    .tiff()
    .toFile(tiffPath);

  console.log(`Created: ${tiffPath}`);
  console.log('Done!');
}

convert().catch(err => {
  console.error('Error converting:', err);
  process.exit(1);
});
