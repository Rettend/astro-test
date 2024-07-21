import { defineConfig } from 'astro/config'
import solidJs from '@astrojs/solid-js'
import vue from '@astrojs/vue'

export default defineConfig({
  integrations: [
    solidJs(),
    vue(),
  ],
})
