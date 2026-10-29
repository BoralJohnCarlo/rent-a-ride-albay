import { motion } from "framer-motion";
import {
    Car,
    ChevronDown,
    MapPin,
} from "lucide-react";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

import OperatorPayoutRecords from "./OperatorPayoutRecords";

const OperatorCard = ({
    operator,
    expanded = false,
    onToggle,
}) => {

const applicant =
    operator?.snapshots?.applicant ?? {};

const vehicle =
    operator?.snapshots?.vehicle ?? {};

const specifications =
    vehicle?.specifications ?? {};

const application =
    operator?.application ?? {};

const address =
    applicant?.address ?? {};

const contact =
    applicant?.contact ?? {};

const identity =
    applicant?.identity ?? {};

const displayName =
    identity?.displayName ??
    "Unknown Partner";

const initials = displayName
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const vehicleName =
    [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ") || "-";

const applicationStatus =
    application.status ?? "Unknown";

    return (
        <motion.article
            layout
            layoutId={`operator-${operator._id}`}
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
            }}
            onClick={onToggle}
            className={[
                "group",
                expanded
                    ? "min-h-[420px]"
                    : "h-[390px]",
                "cursor-pointer",
                "overflow-hidden",
                "rounded-3xl",
                "border",
                "border-gray-200",
                "bg-white",
                "dark:border-gray-800",
                "dark:bg-gray-900",
                "shadow-md",
                "transition-all",
                "duration-300",
                "hover:-translate-y-1",
                "hover:border-gray-300",
                "dark:hover:border-gray-600",
                "hover:shadow-2xl",
            ].join(" ")}
        >

<div className="flex h-full flex-col">

    <div
        className="
            rounded-t-3xl
            bg-gradient-to-b
            from-blue-50
            to-white
            px-6
            pt-6
            pb-8
            dark:from-blue-950/40
            dark:to-gray-900
        "
    >

<div
    className="
        flex
        flex-col
        items-center
        text-center
        pb-8
    "
>

    <motion.div
        whileHover={{
            scale: 1.08,
            rotate: 3,
    }}

        transition={{
            type: "spring",
            stiffness: 350,
            damping: 18,
    }}
    className="
        flex
        h-16
        w-16
        items-center
        justify-center
        rounded-full
        bg-gradient-to-br
        from-blue-100
        to-blue-200
        shadow-lg
        ring-4
        ring-white
        dark:from-blue-900
        dark:to-blue-800
        dark:ring-gray-900
    "
>
        <span
            className="
                text-xl
                font-bold
                tracking-wide
                text-blue-700
                dark:text-blue-200
            "
        >
            {initials}
        </span>
        </motion.div>
    </div>

    <h3
        className="
            mt-4
            text-xl
            font-bold
            tracking-tight
            text-gray-900
            dark:text-white
        "
    >
        {displayName}
    </h3>

<div className="mt-2 space-y-1">

    <p
        className="
            text-sm
            text-gray-500
            dark:text-gray-400
        "
    >
        Official Consignment Partner
    </p>

    <p
        className="
            text-xs
            font-medium
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        {operator?.consignmentCode ?? "-"}
    </p>

</div>

</div>

                <div className="flex-1">

                    {expanded ? (

<motion.div
    layout
    initial={{
        opacity: 0,
        y: 8,
    }}
    animate={{
        opacity: 1,
        y: 0,
    }}
    exit={{
        opacity: 0,
        y: 4,
    }}
    transition={{
        duration: 0.22,
        ease: "easeOut",
    }}
    className="
        rounded-3xl
        border
        border-gray-200
        bg-gray-50
        p-6
        dark:border-gray-800
        dark:bg-gray-800/40
    "
>
<div className="space-y-8">

    <div className="grid gap-8 lg:grid-cols-2">

        <section
            className="
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-sm
                p-6
                dark:border-gray-800
                dark:bg-gray-900
            "
        >
<div className="border-b border-gray-100 pb-4 dark:border-gray-800">
    <h4
        className="
            text-sm
            font-semibold
            uppercase
            tracking-wide
            text-gray-900
            dark:text-white
        "
    >
        Personal Information
    </h4>
</div>

<div className="mt-6 space-y-5">

<div>

    <p
        className="
            text-xs
            font-medium
            uppercase
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        Name
    </p>

    <p
        className="
            mt-1
            text-sm
            font-semibold
            text-gray-900
            dark:text-white
        "
    >
        {displayName}
    </p>

</div>

<div>

    <p
        className="
            text-xs
            font-medium
            uppercase
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        Birth Date
    </p>

    <p
        className="
            mt-1
            text-sm
            font-semibold
            text-gray-900
            dark:text-white
        "
    >
        {identity.birthDate ?? "-"}
    </p>

</div>

<div>

    <p
        className="
            text-xs
            font-medium
            uppercase
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        Nationality
    </p>

    <p
        className="
            mt-1
            text-sm
            font-semibold
            text-gray-900
            dark:text-white
        "
    >
        {identity.nationality ?? "-"}
    </p>

</div>

            </div>
        </section>

<section
    className="
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-sm
        p-6
        dark:border-gray-800
        dark:bg-gray-900
    "
>
<div className="border-b border-gray-100 pb-4 dark:border-gray-800">

    <h4
        className="
            text-sm
            font-semibold
            uppercase
            tracking-wide
            text-gray-900
            dark:text-white
        "
    >
        Contact Information
    </h4>

</div>

            <div className="mt-6 space-y-5">

<div>

    <p
        className="
            text-xs
            font-medium
            uppercase
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        Email
    </p>

    <p
        className="
            mt-1
            text-sm
            font-semibold
            text-gray-900
            dark:text-white
        "
    >
        {contact.email ?? "-"}
    </p>

</div>

<div>

    <p
        className="
            text-xs
            font-medium
            uppercase
            tracking-wide
            text-gray-400
            dark:text-gray-500
        "
    >
        Phone
    </p>

    <p
        className="
            mt-1
            text-sm
            font-semibold
            text-gray-900
            dark:text-white
        "
    >
        {contact.phoneNumber ?? "-"}
    </p>

</div>

            </div>
        </section>

    </div>

<section
    className="
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-sm
        p-6
        dark:border-gray-800
        dark:bg-gray-900
    "
>
<div className="border-b border-gray-100 pb-4 dark:border-gray-800">

    <h4
        className="
            text-sm
            font-semibold
            uppercase
            tracking-wide
            text-gray-900
            dark:text-white
        "
    >
        Vehicle Information
    </h4>

</div>

<div
    className="
        mt-6
        grid
        gap-6
        md:grid-cols-3
    "
>

            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Vehicle
                </p>

                <p className="font-medium">
                    {vehicleName}
                </p>
            </div>

            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Plate Number
                </p>

                <p className="font-medium">
                    {vehicle.plateNumber ?? "-"}
                </p>
            </div>

            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Year
                </p>

                <p className="font-medium">
                    {vehicle.year ?? "-"}
                </p>
            </div>

        </div>
    </section>

    <OperatorPayoutRecords
        operatorId={operator?.audit?.createdBy}
    />

</div>
        </motion.div>

) : (

<div className="flex h-full flex-col">

<div
    className="
        border-t
        border-gray-200
        pt-5
        dark:border-gray-800
    "
>

    <p
    className="
        text-xs
        font-bold
        uppercase
        tracking-[0.2em]
        text-blue-600
        dark:text-blue-400
    "
>
    Vehicle
</p>

    <div className="mt-4 flex items-start gap-3">

    <div
        className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-blue-100
            dark:bg-blue-950/40
        "
    >
        <Car
            size={18}
            className="text-blue-600 dark:text-blue-400"
        />
    </div>

<div className="min-w-0 flex-1">

    <div className="flex items-start justify-between gap-3">

        <p
            className="
                text-lg
                font-bold
                tracking-tight
                text-gray-900
                dark:text-white
            "
        >
            {vehicleName}
        </p>

        <span
            className="
                shrink-0
                rounded-full
                bg-green-100
                px-2.5
                py-1
                text-xs
                font-semibold
                text-green-700
                dark:bg-green-900/30
                dark:text-green-300
            "
        >
            {applicationStatus}
        </span>

    </div>

    <p
        className="
            mt-1
            text-sm
            font-medium
            tracking-wide
            text-gray-500
            dark:text-gray-400
        "
    >
        {vehicle.plateNumber ?? "-"}
    </p>

    <p
        className="
            mt-1
            text-sm
            text-gray-500
            dark:text-gray-400
        "
    >
        {vehicle.year ?? "-"}

        {specifications.transmission && (
            <>
                {" • "}
                {specifications.transmission}
            </>
                    )}
                </p>
            </div>
        </div>
    </div>

<div
    className="
        mt-auto
        border-t
        border-gray-100
        pt-5
        dark:border-gray-800
    "
>

    <div
        className="
            flex
            items-center
            justify-between
        "
    >

        <div>

<div className="flex items-center gap-2">

    <MapPin
        size={16}
        className="text-gray-400 dark:text-gray-500"
    />

    <p
        className="
            text-sm
            font-medium
            text-gray-700
            dark:text-gray-200
        "
    >
        {address.city ?? "Unknown City"}
    </p>

</div>
        </div>

        <motion.div
            animate={{
                rotate: expanded
                    ? 180
                    : 0,
            }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
            }}
        >
            <ChevronDown
                size={22}
                className="text-gray-500 transition-transform dark:text-gray-400"
            />
                            </motion.div>

                        </div>
                    </div>
                </div>
                    )}
                </div>
            </div>
        </motion.article>
    );
};

export default OperatorCard;