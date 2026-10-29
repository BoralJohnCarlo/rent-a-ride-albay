import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    submitSupportTicket,
    fetchMySupportTickets,
    fetchAdminSupportTickets,
    fetchSupportTicketById,
    sendSupportTicketReply,
    readSupportTicket,
    fetchSupportUnreadCount,
    changeSupportTicketStatus,
} from "../../services/supportTicketService";

const initialState = {
    tickets: [],
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    },
    // Admin inbox tallies: per status, `all`, and `unread` (needs a reply).
    counts: {},
    unreadCount: 0,
    selectedTicket: null,
    loading: false,
    threadLoading: false,
    error: null,
};

/*
 * `silent` refetches (after a realtime event) refresh the list in place
 * without flashing the loading state; it's never sent to the server.
 */
const withoutSilent = (params = {}) => {
    const rest = { ...(params || {}) };

    delete rest.silent;

    return rest;
};

const isSilent = (action) => Boolean(action.meta.arg?.silent);

export const createTicket = createAsyncThunk(
    "supportTickets/createTicket",
    async (ticketData, { rejectWithValue }) => {
        try {
            return await submitSupportTicket(
                ticketData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to start the conversation."
            );
        }
    }
);

export const getMyTickets = createAsyncThunk(
    "supportTickets/getMyTickets",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchMySupportTickets(
                withoutSilent(params)
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch your conversations."
            );
        }
    }
);

export const getAdminTickets = createAsyncThunk(
    "supportTickets/getAdminTickets",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchAdminSupportTickets(
                withoutSilent(params)
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch support conversations."
            );
        }
    }
);

export const getTicketById = createAsyncThunk(
    "supportTickets/getTicketById",
    async (ticketId, { rejectWithValue }) => {
        try {
            return await fetchSupportTicketById(
                ticketId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to load this conversation."
            );
        }
    }
);

export const replyToTicket = createAsyncThunk(
    "supportTickets/replyToTicket",
    async (
        { ticketId, message },
        { rejectWithValue }
    ) => {
        try {
            return await sendSupportTicketReply(
                ticketId,
                message
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to send your message."
            );
        }
    }
);

export const markTicketRead = createAsyncThunk(
    "supportTickets/markTicketRead",
    async (ticketId, { rejectWithValue }) => {
        try {
            return await readSupportTicket(ticketId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to mark the conversation as read."
            );
        }
    }
);

export const getSupportUnread = createAsyncThunk(
    "supportTickets/getSupportUnread",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchSupportUnreadCount();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch unread messages."
            );
        }
    }
);

export const updateTicketStatus =
    createAsyncThunk(
        "supportTickets/updateTicketStatus",
        async (
            { ticketId, status },
            { rejectWithValue }
        ) => {
            try {
                return await changeSupportTicketStatus(
                    ticketId,
                    status
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to update the conversation status."
                );
            }
        }
    );

const byLatestMessage = (a, b) =>
    new Date(b.lastMessageAt || b.updatedAt) -
    new Date(a.lastMessageAt || a.updatedAt);

/*
 * Applies a fresher copy of a ticket (from a REST response or a realtime
 * event) to the open thread and to its row in the list, keeping the list in
 * inbox order. Tickets not already listed are left to the page's refetch,
 * which knows the active filter.
 */
const upsertTicket = (state, ticket) => {
    if (!ticket?._id) {
        return;
    }

    if (state.selectedTicket?._id === ticket._id) {
        state.selectedTicket = ticket;
    }

    const index = state.tickets.findIndex(
        (existing) => existing._id === ticket._id
    );

    if (index >= 0) {
        state.tickets[index] = ticket;
        state.tickets.sort(byLatestMessage);
    }
};

const READ_FIELDS = {
    customer: {
        unread: "unreadForCustomer",
        lastReadAt: "customerLastReadAt",
    },
    admin: {
        unread: "unreadForAdmin",
        lastReadAt: "adminLastReadAt",
    },
};

const applyRead = (ticket, { role, readAt }) => {
    const fields = READ_FIELDS[role];

    if (!ticket || !fields) {
        return;
    }

    if (fields.unread in ticket) {
        ticket[fields.unread] = 0;
    }

    ticket[fields.lastReadAt] = readAt;
};

const supportTicketSlice = createSlice({
    name: "supportTickets",
    initialState,
    reducers: {
        clearSupportTicketError: (state) => {
            state.error = null;
        },
        clearSelectedTicket: (state) => {
            state.selectedTicket = null;
        },
        supportTicketReceived: (state, action) => {
            upsertTicket(state, action.payload);
        },
        supportReadReceived: (state, action) => {
            const { ticketId } = action.payload || {};

            if (state.selectedTicket?._id === ticketId) {
                applyRead(state.selectedTicket, action.payload);
            }

            applyRead(
                state.tickets.find(
                    (ticket) => ticket._id === ticketId
                ),
                action.payload
            );
        },
        setSupportUnreadCount: (state, action) => {
            state.unreadCount = Math.max(0, Number(action.payload) || 0);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createTicket.pending, (state) => {
                state.error = null;
            })
            .addCase(createTicket.fulfilled, (state, action) => {
                state.error = null;
                const ticket = action.payload?.data ?? null;
                if (
                    ticket &&
                    !state.tickets.some(
                        (existing) => existing._id === ticket._id
                    )
                ) {
                    state.tickets.unshift(ticket);
                }
                state.selectedTicket = ticket;
            })
            .addCase(createTicket.rejected, (state, action) => {
                state.error = action.payload;
            })

            .addCase(getMyTickets.pending, (state, action) => {
                if (!isSilent(action)) {
                    state.loading = true;
                }
                state.error = null;
            })
            .addCase(getMyTickets.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.tickets = action.payload?.data ?? [];
                state.pagination =
                    action.payload?.pagination ??
                    state.pagination;
            })
            .addCase(getMyTickets.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getAdminTickets.pending, (state, action) => {
                if (!isSilent(action)) {
                    state.loading = true;
                }
                state.error = null;
            })
            .addCase(getAdminTickets.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.tickets = action.payload?.data ?? [];
                state.counts = action.payload?.counts ?? state.counts;
                state.pagination =
                    action.payload?.pagination ??
                    state.pagination;
            })
            .addCase(getAdminTickets.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getTicketById.pending, (state) => {
                state.threadLoading = true;
                state.error = null;
            })
            .addCase(getTicketById.fulfilled, (state, action) => {
                state.threadLoading = false;
                state.error = null;
                state.selectedTicket =
                    action.payload?.data ?? null;
            })
            .addCase(getTicketById.rejected, (state, action) => {
                state.threadLoading = false;
                state.error = action.payload;
            })

            .addCase(replyToTicket.fulfilled, (state, action) => {
                state.error = null;
                upsertTicket(
                    state,
                    action.payload?.data
                );
            })
            .addCase(replyToTicket.rejected, (state, action) => {
                state.error = action.payload;
            })

            .addCase(markTicketRead.fulfilled, (state, action) => {
                const result = action.payload?.data;

                if (!result) {
                    return;
                }

                const ticketId = result.ticketId;

                if (state.selectedTicket?._id === ticketId) {
                    applyRead(state.selectedTicket, result);
                }

                applyRead(
                    state.tickets.find(
                        (ticket) => ticket._id === ticketId
                    ),
                    result
                );
            })

            .addCase(getSupportUnread.fulfilled, (state, action) => {
                state.unreadCount = action.payload?.data?.unread ?? 0;
            })

            .addCase(updateTicketStatus.fulfilled, (state, action) => {
                state.error = null;
                upsertTicket(
                    state,
                    action.payload?.data
                );
            })
            .addCase(updateTicketStatus.rejected, (state, action) => {
                state.error = action.payload;
            });
    },
});

export const {
    clearSupportTicketError,
    clearSelectedTicket,
    supportTicketReceived,
    supportReadReceived,
    setSupportUnreadCount,
} = supportTicketSlice.actions;

export default supportTicketSlice.reducer;
