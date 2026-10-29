const pad = (n) => String(n).padStart(2, "0");

const timestamp = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const printBanner = (config) => {
    console.log("Mock GPS Simulator");
    console.log("-------------------");
    console.log(`Vehicle: ${config.label}`);
    console.log(`Vehicle ID: ${config.vehicleId}`);
    console.log(`Tracker: ${config.imei}`);
    console.log(`Scenario: ${config.scenario}`);
    console.log(
        `Update interval: ${config.updateIntervalMs / 1000} seconds`
    );
    console.log(`API: ${config.apiBaseUrl}`);
    console.log("");
};

// Never logs config.deviceKey.
export const printSent = (config, reading) => {
    console.log(`[${timestamp()}] [${config.label}] SENT`);
    console.log(`  lat: ${reading.latitude.toFixed(6)}`);
    console.log(`  lng: ${reading.longitude.toFixed(6)}`);
    console.log(`  speed: ${reading.speed ?? "unknown"}`);
    console.log(`  heading: ${reading.heading ?? "unknown"}`);
    console.log(`  ignition: ${reading.ignition ? "ON" : "OFF"}`);
    console.log(`  battery: ${reading.batteryLevel}%`);
    console.log(`  gpsFix: ${reading.gpsFix ? "YES" : "NO"}`);
    console.log("");
};

export const printOffline = (config) => {
    console.log(
        `[${timestamp()}] [${config.label}] OFFLINE - not sending telemetry`
    );
};

export const printError = (config, error) => {
    console.error(
        `[${timestamp()}] [${config.label}] ERROR (${error.kind || "unknown"}): ${error.message}`
    );

    if (error.details) {
        console.error("  details:", JSON.stringify(error.details));
    }
};
