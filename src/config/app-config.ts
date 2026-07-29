import { resolve } from 'node:path';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  databasePath: string;
  sourceRoot: string;
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const port = Number(env.PORT ?? 3008);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '127.0.0.1',
    port,
    databasePath: resolve(process.cwd(), env.DATABASE_PATH ?? 'data/pharmacy.sqlite'),
    sourceRoot: resolve(process.cwd(), env.SOURCE_ROOT ?? 'pnarmacy'),
  };
}
