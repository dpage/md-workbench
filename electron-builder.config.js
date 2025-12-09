/**
 * Electron Builder Configuration
 *
 * This file allows dynamic configuration using environment variables.
 *
 * Required environment variables for notarization:
 *   APPLE_ID - Your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD - App-specific password from appleid.apple.com
 *   APPLE_TEAM_ID - Your 10-character team ID
 */

const config = {
  appId: "page.conx.mdworkbench",
  productName: "Markdown Workbench",
  files: [
    "dist/main/**/*",
    "dist/renderer/**/*",
    "!dist/**/*.map",
    "!dist/**/*.d.ts",
    "!dist/**/*.d.ts.map",
    "!dist/test/**/*",
    "!dist/shared/**/*",
    "package.json",
    "!node_modules/**/*"
  ],
  asarUnpack: [],
  directories: {
    output: "release"
  },
  extraMetadata: {
    main: "dist/main/main.js"
  },
  mac: {
    target: ["dmg", "zip"],
    icon: "assets/icons/icon.icns",
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: process.env.APPLE_TEAM_ID ? {
      teamId: process.env.APPLE_TEAM_ID
    } : false
  },
  mas: {
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    hardenedRuntime: false
  },
  dmg: {
    sign: true,
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" }
    ]
  },
  win: {
    target: ["nsis", "zip"],
    icon: "assets/icons/icon.ico"
  },
  linux: {
    target: ["AppImage", "deb"],
    icon: "assets/icons",
    category: "Development"
  }
};

module.exports = config;
