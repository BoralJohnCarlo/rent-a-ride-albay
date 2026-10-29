import { Expand } from "lucide-react";

import Badge from "../common/Badge";
import Button from "../common/Button";
import Modal from "../common/Modal";
import Price from "../common/Price";

import formatDate from "../../utils/formatDate";
import AcceptedTerms from "../legal/AcceptedTerms";
import { LEGAL_DOCUMENT_TYPES } from "../../constants/legalDocuments";

const openFullSize = (url) => {
    if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }
};

const EMPTY_VALUE = "—";

const ReviewSection = ({
    title,
    children,
}) => (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="border-b pb-2 text-lg font-semibold text-gray-900">
            {title}
        </h3>

        {children}
    </section>
);

const DocumentImageTile = ({
    url,
    alt,
    label,
}) => (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="group relative aspect-video bg-gray-100">
            {url ? (
                <button
                    type="button"
                    onClick={() => openFullSize(url)}
                    className="block h-full w-full cursor-zoom-in"
                >
                    <img
                        src={url}
                        alt={alt}
                        className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
                        <Expand size={16} />
                        <span className="text-sm font-medium">
                            View Full Size
                        </span>
                    </div>
                </button>
            ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    No Image
                </div>
            )}
        </div>

        <p className="p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
        </p>
    </div>
);

const ReviewField = ({
    label,
    value,
    className = "",
}) => (
    <div className={className}>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
        </p>

        <p className="mt-1 break-words text-sm text-gray-900">
            {value || EMPTY_VALUE}
        </p>
    </div>
);

const formatName = ({
    firstName,
    middleName,
    lastName,
    suffix,
} = {}) =>
    [
        firstName,
        middleName,
        lastName,
        suffix,
    ]
        .filter(Boolean)
        .join(" ") || EMPTY_VALUE;

const formatAddress = ({
    street,
    barangay,
    city,
    province,
    postalCode,
} = {}) =>
    [
        street,
        barangay,
        city,
        province,
        postalCode,
    ]
        .filter(Boolean)
        .join(", ") || EMPTY_VALUE;

const getStatusVariant = (
    status = ""
) => {
    switch (status) {
        case "Approved":
            return "success";

        case "Rejected":
            return "danger";

        case "Pending":
            return "warning";

        case "Revision Requested":
            return "info";

        case "Withdrawn":
            return "secondary";

        default:
            return "default";
    }
};

const ConsignmentReview = ({
    open,
    consignment,
    onClose,
    onReview,
    onInspect,
    onApprove,
    onReject,
    onRequestRevision,
    onArchive,
    onRestore,
    onReviewReschedule,
    onVerifyId,
    onUnverifyId,
}) => {
    if (!consignment) {
        return null;
    }

    const applicationStatus =
        consignment.application?.status ?? "Draft";

    const workflowStatus =
        applicationStatus.toLowerCase();

    const application =
        consignment.application ?? {};

    const inspectionResult =
        application.inspection?.status ?? "";

    const inspectionStatus =
        inspectionResult.toLowerCase();

    const timelineEvents = [
        ...(consignment.timeline?.events ?? []),
    ].sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );

    const isArchived =
        consignment.archive?.isArchived ?? false;

    const reschedule = consignment.reschedule ?? {};
    const reschedulePending =
        reschedule.status === "Pending";

    // Each action closes this panel and hands off to the page handler,
    // which opens the matching confirm dialog.
    const runAction = (handler) => () => {
        onClose?.();
        handler?.(consignment);
    };

    const footerActions = [];

    if (reschedulePending && onReviewReschedule) {
        footerActions.push({
            key: "reschedule",
            label: "Review Reschedule",
            variant: "warning",
            onClick: runAction(onReviewReschedule),
        });
    }

    if (workflowStatus === "pending" && onReview) {
        footerActions.push({
            key: "review",
            label: "Start Review",
            variant: "primary",
            onClick: runAction(onReview),
        });
    }

    if (workflowStatus === "under review" && onInspect) {
        footerActions.push({
            key: "inspect",
            label: "Inspect",
            variant: "primary",
            onClick: runAction(onInspect),
        });
    }

    if (
        workflowStatus === "under review" &&
        ["passed", "conditional pass"].includes(
            inspectionStatus
        ) &&
        onApprove
    ) {
        footerActions.push({
            key: "approve",
            label: "Approve",
            variant: "success",
            onClick: runAction(onApprove),
        });
    }

    if (
        (workflowStatus === "pending" ||
            workflowStatus === "under review") &&
        onRequestRevision
    ) {
        footerActions.push({
            key: "revision",
            label: "Request Revision",
            variant: "warning",
            onClick: runAction(onRequestRevision),
        });
    }

    if (
        (workflowStatus === "pending" ||
            workflowStatus === "under review") &&
        onReject
    ) {
        footerActions.push({
            key: "reject",
            label: "Reject",
            variant: "danger",
            onClick: runAction(onReject),
        });
    }

    if (
        [
            "approved",
            "rejected",
            "withdrawn",
        ].includes(workflowStatus) &&
        !isArchived &&
        onArchive
    ) {
        footerActions.push({
            key: "archive",
            label: "Archive",
            variant: "secondary",
            onClick: runAction(onArchive),
        });
    }

    if (isArchived && onRestore) {
        footerActions.push({
            key: "restore",
            label: "Restore",
            variant: "secondary",
            onClick: runAction(onRestore),
        });
    }

    const applicant =
        consignment.snapshots
            ?.applicant ?? {};

    const vehicle =
        consignment.snapshots
            ?.vehicle ?? {};

    const organization =
        applicant.organization ?? {};

    const identity =
        applicant.identity ?? {};

    const contact =
        applicant.contact ?? {};

    const address =
        applicant.address ?? {};

    const emergencyContacts =
        applicant.emergencyContacts ?? [];

    const specifications =
        vehicle.specifications ?? {};

    const pricing =
        consignment.generatedEntities?.vehicle?.pricing ??
        vehicle.pricing ?? {};

    const description =
        vehicle.description ?? {};

    const images =
        vehicle.images ?? [];

    const documents =
        vehicle.documents ?? {};

    const operator =
        consignment.audit?.createdBy ?? {};

    // An expired valid ID puts an admin's verification on hold (server:
    // isUserEffectivelyVerified); this list populates the raw flag.
    const operatorIdExpired = Boolean(
        operator.validIdExpirationDate &&
            new Date(operator.validIdExpirationDate) < new Date()
    );

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Consignment Application"
            size="full"
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {footerActions.map((action) => (
                        <Button
                            key={action.key}
                            variant={action.variant}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    ))}

                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {reschedulePending && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            Pending reschedule request
                        </p>
                        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                            Proposed{" "}
                            {formatDate(
                                reschedule.proposedDate
                            )}
                            {reschedule.proposedTime
                                ? ` at ${reschedule.proposedTime}`
                                : ""}
                            {" — "}
                            {reschedule.reason ||
                                "no reason provided"}
                        </p>
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <div>
                        <p className="text-sm text-gray-500">
                            Application Code
                        </p>

                        <h2 className="text-xl font-semibold">
                            {consignment.consignmentCode}
                        </h2>
                    </div>

                    <Badge
                        variant={getStatusVariant(
                            applicationStatus
                        )}
                    >
                        {applicationStatus}
                    </Badge>
                </div>

                <ReviewSection title="Application Status">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        <ReviewField
                            label="Current Stage"
                            value={applicationStatus}
                        />

                        {applicationStatus !==
                            "Approved" && (
                            <ReviewField
                                label="Inspection Result"
                                value={
                                    inspectionResult ||
                                    "Not inspected"
                                }
                            />
                        )}

                        <ReviewField
                            label="Inspection Appointment"
                            value={
                                application.inspection
                                    ?.scheduledDate
                                    ? `${formatDate(
                                          application
                                              .inspection
                                              .scheduledDate
                                      )}${
                                          application
                                              .inspection
                                              .scheduledTime
                                              ? ` at ${application.inspection.scheduledTime}`
                                              : ""
                                      }`
                                    : "Not scheduled"
                            }
                        />

                        <ReviewField
                            label="Submitted"
                            value={formatDate(
                                application.submitted
                                    ?.submittedAt
                            )}
                        />

                        <ReviewField
                            label="Reviewed"
                            value={formatDate(
                                application.review
                                    ?.reviewedAt
                            )}
                        />

                        <ReviewField
                            label="Inspected"
                            value={formatDate(
                                application.inspection
                                    ?.inspectedAt
                            )}
                        />

                        <ReviewField
                            label="Decision Date"
                            value={formatDate(
                                application.approval
                                    ?.approvedAt ||
                                    application.rejection
                                        ?.rejectedAt ||
                                    application.withdrawal
                                        ?.withdrawnAt
                            )}
                        />

                        {/* The Partner Terms version agreed to on submitting. */}
                        {application.submitted?.termsDocument && (
                            <div className="md:col-span-2 lg:col-span-3">
                                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Partner Terms Accepted
                                </p>
                                <AcceptedTerms
                                    type={LEGAL_DOCUMENT_TYPES.PARTNER_TERMS}
                                    acceptance={{
                                        document:
                                            application.submitted.termsDocument,
                                        version:
                                            application.submitted.termsVersion,
                                        acceptedAt:
                                            application.submitted.submittedAt,
                                    }}
                                />
                            </div>
                        )}

                        <ReviewField
                            className="md:col-span-2 lg:col-span-3"
                            label="Submission Remarks"
                            value={
                                application.submitted
                                    ?.remarks
                            }
                        />

                        <ReviewField
                            className="md:col-span-2 lg:col-span-3"
                            label={
                                application.review
                                    ?.revisionRequested
                                    ? "Revision Requested Reason"
                                    : "Reviewer Remarks"
                            }
                            value={
                                application.review
                                    ?.remarks
                            }
                        />

                        <ReviewField
                            className="md:col-span-2 lg:col-span-3"
                            label="Inspection Remarks"
                            value={
                                application.inspection
                                    ?.remarks
                            }
                        />

                        {application.rejection
                            ?.remarks && (
                            <ReviewField
                                className="md:col-span-2 lg:col-span-3"
                                label="Rejection Reason"
                                value={
                                    application
                                        .rejection
                                        ?.remarks
                                }
                            />
                        )}

                        {application.withdrawal
                            ?.remarks && (
                            <ReviewField
                                className="md:col-span-2 lg:col-span-3"
                                label="Withdrawal Reason"
                                value={
                                    application
                                        .withdrawal
                                        ?.remarks
                                }
                            />
                        )}
                    </div>
                </ReviewSection>

                <ReviewSection title="Application Timeline">
                    {timelineEvents.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No timeline events recorded
                            yet.
                        </p>
                    ) : (
                        <ol className="space-y-4">
                            {timelineEvents.map(
                                (
                                    timelineEvent,
                                    index
                                ) => (
                                    <li
                                        key={index}
                                        className="relative border-l-2 border-gray-200 pl-4 dark:border-gray-700"
                                    >
                                        <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-blue-500" />

                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {timelineEvent.title ||
                                                timelineEvent.event}
                                        </p>

                                        <p className="text-xs text-gray-500">
                                            {formatDate(
                                                timelineEvent.createdAt,
                                                {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                }
                                            )}
                                        </p>

                                        {timelineEvent.description && (
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                                {
                                                    timelineEvent.description
                                                }
                                            </p>
                                        )}

                                        {timelineEvent.remarks && (
                                            <p className="mt-1 text-sm italic text-gray-500">
                                                “
                                                {
                                                    timelineEvent.remarks
                                                }
                                                ”
                                            </p>
                                        )}
                                    </li>
                                )
                            )}
                        </ol>
                    )}
                </ReviewSection>

                <ReviewSection title="Applicant Information">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        <ReviewField
                            label="Display Name"
                            value={
                                identity.displayName
                            }
                        />

                        <ReviewField
                            label="First Name"
                            value={
                                identity.firstName
                            }
                        />

                        <ReviewField
                            label="Middle Name"
                            value={
                                identity.middleName
                            }
                        />

                        <ReviewField
                            label="Last Name"
                            value={
                                identity.lastName
                            }
                        />

                        <ReviewField
                            label="Suffix"
                            value={
                                identity.suffix
                            }
                        />

                        <ReviewField
                            label="Nationality"
                            value={
                                identity.nationality
                            }
                        />
                    </div>
                </ReviewSection>

                {organization.name?.trim() && (
                    <ReviewSection title="Organization Information">
                        <div className="grid gap-5 md:grid-cols-2">
                            <ReviewField
                                label="Organization Name"
                                value={
                                    organization.name
                                }
                            />

                            <ReviewField
                                label="Business Permit"
                                value={
                                    organization.businessPermitNumber
                                }
                            />

                            <ReviewField
                                label="Tax Identification Number"
                                value={
                                    organization.taxIdentificationNumber
                                }
                            />

                            <ReviewField
                                label="Representative"
                                value={formatName(
                                    organization.representative
                                )}
                            />

                            <ReviewField
                                label="Representative Position"
                                value={
                                    organization
                                        .representative
                                        ?.position
                                }
                            />
                        </div>
                    </ReviewSection>
                )}

                <ReviewSection title="Contact Information">
                    <div className="grid gap-5 md:grid-cols-3">
                        <ReviewField
                            label="Phone Number"
                            value={
                                contact.phoneNumber
                            }
                        />

                        <ReviewField
                            label="Alternative Phone"
                            value={
                                contact.alternativePhoneNumber
                            }
                        />

                        <ReviewField
                            label="Email Address"
                            value={
                                contact.email
                            }
                        />
                    </div>
                </ReviewSection>

                <ReviewSection title="Address">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        <ReviewField
                            label="Province"
                            value={
                                address.province
                            }
                        />

                        <ReviewField
                            label="City"
                            value={address.city}
                        />

                        <ReviewField
                            label="Barangay"
                            value={
                                address.barangay
                            }
                        />

                        <ReviewField
                            label="Street"
                            value={
                                address.street
                            }
                        />

                        <ReviewField
                            label="Postal Code"
                            value={
                                address.postalCode
                            }
                        />

                        <ReviewField
                            label="Full Address"
                            value={formatAddress(
                                address
                            )}
                        />
                    </div>
                </ReviewSection>

                <ReviewSection title="Emergency Contacts">
                    {emergencyContacts.length ===
                    0 ? (
                        <p className="text-sm text-gray-500">
                            No emergency contacts
                            provided.
                        </p>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {emergencyContacts.map(
                                (
                                    contact,
                                    index
                                ) => (
                                    <div
                                        key={
                                            index
                                        }
                                        className="space-y-4 rounded-xl border border-gray-200 p-4"
                                    >
                                        <ReviewField
                                            label="Full Name"
                                            value={
                                                contact.fullName
                                            }
                                        />

                                        <ReviewField
                                            label="Relationship"
                                            value={
                                                contact.relationship
                                            }
                                        />

                                        <ReviewField
                                            label="Phone Number"
                                            value={
                                                contact.phoneNumber
                                            }
                                        />

                                        <ReviewField
                                            label="Alternative Phone"
                                            value={
                                                contact.alternativePhoneNumber
                                            }
                                        />

                                        <ReviewField
                                            label="Email"
                                            value={
                                                contact.email
                                            }
                                        />

                                        <ReviewField
                                            label="Address"
                                            value={
                                                contact.address
                                            }
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </ReviewSection>

                                <ReviewSection title="Vehicle Information">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        <ReviewField
                            label="Plate Number"
                            value={vehicle.plateNumber}
                        />

                        <ReviewField
                            label="Registration Number"
                            value={
                                vehicle.registrationNumber
                            }
                        />

                        <ReviewField
                            label="Brand"
                            value={vehicle.brand}
                        />

                        <ReviewField
                            label="Model"
                            value={vehicle.model}
                        />

                        <ReviewField
                            label="Variant"
                            value={vehicle.variant}
                        />

                        <ReviewField
                            label="Year"
                            value={vehicle.year}
                        />

                        <ReviewField
                            label="Vehicle Type"
                            value={vehicle.vehicleType}
                        />

                        <ReviewField
                            label="Category"
                            value={
                                vehicle.category?.name
                            }
                        />

                        <ReviewField
                            label="Ownership"
                            value={vehicle.ownership}
                        />
                    </div>
                </ReviewSection>

                <ReviewSection title="Vehicle Specifications">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        <ReviewField
                            label="Transmission"
                            value={
                                specifications.transmission
                            }
                        />

                        <ReviewField
                            label="Fuel Type"
                            value={
                                specifications.fuelType
                            }
                        />

                        <ReviewField
                            label="Engine"
                            value={
                                specifications.engine
                            }
                        />

                        <ReviewField
                            label="Seating Capacity"
                            value={
                                specifications.seatingCapacity
                            }
                        />

                        <ReviewField
                            label="Color"
                            value={
                                specifications.color
                            }
                        />
                    </div>
                </ReviewSection>

                <ReviewSection title="Pricing">
                    <div className="grid gap-5 md:grid-cols-3">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Daily Total Price
                            </p>

                            <Price
                                value={
                                    (Number(pricing.dailyRate) || 0) +
                                    (Number(pricing.reservationFee) || 0)
                                }
                                className="mt-1 text-lg font-semibold text-gray-900"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Base Daily Rate
                            </p>

                            <Price
                                value={pricing.dailyRate}
                                className="mt-1 text-lg font-semibold text-gray-900"
                            />
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Reservation Fee
                            </p>

                            <Price
                                value={
                                    pricing.reservationFee
                                }
                                className="mt-1 text-lg font-semibold text-gray-900"
                            />
                        </div>
                    </div>
                </ReviewSection>

                <ReviewSection title="Description">
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Public Description
                            </p>

                            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900">
                                {description.public ||
                                    EMPTY_VALUE}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Internal Description
                            </p>

                            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900">
                                {description.internal ||
                                    EMPTY_VALUE}
                            </p>
                        </div>
                    </div>
                </ReviewSection>

                <ReviewSection title="Vehicle Images">
                    {images.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            No vehicle images
                            available.
                        </p>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {images.map(
                                (
                                    image,
                                    index
                                ) => (
                                    <div
                                        key={
                                            image.publicId ||
                                            image.url ||
                                            index
                                        }
                                        className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <div className="aspect-video bg-gray-100">
                                            {image.url ? (
                                                <img
                                                    src={
                                                        image.url
                                                    }
                                                    alt={
                                                        image.originalName ||
                                                        `Vehicle ${index + 1}`
                                                    }
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                                                    No
                                                    Image
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 p-4">
                                            {image.isPrimary && (
                                                <Badge variant="primary">
                                                    Primary
                                                </Badge>
                                            )}

                                            <ReviewField
                                                label="Original Filename"
                                                value={
                                                    image.originalName
                                                }
                                            />
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </ReviewSection>

                <ReviewSection title="Vehicle Documents (OR/CR)">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <DocumentImageTile
                            url={documents.officialReceipt?.url}
                            alt="Official Receipt"
                            label="Official Receipt (OR)"
                        />

                        <DocumentImageTile
                            url={
                                documents.certificateOfRegistration
                                    ?.url
                            }
                            alt="Certificate of Registration"
                            label="Certificate of Registration (CR)"
                        />
                    </div>
                </ReviewSection>

                <ReviewSection title="Partner Valid ID">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    Verification Status
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {operator.validIdType ||
                                        "Type not specified"}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={
                                        operatorIdExpired
                                            ? "danger"
                                            : operator.isVerified
                                            ? "success"
                                            : "warning"
                                    }
                                >
                                    {operatorIdExpired
                                        ? "ID Expired"
                                        : operator.isVerified
                                        ? "Verified"
                                        : "Not Verified"}
                                </Badge>

                                {operator._id &&
                                    (operator.isVerified
                                        ? onUnverifyId && (
                                              <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() =>
                                                      onUnverifyId(
                                                          operator
                                                      )
                                                  }
                                              >
                                                  Unverify ID
                                              </Button>
                                          )
                                        : onVerifyId && (
                                              <Button
                                                  size="sm"
                                                  variant="success"
                                                  onClick={() =>
                                                      onVerifyId(
                                                          operator
                                                      )
                                                  }
                                              >
                                                  Verify ID
                                              </Button>
                                          ))}
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <DocumentImageTile
                                url={operator.validIdImage}
                                alt="Valid ID (front)"
                                label="Front"
                            />

                            <DocumentImageTile
                                url={operator.validIdBack}
                                alt="Valid ID (back)"
                                label="Back"
                            />
                        </div>
                    </div>
                </ReviewSection>
            </div>
        </Modal>
    );
};

export default ConsignmentReview;
