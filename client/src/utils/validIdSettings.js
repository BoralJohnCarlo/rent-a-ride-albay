export const normalizeValidIdSettings = (settings) => ({
    validIdRenewalSettings: {
        maxUploadsPerYear: 1, renewalPeriodYears: 1, maxAttempts: 3,
        ...settings.validIdRenewalSettings,
    },
    validIdExpirationSettings: {
        enabled: false, firstReminderDays: 30, secondReminderDays: 7,
        thirdReminderDays: 1, notifyOnExpired: false,
        ...settings.validIdExpirationSettings,
    },
});

export const buildValidIdSettingsPatch = (current, baseline) => {
    const patch = {};
    for (const section of ["validIdRenewalSettings", "validIdExpirationSettings"]) {
        const changes = {};
        for (const [key, value] of Object.entries(current[section])) {
            if (value !== baseline[section]?.[key]) changes[key] = value;
        }
        if (Object.keys(changes).length) patch[section] = changes;
    }
    return patch;
};
