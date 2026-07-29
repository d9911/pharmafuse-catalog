import { normalizeGtin } from './gtin';

describe('normalizeGtin', () => {
  it('preserves the leading zero while removing separators', () => {
    expect(normalizeGtin('0505-0123-4567-89')).toEqual({
      value: '05050123456789',
      valid: false,
    });
  });

  it('accepts a GTIN with a valid GS1 check digit', () => {
    expect(normalizeGtin('4006381333931')).toEqual({
      value: '4006381333931',
      valid: true,
    });
  });

  it('keeps an identifier with an unsupported length for auditing', () => {
    expect(normalizeGtin('123')).toEqual({ value: '123', valid: false });
  });

  it('does not fabricate a missing identifier', () => {
    expect(normalizeGtin(null)).toEqual({ value: null, valid: false });
  });
});
