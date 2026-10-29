/* ==========================================================================
   OWNER
   ========================================================================== */

export const OWNER_STATUS = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
    ARCHIVED: "Archived",
    DECEASED: "Deceased",
};

export const OWNER_STATUS_VALUES = Object.values(OWNER_STATUS);

export const OWNER_TYPE = {
    INDIVIDUAL: "Individual",
    ORGANIZATION: "Organization",
};

export const OWNER_TYPE_VALUES = Object.values(
    OWNER_TYPE
);

export const OWNER_RISK_LEVEL = {
    NORMAL: "Normal",
    PREFERRED_PARTNER: "Preferred Partner",
    NEEDS_ATTENTION: "Needs Attention",
    HIGH_RISK: "High Risk",
    BLACKLISTED: "Blacklisted",
};

export const SEX = {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
};

export const SEX_VALUES = Object.values(SEX);

export const CIVIL_STATUS = {
    SINGLE: "Single",
    MARRIED: "Married",
    WIDOWED: "Widowed",
    DIVORCED: "Divorced",
    SEPARATED: "Separated",
};

export const CIVIL_STATUS_VALUES = Object.values(
    CIVIL_STATUS
);

export const OWNER_SOURCE = {
    ADMIN_CREATED: "Admin Created",
    WALK_IN: "Walk-in",
    OPERATOR_REGISTRATION: "Operator Registration",
    IMPORTED: "Imported",
};

export const OWNER_SOURCE_VALUES = Object.values(
    OWNER_SOURCE
);

export const OWNER_RISK_LEVEL_VALUES = Object.values(
    OWNER_RISK_LEVEL
);

export const VERIFICATION_STATUS = {
    PENDING: "Pending",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
};

export const VERIFICATION_STATUS_VALUES = Object.values(
    VERIFICATION_STATUS
);

export const OWNERSHIP_TYPE = {
    COMPANY_OWNED: "Company-Owned",
    CONSIGNED: "Consigned",
};

export const OWNERSHIP_TYPE_VALUES = Object.values(
    OWNERSHIP_TYPE
);

/* ==========================================================================
   CONSIGNMENT
   ========================================================================== */

export const CONSIGNMENT_STATUS = {
    DRAFT: "Draft",
    PENDING: "Pending",
    UNDER_REVIEW: "Under Review",
    REVISION_REQUESTED: "Revision Requested",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
    ARCHIVED: "Archived",
};

export const CONSIGNMENT_STATUS_VALUES = Object.values(
    CONSIGNMENT_STATUS
);

export const INSPECTION_STATUS = {
    PENDING: "Pending",
    PASSED: "Passed",
    CONDITIONAL_PASS: "Conditional Pass",
    FAILED: "Failed",
};

export const INSPECTION_STATUS_VALUES = Object.values(
    INSPECTION_STATUS
);

export const WITHDRAWAL_REASON = {
    OWNER_REQUEST: "Owner Requested Withdrawal",
    CONTRACT_EXPIRED: "Contract Expired",
    VEHICLE_SOLD: "Vehicle Sold",
    OWNERSHIP_TRANSFER: "Ownership Transferred",
    BUSINESS_CLOSED: "Business Closed",
    COMPANY_DECISION: "Company Decision",
    AGREEMENT_VIOLATION: "Agreement Violation",
    FRAUD: "Fraudulent Activity",
    VEHICLE_REPOSSESSED: "Vehicle Repossessed",
    OWNER_DECEASED: "Owner Deceased",
    PERMANENT_DAMAGE: "Permanent Damage",
    DUPLICATE_RECORD: "Duplicate Record",
    MIGRATION_CLEANUP: "Migration Cleanup",
    OTHER: "Other",
};

export const WITHDRAWAL_REASON_VALUES = Object.values(
    WITHDRAWAL_REASON
);

/* ==========================================================================
   REVENUE AGREEMENT
   ========================================================================== */

export const AGREEMENT_STATUS = {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending Approval",
    APPROVED: "Approved",
    ACTIVE: "Active",
    EXPIRED: "Expired",
    TERMINATED: "Terminated",
    ARCHIVED: "Archived",
};

export const AGREEMENT_STATUS_VALUES = Object.values(
    AGREEMENT_STATUS
);

/* ==========================================================================
   DOCUMENTS
   ========================================================================== */

export const DOCUMENT_CATEGORY = {
    OWNER_DOCUMENT: "Owner Document",
    VEHICLE_DOCUMENT: "Vehicle Document",
    AGREEMENT_DOCUMENT: "Agreement Document",
    OTHER: "Other",
};

export const DOCUMENT_CATEGORY_VALUES = Object.values(
    DOCUMENT_CATEGORY
);

export const DOCUMENT_TYPE = {
    OFFICIAL_RECEIPT: "Official Receipt",
    CERTIFICATE_OF_REGISTRATION: "Certificate of Registration",
    INSURANCE: "Insurance",
    BUSINESS_PERMIT: "Business Permit",
    DRIVER_LICENSE: "Driver's License",
    NATIONAL_ID: "National ID",
    PASSPORT: "Passport",
    AUTHORIZATION_LETTER: "Authorization Letter",
    REVENUE_AGREEMENT: "Revenue Agreement",
    VEHICLE_PHOTO: "Vehicle Photo",
    OWNER_PHOTO: "Owner Photo",
    OTHER: "Other",
};

export const DOCUMENT_TYPE_VALUES = Object.values(
    DOCUMENT_TYPE
);

export const DOCUMENT_STATUS = {
    VALID: "Valid",
    EXPIRING_SOON: "Expiring Soon",
    EXPIRED: "Expired",
};

export const DOCUMENT_STATUS_VALUES = Object.values(
    DOCUMENT_STATUS
);

export const ATTACHMENT_CATEGORY = { 
    AGREEMENT: "Agreement",
    AUTHORIZATION: "Authorization",
    GOVERNMENT_ID: "Government ID",
    VEHICLE_DOCUMENT: "Vehicle Document",
    INSURANCE: "Insurance",
    PHOTO: "Photo",
    OTHER: "Other",
};

export const ATTACHMENT_CATEGORY_VALUES = Object.values(
    ATTACHMENT_CATEGORY
);

/* ==========================================================================
   OWNERSHIP
   ========================================================================== */

export const TRANSFER_REASON = {
    SALE: "Sale",
    DONATION: "Donation",
    INHERITANCE: "Inheritance",
    BUSINESS_TRANSFER: "Business Transfer",
    COMPANY_DECISION: "Company Decision",
    OTHER: "Other",
};

export const TRANSFER_REASON_VALUES = Object.values(
    TRANSFER_REASON
);

/* ==========================================================================
   EARNINGS
   ========================================================================== */

export const EARNINGS_STATUS = {
    PENDING: "Pending",
    READY_FOR_RELEASE: "Ready for Release",
    RELEASED: "Released",
    PAID: "Paid",
    CANCELLED: "Cancelled",
};

export const EARNINGS_STATUS_VALUES = Object.values(
    EARNINGS_STATUS
);

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */

export const OWNER_NOTIFICATION_TYPE = {
    VEHICLE_APPROVED: "Vehicle Approved",
    VEHICLE_REJECTED: "Vehicle Rejected",
    INSPECTION_FAILED: "Inspection Failed",
    AGREEMENT_APPROVED: "Agreement Approved",
    AGREEMENT_EXPIRED: "Agreement Expired",
    DOCUMENT_EXPIRING: "Document Expiring",
    PAYMENT_RELEASED: "Payment Released",
    OWNERSHIP_TRANSFERRED: "Ownership Transferred",
};

export const OWNER_NOTIFICATION_TYPE_VALUES = Object.values(
    OWNER_NOTIFICATION_TYPE
);

/* ==========================================================================
   TIMELINE
   ========================================================================== */

export const OWNER_TIMELINE_EVENT = {
    OWNER_CREATED: "Owner Created",
    OWNER_UPDATED: "Owner Updated",
    DOCUMENT_UPLOADED: "Document Uploaded",
    DOCUMENT_REMOVED: "Document Removed",
    VERIFICATION_APPROVED: "Verification Approved",
    VERIFICATION_REJECTED: "Verification Rejected",
    VEHICLE_ADDED: "Vehicle Added",
    VEHICLE_REMOVED: "Vehicle Removed",
    VEHICLE_APPROVED: "Vehicle Approved",
    VEHICLE_REJECTED: "Vehicle Rejected",
    CONSIGNMENT_CREATED: "Consignment Created",
    CONSIGNMENT_APPROVED: "Consignment Approved",
    CONSIGNMENT_REJECTED: "Consignment Rejected",
    CONSIGNMENT_WITHDRAWN: "Consignment Withdrawn",
    AGREEMENT_CREATED: "Agreement Created",
    AGREEMENT_UPDATED: "Agreement Updated",
    AGREEMENT_TERMINATED: "Agreement Terminated",
    OWNERSHIP_TRANSFERRED: "Ownership Transferred",
    OPERATOR_ACCOUNT_LINKED: "Operator Account Linked",
    OPERATOR_ACCOUNT_UNLINKED: "Operator Account Unlinked",
    OWNER_SUSPENDED: "Owner Suspended",
    OWNER_REACTIVATED: "Owner Reactivated",
    OWNER_ARCHIVED: "Owner Archived",
    PAYMENT_RELEASED: "Payment Released",
};

export const OWNER_TIMELINE_EVENT_VALUES = Object.values(
    OWNER_TIMELINE_EVENT
);

/* ==========================================================================
   AUDIT
   ========================================================================== */

export const AUDIT_ACTION = {
    CREATE: "Create",
    UPDATE: "Update",
    DELETE: "Delete",
    ARCHIVE: "Archive",
    RESTORE: "Restore",
    APPROVE: "Approve",
    REJECT: "Reject",
    SUSPEND: "Suspend",
    REACTIVATE: "Reactivate",
    LINK_OPERATOR: "Link Operator",
    UNLINK_OPERATOR: "Unlink Operator",
    TRANSFER_OWNERSHIP: "Transfer Ownership",
    UPLOAD_DOCUMENT: "Upload Document",
    DELETE_DOCUMENT: "Delete Document",
};

export const AUDIT_ACTION_VALUES = Object.values(
    AUDIT_ACTION
);

/* ==========================================================================
   BUSINESS CODES
   ========================================================================== */

export const BUSINESS_CODE_PREFIX = {
    OWNER: "OWN",
    CONSIGNMENT: "CON",
    AGREEMENT: "AGR",
};

/* ==========================================================================
   SYSTEM LIMITS
   ========================================================================== */

export const SYSTEM_LIMITS = {
    MAX_OWNER_DOCUMENTS: 20,
    MAX_AGREEMENT_ATTACHMENTS: 20,
    MAX_VEHICLE_PHOTOS: 20,
};

export const OWNER_DOCUMENT_TYPE = {
    PROFILE_PHOTO: "Profile Photo",
    GOVERNMENT_ID: "Government ID",
    BUSINESS_PERMIT: "Business Permit",
    TAX_IDENTIFICATION: "Tax Identification",
    AUTHORIZATION_LETTER: "Authorization Letter",
    PROOF_OF_ADDRESS: "Proof of Address",
    OTHER: "Other",
};

export const OWNER_DOCUMENT_TYPE_VALUES = Object.values(
    OWNER_DOCUMENT_TYPE
);