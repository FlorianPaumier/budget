import { describe, expect, it } from 'vitest'
import { parseCadCents, formatCad, inputCad } from './money'

describe('exact CAD input', () => {
  it.each([
    ['12,34', 1234],
    ['12.34', 1234],
    ['-0,01', -1],
    ['0', 0],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('parses %s', (input, want) => expect(parseCadCents(input)).toBe(want))
  it.each([
    '1,2.3',
    '1.234',
    '1e3',
    '',
    '90071992547409.92',
    'NaN',
    '12 34',
    '--1',
  ])('rejects %s', (input) => expect(() => parseCadCents(input)).toThrow())
  it('formats CAD in French Canadian style', () =>
    expect(formatCad(1234)).toContain('12,34'))
})

it('preserves cents at the safe integer boundary when editing', () =>
  expect(inputCad(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91'))

it('does not round a cent while editing large safe amounts', () =>
  expect(inputCad(9007199254740987)).toBe('90071992547409.87'))
