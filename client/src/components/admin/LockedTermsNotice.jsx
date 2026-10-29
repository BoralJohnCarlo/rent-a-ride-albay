import { Info } from "lucide-react";
import { Link } from "react-router-dom";

/*
 * On settings pages whose rules each booking locks in when it's made
 * (server lockedTermsService): a change applies to new bookings, and to
 * existing ones only when it's better for the customer.
 */
const LockedTermsNotice = () => (
    <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
        <Info size={17} className="mt-0.5 shrink-0" />
        <p>
            Changes here apply to new bookings right away. Existing bookings
            keep the rules from when they were booked, and only get a change
            when it&apos;s better for the customer (a bigger refund or credit,
            or a smaller charge).{" "}
            <Link
                to="/admin/settings/legal"
                className="font-semibold underline underline-offset-2"
            >
                Terms &amp; Policies
            </Link>
        </p>
    </div>
);

export default LockedTermsNotice;
