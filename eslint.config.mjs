import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// モノレポ共通の ESLint 設定 (packages/* と apps/api が使う)。
// apps/web は Next.js 専用ルールが必要なため、自身の eslint.config を持つ。
export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/drizzle/**',
    'apps/web/**',
    '.github/**', // CI 用スクリプトは CommonJS で、別の学習用ファイル
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,

  // scripts/ 配下は Node.js で直接実行する CommonJS のスクリプト (Husky のフックから呼ばれる)。
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', process: 'readonly', console: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
