import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { MatchStrategy } from '../../../domain/catalog.types';

@Entity('medicine_sources')
export class MedicineSourceOrmEntity {
  @PrimaryColumn('text', { name: 'medicine_id' })
  medicineId!: string;

  @PrimaryColumn('text', { name: 'source_record_id' })
  sourceRecordId!: string;

  @Column('text', { name: 'match_strategy' })
  matchStrategy!: MatchStrategy;

  @Column('text', { name: 'linked_at' })
  linkedAt!: string;
}
