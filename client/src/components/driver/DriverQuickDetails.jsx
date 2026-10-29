import {
    CalendarDays,
    Clock3,
    CreditCard,
    Mail,
    MapPin,
    Phone,
    ShieldCheck,
    UserRound,
} from "lucide-react";

import {
    CardDetailItem,
    CardGrid,
    CardSection,
} from "../cards";

const DriverQuickDetails = ({
    driver,
}) => {
    const {
        firstName,
        lastName,
        email,
        phoneNumber,
        alternativeContact,
        address = {},
        license = {},
        emergencyContact = {},
        schedule = {},
        status,
        availability,
    } = driver;

    const fullName = [
        firstName,
        lastName,
    ]
        .filter(Boolean)
        .join(" ");

    const addressValue = [
        address.street,
        address.barangay,
        address.city,
        address.province,
    ]
        .filter(Boolean)
        .join(", ");

    const workingDays =
        schedule.workingDays?.length
            ? schedule.workingDays.join(
                  ", "
              )
            : "Not Set";

    return (
        <div className="space-y-6">
            <CardSection
                title="Driver Information"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <UserRound
                                size={16}
                            />
                        }
                        label="Full Name"
                        value={
                            fullName ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <ShieldCheck
                                size={16}
                            />
                        }
                        label="Driver Code"
                        value={
                            driver.driverCode ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <ShieldCheck
                                size={16}
                            />
                        }
                        label="Status"
                        value={
                            status ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Clock3
                                size={16}
                            />
                        }
                        label="Availability"
                        value={
                            availability ||
                            "Not Set"
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection
                title="Contact Information"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <Mail size={16} />
                        }
                        label="Email"
                        value={
                            email ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Phone
                                size={16}
                            />
                        }
                        label="Phone Number"
                        value={
                            phoneNumber ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Phone
                                size={16}
                            />
                        }
                        label="Alternative Contact"
                        value={
                            alternativeContact ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <MapPin
                                size={16}
                            />
                        }
                        label="Address"
                        value={
                            addressValue ||
                            "Not Set"
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection
                title="License Information"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <CreditCard
                                size={16}
                            />
                        }
                        label="License Number"
                        value={
                            license.licenseNumber ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <ShieldCheck
                                size={16}
                            />
                        }
                        label="License Type"
                        value={
                            license.licenseType ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <CalendarDays
                                size={16}
                            />
                        }
                        label="Expiry Date"
                        value={
                            license.expiryDate
                                ? new Date(
                                      license.expiryDate
                                  ).toLocaleDateString(
                                      "en-PH",
                                      {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                      }
                                  )
                                : "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <ShieldCheck
                                size={16}
                            />
                        }
                        label="Driver's License Codes"
                        value={
                            license
                                .restrictionCodes
                                ?.length
                                ? license.restrictionCodes.join(
                                      ", "
                                  )
                                : "None"
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection
                title="Schedule"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <CalendarDays
                                size={16}
                            />
                        }
                        label="Working Days"
                        value={
                            workingDays
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Clock3
                                size={16}
                            />
                        }
                        label="Working Hours"
                        value={
                            schedule.startTime &&
                            schedule.endTime
                                ? `${schedule.startTime} - ${schedule.endTime}`
                                : "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <MapPin
                                size={16}
                            />
                        }
                        label="Timezone"
                        value={
                            schedule.timezone ||
                            "Not Set"
                        }
                    />
                </CardGrid>
            </CardSection>

            <CardSection
                title="Emergency Contact"
            >
                <CardGrid>
                    <CardDetailItem
                        icon={
                            <UserRound
                                size={16}
                            />
                        }
                        label="Name"
                        value={
                            emergencyContact.name ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <UserRound
                                size={16}
                            />
                        }
                        label="Relationship"
                        value={
                            emergencyContact.relationship ||
                            "Not Set"
                        }
                    />

                    <CardDetailItem
                        icon={
                            <Phone
                                size={16}
                            />
                        }
                        label="Phone Number"
                        value={
                            emergencyContact.phoneNumber ||
                            "Not Set"
                        }
                    />
                </CardGrid>
            </CardSection>
        </div>
    );
};

export default DriverQuickDetails;