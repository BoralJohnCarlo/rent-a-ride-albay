import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import Notification from "../../models/Notification.js";
import SupportTicket from "../../models/SupportTicket.js";
import User from "../../models/User.js";

import { SUPPORT_TICKET_STATUS } from "../../constants/supportTicketConstants.js";

import {
    addReply,
    createTicket,
    getTicketById,
    getUnreadSummary,
    markTicketRead,
    updateTicketStatus,
} from "../../services/supportTicketService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Two-way support chat: both sides can reply, unread counters and read
 * stamps track each side, a run of messages notifies once, and customers
 * never learn which admin answered.
 */

let customer;
let otherCustomer;
let admin;

const makeUser = (role, suffix) =>
    User.create({
        firstName: role === "admin" ? "Ana" : "Carlo",
        lastName: role === "admin" ? "Agent" : `Customer${suffix}`,
        email: `${role}-${suffix}-${Date.now()}@test.local`,
        password: "Password123!",
        phoneNumber: `0917${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
        role,
    });

const asCustomer = () => ({ userId: customer._id, role: "customer" });
const asAdmin = () => ({ userId: admin._id, role: "admin" });

const newTicket = () =>
    createTicket(customer._id, {
        subject: "Pickup question",
        category: "Booking",
        message: "Can I pick up at 7 AM?",
    });

const supportNotifications = (filter = {}) =>
    Notification.countDocuments({ type: "support", ...filter });

describe("support chat", () => {
    before(async () => {
        await connectTestDb();
        await Promise.all([SupportTicket.init(), User.init()]);

        [customer, otherCustomer, admin] = await Promise.all([
            makeUser("customer", "a"),
            makeUser("customer", "b"),
            makeUser("admin", "x"),
        ]);
    });

    after(disconnectTestDb);

    beforeEach(() =>
        Promise.all([
            SupportTicket.deleteMany({}),
            Notification.deleteMany({}),
        ])
    );

    it("lets both sides reply and tracks unread per side", async () => {
        const ticket = await newTicket();

        assert.equal(ticket.status, SUPPORT_TICKET_STATUS.OPEN);
        assert.equal(ticket.unreadForAdmin, undefined, "hidden from customer");

        let stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.unreadForAdmin, 1);
        assert.equal(stored.unreadForCustomer, 0);

        await addReply(ticket._id, "Yes, 7 AM works.", asAdmin());

        stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.status, SUPPORT_TICKET_STATUS.IN_PROGRESS);
        assert.equal(stored.unreadForAdmin, 0, "replying reads the chat");
        assert.equal(stored.unreadForCustomer, 1);

        const afterCustomer = await addReply(
            ticket._id,
            "Great, thanks!",
            asCustomer()
        );

        assert.equal(afterCustomer.messages.length, 3);
        assert.deepEqual(
            afterCustomer.messages.map((m) => m.senderRole),
            ["customer", "admin", "customer"]
        );

        stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.unreadForCustomer, 0);
        assert.equal(stored.unreadForAdmin, 1);
        assert.ok(stored.messages.every((m) => m.createdAt));
    });

    it("never shows the customer which admin replied", async () => {
        const ticket = await newTicket();
        await addReply(ticket._id, "Hello!", asAdmin());

        const customerView = await getTicketById(ticket._id, asCustomer());
        const staffMessage = customerView.messages[1];

        assert.equal(staffMessage.senderRole, "admin");
        assert.equal(staffMessage.sender, null);
        assert.equal(staffMessage.agentName, undefined);

        const adminView = await getTicketById(ticket._id, asAdmin());
        assert.equal(adminView.messages[1].agentName, "Ana Agent");
    });

    it("blocks other customers from a conversation", async () => {
        const ticket = await newTicket();

        await assert.rejects(
            addReply(ticket._id, "Hi", {
                userId: otherCustomer._id,
                role: "customer",
            }),
            { statusCode: 403 }
        );

        await assert.rejects(
            markTicketRead(ticket._id, {
                userId: otherCustomer._id,
                role: "customer",
            }),
            { statusCode: 403 }
        );
    });

    it("notifies once per turn, not once per message", async () => {
        const ticket = await newTicket();
        const adminFilter = { recipient: admin._id };
        const customerFilter = { recipient: customer._id };

        assert.equal(await supportNotifications(adminFilter), 1);

        await addReply(ticket._id, "Also...", asCustomer());
        await addReply(ticket._id, "...one more thing", asCustomer());
        assert.equal(await supportNotifications(adminFilter), 1);

        await addReply(ticket._id, "Sure", asAdmin());
        await addReply(ticket._id, "Anything else?", asAdmin());
        assert.equal(await supportNotifications(customerFilter), 1);

        await addReply(ticket._id, "No, thanks", asCustomer());
        assert.equal(await supportNotifications(adminFilter), 2);
    });

    it("keeps concurrent replies from both sides", async () => {
        const ticket = await newTicket();

        await Promise.all([
            addReply(ticket._id, "admin 1", asAdmin()),
            addReply(ticket._id, "customer 1", asCustomer()),
            addReply(ticket._id, "admin 2", asAdmin()),
            addReply(ticket._id, "customer 2", asCustomer()),
        ]);

        const stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.messages.length, 5);
    });

    it("marks read and clears the badge", async () => {
        const ticket = await newTicket();
        await addReply(ticket._id, "One", asAdmin());
        await addReply(ticket._id, "Two", asAdmin());

        assert.deepEqual(await getUnreadSummary(asCustomer()), { unread: 2 });
        assert.deepEqual(await getUnreadSummary(asAdmin()), { unread: 0 });

        const before = await SupportTicket.findById(ticket._id).lean();
        const result = await markTicketRead(ticket._id, asCustomer());

        assert.ok(result.readAt instanceof Date);
        assert.deepEqual(await getUnreadSummary(asCustomer()), { unread: 0 });

        const stored = await SupportTicket.findById(ticket._id).lean();
        assert.ok(stored.customerLastReadAt >= result.readAt);
        assert.equal(
            stored.updatedAt.getTime(),
            before.updatedAt.getTime(),
            "reading isn't activity"
        );
    });

    it("reopens a resolved chat on customer reply, refuses a closed one", async () => {
        const ticket = await newTicket();

        await updateTicketStatus(
            ticket._id,
            SUPPORT_TICKET_STATUS.RESOLVED,
            { userId: admin._id }
        );

        await addReply(ticket._id, "Actually, one more question", asCustomer());

        let stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.status, SUPPORT_TICKET_STATUS.OPEN);
        assert.equal(stored.resolvedAt, null);
        assert.ok(
            stored.messages.some((m) => m.senderRole === "system"),
            "status change is shown in the chat"
        );

        await updateTicketStatus(
            ticket._id,
            SUPPORT_TICKET_STATUS.CLOSED,
            { userId: admin._id }
        );

        await assert.rejects(
            addReply(ticket._id, "Hello?", asCustomer()),
            { statusCode: 400 }
        );

        stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.status, SUPPORT_TICKET_STATUS.CLOSED);
    });

    it("doesn't log a status event when the status is unchanged", async () => {
        const ticket = await newTicket();

        await updateTicketStatus(ticket._id, SUPPORT_TICKET_STATUS.OPEN, {
            userId: admin._id,
        });

        const stored = await SupportTicket.findById(ticket._id).lean();
        assert.equal(stored.messages.length, 1);
    });
});
