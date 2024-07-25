import { join, parse } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import process from 'node:process'
import { dependencies } from '../package.json'
import { console } from './console'

export const components = [
  'base',
  'vue_astro',
  'solid_astro',
  'vue',
  'solid',
] as const

export type Component = typeof components[number]

export function isComponent(arg: string): arg is Component {
  return components.includes(arg as Component)
}

const fileNames = [
  undefined,
  'Vue.astro',
  'Solid.astro',
  'Vue.vue',
  'Solid.tsx',
]

const packageMap: Record<Component, string[] | string> = {
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

interface FileNode {
  name: string
  size: number
  gzippedSize: number
  children: FileNode[]
  referenced: boolean
}

async function getDirectorySize(directoryPath: string): Promise<[number, number, FileNode]> {
  let totalSize = 0
  let totalGzippedSize = 0
  const processedFiles = new Set<string>()
  const filesToProcess: string[] = ['index.html']
  const fileTree: FileNode = { name: 'index.html', size: 0, gzippedSize: 0, children: [], referenced: true }
  const fileNodeMap = new Map<string, FileNode>()
  fileNodeMap.set('index.html', fileTree)

  function addToFileTree(filePath: string, size: number, gzippedSize: number, referenced: boolean) {
    const parts = filePath.split('/').filter(Boolean)
    let currentNode = fileTree
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] as string
      if (i === parts.length - 1) {
        const existingNode = currentNode.children.find(child => child.name === part)
        if (existingNode) {
          existingNode.size = size
          existingNode.gzippedSize = gzippedSize
          existingNode.referenced = referenced
        }
        else {
          const newNode: FileNode = { name: part, size, gzippedSize, children: [], referenced }
          currentNode.children.push(newNode)
          fileNodeMap.set(filePath, newNode)
        }
      }
      else {
        let childNode = currentNode.children.find(child => child.name === part)
        if (!childNode) {
          childNode = { name: part, size: 0, gzippedSize: 0, children: [], referenced: false }
          currentNode.children.push(childNode)
        }
        currentNode = childNode
      }
    }
  }

  while (filesToProcess.length > 0) {
    const fileName = filesToProcess.pop()
    if (!fileName)
      continue
    const filePath = join(directoryPath, fileName)

    if (processedFiles.has(filePath))
      continue
    processedFiles.add(filePath)

    const stats = statSync(filePath)
    if (stats.isFile()) {
      const fileContent = await Bun.file(filePath).text()
      const fileSize = fileContent.length
      const gzippedSize = Bun.gzipSync(fileContent).length
      totalSize += fileSize
      totalGzippedSize += gzippedSize

      addToFileTree(fileName, fileSize, gzippedSize, true)

      // Check for references to other files
      const allFiles = readdirSync(directoryPath, { recursive: true }) as string[]
      for (const file of allFiles) {
        const fullPath = join(directoryPath, file)
        if (fileContent.includes(parse(file).base) && !processedFiles.has(fullPath) && !file.endsWith('index.html'))
          filesToProcess.push(file)
      }
    }
    else if (stats.isDirectory()) {
      const dirContents = readdirSync(filePath)
      for (const item of dirContents) {
        const fullPath = join(fileName, item)
        if (!processedFiles.has(join(directoryPath, fullPath)))
          filesToProcess.push(fullPath)
      }
    }
  }

  // Add unreferenced files to the tree, but mark them as unreferenced
  const allFiles = readdirSync(directoryPath, { recursive: true }) as string[]
  for (const file of allFiles) {
    if (!fileNodeMap.has(file)) {
      const filePath = join(directoryPath, file)
      const stats = statSync(filePath)
      if (stats.isFile()) {
        const fileSize = stats.size
        const fileContent = await Bun.file(filePath).text()
        const gzippedSize = Bun.gzipSync(fileContent).length
        addToFileTree(file, fileSize, gzippedSize, false)
      }
    }
  }

  // Remove nodes with zero size and no children
  function pruneEmptyNodes(node: FileNode): boolean {
    node.children = node.children.filter(child => pruneEmptyNodes(child))
    return node.size > 0 || node.children.length > 0
  }
  pruneEmptyNodes(fileTree)

  return [totalSize, totalGzippedSize, fileTree]
}

function formatFileTree(node: FileNode, prefix: string = '', isLast: boolean = true): string {
  const { name, size, gzippedSize, children, referenced } = node
  const sizeInfo = `(${(size / 1024).toFixed(2)} KB, ${(gzippedSize / 1024).toFixed(2)} KB gzipped)`
  const referenceInfo = referenced ? '' : ' [Unreferenced]'
  const line = `${prefix}${isLast ? '└── ' : '├── '}${name} ${sizeInfo}${referenceInfo}\n`

  const newPrefix = prefix + (isLast ? '    ' : '│   ')
  const childLines = children
    .map((child, index) => formatFileTree(child, newPrefix, index === children.length - 1))
    .join('')

  return line + childLines
}

type Results = Record<
  string,
  {
    version: string[] | string
    size: number
    gzippedSize: number
    treeRepresentation: string
  }
>

let baseSize = 0
let baseGzippedSize = 0

export async function check(components: Component[]): Promise<Results> {
  const results: Results = {}

  if (components.includes('base')) {
    components = components.filter(c => c !== 'base')
    components.unshift('base')
  }

  for (const component of components) {
    const dirPath = `dist-${component}`
    const [size, gzippedSize, fileTree] = await getDirectorySize(dirPath)
    const version = packageMap[component] as Results[string]['version'] | undefined
    const versionNumbers = Array.isArray(version)
      ? version.map(v => `${v}@${dependencies[v as keyof typeof dependencies]}`)
      : `${version}@${dependencies[version as keyof typeof dependencies]}`
    const treeRepresentation = formatFileTree(fileTree)
    results[component] = { size, gzippedSize, version: versionNumbers, treeRepresentation }

    if (component === 'base') {
      baseSize = size
      baseGzippedSize = gzippedSize
    }
    else {
      results[component].size -= baseSize
      results[component].gzippedSize -= baseGzippedSize
    }

    console.log(`File tree for ${component}:\n${treeRepresentation}`)
  }

  return results
}

export function logResults(results: Results, isSort = false) {
  const sortedResults = isSort ? Object.fromEntries(Object.entries(results).sort((a, b) => a[1].size - b[1].size)) : results
  const longest = Math.max(...Object.keys(sortedResults).map(c => c.length))

  for (const [component, { size, gzippedSize }] of Object.entries(sortedResults)) {
    const padding = '.'.repeat(longest - component.length + 15)
    console.chain(c => c
      .colorize(component)
      .pipeTo((c, prevColor) => c
        .log(prevColor(padding)))
      .dump(size, gzippedSize))
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

