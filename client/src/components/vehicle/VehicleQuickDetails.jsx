import { useState } from "react";

import {
    Car,
    CreditCard,
    FileText,
    Fuel,
    Gauge,
    Hash,
    PhilippinePeso,
    Percent,
    ShieldCheck,
    Star,
    Users,
} from "lucide-react";

import {
    CardDetailItem,
    CardGrid,
    CardSection,
} from "../cards";

import Button from "../common/Button";
import VehicleDocumentsDialog from "./VehicleDocumentsDialog";

import formatCommission from "../../utils/formatCommission";

const VehicleQuickDetails = ({
    vehicle,
    platformCommissionRate = null,
}) => {
    const {
        plateNumber,
        condition,
        status,
        isFeatured,
        commission = null,
        ownership = "Company",
        pricing = {},
        specifications = {},
        availability = {},
    } = vehicle;

    const commissionInfo = formatCommission(
        commission,
        platformCommissionRate
    );

    const [documentsOpen, setDocumentsOpen] =
        useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    leftIcon={
                        <FileText size={15} />
                    }
                    onClick={() =>
                        setDocumentsOpen(true)
                    }
                >
                    Documents
                </Button>
            </div>

            <CardSection
                title="Vehicle Information"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <Hash size={16} />
                        }
                        label="Plate Number"
                        value={
                            plateNumber
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Car size={16} />
                        }
                        label="Condition"
                        value={
                            condition
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Gauge size={16} />
                        }
                        label="Transmission"
                        value={
                            specifications.transmission
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Fuel size={16} />
                        }
                        label="Fuel Type"
                        value={
                            specifications.fuelType
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Users size={16} />
                        }
                        label="Seats"
                        value={
                            specifications.seatingCapacity
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection
                title="Pricing"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <PhilippinePeso
                                size={16}
                            />
                        }
                        label="Daily Total Price"
                        value={
                            pricing.dailyRate != null
                                ? `₱${(Number(pricing.dailyRate) + Number(pricing.reservationFee || 0)).toLocaleString()}`
                                : "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <PhilippinePeso
                                size={16}
                            />
                        }
                        label="Base Daily Rate"
                        value={
                            pricing.dailyRate !=
                            null
                                ? `₱${pricing.dailyRate.toLocaleString()}`
                                : "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <CreditCard
                                size={16}
                            />
                        }
                        label="Reservation Fee"
                        value={
                            pricing.reservationFee !=
                            null
                                ? `₱${pricing.reservationFee.toLocaleString()}`
                                : "None"
                        }
                    />

                    {ownership !== "Company" && (
                        <CardDetailItem
                            icon={
                                <Percent
                                    size={16}
                                />
                            }
                            label="Commission"
                            value={
                                commissionInfo.label
                            }
                        />
                    )}
                </CardGrid>
            </CardSection>

            <CardSection
                title="Availability"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <ShieldCheck
                                size={16}
                            />
                        }
                        label="Status"
                        value={
                            status
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Car size={16} />
                        }
                        label="Booking"
                        value={
                            availability.bookingEnabled
                                ? "Enabled"
                                : "Disabled"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Star size={16} />
                        }
                        label="Featured"
                        value={
                            isFeatured
                                ? "Yes"
                                : "No"
                        }
                    />
                </CardGrid>
            </CardSection>

            <VehicleDocumentsDialog
                open={documentsOpen}
                vehicle={vehicle}
                onClose={() =>
                    setDocumentsOpen(false)
                }
            />
        </div>
    );
};

export default VehicleQuickDetails;
