import process from 'node:process'
import path from 'node:path'
import { $ } from 'bun'
import { ConsoleExtended, check, colorize, componentMap, components, createMarkdownTable, logResults, saveResults } from './check'

const console = new ConsoleExtended(process.stdout, process.stderr, false)

const templatePath = path.join(process.cwd(), 'src', 'pages', '_index.astro.template')
const baseIndexPath = path.join(process.cwd(), 'src', 'pages', 'base.astro')
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

function getComponentsFromArgs() {
  const args = process.argv.slice(2).filter(arg => components.includes(arg))
  return args.length > 0 ? args : components
}

async function main() {
  const foundComponents = getComponentsFromArgs()

  for (const component of foundComponents) {
    console.log(`Building ${colorize(component)}...`)

    await updateIndexFile(component)

    await $`${component.toUpperCase()}=true bun run astro build`.quiet()
    await $`rm -rf dist-${component}`
    await $`mv dist dist-${component}`
  }

  console.shout('All builds completed')

  const isSort = process.argv.includes('--sort') || process.argv.includes('-s')
  const results = await check(foundComponents)
  logResults(results, isSort)

  if (foundComponents === components) {
    await saveResults(results)
    console.shout('Results saved')
    await createMarkdownTable(results)
    console.shout('Markdown table created')
  }
}

await main()
