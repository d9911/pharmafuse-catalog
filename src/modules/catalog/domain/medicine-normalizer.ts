import type {
  DosageForm,
  NormalizedMedicineCandidate,
  RawMedicineRecord,
} from './catalog.types';
import { normalizeGtin } from './gtin';

const DOSAGE_FORMS = new Set([
  'tablet',
  'tablets',
  'tab',
  'tabs',
  'film coated tablet',
  'film coated tablets',
  'film coated tab',
  'film coated tabs',
]);

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeName(value: string): string {
  const normalized = normalizeText(value)
    .replace(/\b\d+(?:[.,]\d+)?\s*mg\b/gu, ' ')
    .replace(/\bfilm[\s-]*coated\b/gu, ' ')
    .replace(/\b(?:tablets?|tabs?)\b/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    throw new Error(`INVALID_NAME:${value}`);
  }
  return normalized;
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(' ');
}

function normalizeManufacturer(value: string): string {
  const normalized = normalizeText(value)
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((token) => !['ltd', 'limited', 'healthcare'].includes(token))
    .join(' ')
    .trim();

  if (normalized.length === 0) {
    throw new Error(`INVALID_MANUFACTURER:${value}`);
  }
  return normalized;
}

function dosageToMicrograms(value: number, unit: string): number {
  const normalizedUnit = normalizeText(unit);
  if (normalizedUnit !== 'mg') {
    throw new Error(`UNSUPPORTED_DOSAGE_UNIT:${unit}`);
  }

  const micrograms = value * 1_000;
  if (!Number.isSafeInteger(micrograms) || micrograms <= 0) {
    throw new Error(`INVALID_DOSAGE:${value} ${unit}`);
  }
  return micrograms;
}

function normalizeDosageForm(value: string): DosageForm {
  const normalized = normalizeText(value).replace(/-/g, ' ');
  if (!DOSAGE_FORMS.has(normalized)) {
    throw new Error(`UNSUPPORTED_DOSAGE_FORM:${value}`);
  }
  return 'TABLET';
}

function normalizePrescription(value: boolean | string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeText(value);
  if (['false', 'no'].includes(normalized)) {
    return false;
  }
  if (['true', 'yes'].includes(normalized)) {
    return true;
  }
  throw new Error(`INVALID_PRESCRIPTION_VALUE:${value}`);
}

function normalizeCountry(value: string): 'GB' {
  const normalized = normalizeText(value);
  if (!['gb', 'uk', 'united kingdom'].includes(normalized)) {
    throw new Error(`UNSUPPORTED_COUNTRY:${value}`);
  }
  return 'GB';
}

function normalizeDate(value: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dottedMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  const slashedMatch = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);

  let year: number;
  let month: number;
  let day: number;

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (dottedMatch) {
    day = Number(dottedMatch[1]);
    month = Number(dottedMatch[2]);
    year = Number(dottedMatch[3]);
  } else if (slashedMatch) {
    year = Number(slashedMatch[1]);
    month = Number(slashedMatch[2]);
    day = Number(slashedMatch[3]);
  } else {
    throw new Error(`INVALID_DATE:${value}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`INVALID_DATE:${value}`);
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`;
}

export function normalizeMedicine(record: RawMedicineRecord): NormalizedMedicineCandidate {
  if (!Number.isSafeInteger(record.packageSize) || record.packageSize <= 0) {
    throw new Error(`INVALID_PACKAGE_SIZE:${record.packageSize}`);
  }

  const normalizedName = normalizeName(record.name);
  const normalizedManufacturer = normalizeManufacturer(record.manufacturer);
  const dosageMicrograms = dosageToMicrograms(record.dosageValue, record.dosageUnit);
  const dosageForm = normalizeDosageForm(record.dosageForm);
  const prescriptionRequired = normalizePrescription(record.prescriptionRequired);
  const countryCode = normalizeCountry(record.country);
  const registrationDate = normalizeDate(record.registrationDate);
  const gtin = normalizeGtin(record.gtin);
  const compositeKey = [
    normalizedName,
    normalizedManufacturer,
    dosageMicrograms,
    dosageForm,
    record.packageSize,
    countryCode,
  ].join('|');
  const dosageMilligrams = dosageMicrograms / 1_000;

  const normalizedPayload = {
    canonicalName: `${titleCase(normalizedName)} ${dosageMilligrams} mg tablets`,
    normalizedName,
    manufacturer: titleCase(normalizedManufacturer),
    normalizedManufacturer,
    gtin: gtin.value,
    gtinValid: gtin.valid,
    dosageMicrograms,
    dosageForm,
    packageSize: record.packageSize,
    prescriptionRequired,
    countryCode,
    registrationDate,
    compositeKey,
  };

  return {
    providerCode: record.providerCode,
    externalId: record.externalId,
    sourceFile: record.sourceFile,
    ...normalizedPayload,
    rawPayloadJson: JSON.stringify(record.rawPayload),
    normalizedPayloadJson: JSON.stringify(normalizedPayload),
  };
}
