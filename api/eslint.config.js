import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'storage/**'] },
  {
    files: ['server/**/*.js', 'tests/**/*.js'],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
