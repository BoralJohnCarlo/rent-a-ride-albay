import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatePickerPosition, keepPopoverFocusVisible } from '../src/utils/datePickerPopover.js';

test('desktop calendar stays anchored below or above the trigger', () => {
    const viewport = { width: 1280, height: 900 };
    const below = getDatePickerPosition({ left: 100, top: 100, bottom: 140 }, viewport, 400);
    assert.equal(below.top, 148);
    assert.equal(below.left, 100);
    assert.equal(below.width, 304);
    assert.equal(below.placeAbove, false);
    const above = getDatePickerPosition({ left: 100, top: 750, bottom: 790 }, viewport, 400);
    assert.equal(above.top, 342);
    assert.equal(above.placeAbove, true);
});

test('short landscape calendar is capped and remains fully reachable', () => {
    const result = getDatePickerPosition({ left: 400, top: 180, bottom: 220 }, { width: 640, height: 320 }, 400);
    assert.equal(result.top, 12);
    assert.equal(result.maxHeight, 296);
    assert.equal(result.left, 324);
});

test('calendar respects mobile, zoomed, keyboard and panned viewport bounds', () => {
    for (const viewport of [
        { width: 320, height: 640 },
        { width: 240, height: 200 },
        { width: 390, height: 240, offsetLeft: 20, offsetTop: 170 },
        { width: 10, height: 10 },
    ]) {
        for (const contentHeight of [260, 450]) {
            for (const top of [-200, 180, 900]) {
                const position = getDatePickerPosition({ left: 500, top, bottom: top + 40 }, viewport, contentHeight);
                const left = (viewport.offsetLeft ?? 0) + Math.min(12, viewport.width / 2);
                const upper = (viewport.offsetTop ?? 0) + Math.min(12, viewport.height / 2);
                const right = (viewport.offsetLeft ?? 0) + viewport.width - Math.min(12, viewport.width / 2);
                const bottom = (viewport.offsetTop ?? 0) + viewport.height - Math.min(12, viewport.height / 2);
                assert.ok(position.left >= left);
                assert.ok(position.left + position.width <= right);
                assert.ok(position.top >= upper);
                assert.ok(position.top + Math.min(contentHeight, position.maxHeight) <= bottom);
                assert.ok(position.width >= 0 && position.maxHeight >= 0);
            }
        }
    }
});

test('keyboard focus scrolls controls into view within the popup', () => {
    const target = { getBoundingClientRect: () => ({ top: 260, bottom: 292 }) };
    const panel = {
        contains: element => element === target,
        scrollHeight: 400, clientHeight: 200, clientTop: 1, scrollTop: 0,
        getBoundingClientRect: () => ({ top: 12 }),
    };
    keepPopoverFocusVisible(panel, target);
    assert.equal(panel.scrollTop, 83);
    target.getBoundingClientRect = () => ({ top: 0, bottom: 32 });
    keepPopoverFocusVisible(panel, target);
    assert.equal(panel.scrollTop, 66);
    target.getBoundingClientRect = () => ({ top: 1000, bottom: 1032 });
    keepPopoverFocusVisible(panel, target);
    assert.equal(panel.scrollTop, 200);
    keepPopoverFocusVisible(panel, { getBoundingClientRect: () => ({ top: 0, bottom: 30 }) });
    assert.equal(panel.scrollTop, 200);
});
