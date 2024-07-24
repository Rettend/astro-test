import { join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import process from 'node:process'
import chalk from 'chalk'
import { dependencies } from '../package.json'

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

const packageMap: Record<string, string[] | string> = {
  base: 'astro',
  vue_astro: ['astro', '@astrojs/vue'],
  solid_astro: ['astro', '@astrojs/solid-js'],
  vue: 'vue',
  solid: 'solid-js',
}

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

type Results = Record<
  string,
  {
    version: string[] | string
    size: number
    gzippedSize: number
  }
>

let baseSize = 0
let baseGzippedSize = 0

export async function check(components: string[]): Promise<Results> {
  const results: Results = {}

  if (components.includes('base')) {
    components = components.filter(c => c !== 'base')
    components.unshift('base')
  }

  for (const component of components) {
    const dirPath = `dist-${component}`
    const [size, gzippedSize] = await getDirectorySize(dirPath)
    const version = packageMap[component] as Results[string]['version'] | undefined
    const versionNumbers = Array.isArray(version)
      ? version.map(v => `${v}@${dependencies[v as keyof typeof dependencies]}`)
      : `${version}@${dependencies[version as keyof typeof dependencies]}`
    results[component] = { size: size - baseSize, gzippedSize: gzippedSize - baseGzippedSize, version: versionNumbers }

    if (component === 'base') {
      baseSize = size
      baseGzippedSize = gzippedSize
    }
  }

  return results
}

export function logResults(results: Results, isSort = false) {
  const sortedResults = isSort ? Object.fromEntries(Object.entries(results).sort((a, b) => a[1].size - b[1].size)) : results
  const longest = Math.max(...Object.keys(sortedResults).map(c => c.length))

  for (const [component, { size, gzippedSize }] of Object.entries(sortedResults)) {
    const paddedComponent = component.padEnd(longest + 15, '.')
    console.log(`${colorize(paddedComponent)} ${chalk.gray(`${(size / 1024).toFixed(2)} kB (${(gzippedSize / 1024).toFixed(2)} kB gzipped)`)}`)
  }
}

export async function saveResults(results: Results) {
  const date = new Date().toISOString().split('T')[0]
  const filePath = join(process.cwd(), 'benchmarks', `${date}.json`)
  await Bun.write(filePath, `${JSON.stringify(results, null, 2)}\n`)
}

export async function createMarkdownTable(results: Results) {
  const tableHeader = `| Framework | Versions | Size (KB) | Size (KB gzip) |\n| --------- | -------- | --------- | -------------- |\n`
  const sortedResults = Object.fromEntries(Object.entries(results).sort((a, b) => a[1].size - b[1].size))
  const tableRows = Object.entries(sortedResults).map(([framework, { version, size, gzippedSize }]) => {
    const versions = Array.isArray(version) ? version.join(', ') : version
    return `| ${framework} | \`${versions}\` | ${(size / 1024).toFixed(2)} | ${(gzippedSize / 1024).toFixed(2)} |`
  }).join('\n')

  const table = tableHeader + tableRows

  const readmePath = join(process.cwd(), 'README.md')
  let readmeContent = await Bun.file(readmePath).text()

  const startMarker = '<!-- RESULTS_START -->'
  const endMarker = '<!-- RESULTS_END -->'
  const startIndex = readmeContent.indexOf(startMarker) + startMarker.length
  const endIndex = readmeContent.indexOf(endMarker)

  readmeContent = `${readmeContent.slice(0, startIndex)}\n${table}\n${readmeContent.slice(endIndex)}`

  await Bun.write(readmePath, readmeContent)

  const date = new Date().toISOString().split('T')[0]
  const filePath = join(process.cwd(), 'benchmarks', `${date}.md`)
  await Bun.write(filePath, `${table}\n`)
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

export class ConsoleExtended extends console.Console {
  shout(message: string) {
    this.log(chalk.bold(`> ${message}`))
  }
}
