import Textarea from "../common/Textarea";
import ImageUploadZone from "../shared/ImageUploadZone";

/*
 * Second step of the New Consignment wizard — the vehicle's public
 * description and photos, reviewed by admin before being shown to
 * customers. Split out from NewConsignmentForm.jsx so it can be its own
 * wizard step, ahead of the inspection appointment step.
 */
const NewConsignmentMediaForm = ({
    form,
    errors,

    onNestedChange,

    onImagesChange,
    imagesUploading = false,
}) => {
    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Description
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Reviewed by the administrator and shown to customers
                        once approved.
                    </p>
                </div>

                <Textarea
                    label="Public Description (optional)"
                    rows={5}
                    value={form.snapshots.vehicle.description.public}
                    error={errors["snapshots.vehicle.description.public"]}
                    helperText="If provided, this description will be reviewed before being shown to customers."
                    onChange={(event) =>
                        onNestedChange(
                            "snapshots.vehicle.description.public",
                            event.target.value
                        )
                    }
                />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Vehicle Images
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Upload clear photos of the vehicle. The first image
                        will automatically become the primary image.
                    </p>
                </div>

                <ImageUploadZone
                    images={form.snapshots.vehicle.images}
                    onChange={onImagesChange}
                    disabled={imagesUploading}
                />

                {errors["snapshots.vehicle.images"] && (
                    <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                        {errors["snapshots.vehicle.images"]}
                    </p>
                )}
            </section>
        </div>
    );
};

export default NewConsignmentMediaForm;
