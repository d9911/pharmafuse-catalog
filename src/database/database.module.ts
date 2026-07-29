import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { AppConfigModule } from '../config/app-config.module';
import { entities } from '../modules/catalog/infrastructure/persistence/entities';
import { CreatePharmacyCatalog1785283200000 } from './migrations/1785283200000-create-pharmacy-catalog';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        mkdirSync(dirname(config.databasePath), { recursive: true });
        return {
          type: 'better-sqlite3' as const,
          database: config.databasePath,
          entities,
          migrations: [CreatePharmacyCatalog1785283200000],
          synchronize: false,
          migrationsRun: false,
          prepareDatabase: (database: { pragma(statement: string): unknown }) => {
            database.pragma('foreign_keys = ON');
            database.pragma(
              config.nodeEnv === 'test' ? 'journal_mode = MEMORY' : 'journal_mode = WAL',
            );
          },
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
