const GTIN_LENGTHS = new Set([8, 12, 13, 14])

export interface NormalizedGtin {
  value: string | null
  valid: boolean
}

export function normalizeGtin(input: string | null): NormalizedGtin {
  if (input === null) {
    return { value: null, valid: false }
  }

  const value = input.replace(/[^0-9]/g, '')
  if (!GTIN_LENGTHS.has(value.length)) {
    return { value, valid: false }
  }

  const suppliedCheckDigit = Number(value.at(-1))
  const body = value.slice(0, -1)
  let weightedSum = 0

  for (let index = body.length - 1, positionFromRight = 1; index >= 0; index -= 1, positionFromRight += 1) {
    weightedSum += Number(body[index]) * (positionFromRight % 2 === 1 ? 3 : 1)
  }

  const calculatedCheckDigit = (10 - (weightedSum % 10)) % 10
  return {
    value,
    valid: calculatedCheckDigit === suppliedCheckDigit,
  }
}
