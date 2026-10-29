import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { VEHICLE_MAINTENANCE_MODE } from "../../constants/vehicleConstants.js";
import { resolveOffRoadVehicleSettings } from "../../services/settingsService.js";
import {
    describeMaintenanceBlock,
    getMaintenanceWindow,
} from "../../utils/vehicleMaintenance.js";

const offRoadVehicle = {
    maintenance: {
        mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        until: null,
    },
};

const extendedVehicle = {
    maintenance: {
        mode: VEHICLE_MAINTENANCE_MODE.EXTENDED,
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        until: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
};

describe("off-road vehicle settings", () => {
    it("default to showing off-road vehicles and the notice", () => {
        assert.deepEqual(resolveOffRoadVehicleSettings(undefined), {
            showInListings: true,
            showNotice: true,
        });
        assert.deepEqual(resolveOffRoadVehicleSettings({}), {
            showInListings: true,
            showNotice: true,
        });
    });

    it("only turn off on an explicit false", () => {
        assert.deepEqual(
            resolveOffRoadVehicleSettings({
                showInListings: false,
                showNotice: false,
            }),
            { showInListings: false, showNotice: false }
        );
    });
});

describe("off-road booking message", () => {
    it("says off road when the notice is on", () => {
        assert.match(
            describeMaintenanceBlock(getMaintenanceWindow(offRoadVehicle)),
            /off the road/
        );
    });

    it("only mentions blocked dates when the notice is off", () => {
        const message = describeMaintenanceBlock(
            getMaintenanceWindow(offRoadVehicle),
            { showOffRoadNotice: false }
        );

        assert.match(message, /dates are blocked/);
        assert.doesNotMatch(message, /off the road|maintenance/);
    });

    it("leaves maintenance with an end date unchanged", () => {
        assert.match(
            describeMaintenanceBlock(getMaintenanceWindow(extendedVehicle), {
                showOffRoadNotice: false,
            }),
            /under maintenance until/
        );
    });
});
