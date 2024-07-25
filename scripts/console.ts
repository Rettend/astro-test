import process from 'node:process'
import chalk from 'chalk'
import type { Component } from './check'

type TransformFn = (text: string) => string

interface ColorMapping {
  transform: TransformFn
  lastColor: typeof chalk
}

const colorMappings: { [K in Component]: typeof chalk | ColorMapping } = {
  base: chalk.bold,
  vue: chalk.green,
  solid: chalk.cyan,
  vue_astro: {
    transform: (text: string) => {
      const [vue, astro] = text.split('_')
      return `${chalk.green(vue)}${chalk.green('/')}${chalk.magenta(astro)}`
    },
    lastColor: chalk.magenta,
  },
  solid_astro: {
    transform: (text: string) => {
      const [solid, astro] = text.split('_')
      return `${chalk.cyan(solid)}${chalk.cyan('/')}${chalk.magenta(astro)}`
    },
    lastColor: chalk.magenta,
  },
}

class ChainableConsole extends console.Console {
  #chain: this
  #isChaining: boolean = false
  #isFirstInChain: boolean = true
  #prevColor: typeof chalk = chalk.white
  #prevTransformation: TransformFn = (text: string) => text

  constructor(stdout: NodeJS.WriteStream, stderr: NodeJS.WriteStream, ignoreErrors?: boolean) {
    super(stdout, stderr, ignoreErrors)
    this.#chain = this.createChain()
  }

  /**
   * Logs a message with a leading `>` and makes it bold.
   */
  heading(...args: any[]) {
    this.log(chalk.bold(`> ${args.join(' ')}`))
    return this
  }

  /**
   * Logs a message with colorized component names.
   *
   * @example
   * vue -> green(vue)
   * solid -> cyan(solid)
   * astro -> magenta(astro)
   * vue_astro -> green(vue) + green(/) + magenta(astro)
   * solid_astro -> cyan(solid) + cyan(/) + magenta(astro)
   */
  colorize(...args: string[]) {
    const keys = Object.keys(colorMappings).join('|')
    const regex = new RegExp(`\\b(${keys})\\b`, 'g')

    const colorizeText = (text: string) => {
      return text.replace(regex, (match) => {
        const colorOrTransform = colorMappings[match as Component] || chalk.white
        if (typeof colorOrTransform === 'object') {
          this.#prevColor = colorOrTransform.lastColor
          this.#prevTransformation = colorOrTransform.transform
        }
        else {
          this.#prevColor = colorOrTransform
          this.#prevTransformation = (text: string) => this.#prevColor(text)
        }
        return this.#prevTransformation(match)
      })
    }

    this.log(...args.map(colorizeText))
    return this
  }

  /**
   * Logs the size and gzipped size in kB and in muted color.
   */
  dump(size: number, gzippedSize: number) {
    this.log(chalk.gray(`${(size / 1024).toFixed(2)} kB (${(gzippedSize / 1024).toFixed(2)} kB gzipped)`))
    return this
  }

  /**
   * Logs a message.
   */
  override log(...args: any[]) {
    if (this.#isChaining)
      process.stdout.write(args.join(' '))
    else
      super.log(...args)

    return this
  }

  /**
   * Chains multiple console methods together.
   *
   * @example
   * console.chain(c => c
   *  .log('Hello')
   *  .log('World'),
   * )
   * // Output: Hello World
   */
  chain(callback: (c: this) => void) {
    this.#isChaining = true
    this.#isFirstInChain = true
    callback(this.#chain)
    this.#isChaining = false
    process.stdout.write('\n')
    return this
  }

  /**
   * Pipes the last color and transformation to the next chain.
   *
   * @example
   * console.chain(c => c
   *  .colorize('asd')
   *  .colorize('solid_astro')
   *  .pipeTo((c, lastColor, lastTransformation) => c
   *    .log(lastColor('asd'))
   *    .log(lastTransformation('...')),
   *  ),
   * )
   */
  pipeTo(callback: (c: this, prevColor: typeof chalk, prevTransformation: TransformFn) => void) {
    this.#isFirstInChain = true
    callback(this.#chain, this.#prevColor, this.#prevTransformation)
    return this
  }

  private createChain() {
    return new Proxy(this, {
      get: (target, prop: string) => {
        if (typeof target[prop as keyof this] === 'function') {
          return (...args: any[]) => {
            if (this.#isChaining && !this.#isFirstInChain)
              process.stdout.write(' ');

            (target[prop as keyof this] as (...args: any[]) => this)(...args)
            this.#isFirstInChain = false
            return this.#chain
          }
        }
        return target[prop as keyof this]
      },
    })
  }
}

const c = new ChainableConsole(process.stdout, process.stderr)
export { c as console }
