import { test } from '@japa/runner'
import { datesForRule } from '../../app/services/recurrence.js'

const base = { startsOn: '2026-01-31', endsOn: null, interval: 1 }

test.group('recurrence dates', () => {
  test('monthly rules clamp to short months and return to the anchor day', ({ assert }) => {
    assert.deepEqual(datesForRule({ ...base, frequency: 'monthly' }, '2026-02-01', '2026-04-30'), [
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  test('weekly intervals cross year boundaries without shifting', ({ assert }) => {
    assert.deepEqual(
      datesForRule(
        { ...base, startsOn: '2026-12-21', frequency: 'weekly', interval: 2 },
        '2026-12-28',
        '2027-01-31'
      ),
      ['2027-01-04', '2027-01-18']
    )
  })

  test('twice monthly clamps both chosen dates and removes duplicates', ({ assert }) => {
    assert.deepEqual(
      datesForRule(
        { ...base, frequency: 'twice_monthly', scheduleDetails: { days: [15, 31] } },
        '2026-02-01',
        '2026-02-28'
      ),
      ['2026-02-15', '2026-02-28']
    )
  })

  test('ends the schedule on the inclusive end date', ({ assert }) => {
    assert.deepEqual(
      datesForRule(
        { ...base, frequency: 'daily', endsOn: '2026-02-02' },
        '2026-02-01',
        '2026-02-05'
      ),
      ['2026-02-01', '2026-02-02']
    )
  })

  test('common shortcuts and interval schedules preserve their cadence', ({ assert }) => {
    assert.deepEqual(
      datesForRule(
        { ...base, startsOn: '2026-01-01', frequency: 'daily', interval: 3 },
        '2026-01-01',
        '2026-01-10'
      ),
      ['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10']
    )
    assert.deepEqual(
      datesForRule(
        { ...base, startsOn: '2026-01-01', frequency: 'biweekly' },
        '2026-01-01',
        '2026-01-31'
      ),
      ['2026-01-01', '2026-01-15', '2026-01-29']
    )
    assert.deepEqual(
      datesForRule(
        { ...base, startsOn: '2026-01-01', frequency: 'monthly', interval: 2 },
        '2026-01-01',
        '2026-05-31'
      ),
      ['2026-01-01', '2026-03-01', '2026-05-01']
    )
    assert.deepEqual(
      datesForRule(
        { ...base, startsOn: '2024-02-29', frequency: 'yearly' },
        '2025-01-01',
        '2028-12-31'
      ),
      ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']
    )
  })

  test('rejects unsupported cadence rather than generating yearly dates', ({ assert }) => {
    assert.throws(
      () =>
        datesForRule(
          { ...base, frequency: 'fortnightly' as 'monthly' },
          '2026-01-01',
          '2027-01-01'
        ),
      /Invalid frequency/
    )
  })
})
