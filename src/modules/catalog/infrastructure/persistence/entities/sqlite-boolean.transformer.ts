export const sqliteBoolean = {
  to(value: boolean): number {
    return value ? 1 : 0
  },
  from(value: number): boolean {
    return value === 1
  },
}
