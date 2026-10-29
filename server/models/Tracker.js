import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import {
    TRACKER_STATUS,
    TRACKER_STATUS_VALUES,
    TRACKER_PROTOCOL,
    TRACKER_PROTOCOL_VALUES,
    DEVICE_KEY_PROTOCOLS,
    TRACKER_NOTES_MAX_LENGTH,
} from "../constants/telemetryConstants.js";

const auditSchema = new mongoose.Schema(
    {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        _id: false,
    }
);

/*
 * `deviceKey` authenticates the HTTP ingestion mechanism only (see
 * trackerAuthMiddleware.js), so it is only issued for DEVICE_KEY_PROTOCOLS.
 * It is NOT assumed to be how a physical tracker will authenticate - that
 * handshake depends on the device's actual protocol and will be implemented
 * once confirmed, without changing trackingService.
 *
 * `imei` holds the device's identity as the device reports it. The label is
 * "Device ID / IMEI" because a real device's identity is not necessarily a
 * conventional 15-digit IMEI.
 *
 * `status` is never set freely: ACTIVE = enabled + assigned, UNASSIGNED =
 * enabled + no vehicle, INACTIVE = disabled (assignment kept as-is). See
 * trackerService.js.
 */
const trackerSchema = new mongoose.Schema(
    {
        imei: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        protocol: {
            type: String,
            enum: TRACKER_PROTOCOL_VALUES,
            default: TRACKER_PROTOCOL.HTTP_SIMULATOR,
            required: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        deviceKey: {
            type: String,
            default: null,
            select: false,
            required: function () {
                return DEVICE_KEY_PROTOCOLS.includes(this.protocol);
            },
        },

        model: {
            type: String,
            default: "",
            trim: true,
        },

        // SIM card number inside the device - needed to reconfigure it by SMS.
        simNumber: {
            type: String,
            default: "",
            trim: true,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
            maxlength: TRACKER_NOTES_MAX_LENGTH,
        },

        status: {
            type: String,
            enum: TRACKER_STATUS_VALUES,
            default: TRACKER_STATUS.UNASSIGNED,
        },

        // Communication activity (any authenticated packet, incl. heartbeats)
        // - server receipt time, only ever moves forward. GPS position time
        // lives on VehicleTrackingState.recordedAt instead.
        lastSeenAt: {
            type: Date,
            default: null,
        },

        audit: {
            type: auditSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

trackerSchema.index({ vehicle: 1 });

trackerSchema.pre("save", async function () {
    if (!this.isModified("deviceKey") || !this.deviceKey) {
        return;
    }

    if (this.deviceKey.startsWith("$2")) {
        return;
    }

    const salt = await bcrypt.genSalt(12);
    this.deviceKey = await bcrypt.hash(this.deviceKey, salt);
});

trackerSchema.methods.compareDeviceKey = async function (deviceKey) {
    if (!this.deviceKey) {
        return false;
    }

    return bcrypt.compare(deviceKey, this.deviceKey);
};

const Tracker = mongoose.model("Tracker", trackerSchema);

export default Tracker;
