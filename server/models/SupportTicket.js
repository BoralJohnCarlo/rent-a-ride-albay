import mongoose from "mongoose";

import {
    SUPPORT_TICKET_STATUS,
    SUPPORT_TICKET_STATUS_VALUES,
    SUPPORT_TICKET_CATEGORY_VALUES,
} from "../constants/supportTicketConstants.js";

const supportTicketMessageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        senderRole: {
            type: String,
            required: true,
            trim: true,
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
    },
    {
        timestamps: true,
    }
);

const supportTicketSchema = new mongoose.Schema(
    {
        ticketCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        category: {
            type: String,
            required: true,
            trim: true,
            enum: SUPPORT_TICKET_CATEGORY_VALUES,
        },

        status: {
            type: String,
            required: true,
            trim: true,
            enum: SUPPORT_TICKET_STATUS_VALUES,
            default: SUPPORT_TICKET_STATUS.OPEN,
        },

        messages: {
            type: [supportTicketMessageSchema],
            default: [],
        },

        /*
         * Chat bookkeeping. lastMessageAt orders the inbox (status changes
         * bump updatedAt but aren't new messages); the unread counters are
         * $inc'd with each message and zeroed when that side opens the
         * conversation; the lastReadAt stamps drive "Seen" receipts.
         */
        lastMessageAt: {
            type: Date,
            default: Date.now,
        },

        lastMessageRole: {
            type: String,
            trim: true,
            default: "customer",
        },

        unreadForCustomer: {
            type: Number,
            default: 0,
            min: 0,
        },

        unreadForAdmin: {
            type: Number,
            default: 0,
            min: 0,
        },

        customerLastReadAt: {
            type: Date,
            default: null,
        },

        adminLastReadAt: {
            type: Date,
            default: null,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },

        closedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

supportTicketSchema.index({ customer: 1, updatedAt: -1 });
supportTicketSchema.index({ status: 1, updatedAt: -1 });
supportTicketSchema.index({ lastMessageAt: -1 });
supportTicketSchema.index({ unreadForAdmin: 1, status: 1 });

const SupportTicket = mongoose.model(
    "SupportTicket",
    supportTicketSchema
);

export default SupportTicket;
