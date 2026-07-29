import type { CatalogReadRepository, ImportBatchView, MedicineView } from './ports/catalog-read.repository'

export class GetCatalogQuery {
  constructor(private readonly repository: CatalogReadRepository) {}

  list(): Promise<MedicineView[]> {
    return this.repository.listMedicines()
  }

  findById(id: string): Promise<MedicineView | null> {
    return this.repository.findMedicine(id)
  }

  listImportBatches(): Promise<ImportBatchView[]> {
    return this.repository.listImportBatches()
  }
}
