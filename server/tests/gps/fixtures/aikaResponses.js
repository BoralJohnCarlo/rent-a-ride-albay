/*
 * Real AIKA GetTracking replies from the AK-61220 (AIKA deviceID 3237204,
 * serial 9176761220), captured by scripts/aikaProbe.js on 2026-10-01.
 * Only the SIM ICCID is masked. Values are strings exactly as AIKA sends.
 */

// 03:13:03 UTC - parked, last fix 16 min earlier, device silent 15 min.
export const AIKA_PARKED_REPLY = Object.freeze({
    state: "0",
    positionTime: "2026-10-01 02:56:56",
    lat: "13.35536",
    lng: "123.70982",
    ofl: "15",
    olat: "13.35536",
    olng: "123.70982",
    speed: "0.00",
    course: "66",
    isStop: "1",
    icon: "1",
    isGPS: "1",
    ICCID: "<masked>",
    VIN: "",
    stm: "2242",
    warn: "",
    work: "",
    battery: "-1",
    batteryStatus: "-1",
    status: "2-ACC OFF,Dismiss,Power Connected",
    statusX20: "",
    onlineTime: "0",
});

// 03:26:57 UTC - just powered on: contact fresh (ofl 0), same old fix.
export const AIKA_POWERED_ON_REPLY = Object.freeze({
    ...AIKA_PARKED_REPLY,
    ofl: "0",
    course: "0",
    stm: "2271",
});

// 03:31:15 UTC - moving on foot: new fix 31s old. The probe loop captured
// these fields; the rest are unchanged from the replies above.
export const AIKA_MOVING_REPLY = Object.freeze({
    ...AIKA_PARKED_REPLY,
    positionTime: "2026-10-01 03:30:44",
    lat: "13.35546",
    lng: "123.71023",
    olat: "13.35546",
    olng: "123.71023",
    ofl: "0",
    speed: "11.11",
    course: "242",
    isStop: "0",
    stm: "0",
    status: "1-ACC OFF,Dismiss,Power Connected",
});

export const AIKA_MOVING_POLLED_AT = new Date("2026-10-01T03:31:15Z");
export const AIKA_PARKED_POLLED_AT = new Date("2026-10-01T03:13:03Z");
