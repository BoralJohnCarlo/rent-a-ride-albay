export const normalizeDriverSettings = (settings) => ({
    driverAssignmentSettings: {
        requireAdminDriverAssignment: false,
        motorcycleDriversEnabled: true,
        ...settings.driverAssignmentSettings,
    },
    driverPricingSettings: {
        mode: "global",
        globalDailyRate: 0,
        ...settings.driverPricingSettings,
    },
});

export const buildDriverSettingsPatch = (current, baseline) => {
    const patch = {};
    for (const section of ["driverAssignmentSettings", "driverPricingSettings"]) {
        const changes = {};
        for (const [key, value] of Object.entries(current[section])) {
            if (value !== baseline[section]?.[key]) changes[key] = value;
        }
        if (Object.keys(changes).length) patch[section] = changes;
    }
    return patch;
};
