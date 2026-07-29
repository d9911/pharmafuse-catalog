import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('source_records')
export class SourceRecordOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'provider_id' })
  providerId!: string;

  @Column('text', { name: 'import_batch_id' })
  importBatchId!: string;

  @Column('text', { name: 'external_id' })
  externalId!: string;

  @Column('text', { name: 'source_file' })
  sourceFile!: string;

  @Column('text', { name: 'raw_payload_json' })
  rawPayloadJson!: string;

  @Column('text', { name: 'normalized_payload_json' })
  normalizedPayloadJson!: string;

  @Column('text', { name: 'payload_hash' })
  payloadHash!: string;

  @Column('text', { name: 'imported_at' })
  importedAt!: string;
}
