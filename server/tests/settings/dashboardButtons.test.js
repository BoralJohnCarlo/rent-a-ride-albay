import { afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import Settings from "../../models/Settings.js";
import { updateSettings } from "../../controllers/settingsController.js";
import { resolveThemeSettings } from "../../services/settingsService.js";
import { buttonTextColor, resolveButtonColors } from "../../../client/src/utils/dashboardButtonTheme.js";

afterEach(() => mock.restoreAll());

const save = async (themeSettings, current = {}) => {
    let written;
    mock.method(Settings, "findOne", () => ({ lean: async () => ({ themeSettings: current }) }));
    mock.method(Settings, "findOneAndUpdate", (_filter, update) => {
        written = update;
        return { lean: async () => update };
    });
    const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await updateSettings({ body: { themeSettings } }, response);
    return { response, written };
};

it("older settings and invalid cached colors safely resolve to blue", () => {
    assert.deepEqual(resolveButtonColors(resolveThemeSettings()), { buttonColor: "#2563eb", buttonHoverColor: "#1d4ed8" });
    assert.deepEqual(resolveButtonColors({ buttonColor: "url(bad)", buttonHoverColor: null }), resolveButtonColors());
});

it("saves colors without clearing the other theme settings", async () => {
    const { response, written } = await save({ buttonColor: "#AABBCC", buttonHoverColor: "#112233" }, { navbarStyle: "pill", cardHoverMode: "spotlight", heroMediaType: "image", featuredImageFrame: false });
    assert.equal(response.code, 200);
    assert.equal(written.themeSettings.buttonColor, "#aabbcc");
    assert.equal(written.themeSettings.buttonHoverColor, "#112233");
    assert.equal(written.themeSettings.navbarStyle, "pill");
    assert.equal(written.themeSettings.cardHoverMode, "spotlight");
    assert.equal(written.themeSettings.heroMediaType, "image");
    assert.equal(written.themeSettings.featuredImageFrame, false);
});

it("an unrelated theme save preserves the configured button colors", async () => {
    const { written } = await save({ navbarStyle: "pill" }, { buttonColor: "#123456", buttonHoverColor: "#abcdef" });
    assert.equal(written.themeSettings.buttonColor, "#123456");
    assert.equal(written.themeSettings.buttonHoverColor, "#abcdef");
});

it("rejects malformed color values before writing settings", async () => {
    for (const value of [null, 123, "red", "#fff", "#123456; color:red", {}]) {
        const { response, written } = await save({ buttonColor: value });
        assert.equal(response.code, 400);
        assert.equal(written, undefined);
        mock.restoreAll();
    }
});

it("chooses readable foregrounds across the full RGB range", () => {
    for (let value = 0; value <= 0xffffff; value += 7919) {
        const color = `#${value.toString(16).padStart(6, "0")}`;
        const linear = [16, 8, 0].map((shift) => {
            const channel = ((value >> shift) & 255) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        const contrast = buttonTextColor(color) === "#000000" ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
        assert.ok(contrast >= 4.5, `${color} must meet normal text contrast`);
    }
});
