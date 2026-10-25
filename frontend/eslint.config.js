import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.output/**',
      'dist/**',
      '.tanstack/**',
      'src/routeTree.gen.ts',
      'src/lib/api.generated.ts',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/server/**'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
)
