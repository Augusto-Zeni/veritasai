import { parseArgs, type ParseArgsConfig } from 'node:util'

/**
 * `parseArgs` que ignora o `--` que o pnpm repassa (`pnpm eval:run -- --variant full`).
 */
export function parseCliArgs<T extends NonNullable<ParseArgsConfig['options']>>(options: T) {
  return parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options,
    allowPositionals: true,
  })
}

/** Encerra com mensagem de erro (para validação de argumentos). */
export function fail(message: string): never {
  process.stderr.write(`✘ ${message}\n`)
  process.exit(1)
}
