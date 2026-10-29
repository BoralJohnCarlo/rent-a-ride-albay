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

export const OWNER_SOURCE = {
    ADMIN_CREATED: "Admin Created",
    WALK_IN: "Walk-in",
    OPERATOR_REGISTRATION: "Partner Registration",
    IMPORTED: "Imported",
};

export const OWNER_SOURCE_VALUES = Object.values(
    OWNER_SOURCE
);

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

/* ==========================================================================
   OWNERSHIP
   ========================================================================== */

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

/*
|--------------------------------------------------------------------------
| Compatibility Alias
|--------------------------------------------------------------------------
|
| Existing frontend components import this name.
| Keep this until every component is migrated.
|
*/

export const CONSIGNMENT_WITHDRAW_REASONS =
    WITHDRAWAL_REASON_VALUES;

/* ==========================================================================
   BUSINESS
   ========================================================================== */

export const BUSINESS_CODE_PREFIX = {
    OWNER: "OWN",
    CONSIGNMENT: "CON",
    AGREEMENT: "AGR",
};