# astro-test

Benchmarking framework bundle sizes with astro.

## Latest Results

The base bundle size is substracted from the framework bundle size to get the actual framework size.

<!-- RESULTS_START -->
| Framework | Versions | Size (KB) | Size (KB gzip) |
| --------- | -------- | --------- | -------------- |
| solid_astro | `astro@^4.12.2, @astrojs/solid-js@^4.4.0` | 0.76 | 0.62 |
| vue_astro | `astro@^4.12.2, @astrojs/vue@^4.5.0` | 1.49 | 1.33 |
| vue | `vue@^3.4.33` | 5.63 | 2.82 |
| solid | `solid-js@^1.8.18` | 6.15 | 2.84 |
| base | `astro@^4.12.2` | 73.11 | 30.80 |
<!-- RESULTS_END -->

actual:

- solid_astro: 8 KB (gzip: 5.6 KB)
- vue_astro: 15.2 KB (gzip: 8.3 KB)
- vue: 69.6 KB (gzip: 30.6 KB)
- solid: 18.1 KB (gzip: 10.1 KB)
- base: 1.6 KB (gzip: 2.2 KB)

Results:
base: 1.59 KB (gzip: 0.88 KB)
vue_astro: 1.88 KB (gzip: 1.12 KB)
solid_astro: 1.87 KB (gzip: 1.11 KB)
vue: 5.55 KB (gzip: 2.50 KB) // missing: client.CMMtWkl7.js
solid: 5.95 KB (gzip: 2.71 KB)

## Usage

```sh
bun run bench [frameworks...] [options]
```

Running without arguments will benchmark all frameworks.

### Options

- `--sort`, `-s`: Sort by size. Default is false.

### Example

```sh
bun run bench vue solid
```

>[!TIP]
> Use `base` to compare against the base size.
