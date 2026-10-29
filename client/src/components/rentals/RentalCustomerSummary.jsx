import { Mail, Phone, UserRound } from "lucide-react";

const getCustomerName = (customer) => {
    if (!customer) {
        return "Unknown Customer";
    }

    const fullName = [
        customer.firstName,
        customer.lastName,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        customer.fullName ||
        fullName ||
        customer.name ||
        customer.email ||
        "Unknown Customer"
    );
};

const RentalCustomerSummary = ({
    customer,
}) => {
    const name = getCustomerName(customer);

    if (!customer) {
        return (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <UserRound size={19} />
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Customer
                        </p>

                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            No customer information available.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <UserRound size={20} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Customer
                    </p>

                    <h3 className="mt-1 truncate text-base font-semibold text-gray-900 dark:text-white">
                        {name}
                    </h3>

                    <div className="mt-3 space-y-2">
                        {customer.email && (
                            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <Mail
                                    size={15}
                                    className="shrink-0 text-gray-400"
                                />

                                <span className="truncate">
                                    {customer.email}
                                </span>
                            </div>
                        )}

                        {customer.phoneNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <Phone
                                    size={15}
                                    className="shrink-0 text-gray-400"
                                />

                                <span>
                                    {customer.phoneNumber}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RentalCustomerSummary;