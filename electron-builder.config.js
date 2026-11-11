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
    "!node_modules/**/*",
    "node_modules/better-sqlite3/**/*",
    "!node_modules/better-sqlite3/deps/**/*",
    "!node_modules/better-sqlite3/build/Release/obj/**/*",
    "!node_modules/better-sqlite3/build/deps/**/*",
    "!node_modules/better-sqlite3/src/**/*",
    "!node_modules/better-sqlite3/bin/**/*",
    "node_modules/bindings/**/*",
    "node_modules/file-uri-to-path/**/*"
  ],
  asarUnpack: [
    "node_modules/better-sqlite3/**/*"
  ],
  directories: {
    output: "release"
  },
  extraMetadata: {
    main: "dist/main/main.js"
  },
  fileAssociations: [
    {
      ext: ["md", "markdown", "mdown", "mkd"],
      name: "Markdown Document",
      role: "Editor",
      icon: "assets/icons/icon"
    },
    {
      ext: "json",
      name: "JSON Document",
      role: "Editor"
    },
    {
      ext: ["yaml", "yml"],
      name: "YAML Document",
      role: "Editor"
    },
    {
      ext: "xml",
      name: "XML Document",
      role: "Editor"
    },
    {
      ext: "txt",
      name: "Text Document",
      role: "Editor"
    }
  ],
  mac: {
    target: ["dmg"],
    icon: "assets/icons/icon.icns",
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: !!process.env.APPLE_TEAM_ID,
    // better-sqlite3 ships one prebuilt binary per architecture and picks
    // the right one at runtime, so both are identical in each half of a
    // universal build
    x64ArchFiles: "Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/darwin-*.node"
  },
  mas: {
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    hardenedRuntime: false,
    minimumSystemVersion: "12.0",
    extendInfo: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  dmg: {
    sign: false,
    format: "UDZO",
    background: "build/dmg-background.png",
    iconSize: 80,
    iconTextSize: 12,
    window: {
      width: 540,
      height: 380
    },
    contents: [
      { x: 140, y: 190 },
      { x: 400, y: 190, type: "link", path: "/Applications" }
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
