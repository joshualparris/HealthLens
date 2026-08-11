import { describe, it } from 'node:test'
import assert from 'node:assert'

const expect = (actual) => {
  return {
    toBe: (expected) => assert.strictEqual(actual, expected),
    toBeCloseTo: (expected) => {
      if (Math.abs(actual - expected) > 0.0001) {
        assert.fail(`Expected ${actual} to be close to ${expected}`)
      }
    },
    toBeNull: () => assert.strictEqual(actual, null),
    not: {
      toBe: (expected) => assert.notStrictEqual(actual, expected)
    }
  }
}
import { 
  calculateMedian, 
  calculateMean, 
  calculateCV, 
  getLocalDateString, 
  computeHrvBaselinesFromRows 
} from '../src/lib/health/hrvBaseline.js'

describe('Math utilities', () => {
  it('odd and even sample-count medians', () => {
    expect(calculateMedian([10, 20, 30])).toBe(20)
    expect(calculateMedian([10, 20, 30, 40])).toBe(25)
  })

  it('decimal median', () => {
    expect(calculateMedian([1.5, 2.5, 3.5])).toBe(2.5)
    expect(calculateMedian([1.5, 2.5, 3.5, 4.5])).toBe(3.0)
  })

  it('median versus mean producing different results', () => {
    const arr = [10, 20, 100] // mean is 43.333..., median is 20
    expect(calculateMedian(arr)).toBe(20)
    expect(calculateMean(arr)).toBeCloseTo(43.333333333333336)
    expect(calculateMedian(arr)).not.toBe(calculateMean(arr))
  })

  it('CV definition and expected exact result', () => {
    // arr = [2, 4, 4, 4, 5, 5, 7, 9] -> mean = 5. 
    // variance = sum((x - 5)^2) / 8 = (9 + 1 + 1 + 1 + 0 + 0 + 4 + 16) / 8 = 32 / 8 = 4
    // stddev = sqrt(4) = 2. CV = 2 / 5 = 0.4
    expect(calculateCV([2, 4, 4, 4, 5, 5, 7, 9])).toBe(0.4)
  })

  it('zero-mean and one-value CV handling', () => {
    expect(calculateCV([0, 0, 0])).toBeNull()
    expect(calculateCV([5])).toBeNull()
  })
})

describe('Date handling', () => {
  it('Australia/Sydney date conversion', () => {
    // Epoch 0 is Jan 1, 1970 00:00:00 UTC, which is 10:00 AM Sydney (AEDT/AEST)
    expect(getLocalDateString(0)).toBe('1970-01-01')
  })
  
  it('daylight-saving boundary dates', () => {
    // April 5, 2026, Sydney daylight saving ends at 3:00 am -> 2:00 am.
    // Let's use a fixed timestamp just to ensure it parses without throwing.
    expect(getLocalDateString(new Date('2026-04-05T02:30:00Z').getTime())).toBe('2026-04-05')
  })
})

describe('computeHrvBaselinesFromRows', () => {
  const baseDay = new Date('2026-08-01T12:00:00Z').getTime()
  
  const generateRow = (daysAgo, value, id = null, time = null) => {
    const d = new Date(baseDay - daysAgo * 86400000)
    return {
      day: d.toISOString().slice(0, 10),
      value: value,
      id: id,
      time: time || d.getTime()
    }
  }

  it('exact 7-day and 28-day date boundaries (non-overlapping)', () => {
    const rows = []
    // Latest day is 2026-08-01 (Day 0).
    // Days 0-6 (7 days, 2026-07-26 to 2026-08-01)
    for (let i = 0; i < 7; i++) rows.push(generateRow(i, 40)) // median7 = 40
    // Days 7-34 (28 days, 2026-06-28 to 2026-07-25)
    for (let i = 7; i < 35; i++) rows.push(generateRow(i, 50)) // median28 = 50
    
    // Day 35 (2026-06-27) is outside the 28 day boundary and should be ignored
    rows.push(generateRow(35, 100))
    
    const result = computeHrvBaselinesFromRows(rows)
    expect(result.validDays7).toBe(7)
    expect(result.median7).toBe(40)
    expect(result.recentWindowStart).toBe('2026-07-26')
    expect(result.recentWindowEnd).toBe('2026-08-01')
    
    expect(result.validDays28).toBe(28)
    expect(result.median28).toBe(50) // If Day 35 was included, median would shift
    expect(result.baselineWindowStart).toBe('2026-06-28')
    expect(result.baselineWindowEnd).toBe('2026-07-25')
    
    expect(result.pctDiff).toBe(-20) // (40 - 50) / 50 * 100 = -20%
    expect(result.label).toBe('below recent baseline')
    expect(result.confidence).toBe('high')
  })

  it('fewer than seven recent valid days & missing calendar days', () => {
    const rows = []
    // 3 recent days out of 7
    rows.push(generateRow(0, 40))
    rows.push(generateRow(2, 40))
    rows.push(generateRow(5, 40))
    
    // 15 baseline days out of 28
    for (let i = 10; i < 25; i++) rows.push(generateRow(i, 50))
    
    const result = computeHrvBaselinesFromRows(rows)
    expect(result.validDays7).toBe(3)
    expect(result.validDays28).toBe(15)
    expect(result.confidence).toBe('medium')
  })

  it('fewer than 28 historical valid days (insufficient)', () => {
    const rows = []
    // 7 recent days
    for (let i = 0; i < 7; i++) rows.push(generateRow(i, 40))
    // Only 10 baseline days
    for (let i = 7; i < 17; i++) rows.push(generateRow(i, 50))
    
    const result = computeHrvBaselinesFromRows(rows)
    expect(result.validDays7).toBe(7)
    expect(result.validDays28).toBe(10)
    expect(result.median28).toBeNull() // Not enough for meaningful baseline
    expect(result.confidence).toBe('low')
  })

  it('multiple samples per day, duplicate IDs, duplicate composite records, and legitimate same-time records', () => {
    const rows = [
      // Multiple samples for same day
      generateRow(0, 30, 'id1'),
      generateRow(0, 50, 'id2'),
      // Duplicate ID
      generateRow(0, 50, 'id2'), 
      // Duplicate composite (no ID, same day, time, value)
      generateRow(1, 40, null, 1000),
      generateRow(1, 40, null, 1000), 
      // Legitimate same-time, different source (no ID, same time, DIFFERENT value)
      generateRow(1, 45, null, 1000)
    ]
    const result = computeHrvBaselinesFromRows(rows)
    
    expect(result.audit.rawRows).toBe(6)
    expect(result.audit.duplicates).toBe(2)
    expect(result.audit.retainedSamples).toBe(4)
    expect(result.audit.distinctDays).toBe(2)
    
    // Day 0 retained: 30, 50. Median = 40.
    // Day 1 retained: 40, 45. Median = 42.5.
    // Overall median7 of [42.5, 40] = 41.25.
    expect(result.median7).toBe(41.25)
  })

  it('invalid negative, zero, null, text, NaN, and implausible RMSSD values', () => {
    const rows = [
      generateRow(0, -10),
      generateRow(0, 0),
      generateRow(0, null),
      generateRow(0, 'text'),
      generateRow(0, NaN),
      generateRow(0, 600), // > 500 (implausible)
      generateRow(0, 45) // Only valid one
    ]
    const result = computeHrvBaselinesFromRows(rows)
    expect(result.audit.invalidRows).toBe(6)
    expect(result.audit.retainedSamples).toBe(1)
    expect(result.latestMedian).toBe(45)
  })

  it('classification boundary values', () => {
    const runBoundaries = (m7, m28) => {
      const rows = []
      for (let i = 0; i < 7; i++) rows.push(generateRow(i, m7))
      for (let i = 7; i < 35; i++) rows.push(generateRow(i, m28))
      return computeHrvBaselinesFromRows(rows).label
    }
    
    // Exact +5%
    expect(runBoundaries(105, 100)).toBe('near recent baseline')
    // > 5%
    expect(runBoundaries(105.1, 100)).toBe('above recent baseline')
    // Exact -5%
    expect(runBoundaries(95, 100)).toBe('near recent baseline')
    // < -5%
    expect(runBoundaries(94.9, 100)).toBe('below recent baseline')
  })
})
