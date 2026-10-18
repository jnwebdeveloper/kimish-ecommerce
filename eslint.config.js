import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist', 'node_modules', 'public'] },
  js.configs.recommended,
  {
    // Allow intentionally unused arguments such as Express's 4-argument error handler (err, req, res, _next)
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    // Storefront and admin (browser)
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      // Only the classic hook rules; the newer ones target the React Compiler, which this project does not use
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Browser globals that are easy to use by accident when a variable of the same name was meant
      // (e.g. `navigation` from useStore() missing, which silently became window.navigation).
      // Use window.<name> when the global really is intended.
      'no-restricted-globals': [
        'error',
        ...[
          'navigation',
          'name',
          'status',
          'event',
          'origin',
          'length',
          'parent',
          'top',
          'self',
          'close',
          'open',
          'stop',
          'find',
          'print',
          'history',
          'external',
          'screen',
          'scroll',
        ].map((name) => ({ name, message: `Use a local variable, or window.${name} on purpose.` })),
      ],
    },
  },
  {
    // Context modules export a provider plus its hook/helpers, and adminPresentation shares constants with
    // its component; splitting them only to satisfy fast refresh isn't worth it
    files: [
      'src/data/StoreContext.jsx',
      'src/auth/AuthContext.jsx',
      'src/admin/components/adminPresentation.jsx',
      'src/admin/session/AdminSession.jsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // API, Vercel function, scripts and config (Node)
    files: ['server/**/*.js', 'api/**/*.js', 'ops/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
  // Turn off rules that conflict with Prettier formatting
  prettier,
]
