import mongoose from "mongoose";

import {
    CONSIGNMENT_STATUS,
    CONSIGNMENT_STATUS_VALUES,
    INSPECTION_STATUS,
    INSPECTION_STATUS_VALUES,
    OWNERSHIP_TYPE_VALUES,
    VERIFICATION_STATUS,
    VERIFICATION_STATUS_VALUES,
    SEX_VALUES,
    CIVIL_STATUS_VALUES,
} from "../constants/consignmentConstants.js";

import {
    VEHICLE_TYPE_VALUES,
} from "../constants/vehicleConstants.js";

const { Schema } = mongoose;

/* -------------------------------------------------------------------------- */
/*                           Applicant Snapshot Schemas                       */
/* -------------------------------------------------------------------------- */

const identitySchema = new Schema(
    {
        displayName: {
            type: String,
            required: true,
            trim: true,
        },

        firstName: {
            type: String,
            default: "",
            trim: true,
        },

        middleName: {
            type: String,
            default: "",
            trim: true,
        },

        lastName: {
            type: String,
            default: "",
            trim: true,
        },

        suffix: {
            type: String,
            default: "",
            trim: true,
        },

        birthDate: {
            type: Date,
            default: null,
        },

        sex: {
            type: String,
            enum: SEX_VALUES,
            default: null,
            trim: true,
        },

        nationality: {
            type: String,
            default: "",
            trim: true,
        },

        civilStatus: {
            type: String,
            enum: CIVIL_STATUS_VALUES,
            default: null,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const representativeSchema = new Schema(
    {
        firstName: {
            type: String,
            default: "",
            trim: true,
        },

        middleName: {
            type: String,
            default: "",
            trim: true,
        },

        lastName: {
            type: String,
            default: "",
            trim: true,
        },

        suffix: {
            type: String,
            default: "",
            trim: true,
        },

        position: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const organizationSchema = new Schema(
    {
        name: {
            type: String,
            default: "",
            trim: true,
        },

        representative: {
            type: representativeSchema,
            default: () => ({}),
        },

        businessPermitNumber: {
            type: String,
            default: "",
            trim: true,
        },

        taxIdentificationNumber: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const contactSchema = new Schema(
    {
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },

        alternativePhoneNumber: {
            type: String,
            default: "",
            trim: true,
        },

        email: {
            type: String,
            default: "",
            lowercase: true,
            trim: true,
        },

        profileImage: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const addressSchema = new Schema(
    {
        province: {
            type: String,
            required: true,
            trim: true,
        },

        city: {
            type: String,
            required: true,
            trim: true,
        },

        barangay: {
            type: String,
            required: true,
            trim: true,
        },

        street: {
            type: String,
            default: "",
            trim: true,
        },

        postalCode: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const emergencyContactSchema = new Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        relationship: {
            type: String,
            required: true,
            trim: true,
        },

        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },

        alternativePhoneNumber: {
            type: String,
            default: "",
            trim: true,
        },

        email: {
            type: String,
            default: "",
            lowercase: true,
            trim: true,
        },

        address: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const verificationSchema = new Schema(
    {
        status: {
            type: String,
            enum: VERIFICATION_STATUS_VALUES,
            default: VERIFICATION_STATUS.PENDING,
            trim: true,
        },

        documentsVerified: {
            type: Boolean,
            default: false,
        },

        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        lastVerifiedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        expiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                            Vehicle Snapshot Schema                         */
/* -------------------------------------------------------------------------- */

const vehicleSnapshotSchema = new Schema(
    {
        plateNumber: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },

        registrationNumber: {
            type: String,
            default: "",
            uppercase: true,
            trim: true,
        },

        brand: {
            type: String,
            required: true,
            trim: true,
        },

        model: {
            type: String,
            required: true,
            trim: true,
        },

        variant: {
            type: String,
            default: "",
            trim: true,
        },

        year: {
            type: Number,
            required: true,
            min: 1900,
            max: new Date().getFullYear() + 1,
        },

        vehicleType: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: true,
            trim: true,
        },

        category: {
            type: Schema.Types.ObjectId,
            ref: "VehicleCategory",
            default: null,
        },

        specifications: {
            transmission: {
                type: String,
                required: true,
                trim: true,
            },

            fuelType: {
                type: String,
                required: true,
                trim: true,
            },

            engine: {
                type: String,
                default: "",
                trim: true,
            },

            seatingCapacity: {
                type: Number,
                required: true,
                min: 1,
            },

            /*
             * Never made it onto the real Vehicle schema (see
             * server/models/Vehicle.js) — kept here, unrequired, only so
             * consignments submitted before this field was dropped from the
             * form still load and display correctly.
             */
            color: {
                type: String,
                default: "",
                trim: true,
            },
        },

        /*
         * No longer collected from the operator at submission — admin sets
         * the rental rate as part of approving the consignment (see
         * approvalValidator/approveConsignment), before the vehicle it
         * creates goes live as Available.
         */
        pricing: {
            dailyRate: {
                type: Number,
                default: null,
                min: 0,
            },

            reservationFee: {
                type: Number,
                default: null,
                min: 0,
            },
        },

        description: {
            public: {
                type: String,
                default: "",
                trim: true,
            },

            internal: {
                type: String,
                default: "",
                trim: true,
            },
        },

        compliance: {
            licenseExpiration: {
                type: Date,
                default: null,
            },

            registrationNumberVerified: {
                type: Boolean,
                default: false,
            },
        },

        /*
         * Official Receipt and Certificate of Registration — one image
         * each, collected on the wizard's Documents step alongside the
         * plate/registration numbers.
         */
        documents: {
            officialReceipt: {
                url: {
                    type: String,
                    default: "",
                    trim: true,
                },

                publicId: {
                    type: String,
                    default: "",
                    trim: true,
                },

                originalName: {
                    type: String,
                    default: "",
                    trim: true,
                },
            },

            certificateOfRegistration: {
                url: {
                    type: String,
                    default: "",
                    trim: true,
                },

                publicId: {
                    type: String,
                    default: "",
                    trim: true,
                },

                originalName: {
                    type: String,
                    default: "",
                    trim: true,
                },
            },
        },

        ownership: {
            type: String,
            enum: OWNERSHIP_TYPE_VALUES,
            required: true,
            trim: true,
        },

        images: {
            type: [
                {
                    url: {
                        type: String,
                        required: true,
                        trim: true,
                    },

                    publicId: {
                        type: String,
                        required: true,
                        trim: true,
                    },

                    originalName: {
                        type: String,
                        default: "",
                        trim: true,
                    },

                    isPrimary: {
                        type: Boolean,
                        default: false,
                    },
                },
            ],

            default: [],

            validate: {
                validator(images) {
                    return Array.isArray(images) && images.length <= 10;
                },
                message: "A vehicle can only have up to 10 images.",
            },
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                           Application Lifecycle Schemas                    */
/* -------------------------------------------------------------------------- */

const submissionSchema = new Schema(
    {
        submittedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        submittedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        /*
         * Recorded on a best-effort basis when the operator submits through
         * the New Consignment wizard's Terms & Agreement step. Other
         * submission paths (e.g. an admin submitting on an operator's
         * behalf) don't collect this, so it's optional rather than
         * required — absence here doesn't block submission.
         */
        termsAgreed: {
            type: Boolean,
            default: false,
        },

        // Which Partner/Consignment Terms version was agreed to (Settings →
        // Terms & Policies); null when termsAgreed wasn't collected.
        termsDocument: {
            type: Schema.Types.ObjectId,
            ref: "LegalDocument",
            default: null,
        },

        termsVersion: {
            type: Number,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const reviewSchema = new Schema(
    {
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        revisionRequested: {
            type: Boolean,
            default: false,
        },
    },
    {
        _id: false,
    }
);

const inspectionSchema = new Schema(
    {
        status: {
            type: String,
            enum: INSPECTION_STATUS_VALUES,
            default: INSPECTION_STATUS.PENDING,
            trim: true,
        },

        // The physical inspection appointment the operator booked against the
        // admin-managed InspectionSetting slots (YYYY-MM-DD + "HH:mm").
        scheduledDate: {
            type: String,
            default: "",
            trim: true,
        },

        scheduledTime: {
            type: String,
            default: "",
            trim: true,
        },

        scheduledAt: {
            type: Date,
            default: null,
        },

        inspectedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        inspectedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const approvalSchema = new Schema(
    {
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        approvedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        /*
         * Recorded only when the approving admin gave this vehicle its own
         * individually-negotiated rate — an audit trail of that decision,
         * mirroring what's set on the generated Vehicle itself. Null means
         * this vehicle uses the platform's default rate instead.
         */
        commission: {
            mode: {
                type: String,
                enum: ["PERCENTAGE", "FIXED"],
                default: null,
            },

            value: {
                type: Number,
                default: null,
                min: 0,
            },
        },
    },
    {
        _id: false,
    }
);

const rejectionSchema = new Schema(
    {
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        rejectedAt: {
            type: Date,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const withdrawalSchema = new Schema(
    {
        withdrawnBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        withdrawnAt: {
            type: Date,
            default: null,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const rescheduleSchema = new Schema(
    {
        status: {
            type: String,
            enum: ["None", "Pending", "Approved", "Rejected"],
            default: "None",
            trim: true,
        },

        requestedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        requestedAt: {
            type: Date,
            default: null,
        },

        proposedDate: {
            type: Date,
            default: null,
        },

        proposedTime: {
            type: String,
            default: "",
            trim: true,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        reviewRemarks: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const applicationSchema = new Schema(
    {
        status: {
            type: String,
            enum: CONSIGNMENT_STATUS_VALUES,
            default: CONSIGNMENT_STATUS.DRAFT,
            trim: true,
        },

        submitted: {
            type: submissionSchema,
            default: () => ({}),
        },

        review: {
            type: reviewSchema,
            default: () => ({}),
        },

        inspection: {
            type: inspectionSchema,
            default: () => ({}),
        },

        approval: {
            type: approvalSchema,
            default: () => ({}),
        },

        rejection: {
            type: rejectionSchema,
            default: () => ({}),
        },

        withdrawal: {
            type: withdrawalSchema,
            default: () => ({}),
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                          Applicant Snapshot Schema                         */
/* -------------------------------------------------------------------------- */

const applicantSnapshotSchema = new Schema(
    {
        identity: {
            type: identitySchema,
            required: true,
        },

        organization: {
            type: organizationSchema,
            default: () => ({}),
        },

        contact: {
            type: contactSchema,
            required: true,
        },

        address: {
            type: addressSchema,
            required: true,
        },

        emergencyContacts: {
            type: [emergencyContactSchema],
            default: [],
            validate: {
                validator(contacts) {
                    return (
                        Array.isArray(contacts) &&
                        contacts.length <= 5
                    );
                },
                message:
                    "An applicant can only have up to 5 emergency contacts.",
            },
        },

        verification: {
            type: verificationSchema,
            default: () => ({}),
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                             Timeline Schemas                               */
/* -------------------------------------------------------------------------- */

const timelineEventSchema = new Schema(
    {
        event: {
            type: String,
            required: true,
            trim: true,
        },

        title: {
            type: String,
            default: "",
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        performedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

const timelineSchema = new Schema(
    {
        events: {
            type: [timelineEventSchema],
            default: [],
            validate: {
                validator(events) {
                    return (
                        Array.isArray(events) &&
                        events.length <= 500
                    );
                },
                message:
                    "A consignment can only contain up to 500 timeline events.",
            },
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                         Generated Entities Schema                          */
/* -------------------------------------------------------------------------- */

const generatedEntitiesSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        vehicle: {
            type: Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        agreement: {
            type: Schema.Types.ObjectId,
            ref: "Agreement",
            default: null,
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                             Archive Schema                                 */
/* -------------------------------------------------------------------------- */

const archiveSchema = new Schema(
    {
        isArchived: {
            type: Boolean,
            default: false,
        },

        archivedAt: {
            type: Date,
            default: null,
        },

        archivedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        archiveReason: {
            type: String,
            default: "",
            trim: true,
        },

        previousStatus: {
            type: String,
            enum: CONSIGNMENT_STATUS_VALUES,
            default: null,
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                               Audit Schema                                 */
/* -------------------------------------------------------------------------- */

const auditSchema = new Schema(
    {
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedAt: {
            type: Date,
            default: null,
        },
    },
    {
        _id: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                           Consignment Schema                               */
/* -------------------------------------------------------------------------- */

const consignmentSchema = new Schema(
    {
        consignmentCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        snapshots: {
            applicant: {
                type: applicantSnapshotSchema,
                required: true,
            },

            vehicle: {
                type: vehicleSnapshotSchema,
                required: true,
            },
        },

        application: {
            type: applicationSchema,
            default: () => ({}),
        },

        generatedEntities: {
            type: generatedEntitiesSchema,
            default: () => ({}),
        },

        timeline: {
            type: timelineSchema,
            default: () => ({}),
        },

        archive: {
            type: archiveSchema,
            default: () => ({}),
        },

        audit: {
            type: auditSchema,
            default: () => ({}),
        },

        // Operator-initiated request to move a scheduled physical inspection.
        // Lives at the document root (not under `application`) because every
        // consumer — services and client alike — reads `consignment.reschedule`.
        reschedule: {
            type: rescheduleSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                   */
/* -------------------------------------------------------------------------- */

consignmentSchema.index({
    "application.status": 1,
});

consignmentSchema.index({
    "application.inspection.status": 1,
});

consignmentSchema.index({
    "snapshots.applicant.identity.displayName": 1,
});

consignmentSchema.index({
    "snapshots.vehicle.plateNumber": 1,
});

consignmentSchema.index({
    "generatedEntities.vehicle": 1,
});

consignmentSchema.index({
    "application.inspection.scheduledDate": 1,
});

consignmentSchema.index({
    createdAt: -1,
});

/* -------------------------------------------------------------------------- */
/*                               Model Export                                 */
/* -------------------------------------------------------------------------- */

const Consignment = mongoose.model(
    "Consignment",
    consignmentSchema
);

export default Consignment;