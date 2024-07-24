import antfu from '@antfu/eslint-config'

export default antfu({
  astro: true,
  solid: true,
  rules: {
    'style/jsx-one-expression-per-line': 'off',
    'curly': ['warn', 'multi-or-nest', 'consistent'],
  },
})
