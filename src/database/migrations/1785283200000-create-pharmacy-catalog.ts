import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePharmacyCatalog1785283200000 implements MigrationInterface {
  name = 'CreatePharmacyCatalog1785283200000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE providers (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        source_file TEXT NOT NULL
      )
    `)
    await queryRunner.query(`
      CREATE TABLE import_batches (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        provider_records_read INTEGER NOT NULL DEFAULT 0,
        medicines_created INTEGER NOT NULL DEFAULT 0,
        source_records_linked INTEGER NOT NULL DEFAULT 0,
        duplicates_merged INTEGER NOT NULL DEFAULT 0,
        record_errors INTEGER NOT NULL DEFAULT 0,
        failure_message TEXT
      )
    `)
    await queryRunner.query(`
      CREATE TABLE medicines (
        id TEXT PRIMARY KEY,
        canonical_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        normalized_manufacturer TEXT NOT NULL,
        gtin TEXT,
        gtin_valid INTEGER NOT NULL CHECK (gtin_valid IN (0, 1)),
        dosage_micrograms INTEGER NOT NULL CHECK (dosage_micrograms > 0),
        dosage_form TEXT NOT NULL CHECK (dosage_form IN ('TABLET')),
        package_size INTEGER NOT NULL CHECK (package_size > 0),
        prescription_required INTEGER NOT NULL
          CHECK (prescription_required IN (0, 1)),
        country_code TEXT NOT NULL,
        registration_date TEXT NOT NULL,
        composite_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_medicines_valid_gtin
      ON medicines(gtin)
      WHERE gtin IS NOT NULL AND gtin_valid = 1
    `)
    await queryRunner.query(`
      CREATE INDEX ix_medicines_composite_key
      ON medicines(composite_key)
    `)
    await queryRunner.query(`
      CREATE TABLE source_records (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES providers(id),
        import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
        external_id TEXT NOT NULL,
        source_file TEXT NOT NULL,
        raw_payload_json TEXT NOT NULL,
        normalized_payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        UNIQUE(provider_id, external_id, payload_hash)
      )
    `)
    await queryRunner.query(`
      CREATE TABLE medicine_sources (
        medicine_id TEXT NOT NULL REFERENCES medicines(id),
        source_record_id TEXT NOT NULL UNIQUE REFERENCES source_records(id),
        match_strategy TEXT NOT NULL CHECK (
          match_strategy IN (
            'NEW_RECORD',
            'VALID_GTIN',
            'INVALID_GTIN_WITH_COMPOSITE',
            'COMPOSITE_KEY'
          )
        ),
        linked_at TEXT NOT NULL,
        PRIMARY KEY(medicine_id, source_record_id)
      )
    `)
    await queryRunner.query(`
      CREATE TABLE import_errors (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
        provider_code TEXT NOT NULL,
        external_id TEXT,
        source_file TEXT NOT NULL,
        error_code TEXT NOT NULL,
        message TEXT NOT NULL,
        raw_payload_json TEXT,
        created_at TEXT NOT NULL
      )
    `)
    await queryRunner.query(`
      INSERT INTO providers (id, code, name, source_file) VALUES
        ('provider-a', 'pharmacy-a', 'Pharmacy A', 'pharmacy_a.json'),
        ('provider-b', 'pharmacy-b', 'Pharmacy B', 'pharmacy_b.xml'),
        ('provider-c', 'pharmacy-c', 'Pharmacy C', 'pharmacy_c.json')
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE import_errors')
    await queryRunner.query('DROP TABLE medicine_sources')
    await queryRunner.query('DROP TABLE source_records')
    await queryRunner.query('DROP TABLE medicines')
    await queryRunner.query('DROP TABLE import_batches')
    await queryRunner.query('DROP TABLE providers')
  }
}
