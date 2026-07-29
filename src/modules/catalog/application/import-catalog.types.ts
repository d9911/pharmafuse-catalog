export interface ImportStats {
  providerRecordsRead: number;
  medicinesCreated: number;
  sourceRecordsLinked: number;
  duplicatesMerged: number;
  recordErrors: number;
}

export interface ImportBatchResult extends ImportStats {
  id: string;
  status: 'COMPLETED';
  startedAt: string;
  finishedAt: string;
}
