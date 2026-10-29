import mongoose from "mongoose";

const sequenceSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        value: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    {
        versionKey: false,
    }
);

const Sequence = mongoose.model(
    "Sequence",
    sequenceSchema
);

export const nextSequence = async (
    key,
    initialValue = 0,
    session = null
) => {
    const sequence = await Sequence.findOneAndUpdate(
        { _id: key },
        [
            {
                $set: {
                    value: {
                        $add: [
                            {
                                $max: [
                                    {
                                        $ifNull: [
                                            "$value",
                                            0,
                                        ],
                                    },
                                    initialValue,
                                ],
                            },
                            1,
                        ],
                    },
                },
            },
        ],
        {
            new: true,
            upsert: true,
            session,
            updatePipeline: true,
        }
    );

    return sequence.value;
};
