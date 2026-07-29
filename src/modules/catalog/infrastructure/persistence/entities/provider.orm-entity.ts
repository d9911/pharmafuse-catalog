import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('providers')
export class ProviderOrmEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('text', { unique: true })
  code!: string

  @Column('text')
  name!: string

  @Column('text', { name: 'source_file' })
  sourceFile!: string
}
