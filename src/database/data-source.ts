import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DataSource } from 'typeorm';
import { loadAppConfig } from '../config/app-config';
import { entities } from '../modules/catalog/infrastructure/persistence/entities';
import { CreatePharmacyCatalog1785283200000 } from './migrations/1785283200000-create-pharmacy-catalog';

const config = loadAppConfig(process.env);
mkdirSync(dirname(config.databasePath), { recursive: true });

export default new DataSource({
  type: 'better-sqlite3',
  database: config.databasePath,
  entities,
  migrations: [CreatePharmacyCatalog1785283200000],
  synchronize: false,
  migrationsRun: false,
  prepareDatabase: (database: { pragma(statement: string): unknown }) => {
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
  },
});
