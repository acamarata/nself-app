/**
 * Purpose: ESLint config for ɳTask mobile (React Native Expo, TypeScript)
 * Inputs: TypeScript source files under src/
 * Outputs: lint errors/warnings
 * Constraints: Uses @typescript-eslint v7; no React-specific rules (no jsx-runtime import needed for RN)
 * SPORT: T-E1-05
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: false,
    es2020: true,
    node: false,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
  overrides: [
    {
      // Jest mock factories must use require() — static imports get hoisted
      // above jest.mock() and break the mock (documented Jest behavior).
      files: ['src/**/__tests__/**', 'src/**/*.test.*'],
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
  ],
  ignorePatterns: ['node_modules/', 'android/', 'ios/'],
};
