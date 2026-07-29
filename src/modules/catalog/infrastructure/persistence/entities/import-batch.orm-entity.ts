import { Column, Entity, PrimaryColumn } from 'typeorm'
import type { ImportBatchStatus } from '../../../application/ports/catalog-read.repository'

@Entity('import_batches')
export class ImportBatchOrmEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('text')
  status!: ImportBatchStatus

  @Column('text', { name: 'started_at' })
  startedAt!: string

  @Column('text', { name: 'finished_at', nullable: true })
  finishedAt!: string | null

  @Column('integer', { name: 'provider_records_read', default: 0 })
  providerRecordsRead!: number

  @Column('integer', { name: 'medicines_created', default: 0 })
  medicinesCreated!: number

  @Column('integer', { name: 'source_records_linked', default: 0 })
  sourceRecordsLinked!: number

  @Column('integer', { name: 'duplicates_merged', default: 0 })
  duplicatesMerged!: number

  @Column('integer', { name: 'record_errors', default: 0 })
  recordErrors!: number

  @Column('text', { name: 'failure_message', nullable: true })
  failureMessage!: string | null
}
