import Input from "../common/Input";
import IdImageUploadRow from "../shared/IdImageUploadRow";

/*
 * Third piece of vehicle info collection, split into its own wizard step:
 * the plate/registration numbers plus a photo each of the Official Receipt
 * (OR) and Certificate of Registration (CR) — uploaded side by side the
 * same way a valid ID's front/back are uploaded during registration.
 */
const NewConsignmentDocumentsForm = ({
    form,
    errors,

    onNestedChange,

    imagesUploading = false,
}) => {
    const documents =
        form.snapshots.vehicle.documents || {};

    const documentImages = [
        documents.officialReceipt || null,
        documents.certificateOfRegistration ||
            null,
    ];

    const handleDocumentImagesChange = (
        next
    ) => {
        onNestedChange(
            "snapshots.vehicle.documents.officialReceipt",
            next[0] || null
        );

        onNestedChange(
            "snapshots.vehicle.documents.certificateOfRegistration",
            next[1] || null
        );
    };

    const documentError =
        errors[
            "snapshots.vehicle.documents.officialReceipt"
        ] ||
        errors[
            "snapshots.vehicle.documents.certificateOfRegistration"
        ];

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Plate & Registration
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Official identifiers for the vehicle being
                        submitted for consignment.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Input
                        label="Plate Number"
                        value={
                            form.snapshots.vehicle
                                .plateNumber
                        }
                        error={
                            errors[
                                "snapshots.vehicle.plateNumber"
                            ]
                        }
                        required
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.plateNumber",
                                event.target.value
                            )
                        }
                    />

                    <div className="space-y-6">
                        <Input
                            label="Registration Number"
                            value={
                                form.snapshots.vehicle
                                    .registrationNumber
                            }
                            error={
                                errors[
                                    "snapshots.vehicle.registrationNumber"
                                ]
                            }
                            onChange={(event) =>
                                onNestedChange(
                                    "snapshots.vehicle.registrationNumber",
                                    event.target.value
                                )
                            }
                        />

                        <Input
                            label="Registration Expiration"
                            type="date"
                            value={
                                form.snapshots.vehicle
                                    .compliance
                                    ?.licenseExpiration
                                    ? String(
                                          form.snapshots
                                              .vehicle
                                              .compliance
                                              .licenseExpiration
                                      ).substring(
                                          0,
                                          10
                                      )
                                    : ""
                            }
                            error={
                                errors[
                                    "snapshots.vehicle.compliance.licenseExpiration"
                                ]
                            }
                            onChange={(event) =>
                                onNestedChange(
                                    "snapshots.vehicle.compliance.licenseExpiration",
                                    event.target.value
                                )
                            }
                        />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <IdImageUploadRow
                    title="Vehicle Documents"
                    helperText="Upload a clear photo of the Official Receipt (OR) and Certificate of Registration (CR)."
                    images={documentImages}
                    onChange={
                        handleDocumentImagesChange
                    }
                    disabled={imagesUploading}
                    frontLabel="Official Receipt (OR)"
                    backLabel="Certificate of Registration (CR)"
                    required
                />

                {documentError && (
                    <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                        {documentError}
                    </p>
                )}
            </section>
        </div>
    );
};

export default NewConsignmentDocumentsForm;
