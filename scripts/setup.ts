import process from 'node:process'
import path from 'node:path'
import { $ } from 'bun'
import { check, colorize, componentMap, components } from './check'

const templatePath = path.join(process.cwd(), 'src', 'pages', '_index.astro.template')
const baseIndexPath = path.join(process.cwd(), 'src', 'pages', 'base.index.astro')
const indexPath = path.join(process.cwd(), 'src', 'pages', 'index.astro')

async function updateIndexFile(component: string) {
  const template = await Bun.file(templatePath).text()
  const componentFile = componentMap[component]

  const [name, ext] = componentFile?.split('.') ?? []
  const updatedContent = componentFile
    ? template
      .replace('import COMPONENT from \'@components/COMPONENT\'', `import ${name} from '@components/${componentFile}'`)
      .replace('<COMPONENT />', `<${name} ${ext === 'astro' ? '' : 'client:load '}/>`)
      .replace('<span>COMPONENT</span>', `<span>${component}</span>`)
    : await Bun.file(baseIndexPath).text()

  await Bun.write(indexPath, updatedContent)
}

async function main() {
  for (const component of components) {
    console.log(`Building ${colorize(component)}...`)

    await updateIndexFile(component)

    await $`${component.toUpperCase()}=true bun run astro build`.quiet()
    await $`rm -rf dist-${component}`
    await $`mv dist dist-${component}`
  }

  console.log('All builds completed.')

  await check(components)
}

await main()
