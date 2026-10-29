import { motion } from "framer-motion";
import { UsersRound } from "lucide-react";

import UserCard from "./UserCard";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const UserCardGrid = ({
    users = [],
    mode = "users",
    onView,
    onSuspend,
    onBlacklist,
    onUnblacklist,
    onVerify,
    onUnverify,
    onGrantRenewalAttempt,
    className = "",
}) => {
    if (!users.length) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    <UsersRound size={26} />
                </div>
                <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                    No users found
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Try adjusting your search or filters.
                </p>
            </div>
        );
    }

    return (
        <motion.div
            layout
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
            }}
            className={[
                "mx-auto",
                "grid",
                "w-full",
                "max-w-[1600px]",
                "grid-cols-1",
                "gap-5",
                "md:grid-cols-2",
                "xl:grid-cols-3",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {users.map((user) => (
                <UserCard
                    key={user._id ?? user.id}
                    user={user}
                    mode={mode}
                    onView={onView}
                    onSuspend={onSuspend}
                    onBlacklist={onBlacklist}
                    onUnblacklist={onUnblacklist}
                    onVerify={onVerify}
                    onUnverify={onUnverify}
                    onGrantRenewalAttempt={
                        onGrantRenewalAttempt
                    }
                />
            ))}
        </motion.div>
    );
};

export default UserCardGrid;
