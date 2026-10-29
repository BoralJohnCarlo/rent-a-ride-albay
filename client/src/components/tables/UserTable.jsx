import {
    CheckCircle2,
    User,
} from "lucide-react";

import Avatar from "../common/Avatar";
import StatusChip from "../common/StatusChip";

import DataTable from "./DataTable";
import TableActions from "./TableActions";

const UserTable = ({
    users = [],
    loading = false,
    mode = "users",
    onView,
    onSuspend,
    onBlacklist,
    onUnblacklist,
}) => {
    const columns = [
        {
            key: "user",
            header: "User",
            render: (user) => (
                <div className="flex items-center gap-3">
                    <Avatar
                        src={user.profileImage}
                        name={`${user.firstName} ${user.lastName}`}
                        size="md"
                    />

                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium text-gray-900 dark:text-white">
                                {user.firstName}{" "}
                                {user.lastName}
                            </p>

                            {user.isVerified && (
                                <CheckCircle2
                                    size={16}
                                    className="shrink-0 text-blue-600 dark:text-blue-400"
                                />
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                onView?.(user)
                            }
                            className="mt-0.5 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            <User
                                size={12}
                            />
                            View Profile
                        </button>
                    </div>
                </div>
            ),
        },

        {
            key: "phoneNumber",
            header: "Phone",
            render: (user) =>
                user.phoneNumber || "—",
        },

        {
            key: "verification",
            header: "Valid ID",
            align: "center",
            render: (user) => (
                <StatusChip
                    status={
                        user.isVerified
                            ? "approved"
                            : "pending"
                    }
                />
            ),
        },

        {
            key: "status",
            header: "Account",
            align: "center",
            render: (user) => (
                <StatusChip
                    status={
                        user.isSuspended
                            ? "suspended"
                            : "active"
                    }
                />
            ),
        },

        {
            key: "actions",
            header: "Actions",
            align: "right",
            cellClassName: "min-w-[180px]",
            render: (user) => {
                const actions = [
                    {
                        label: "View",
                        variant: "outline",
                        onClick: () =>
                            onView?.(user),
                    },
                ];

                if (mode === "users") {
                    actions.push({
                        label: "Blacklist",
                        variant: "danger",
                        onClick: () =>
                            onBlacklist?.(user),
                    });
                }

                if (mode === "operators") {
                    actions.push({
                        label: user.isSuspended
                            ? "Activate"
                            : "Suspend",
                        variant: user.isSuspended
                            ? "success"
                            : "warning",
                        onClick: () =>
                            onSuspend?.(user),
                    });
                }

                if (mode === "blacklisted") {
                    actions.push({
                        label: "Remove Blacklist",
                        variant: "success",
                        onClick: () =>
                            onUnblacklist?.(user),
                    });
                }

                return (
                    <TableActions
                        actions={actions}
                    />
                );
            },
        },
    ];

    return (
        <DataTable
            columns={columns}
            data={users}
            loading={loading}
            caption="User management table"
            emptyMessage="No users match the current search."
        />
    );
};

export default UserTable;