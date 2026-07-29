import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, type MercuriusDriverConfig } from '@nestjs/mercurius';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { CatalogModule } from './modules/catalog';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    GraphQLModule.forRootAsync<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      imports: [AppConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        graphiql: config.nodeEnv !== 'production',
        path: '/graphql',
      }),
    }),
    CatalogModule,
  ],
})
export class AppModule {}
