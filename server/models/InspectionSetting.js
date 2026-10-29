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
        let instance = await this.findOne();
        if (!instance) {
            instance = await this.create({});
        }
        return instance;
    }
};

export default model('InspectionSetting', inspectionSettingSchema);