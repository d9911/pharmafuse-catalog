import { resolve } from 'node:path'

export const APP_CONFIG = Symbol('APP_CONFIG')

export interface AppConfig {
  nodeEnv: string
  host: string
  port: number
  databasePath: string
  sourceRoot: string
  graphiqlEnabled: boolean
}

function parseGraphiqlEnabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('GRAPHIQL_ENABLED must be true or false')
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const port = Number(env.PORT ?? 3008)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return {
    nodeEnv,
    host: env.HOST ?? '127.0.0.1',
    port,
    databasePath: resolve(process.cwd(), env.DATABASE_PATH ?? 'data/pharmacy.sqlite'),
    sourceRoot: resolve(process.cwd(), env.SOURCE_ROOT ?? 'pnarmacy'),
    graphiqlEnabled: parseGraphiqlEnabled(env.GRAPHIQL_ENABLED, nodeEnv !== 'production'),
  }
}
