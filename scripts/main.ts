import process from 'node:process'
import { isEqual } from 'lodash-es'
import { build, getComponentsFromArgs } from './build'
import { check, components, createMarkdownTable, logResults, saveResults } from './check'
import { console } from './console'

async function main() {
  const foundComponents = getComponentsFromArgs()
  await build(foundComponents)

  const isSort = process.argv.includes('--sort') || process.argv.includes('-s')
  const results = await check(foundComponents)
  logResults(results, isSort)

  if (isEqual(foundComponents, components)) {
    await saveResults(results)
    console.heading('Results saved')
    await createMarkdownTable(results)
    console.heading('Markdown table created')
  }
}

await main()
