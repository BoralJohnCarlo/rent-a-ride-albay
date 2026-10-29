import {
    Calendar,
    Car,
    CreditCard,
    Fuel,
    Gauge,
    Hash,
    PhilippinePeso,
    User,
    Users,
} from "lucide-react";

import {
    CardDetailItem,
    CardGrid,
    CardSection,
} from "../cards";

import getConsignmentCardData from "../../utils/getConsignmentCardData";
import formatDate from "../../utils/formatDate";

const ConsignmentQuickDetails = ({
    consignment,
}) => {
    const item =
        getConsignmentCardData(
            consignment
        );

    return (
        <div className="space-y-6">
            <CardSection title="Application">
                <CardGrid>
                    <CardDetailItem
                        icon={<Hash size={16} />}
                        label="Application Code"
                        value={
                            item.consignmentCode
                        }
                    />

                    <CardDetailItem
                        icon={<Calendar size={16} />}
                        label="Submitted"
                        value={
                            item.submittedAt
                                ? formatDate(
                                      item.submittedAt
                                  )
                                : "Draft"
                        }
                    />

                    <CardDetailItem
                        icon={<User size={16} />}
                        label="Applicant"
                        value={
                            item.applicantName
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection title="Vehicle Information">
                <CardGrid>
                    <CardDetailItem
                        icon={<Car size={16} />}
                        label="Vehicle"
                        value={item.title}
                    />

                    <CardDetailItem
                        icon={<Hash size={16} />}
                        label="Plate Number"
                        value={
                            item.plateNumber ||
                            "Not Available"
                        }
                    />

                    <CardDetailItem
                        icon={<Gauge size={16} />}
                        label="Transmission"
                        value={
                            item.transmission ||
                            "Not Specified"
                        }
                    />

                    <CardDetailItem
                        icon={<Fuel size={16} />}
                        label="Fuel Type"
                        value={
                            item.fuelType ||
                            "Not Specified"
                        }
                    />

                    <CardDetailItem
                        icon={<Users size={16} />}
                        label="Seats"
                        value={
                            item.seats ??
                            "Not Specified"
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection title="Pricing">
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <PhilippinePeso
                                size={16}
                            />
                        }
                        label="Daily Rate"
                        value={
                            item.dailyRate !=
                            null
                                ? `₱${item.dailyRate.toLocaleString()}`
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
                            item.reservationFee !=
                            null
                                ? `₱${item.reservationFee.toLocaleString()}`
                                : "None"
                        }
                    />
                </CardGrid>
            </CardSection>
        </div>
    );
};

export default ConsignmentQuickDetails;