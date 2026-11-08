import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseISODay, toISODate } from '../src/utils/calendarGrid.js';

// Exercise the component's actual handler without needing a browser renderer.
const source = readFileSync(new URL('../src/components/common/CalendarPanel.jsx', import.meta.url), 'utf8');
const body = source.split('const handleGridKeyDown = (event) => {')[1].split('\n    };')[0];
const createHandler = new Function('parseISODay', 'toISODate', 'monthKey', 'isDayOut', 'viewKey', 'setDirection', 'setViewDate', 'setFocusISO', `return event => {${body}}`);

function navigate(iso, key, minDay, maxDay) {
    const result = { focus: null, month: null, prevented: false };
    const handler = createHandler(
        parseISODay, toISODate,
        (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`,
        day => (minDay && day < minDay) || (maxDay && day > maxDay),
        iso.slice(0, 7), () => {},
        date => { result.month = toISODate(date); },
        day => { result.focus = day; },
    );
    handler({ key, target: { dataset: { iso } }, preventDefault() { result.prevented = true; } });
    return result;
}

test('month keys clamp month-end dates in both directions including leap years', () => {
    for (const [from, key, expected] of [
        ['2025-01-31', 'PageDown', '2025-02-28'],
        ['2025-03-31', 'PageUp', '2025-02-28'],
        ['2024-01-31', 'PageDown', '2024-02-29'],
        ['2024-03-31', 'PageUp', '2024-02-29'],
        ['2025-05-31', 'PageUp', '2025-04-30'],
        ['2025-03-31', 'PageDown', '2025-04-30'],
        ['2025-12-31', 'PageDown', '2026-01-31'],
        ['2025-01-31', 'PageUp', '2024-12-31'],
        ['2025-01-15', 'PageDown', '2025-02-15'],
    ]) {
        const result = navigate(from, key);
        assert.equal(result.focus, expected, `${from} ${key}`);
        assert.equal(result.month, `${expected.slice(0, 7)}-01`);
        assert.equal(result.prevented, true);
    }
});

test('month keys retain date-limit enforcement after clamping', () => {
    assert.equal(navigate('2025-03-31', 'PageUp', '2025-03-01').focus, null);
    assert.equal(navigate('2025-01-31', 'PageDown', undefined, '2025-02-27').focus, null);
    assert.equal(navigate('2025-01-31', 'PageDown', undefined, '2025-02-28').focus, '2025-02-28');
});

test('arrow and week navigation continue to cross month boundaries normally', () => {
    assert.equal(navigate('2025-01-31', 'ArrowRight').focus, '2025-02-01');
    assert.equal(navigate('2025-03-01', 'ArrowLeft').focus, '2025-02-28');
    assert.equal(navigate('2025-01-31', 'ArrowDown').focus, '2025-02-07');
    assert.equal(navigate('2025-01-31', 'Home').focus, '2025-01-26');
    assert.equal(navigate('2025-01-31', 'End').focus, '2025-02-01');
});
