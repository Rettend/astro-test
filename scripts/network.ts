import puppeteer from 'puppeteer'
import { build, getComponentsFromArgs } from './build'

interface AssetSizes {
  size: number
  gzipped: number
}

interface AssetMap {
  [type: string]: AssetSizes
}

interface Results {
  [component: string]: {
    totalSize: number
    totalGzippedSize: number
    assets: AssetMap
  }
}

async function buildAndMeasurePreviewAssets(component: string): Promise<AssetMap> {
  const assets: AssetMap = {}

  // Run the preview server
  console.log(`Starting preview server for ${component}...`)
  const previewProc = Bun.spawn(['bun', 'run', 'astro', 'preview', '--outDir', `dist-${component}`], {
    stdout: 'pipe',
  })

  let buffer = ''
  const reader = previewProc.stdout.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.error(`Preview server for ${component} closed unexpectedly`)
        break
      }

      buffer += new TextDecoder().decode(value)
      const match = buffer.match(/Local\s+(http:\/\/\S+)/)
      if (match) {
        const url = match[1] ?? ''
        console.log(`Preview server started at ${url}`)
        await measurePageSize(url)
        previewProc.kill()
        break
      }
    }
  }
  catch (error) {
    console.error(`Error reading from preview server for ${component}:`, error)
    previewProc.kill()
  }

  // Set a timeout in case the server doesn't start
  setTimeout(() => {
    console.error(`Timeout waiting for preview server for ${component}`)
    previewProc.kill()
  }, 30000) // 30 seconds timeout

  return assets
}

async function measurePageSize(url: string) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  let totalSize = 0
  let totalGzippedSize = 0
  const assetSizes: AssetMap = {}

  page.on('response', async (response) => {
    try {
      const responseUrl = response.url()
      const contentType = response.headers()['content-type'] || 'unknown'

      // Skip data URIs
      if (responseUrl.startsWith('data:'))
        return

      const responseText = await response.text()

      const rawSize = responseText.length
      const gzippedSize = Bun.gzipSync(responseText).length

      totalSize += rawSize
      totalGzippedSize += gzippedSize

      if (!assetSizes[contentType])
        assetSizes[contentType] = { size: 0, gzipped: 0 }

      assetSizes[contentType].size += rawSize
      assetSizes[contentType].gzipped += gzippedSize

      console.log(`Asset: ${responseUrl}, Type: ${contentType}, Raw: ${rawSize}, Gzipped: ${gzippedSize}`)
    }
    catch (error) {
      console.error(`Error processing response: ${error}`)
    }
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
  }
  catch (error) {
    console.error(`Failed to load page ${url}: ${error}`)
  }

  await browser.close()

  return { totalSize, totalGzippedSize, assetSizes }
}

async function main() {
  const results: Results = {}
  const foundComponents = getComponentsFromArgs()

  try {
    await build(foundComponents)

    for (const component of foundComponents) {
      console.log(`Processing ${component}...`)
      const results = (await buildAndMeasurePreviewAssets(component))[component]

      if (!results) {
        console.error(`No results found for ${component}`)
        continue
      }

      const { totalSize, totalGzippedSize, assets } = results
      results[component] = { totalSize, totalGzippedSize, assets }
    }

    console.log('\nResults:')
    for (const [component, { totalSize, totalGzippedSize, assets }] of Object.entries(results)) {
      console.log(`${component}:`)
      console.log(`  Total: ${(totalSize / 1024).toFixed(2)} KB (gzip: ${(totalGzippedSize / 1024).toFixed(2)} KB)`)
      for (const [type, { size, gzippedSize }] of Object.entries(assets))
        console.log(`  ${type}: ${(size / 1024).toFixed(2)} KB (gzip: ${(gzippedSize / 1024).toFixed(2)} KB)`)
    }
  }
  catch (error) {
    console.error('An error occurred during measurement:', error)
  }
}

await main()
