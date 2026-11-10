import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/consignments/InspectionAppointmentCalendar.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const listSource = readFileSync(new URL('../src/components/consignments/ConsignmentAppointmentsPanel.jsx', import.meta.url), 'utf8');
const partition = new Function('getConsignmentCardData', `${listSource.slice(listSource.indexOf('const partitionAppointments ='), listSource.indexOf('// Shared appointment list'))}; return partitionAppointments;`)(() => ({}));

test('future appointments use their Albay date/time even when legacy scheduledAt is the booking timestamp', () => {
    const record = { application: { status: 'Pending', inspection: { status: 'Pending', scheduledDate: '2099-12-10', scheduledTime: '09:00', scheduledAt: '2020-01-01T00:00:00Z' } } };
    const result = partition([record], Date.parse('2099-12-10T00:00:00Z'));
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.upcoming[0].appointmentDate.toISOString(), '2099-12-10T01:00:00.000Z');
    record.application.status = 'Withdrawn';
    assert.equal(partition([record], Date.parse('2099-12-10T00:00:00Z')).past.length, 1);
});

test('closed registration inspections are history even when their booked date is in the future', () => {
    const record = { registrationAppointment: true, registrationVehicle: { status: 'rejected' }, application: { inspection: { scheduledDate: '2099-12-10', scheduledTime: '09:00' } } };
    assert.equal(partition([record], Date.now()).past.length, 1);
    record.registrationVehicle.status = 'under_inspection';
    assert.equal(partition([record], Date.now()).upcoming.length, 1);
});
const start = source.indexOf('    const handleSelectDate =');
const handlers = source.slice(start, source.indexOf('    const timeSlotsForSelectedDate =', start));

function calendar(disabled = false) {
    const state = { date: '2026-12-10', time: '09:00', appointment: '2026-12-10T09:00:00' };
    const render = () => new Function('disabled', 'slotsByDate', 'selectedDate', 'setSelectedDate', 'setSelectedTime', 'onChange', `${handlers}; return {handleSelectDate, handleSelectTime};`)(
        disabled, new Map([['2026-12-10', []], ['2026-12-11', []]]), state.date,
        value => { state.date = value; }, value => { state.time = value; }, value => { state.appointment = value; },
    );
    return { state, render };
}

test('selecting an appointment date clears the old submitted slot until a new time is selected', () => {
    const { state, render } = calendar();
    render().handleSelectDate('2026-12-11');
    assert.equal(state.date, '2026-12-11');
    assert.equal(state.time, null);
    assert.equal(state.appointment, '');
    render().handleSelectTime('10:00');
    assert.equal(state.appointment, '2026-12-11T10:00:00');
    // Clicking the currently selected date also clears its visible time.
    render().handleSelectDate('2026-12-11');
    assert.equal(state.appointment, '');
});

test('disabled and unavailable dates preserve the existing appointment', () => {
    for (const [disabled, date] of [[true, '2026-12-11'], [false, '2026-12-12']]) {
        const { state, render } = calendar(disabled);
        render().handleSelectDate(date);
        assert.equal(state.date, '2026-12-10');
        assert.equal(state.time, '09:00');
        assert.equal(state.appointment, '2026-12-10T09:00:00');
    }
});

test('month arrows move exactly one month at month ends, leap years and year boundaries', () => {
    const callbacks = [...source.matchAll(/setCalendarViewDate\(\(prev\) => \{([\s\S]*?)\n\s*\}\)/g)];
    assert.equal(callbacks.length, 2);
    const previous = new Function('prev', callbacks[0][1]);
    const next = new Function('prev', callbacks[1][1]);
    for (const [fn, year, month, day, expected] of [
        [next, 2025, 0, 31, [2025, 1]],
        [previous, 2025, 2, 31, [2025, 1]],
        [next, 2024, 0, 31, [2024, 1]],
        [previous, 2024, 2, 31, [2024, 1]],
        [next, 2025, 11, 31, [2026, 0]],
        [previous, 2025, 0, 31, [2024, 11]],
    ]) {
        const original = new Date(year, month, day);
        const result = fn(original);
        assert.deepEqual([result.getFullYear(), result.getMonth()], expected);
        assert.equal(result.getDate(), 1);
        assert.equal(original.getDate(), day);
    }
});
