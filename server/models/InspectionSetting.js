import { Schema, model } from 'mongoose';

const timeSlotSchema = new Schema({
    time: {
        type: String,
        required: true,
        trim: true,
    },
    endTime: {
        type: String,
        default: '',
        trim: true,
    },
    period: {
        type: String,
        enum: ['AM', 'PM', 'Custom'],
        default: 'Custom',
        trim: true,
    },
    // No longer set from the admin UI — each slot is a single appointment
    // window (time to endTime), so capacity is always 1.
    maxAppointments: {
        type: Number,
        default: 1,
        min: 1,
        max: 50,
    },
}, { _id: false });

const inspectionSlotSchema = new Schema({
    date: {
        type: String,
        required: true,
        trim: true,
    },
    timeSlots: [timeSlotSchema],
    enabled: {
        type: Boolean,
        default: true,
    },
    weekdays: {
        type: [Number],
        default: [1, 2, 3, 4, 5, 6, 0],
        validate: {
            validator(days) {
                return (
                    Array.isArray(days) &&
                    days.length > 0 &&
                    days.every(
                        (d) =>
                            Number.isInteger(d) &&
                            d >= 0 &&
                            d <= 6
                    )
                );
            },
            message: 'Weekdays must be an array of integers 0-6.',
        },
    },
}, { _id: false });

const inspectionSettingSchema = new Schema({
    inspectionSlots: {
        type: [inspectionSlotSchema],
        default: [],
    },
    disabledDates: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true,
});

inspectionSettingSchema.statics = {
    getInstance: async function () {
        // Keep legacy settings (and consistently select the oldest if an old
        // initialization race created duplicates). Never discard configured slots.
        const existing = await this.findOne().sort({ createdAt: 1, _id: 1 });
        if (existing) return existing;
        // The built-in unique _id index serializes initialization without relying
        // on a secondary index having finished building on a new database.
        const singletonId = '000000000000000000000001';
        try {
            return await this.findOneAndUpdate(
                { _id: singletonId },
                { $setOnInsert: { inspectionSlots: [], disabledDates: [] } },
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
            return this.findById(singletonId);
        }
    }
};

export default model('InspectionSetting', inspectionSettingSchema);
