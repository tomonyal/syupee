const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// functions/ ディレクトリをMetroのウォッチ対象から除外
// （Cloud Functionsの package.json が誤って解決されるのを防ぐ）
config.resolver.blockList = [/functions\/.*/];

// Firebase JS SDK モジュール解決の問題を修正:
// firebase/app は ESM (import) で @firebase/app を読み、
// @firebase/auth/dist/rn は CJS (require) で @firebase/app を読むため、
// 2つの異なるインスタンスが作られ auth コンポーネント登録が失敗する。
// → 全ての Firebase パッケージを CJS 版に統一して同一インスタンスを保証する。

const firebaseModuleMap = {
  // 全ての Firebase 内部パッケージのモジュール解決を統一して、
  // CJS require と ESM import が同じファイルに解決されるようにする。
  // これにより auth/firestore が同一の @firebase/app インスタンスを共有し、
  // コンポーネント登録の問題を回避できる。

  // @firebase/app - ESM版に統一
  '@firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/esm/index.esm2017.js'),
  'firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/esm/index.esm2017.js'),

  // @firebase/component - ESM版に統一
  '@firebase/component': path.resolve(__dirname, 'node_modules/@firebase/component/dist/esm/index.esm2017.js'),

  // @firebase/util - ESM版に統一
  '@firebase/util': path.resolve(__dirname, 'node_modules/@firebase/util/dist/index.esm2017.js'),

  // @firebase/logger - ESM版に統一
  '@firebase/logger': path.resolve(__dirname, 'node_modules/@firebase/logger/dist/esm/index.esm2017.js'),

  // Auth: RN 用エントリ
  'firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),
  '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),

  // Firestore: RN 用エントリ
  'firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.rn.js'),
  '@firebase/firestore': path.resolve(__dirname, 'node_modules/@firebase/firestore/dist/index.rn.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (firebaseModuleMap[moduleName]) {
    return {
      filePath: firebaseModuleMap[moduleName],
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
