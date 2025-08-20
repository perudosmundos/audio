module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  extends: ['eslint:recommended'],
  plugins: ['react-hooks'],
  ignorePatterns: ['dist/**', 'node_modules/**', 'public/**', 'uploads/**'],
  rules: {
    'no-debugger': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^React$' }],
    'react-hooks/exhaustive-deps': 'off',
  },
  overrides: [
    {
      files: [
        'vite.config.js',
        'tailwind.config.js',
        'postcss.config.js',
        '.eslintrc.cjs',
        'vercel.json',
        'api/**/*.js',
        'plugins/**/*.js',
      ],
      env: { node: true, browser: false },
      parserOptions: { sourceType: 'module' },
      rules: {
        'no-undef': 'off',
      },
    },
  ],
};
