/*
 * Whether the valid ID on file has passed its expiry date. No date on file
 * (an ID without one, or not recorded yet) never counts as expired.
 */
export const isValidIdExpired = (user) =>
    Boolean(user.validIdExpirationDate) &&
    new Date(user.validIdExpirationDate) < new Date();

/*
 * A user's ID can be verified by an admin, but that verification shouldn't
 * keep showing once their valid ID or license has lapsed - the "Verified"
 * badge is meant to mean "safe to trust right now", not just "was checked
 * once". This is a computed, read-only view of isVerified, not a stored
 * value: the admin's decision stays in the DB, and the user is shown as
 * unverified from the moment the document expires (no wait for a cron
 * sweep). A renewed license brings the badge back on its own; a renewed
 * valid ID is a new image, so uploading one clears isVerified for an admin
 * to review it (uploadRenewedValidId). No date on file at all is not treated
 * as "expired" here, matching the same profile-completeness carve-out used
 * everywhere else license data is checked in this app (e.g. the booking
 * drivability gate) - missing data isn't the same as invalid data.
 */
export const isUserEffectivelyVerified = (user) => {
    if (!user.isVerified) {
        return false;
    }

    if (isValidIdExpired(user)) {
        return false;
    }

    if (!user.licenseExpirationDate) {
        return true;
    }

    return (
        new Date(user.licenseExpirationDate) >= new Date()
    );
};

const formatUser = (user) => ({
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    alternativeContact: user.alternativeContact,
    profileImage: user.profileImage,
    role: user.role,
    isVerified: isUserEffectivelyVerified(user),
    // The raw admin decision, before the expiry checks above are applied -
    // lets the UI tell "never verified" apart from "was verified, but the
    // badge is on hold until the expired document is renewed".
    verifiedByAdmin: Boolean(user.isVerified),
    validIdExpired: isValidIdExpired(user),
    isApproved: user.isApproved,
    isSuspended: user.isSuspended,
    lastLogin: user.lastLogin,
    address: user.address,
    emergencyContact: user.emergencyContact,
    uploadedDocuments: user.uploadedDocuments,
    middleName: user.middleName,
    birthdate: user.birthdate,
    validIdType: user.validIdType,
    validIdImage: user.validIdImage,
    validIdBack: user.validIdBack,
    proofOfBillingImage: user.proofOfBillingImage,
    licenseNumber: user.licenseNumber,
    licenseExpirationDate: user.licenseExpirationDate,
    hasDriversLicense: user.hasDriversLicense,
    licenseCodes: user.licenseCodes,
    motorcycleTransmission: user.motorcycleTransmission,
    carTransmission: user.carTransmission,
    validIdRenewalCount: user.validIdRenewalCount,
    lastValidIdRenewalAt: user.lastValidIdRenewalAt,
    validIdExpirationDate: user.validIdExpirationDate,
    passwordChangedAt: user.passwordChangedAt ?? null,
    // The Terms & Conditions version accepted at registration (null for
    // accounts from before versions were recorded).
    termsAcceptance: user.termsDocument
        ? {
              document: user.termsDocument,
              version: user.termsVersion ?? null,
              acceptedAt: user.termsAcceptedAt ?? null,
          }
        : null,
    notificationPreferences: {
        soundVolume: user.notificationPreferences?.soundVolume ?? 50,
        soundMuted: Boolean(user.notificationPreferences?.soundMuted),
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

export default formatUser;