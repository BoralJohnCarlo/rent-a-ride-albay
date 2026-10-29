import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
    {
        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        currency: {
            type: String,
            default: "PHP",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;
