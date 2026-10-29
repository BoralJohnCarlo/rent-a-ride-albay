import { useState } from "react";

import Modal from "../common/Modal";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";

import { BOOKING_DRIVER_OPTIONS } from "../../constants/bookingStatus";

const DRIVER_OPTIONS = [
    { value: "", label: "Any driver option" },
    {
        value: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
        label: "With driver",
    },
    {
        value: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        label: "Without driver",
    },
];

const PAYMENT_OPTIONS = [
    { value: "", label: "Any payment status" },
    { value: "VERIFIED", label: "Reservation fee paid" },
    { value: "PENDING", label: "Awaiting payment" },
];

const EMPTY = {
    dateRange: { from: "", to: "" },
    driverOption: "",
    paymentStatus: "",
};

const BookingFilters = ({
    filters,
    onApply,
    onReset,
    onClose,
}) => {
    const [dateRange, setDateRange] = useState(
        filters?.dateRange || EMPTY.dateRange
    );
    const [driverOption, setDriverOption] = useState(
        filters?.driverOption || ""
    );
    const [paymentStatus, setPaymentStatus] = useState(
        filters?.paymentStatus || ""
    );

    const handleApply = () => {
        onApply({ dateRange, driverOption, paymentStatus });
        onClose();
    };

    const handleReset = () => {
        setDateRange(EMPTY.dateRange);
        setDriverOption("");
        setPaymentStatus("");
        onReset();
        onClose();
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Filter bookings"
            size="sm"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                    <Button onClick={handleApply}>
                        Apply filters
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                        Created between
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                            type="date"
                            value={dateRange.from}
                            onChange={(event) =>
                                setDateRange((current) => ({
                                    ...current,
                                    from: event.target.value,
                                }))
                            }
                        />
                        <Input
                            type="date"
                            value={dateRange.to}
                            onChange={(event) =>
                                setDateRange((current) => ({
                                    ...current,
                                    to: event.target.value,
                                }))
                            }
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                        Driver option
                    </label>
                    <Select
                        value={driverOption}
                        options={DRIVER_OPTIONS}
                        onChange={(event) =>
                            setDriverOption(event.target.value)
                        }
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                        Payment status
                    </label>
                    <Select
                        value={paymentStatus}
                        options={PAYMENT_OPTIONS}
                        onChange={(event) =>
                            setPaymentStatus(event.target.value)
                        }
                    />
                </div>
            </div>
        </Modal>
    );
};

export default BookingFilters;
