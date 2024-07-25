import process from 'node:process'
import path from 'node:path'
import { $ } from 'bun'
import { type Component, componentMap, components, isComponent } from './check'
import { console } from './console'

const templatePath = path.join(process.cwd(), 'src', 'pages', '_index.astro.template')
const baseIndexPath = path.join(process.cwd(), 'src', 'pages', 'base.astro')
const indexPath = path.join(process.cwd(), 'src', 'pages', 'index.astro')

async function updateIndexFile(component: Component) {
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

export function getComponentsFromArgs(): Component[] {
  const args = process.argv.slice(2).filter(isComponent)
  return args.length > 0 ? args : [...components]
}

export async function build(components: Component[]) {
  for (const component of components) {
    console.colorize(`Building ${component}...`)

    await updateIndexFile(component)

    await $`${component.toUpperCase()}=true bun run astro build`.quiet()
    await $`rm -rf dist-${component}`
    await $`mv dist dist-${component}`
  }

  console.heading('All builds completed')
}
