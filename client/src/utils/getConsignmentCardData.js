const PENDING_STATUSES = [
    "Pending",
    "Under Review",
    "Revision Requested",
    "Draft",
];

const getConsignmentCardData = (
    consignment = {}
) => {
    const applicant =
        consignment.snapshots?.applicant ?? {};

    const status =
        consignment.application?.status ?? "Draft";

    const isPending = PENDING_STATUSES.includes(status);

    const vehicle =
        isPending && consignment.generatedEntities?.vehicle
            ? consignment.generatedEntities.vehicle
            : consignment.snapshots?.vehicle ?? {};

    const pricing =
        consignment.generatedEntities?.vehicle?.pricing ??
        vehicle.pricing ??
        {};

    const images =
        vehicle.images ?? [];

    const primaryImage =
        images.find(
            (image) => image.isPrimary
        ) ??
        images[0] ??
        null;

    const title = [
        vehicle.brand,
        vehicle.model,
        vehicle.variant,
    ]
        .filter(Boolean)
        .join(" ");

    return {
        id: consignment._id,

        consignmentCode:
            consignment.consignmentCode ?? "",

        title:
            title || "Unnamed Vehicle",

        applicantName:
            applicant.identity?.displayName ??
            "Unknown Applicant",

        image:
            primaryImage?.url ?? "",

        status,

        ownership:
            vehicle.ownership ?? "",

        vehicleType:
            vehicle.vehicleType ?? "",

        plateNumber:
            vehicle.plateNumber ?? "",

        registrationNumber:
            vehicle.registrationNumber ??
            "",

        transmission:
            vehicle.specifications
                ?.transmission ?? "",

        fuelType:
            vehicle.specifications
                ?.fuelType ?? "",

        seats:
            vehicle.specifications
                ?.seatingCapacity ?? null,

        color:
            vehicle.specifications
                ?.color ?? "",

        dailyRate:
            pricing.dailyRate ??
            null,

        reservationFee:
            pricing.reservationFee ?? null,

        submittedAt:
            consignment.application
                ?.submitted
                ?.submittedAt ?? null,

        reviewedAt:
            consignment.application
                ?.review
                ?.reviewedAt ?? null,

        inspectedAt:
            consignment.application
                ?.inspection
                ?.inspectedAt ?? null,

        approvedAt:
            consignment.application
                ?.approval
                ?.approvedAt ?? null,

        withdrawnAt:
            consignment.application
                ?.withdrawal
                ?.withdrawnAt ?? null,

        createdAt:
            consignment.createdAt,

        updatedAt:
            consignment.updatedAt,

        archive:
            consignment.archive,

        applicant,

        vehicle,

        consignment,
    };
};

export default getConsignmentCardData;
