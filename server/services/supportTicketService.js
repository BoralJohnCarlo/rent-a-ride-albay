import createError from "../utils/createError.js";

import SupportTicket from "../models/SupportTicket.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { nextSequence } from "../models/Sequence.js";

import {
    SUPPORT_TICKET_STATUS,
    SUPPORT_TICKET_STATUS_VALUES,
    SUPPORT_TICKET_CODE_PREFIX,
    SUPPORT_SENDER_ROLE,
} from "../constants/supportTicketConstants.js";

import {
    notifyAdmins,
    notifyUser,
} from "./notificationService.js";

import { serializeSupportTicket } from "../utils/serializeSupportTicket.js";

import {
    broadcastSupportRead,
    broadcastSupportTicket,
} from "../sockets/broadcastSupport.js";

const SENDER_SELECT =
    "firstName lastName email";

const INBOX_SORT = {
    lastMessageAt: -1,
    updatedAt: -1,
};

/*
 * Per-side field names: the side sending a message (or opening the chat)
 * has read everything; the other side gains an unread message.
 */
const SIDE_FIELDS = {
    [SUPPORT_SENDER_ROLE.CUSTOMER]: {
        unread: "unreadForCustomer",
        lastReadAt: "customerLastReadAt",
    },
    [SUPPORT_SENDER_ROLE.ADMIN]: {
        unread: "unreadForAdmin",
        lastReadAt: "adminLastReadAt",
    },
};

const sideOf = (role) =>
    role === "admin"
        ? SUPPORT_SENDER_ROLE.ADMIN
        : SUPPORT_SENDER_ROLE.CUSTOMER;

const otherSide = (side) =>
    side === SUPPORT_SENDER_ROLE.ADMIN
        ? SUPPORT_SENDER_ROLE.CUSTOMER
        : SUPPORT_SENDER_ROLE.ADMIN;

/*
 * Shown in the conversation itself when an admin changes its status, so
 * the customer sees why the chat closed instead of it silently locking.
 */
const STATUS_EVENT_TEXT = {
    [SUPPORT_TICKET_STATUS.OPEN]: "Conversation reopened.",
    [SUPPORT_TICKET_STATUS.IN_PROGRESS]: "Support is looking into this.",
    [SUPPORT_TICKET_STATUS.RESOLVED]:
        "Marked as resolved. Reply here if you still need help.",
    [SUPPORT_TICKET_STATUS.CLOSED]:
        "Conversation closed. Start a new one any time.",
};

const generateTicketCode = async () => {
    const nextNumber = await nextSequence(
        "supportTicketCode"
    );

    return `${SUPPORT_TICKET_CODE_PREFIX}${String(
        nextNumber
    ).padStart(5, "0")}`;
};

const populateTicket = (query) =>
    query
        .populate("customer", "firstName lastName email profileImage")
        .populate(
            "messages.sender",
            SENDER_SELECT
        );

const loadPopulated = (ticketId) =>
    populateTicket(SupportTicket.findById(ticketId));

const getTicketByIdOrThrow = async (
    ticketId
) => {
    const ticket = await SupportTicket.findById(
        ticketId
    );

    if (!ticket) {
        throw createError(
            "Support ticket not found.",
            404
        );
    }

    return ticket;
};

const ensureCanAccessTicket = (
    ticket,
    { userId, role }
) => {
    if (role === "admin") {
        return;
    }

    /*
     * `ticket.customer` may be a raw ObjectId (unpopulated tickets, e.g. in
     * addReply) or a populated User document (getTicketById) — a populated
     * document's own .toString() does not return its id, so the id must be
     * read off `._id` when present.
     */
    const customerId = ticket.customer?._id
        ? ticket.customer._id.toString()
        : ticket.customer.toString();

    if (customerId !== userId.toString()) {
        throw createError(
            "You are not authorized to access this ticket.",
            403
        );
    }
};

const escapeRegex = (value) =>
    value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

const buildSearchFilter = async (search, { includeCustomers = false } = {}) => {
    if (!search) {
        return null;
    }

    const escaped = escapeRegex(search);
    const pattern = new RegExp(escaped, "i");

    const clauses = [
        { ticketCode: pattern },
        { subject: pattern },
        { "messages.message": pattern },
    ];

    // Admins look conversations up by who they're with, too.
    if (includeCustomers) {
        const customers = await User.find({
            $or: [
                { firstName: pattern },
                { lastName: pattern },
                { email: pattern },
            ],
        })
            .select("_id")
            .limit(200)
            .lean();

        if (customers.length > 0) {
            clauses.push({
                customer: {
                    $in: customers.map((customer) => customer._id),
                },
            });
        }
    }

    return { $or: clauses };
};

const safeNotify = async (send, label) => {
    try {
        await send();
    } catch (notificationError) {
        console.error(label, notificationError);
    }
};

export const createTicket = async (
    customerId,
    { subject, category, message }
) => {
    const ticketCode = await generateTicketCode();
    const now = new Date();

    const ticket = await SupportTicket.create({
        ticketCode,
        customer: customerId,
        subject: subject.trim(),
        category,
        status: SUPPORT_TICKET_STATUS.OPEN,
        messages: [
            {
                sender: customerId,
                senderRole: SUPPORT_SENDER_ROLE.CUSTOMER,
                message: message.trim(),
            },
        ],
        lastMessageAt: now,
        lastMessageRole: SUPPORT_SENDER_ROLE.CUSTOMER,
        unreadForAdmin: 1,
        customerLastReadAt: now,
    });

    await safeNotify(
        () =>
            notifyAdmins({
                type: "support",
                title: "New Support Conversation",
                message: `${ticket.ticketCode}: ${ticket.subject}`,
                variant: "info",
                category: "Support",
                metadata: {
                    reference: ticket.ticketCode,
                    relatedId: ticket._id,
                    relatedModel: "SupportTicket",
                },
            }),
        "Failed to notify admins of new support ticket:"
    );

    const populated = await loadPopulated(ticket._id);

    broadcastSupportTicket(populated);

    return serializeSupportTicket(
        populated,
        SUPPORT_SENDER_ROLE.CUSTOMER
    );
};

export const getCustomerTickets = async (
    customerId,
    { status, search, page = 1, limit = 20 } = {}
) => {
    const query = {
        customer: customerId,
    };

    if (status) {
        query.status = status;
    }

    const searchFilter = await buildSearchFilter(search);

    if (searchFilter) {
        Object.assign(query, searchFilter);
    }

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
        populateTicket(
            SupportTicket.find(query)
                .sort(INBOX_SORT)
                .skip(skip)
                .limit(limit)
        ),
        SupportTicket.countDocuments(query),
    ]);

    return {
        tickets: tickets.map((ticket) =>
            serializeSupportTicket(
                ticket,
                SUPPORT_SENDER_ROLE.CUSTOMER
            )
        ),
        total,
    };
};

export const getAdminTickets = async ({
    status,
    category,
    search,
    unreadOnly = false,
    page = 1,
    limit = 20,
} = {}) => {
    const query = {};

    if (status) {
        query.status = status;
    }

    if (category) {
        query.category = category;
    }

    if (unreadOnly) {
        query.unreadForAdmin = { $gt: 0 };
    }

    const searchFilter = await buildSearchFilter(search, {
        includeCustomers: true,
    });

    if (searchFilter) {
        Object.assign(query, searchFilter);
    }

    const skip = (page - 1) * limit;

    const [tickets, total, grouped, unreadConversations] =
        await Promise.all([
            populateTicket(
                SupportTicket.find(query)
                    .sort(INBOX_SORT)
                    .skip(skip)
                    .limit(limit)
            ),
            SupportTicket.countDocuments(query),
            SupportTicket.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                    },
                },
            ]),
            countAdminUnreadConversations(),
        ]);

    const statusCounts = Object.fromEntries(
        SUPPORT_TICKET_STATUS_VALUES.map((value) => [value, 0])
    );

    grouped.forEach(({ _id, count }) => {
        if (_id in statusCounts) {
            statusCounts[_id] = count;
        }
    });

    return {
        tickets: tickets.map((ticket) =>
            serializeSupportTicket(
                ticket,
                SUPPORT_SENDER_ROLE.ADMIN
            )
        ),
        total,
        counts: {
            ...statusCounts,
            all: Object.values(statusCounts).reduce(
                (sum, value) => sum + value,
                0
            ),
            unread: unreadConversations,
        },
    };
};

export const getTicketById = async (
    ticketId,
    { userId, role }
) => {
    const ticket = await loadPopulated(ticketId);

    if (!ticket) {
        throw createError(
            "Support ticket not found.",
            404
        );
    }

    ensureCanAccessTicket(ticket, {
        userId,
        role,
    });

    return serializeSupportTicket(ticket, sideOf(role));
};

export const addReply = async (
    ticketId,
    message,
    { userId, role }
) => {
    const ticket = await getTicketByIdOrThrow(
        ticketId
    );

    ensureCanAccessTicket(ticket, {
        userId,
        role,
    });

    if (ticket.status === SUPPORT_TICKET_STATUS.CLOSED) {
        throw createError(
            "This conversation is closed. Start a new one if you still need help.",
            400
        );
    }

    const senderRole = sideOf(role);
    const own = SIDE_FIELDS[senderRole];
    const other = SIDE_FIELDS[otherSide(senderRole)];
    const now = new Date();

    /*
     * One conditional update: two people replying at once both land (no
     * read-modify-save race on the messages array), and a reply racing an
     * admin closing the ticket loses cleanly instead of slipping in.
     * Returns the pre-update document so we know who spoke last.
     */
    const previous = await SupportTicket.findOneAndUpdate(
        {
            _id: ticketId,
            status: { $ne: SUPPORT_TICKET_STATUS.CLOSED },
        },
        {
            $push: {
                messages: {
                    sender: userId,
                    senderRole,
                    message: message.trim(),
                },
            },
            $set: {
                lastMessageAt: now,
                lastMessageRole: senderRole,
                [own.lastReadAt]: now,
                [own.unread]: 0,
            },
            $inc: {
                [other.unread]: 1,
            },
        },
        {
            returnDocument: "before",
            projection: { lastMessageRole: 1 },
        }
    );

    if (!previous) {
        throw createError(
            "This conversation was just closed. Start a new one if you still need help.",
            409
        );
    }

    // Each side's reply moves the status along, but only from the state it
    // applies to - conditional, so a concurrent admin status change wins.
    if (senderRole === SUPPORT_SENDER_ROLE.ADMIN) {
        await SupportTicket.updateOne(
            { _id: ticketId, status: SUPPORT_TICKET_STATUS.OPEN },
            { $set: { status: SUPPORT_TICKET_STATUS.IN_PROGRESS } }
        );
    } else {
        await SupportTicket.updateOne(
            { _id: ticketId, status: SUPPORT_TICKET_STATUS.RESOLVED },
            {
                $set: {
                    status: SUPPORT_TICKET_STATUS.OPEN,
                    resolvedAt: null,
                },
            }
        );
    }

    /*
     * A chat is many short messages - only the first of a run from one side
     * raises a notification, so five quick lines aren't five bell entries.
     */
    const startsNewTurn =
        previous.lastMessageRole !== senderRole;

    if (startsNewTurn) {
        const metadata = {
            reference: ticket.ticketCode,
            relatedId: ticket._id,
            relatedModel: "SupportTicket",
        };

        await safeNotify(
            () =>
                senderRole === SUPPORT_SENDER_ROLE.ADMIN
                    ? notifyUser(ticket.customer, {
                          type: "support",
                          title: "New Message from Support",
                          message: `Support replied about "${ticket.subject}".`,
                          variant: "info",
                          category: "Support",
                          metadata,
                      })
                    : notifyAdmins({
                          type: "support",
                          title: "New Customer Message",
                          message: `${ticket.ticketCode} (${ticket.subject}) has a new customer message.`,
                          variant: "info",
                          category: "Support",
                          metadata,
                      }),
            "Failed to notify of support ticket reply:"
        );
    }

    const populated = await loadPopulated(ticketId);

    broadcastSupportTicket(populated);

    return serializeSupportTicket(populated, senderRole);
};

/*
 * Called when one side has the conversation open: clears that side's unread
 * count and stamps its read time (the other side's "Seen" receipt).
 */
export const markTicketRead = async (
    ticketId,
    { userId, role }
) => {
    const ticket = await SupportTicket.findById(ticketId)
        .select("customer")
        .lean();

    if (!ticket) {
        throw createError(
            "Support ticket not found.",
            404
        );
    }

    ensureCanAccessTicket(ticket, {
        userId,
        role,
    });

    const side = sideOf(role);
    const own = SIDE_FIELDS[side];
    const readAt = new Date();

    // timestamps:false - reading a chat isn't activity on it.
    await SupportTicket.updateOne(
        { _id: ticketId },
        {
            $set: {
                [own.unread]: 0,
                [own.lastReadAt]: readAt,
            },
        },
        { timestamps: false }
    );

    broadcastSupportRead({
        ticketId,
        customerId: ticket.customer,
        role: side,
        readAt,
    });

    return { ticketId, role: side, readAt };
};

const countAdminUnreadConversations = () =>
    SupportTicket.countDocuments({
        unreadForAdmin: { $gt: 0 },
        status: { $ne: SUPPORT_TICKET_STATUS.CLOSED },
    });

/*
 * Badge counts. Customers: unread support messages across their chats.
 * Admins: conversations waiting on a staff reply.
 */
export const getUnreadSummary = async ({ userId, role }) => {
    if (role === "admin") {
        return { unread: await countAdminUnreadConversations() };
    }

    const [row] = await SupportTicket.aggregate([
        { $match: { customer: userId } },
        {
            $group: {
                _id: null,
                unread: { $sum: "$unreadForCustomer" },
            },
        },
    ]);

    return { unread: row?.unread || 0 };
};

export const updateTicketStatus = async (
    ticketId,
    status,
    { userId } = {}
) => {
    const ticket = await getTicketByIdOrThrow(
        ticketId
    );

    if (ticket.status === status) {
        return serializeSupportTicket(
            await loadPopulated(ticketId),
            SUPPORT_SENDER_ROLE.ADMIN
        );
    }

    ticket.status = status;

    ticket.resolvedAt =
        status === SUPPORT_TICKET_STATUS.RESOLVED
            ? new Date()
            : null;

    ticket.closedAt =
        status === SUPPORT_TICKET_STATUS.CLOSED
            ? new Date()
            : null;

    if (userId) {
        ticket.messages.push({
            sender: userId,
            senderRole: "system",
            message: STATUS_EVENT_TEXT[status] || `Status changed to ${status}.`,
        });
    }

    await ticket.save();

    await safeNotify(
        () =>
            notifyUser(ticket.customer, {
                type: "support",
                title: "Support Conversation Updated",
                message: `Your conversation "${ticket.subject}" is now ${status}.`,
                variant:
                    status === SUPPORT_TICKET_STATUS.RESOLVED
                        ? "success"
                        : "info",
                category: "Support",
                metadata: {
                    reference: ticket.ticketCode,
                    relatedId: ticket._id,
                    relatedModel: "SupportTicket",
                },
            }),
        "Failed to notify customer of support ticket status change:"
    );

    const populated = await loadPopulated(ticketId);

    broadcastSupportTicket(populated);

    return serializeSupportTicket(
        populated,
        SUPPORT_SENDER_ROLE.ADMIN
    );
};

/*
 * Side panel in the admin support inbox: who the customer is and what
 * they've booked, so staff can answer without leaving the chat.
 */
export const getTicketCustomerContext = async (ticketId) => {
    const ticket = await SupportTicket.findById(ticketId)
        .select("customer")
        .lean();

    if (!ticket) {
        throw createError(
            "Support ticket not found.",
            404
        );
    }

    const customerId = ticket.customer;

    const [
        customer,
        recentBookings,
        bookingCount,
        conversations,
        conversationCount,
    ] = await Promise.all([
        User.findById(customerId)
            .select(
                "firstName lastName email phoneNumber profileImage isVerified isSuspended createdAt licenseExpirationDate"
            )
            .lean(),
        Booking.find({ customer: customerId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select(
                "bookingCode status startDate endDate pricing.totalAmount vehicle createdAt"
            )
            .populate("vehicle", "brand model plateNumber")
            .lean(),
        Booking.countDocuments({ customer: customerId }),
        SupportTicket.find({ customer: customerId })
            .sort(INBOX_SORT)
            .limit(6)
            .select("ticketCode subject status lastMessageAt")
            .lean(),
        SupportTicket.countDocuments({ customer: customerId }),
    ]);

    return {
        customer,
        bookingCount,
        recentBookings,
        conversations,
        conversationCount,
    };
};
