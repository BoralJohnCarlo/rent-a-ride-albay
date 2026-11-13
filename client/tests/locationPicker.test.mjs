import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/components/maps/LocationPicker.jsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("const MapClickHandler ="), source.indexOf("const MapCenter ="));

for (const disabled of [false, true]) {
    test(`map selection ${disabled ? "ignores" : "accepts"} clicks when disabled=${disabled}`, () => {
        let events;
        const selections = [];
        const create = new Function("useMapEvents", `${handler}; return MapClickHandler;`)(
            value => { events = value; },
        );
        create({ disabled, onLocationChange: value => selections.push(value) });
        events.click({ latlng: { lat: 13.15, lng: 123.71 } });
        assert.deepEqual(selections, disabled ? [] : [{ latitude: 13.15, longitude: 123.71 }]);
    });
}

test("coordinate updates recenter the map while preserving the user's zoom", () => {
    const component = source.slice(source.indexOf("const MapCenter ="), source.indexOf("const LocationPicker ="));
    const views = [];
    const effects = [];
    const map = { getZoom: () => 17, setView: (...args) => views.push(args) };
    const render = new Function("useMap", "useEffect", `${component}; return MapCenter;`)(
        () => map, (effect, deps) => { effects.push(deps); effect(); },
    );
    render({ latitude: 13, longitude: 123 });
    render({ latitude: 14, longitude: 124 });
    assert.deepEqual(views, [
        [[13, 123], 17, { animate: false }],
        [[14, 124], 17, { animate: false }],
    ]);
    assert.deepEqual(effects[1], [map, 14, 124]);
});
