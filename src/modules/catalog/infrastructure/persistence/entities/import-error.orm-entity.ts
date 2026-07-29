import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ProviderCode } from '../../../domain/catalog.types';

@Entity('import_errors')
export class ImportErrorOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'import_batch_id' })
  importBatchId!: string;

  @Column('text', { name: 'provider_code' })
  providerCode!: ProviderCode;

  @Column('text', { name: 'external_id', nullable: true })
  externalId!: string | null;

  @Column('text', { name: 'source_file' })
  sourceFile!: string;

  @Column('text', { name: 'error_code' })
  errorCode!: string;

  @Column('text')
  message!: string;

  @Column('text', { name: 'raw_payload_json', nullable: true })
  rawPayloadJson!: string | null;

  @Column('text', { name: 'created_at' })
  createdAt!: string;
}
