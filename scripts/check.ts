import { join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import chalk from 'chalk'

export const components = [
  'base',
  'vue_astro',
  'solid_astro',
  'vue',
  'solid',
]

const fileNames = [
  undefined,
  'Vue.astro',
  'Solid.astro',
  'Vue.vue',
  'Solid.tsx',
]

export const componentMap = components.reduce((map, component, index) => {
  map[component] = fileNames[index]
  return map
}, {} as Record<string, string | undefined>)

async function getDirectorySize(directoryPath: string): Promise<[number, number]> {
  let totalSize = 0
  let totalGzippedSize = 0
  const files = readdirSync(directoryPath)

  for (const file of files) {
    const filePath = join(directoryPath, file)
    const stats = statSync(filePath)

    if (stats.isFile()) {
      totalSize += stats.size
      const fileContent = await Bun.file(filePath).text()
      totalGzippedSize += Bun.gzipSync(fileContent).length
    }
    else if (stats.isDirectory()) {
      const [dirSize, dirGzippedSize] = await getDirectorySize(filePath)
      totalSize += dirSize
      totalGzippedSize += dirGzippedSize
    }
  }

  return [totalSize, totalGzippedSize]
}

let baseSize = 0
let baseGzippedSize = 0

export async function check(components: string[]) {
  const longest = Math.max(...components.map(c => c.length))

  for (const component of components) {
    const dirPath = `dist-${component}`
    const [size, gzippedSize] = await getDirectorySize(dirPath)

    const paddedComponent = component.padEnd(longest + 15, '.')
    console.log(`${colorize(paddedComponent)} ${((size - baseSize) / 1024).toFixed(2)} kB ${chalk.gray(`(${((gzippedSize - baseGzippedSize) / 1024).toFixed(2)} kB gzipped)`)}`)

    if (component === 'base') {
      baseSize = size
      baseGzippedSize = gzippedSize
    }
  }
}

export function colorize(component: string) {
  const [base, suffix] = component.includes('_') ? component.split('_') : [component, '']

  if (base?.includes('vue'))
    return chalk.green(base) + (suffix ? chalk.green('/') + chalk.magenta(suffix) : '')
  else if (base?.includes('solid'))
    return chalk.cyan(base) + (suffix ? chalk.cyan('/') + chalk.magenta(suffix) : '')
  else
    return component
}
