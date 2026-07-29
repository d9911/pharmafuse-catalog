import { Column, Entity, PrimaryColumn } from 'typeorm'
import type { DosageForm } from '../../../domain/catalog.types'
import { sqliteBoolean } from './sqlite-boolean.transformer'

@Entity('medicines')
export class MedicineOrmEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('text', { name: 'canonical_name' })
  canonicalName!: string

  @Column('text', { name: 'normalized_name' })
  normalizedName!: string

  @Column('text')
  manufacturer!: string

  @Column('text', { name: 'normalized_manufacturer' })
  normalizedManufacturer!: string

  @Column('text', { nullable: true })
  gtin!: string | null

  @Column('integer', { name: 'gtin_valid', transformer: sqliteBoolean })
  gtinValid!: boolean

  @Column('integer', { name: 'dosage_micrograms' })
  dosageMicrograms!: number

  @Column('text', { name: 'dosage_form' })
  dosageForm!: DosageForm

  @Column('integer', { name: 'package_size' })
  packageSize!: number

  @Column('integer', {
    name: 'prescription_required',
    transformer: sqliteBoolean,
  })
  prescriptionRequired!: boolean

  @Column('text', { name: 'country_code' })
  countryCode!: string

  @Column('text', { name: 'registration_date' })
  registrationDate!: string

  @Column('text', { name: 'composite_key' })
  compositeKey!: string

  @Column('text', { name: 'created_at' })
  createdAt!: string

  @Column('text', { name: 'updated_at' })
  updatedAt!: string
}
