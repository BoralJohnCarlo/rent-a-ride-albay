import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { MapPin } from "lucide-react";

import Input from "../common/Input";
import Select from "../common/Select";
import Switch from "../common/Switch";
import Button from "../common/Button";
import Modal from "../common/Modal";

import LocationPicker from "../maps/LocationPicker";

import { reverseGeocode } from "../../services/geocodingService";

import {
    REGIONS,
    getProvinces,
    getCities,
    getBarangays,
    getMunicipalities,
    matchGeocodedAddress,
} from "../../data/philippineLocations";

const EMPTY_FORM = {
    name: "",
    region: "",
    province: "",
    city: "",
    barangay: "",
    address: "",
    latitude: "",
    longitude: "",
    pickupFee: "",
    returnFee: "",
    isDefault: false,
    enabled: true,
};

const getInitialState = (location, isEditMode) => {
    if (!isEditMode || !location) {
        return { ...EMPTY_FORM };
    }

    return {
        name: location.name ?? "",
        region: location.region ?? "",
        province: location.province ?? "",
        city: location.city ?? "",
        barangay: location.barangay ?? "",
        address: location.address ?? "",
        latitude: location.latitude ?? "",
        longitude: location.longitude ?? "",
        pickupFee: location.pickupFee ?? 0,
        returnFee: location.returnFee ?? 0,
        isDefault: location.isDefault ?? false,
        enabled: location.enabled ?? true,
    };
};

const ServiceLocationForm = ({
    mode = "create",
    location = null,
    loading = false,
    errors = null,
    onSubmit,
    onCancel,
}) => {
    const isEditMode = mode === "edit";
    const isViewMode = mode === "view";

    const [formData, setFormData] = useState(
        () => getInitialState(location, isEditMode)
    );

    useEffect(() => {
        if (formData.isDefault) {
            setFormData((previous) => ({
                ...previous,
                pickupFee: 0,
                returnFee: 0,
            }));
        }
    }, [formData.isDefault]);

    const [isMapOpen, setIsMapOpen] = useState(false);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapError, setMapError] = useState(null);
    const mapLoadingRef = useRef(false);

    const validationErrors = useMemo(() => {
        if (!errors) {
            return {};
        }

        if (typeof errors === "string") {
            return {};
        }

        if (Array.isArray(errors)) {
            return errors.reduce(
                (acc, error) => {
                    if (
                        error?.path &&
                        error.msg
                    ) {
                        acc[error.path] =
                            error.msg;
                    }

                    return acc;
                },
                {}
            );
        }

        if (typeof errors === "object") {
            return {
                ...errors,
            };
        }

        return {};
    }, [errors]);

    const provinces = useMemo(
        () => getProvinces(formData.region),
        [formData.region]
    );

    const cities = useMemo(() => {
        const list =
            getCities(formData.region, formData.province);

        if (list.length > 0) {
            return list;
        }

        return getMunicipalities(
            formData.region,
            formData.province
        );
    }, [formData.region, formData.province]);

    const barangays = useMemo(
        () =>
            getBarangays(
                formData.region,
                formData.province,
                formData.city
            ),
        [
            formData.region,
            formData.province,
            formData.city,
        ]
    );

    const handleSelectChange = (field) => (
        event
    ) => {
        const value = event.target.value;

        setFormData((previous) => {
            const next = {
                ...previous,
                [field]: value,
            };

            if (field === "region") {
                next.province = "";
                next.city = "";
                next.barangay = "";
            }

            if (field === "province") {
                next.city = "";
                next.barangay = "";
            }

            if (field === "city") {
                next.barangay = "";
            }

            return next;
        });
    };

    const handleChange = (event) => {
        const { name, value, type, checked } =
            event.target;

        setFormData((previous) => ({
            ...previous,
            [name]:
                type === "checkbox" ||
                    type === "switch"
                    ? checked
                    : value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const payload = {
            name: formData.name.trim(),
            region: formData.region.trim(),
            province: formData.province.trim(),
            city: formData.city.trim(),
            barangay: formData.barangay.trim(),
            address: formData.address.trim(),
            latitude:
                formData.latitude !== ""
                    ? Number(formData.latitude)
                    : null,
            longitude:
                formData.longitude !== ""
                    ? Number(formData.longitude)
                    : null,
            pickupFee:
                formData.pickupFee !== ""
                    ? Number(formData.pickupFee)
                    : 0,
            returnFee:
                formData.returnFee !== ""
                    ? Number(formData.returnFee)
                    : 0,
            isDefault: formData.isDefault,
            enabled: formData.enabled,
        };

        onSubmit?.(payload);
    };

    const getFieldError = (fieldName) => {
        return validationErrors[fieldName] || null;
    };

    const regionOptions = useMemo(
        () =>
            REGIONS.map((region) => ({
                value: region,
                label: region,
            })),
        []
    );

    const provinceOptions = useMemo(
        () =>
            provinces.map((province) => ({
                value: province,
                label: province,
            })),
        [provinces]
    );

    const cityOptions = useMemo(
        () =>
            cities.map((city) => ({
                value: city,
                label: city,
            })),
        [cities]
    );

    const barangayOptions = useMemo(
        () =>
            barangays.map((barangay) => ({
                value: barangay,
                label: barangay,
            })),
        [barangays]
    );

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5"
        >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Input
                    label="Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    error={getFieldError("name")}
                    disabled={loading || isViewMode}
                    required
                    placeholder="e.g. Legazpi City Terminal"
                />

                <Select
                    label="Region"
                    name="region"
                    value={formData.region}
                    onChange={handleSelectChange(
                        "region"
                    )}
                    options={regionOptions}
                    error={getFieldError("region")}
                    disabled={loading || isViewMode}
                    required
                    placeholder="Select region"
                />

                <Select
                    label="Province"
                    name="province"
                    value={formData.province}
                    onChange={handleSelectChange(
                        "province"
                    )}
                    options={provinceOptions}
                    error={getFieldError("province")}
                    disabled={
                        loading ||
                        isViewMode ||
                        !formData.region
                    }
                    required
                    placeholder={
                        formData.region
                            ? "Select province"
                            : "Select region first"
                    }
                />

                <Select
                    label="City / Municipality"
                    name="city"
                    value={formData.city}
                    onChange={handleSelectChange(
                        "city"
                    )}
                    options={cityOptions}
                    error={getFieldError("city")}
                    disabled={
                        loading ||
                        isViewMode ||
                        !formData.province
                    }
                    required
                    placeholder={
                        formData.province
                            ? "Select city/municipality"
                            : "Select province first"
                    }
                />

                <Select
                    label="Barangay"
                    name="barangay"
                    value={formData.barangay}
                    onChange={handleSelectChange(
                        "barangay"
                    )}
                    options={barangayOptions}
                    error={getFieldError("barangay")}
                    disabled={
                        loading ||
                        isViewMode ||
                        !formData.city
                    }
                    helperText={
                        formData.city &&
                        barangays.length === 0
                            ? "Barangay list is not available for this location. You can enter details manually in the address field."
                            : undefined
                    }
                    placeholder={
                        formData.city
                            ? "Select barangay"
                            : "Select city first"
                    }
                />

                <Input
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    error={getFieldError("address")}
                    disabled={loading || isViewMode}
                    placeholder="Street address or landmark"
                />

                <div className="md:col-span-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setIsMapOpen(true);
                            setMapError(null);
                        }}
                        disabled={loading || isViewMode}
                        className="w-full"
                    >
                        <MapPin
                            size={16}
                            className="mr-2"
                        />

                        Pick Location on Map
                    </Button>
                </div>

                <Input
                    label="Pickup Fee"
                    name="pickupFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pickupFee}
                    onChange={handleChange}
                    error={getFieldError("pickupFee")}
                    disabled={loading || isViewMode || formData.isDefault}
                    helperText={
                        formData.isDefault
                            ? "Default locations cannot have pickup fees."
                            : undefined
                    }
                    placeholder="0.00"
                />

                <Input
                    label="Return Fee"
                    name="returnFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.returnFee}
                    onChange={handleChange}
                    error={getFieldError("returnFee")}
                    disabled={loading || isViewMode || formData.isDefault}
                    helperText={
                        formData.isDefault
                            ? "Default locations cannot have return fees."
                            : undefined
                    }
                    placeholder="0.00"
                />
            </div>

            <Modal
                isOpen={isMapOpen}
                onClose={() => {
                    if (!mapLoading) {
                        setIsMapOpen(false);
                        setMapError(null);
                    }
                }}
                title="Pick Location on Map"
                size="xl"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Click on the map to select the exact location. Region, Province, City, and Barangay dropdowns will be updated automatically.
                    </p>

                    {mapError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {mapError}
                        </p>
                    )}

                    <LocationPicker
                        latitude={
                            formData.latitude ||
                                null
                        }
                        longitude={
                            formData.longitude ||
                                null
                        }
                        onLocationChange={async (
                            coords
                        ) => {
                            if (
                                mapLoadingRef.current
                            ) {
                                return;
                            }

                            mapLoadingRef.current = true;
                            setMapLoading(true);
                            setMapError(null);

                            try {
                                const address =
                                    await reverseGeocode(
                                        coords.latitude,
                                        coords.longitude
                                    );

                                const matched =
                                    matchGeocodedAddress(
                                        address
                                    );

                                /*
                                 * A native <select> renders blank when its
                                 * value is not one of its options, so only
                                 * apply a dropdown value that actually exists
                                 * for the resolved parent selection. Whatever
                                 * cannot be mapped is preserved in the
                                 * free-text address field instead.
                                 */
                                const nextRegion =
                                    matched.region &&
                                    REGIONS.includes(
                                        matched.region
                                    )
                                        ? matched.region
                                        : "";

                                const nextProvince =
                                    nextRegion &&
                                    matched.province &&
                                    getProvinces(
                                        nextRegion
                                    ).includes(
                                        matched.province
                                    )
                                        ? matched.province
                                        : "";

                                const cityList =
                                    nextRegion &&
                                    nextProvince
                                        ? [
                                              ...getCities(
                                                  nextRegion,
                                                  nextProvince
                                              ),
                                              ...getMunicipalities(
                                                  nextRegion,
                                                  nextProvince
                                              ),
                                          ]
                                        : [];

                                const nextCity =
                                    matched.city &&
                                    cityList.includes(
                                        matched.city
                                    )
                                        ? matched.city
                                        : "";

                                const barangayList =
                                    nextCity
                                        ? getBarangays(
                                              nextRegion,
                                              nextProvince,
                                              nextCity
                                          )
                                        : [];

                                const nextBarangay =
                                    matched.barangay &&
                                    barangayList.includes(
                                        matched.barangay
                                    )
                                        ? matched.barangay
                                        : "";

                                const unmatchedParts = [
                                    !nextRegion
                                        ? matched.region
                                        : "",
                                    !nextProvince
                                        ? matched.province
                                        : "",
                                    !nextCity
                                        ? matched.city
                                        : "",
                                    !nextBarangay
                                        ? matched.barangay
                                        : "",
                                ].filter(Boolean);

                                setFormData(
                                    (previous) => {
                                        const fallbackAddress =
                                            [
                                                ...unmatchedParts,
                                                address.address,
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    ", "
                                                );

                                        return {
                                            ...previous,
                                            latitude:
                                                coords.latitude,
                                            longitude:
                                                coords.longitude,
                                            region:
                                                nextRegion ||
                                                previous.region,
                                            province:
                                                nextRegion
                                                    ? nextProvince
                                                    : previous.province,
                                            city:
                                                nextRegion &&
                                                nextProvince
                                                    ? nextCity
                                                    : previous.city,
                                            barangay:
                                                nextCity
                                                    ? nextBarangay
                                                    : previous.barangay,
                                            address:
                                                previous.address?.trim()
                                                    ? previous.address
                                                    : fallbackAddress,
                                        };
                                    }
                                );

                                if (
                                    nextRegion &&
                                    nextProvince &&
                                    nextCity
                                ) {
                                    setIsMapOpen(false);
                                } else {
                                    setMapError(
                                        "Some address fields could not be matched automatically. Please review the dropdowns and address before saving."
                                    );
                                }
                            } catch (error) {
                                setMapError(
                                    `Unable to fetch address details: ${error.message}. Please fill the address fields manually.`
                                );

                                setFormData(
                                    (previous) => ({
                                        ...previous,
                                        latitude:
                                            coords.latitude,
                                        longitude:
                                            coords.longitude,
                                    })
                                );
                            } finally {
                                mapLoadingRef.current = false;
                                setMapLoading(false);
                            }
                        }}
                        loading={mapLoading}
                        disabled={mapLoading}
                    />

                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsMapOpen(false);
                                setMapError(null);
                            }}
                            disabled={mapLoading}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            <div className="flex flex-col gap-4 border-t border-gray-200 pt-5 dark:border-gray-700">
                <Switch
                    name="isDefault"
                    label="Default Location"
                    helperText="Set this as the default pickup and return location for new bookings."
                    checked={formData.isDefault}
                    onChange={handleChange}
                    disabled={loading || isViewMode}
                />

                <Switch
                    name="enabled"
                    label="Enabled"
                    helperText="Disabled locations will not be available for customers to select."
                    checked={formData.enabled}
                    onChange={handleChange}
                    disabled={loading || isViewMode}
                />
            </div>

            {!isViewMode && (
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        loading={loading}
                    >
                        {isEditMode
                            ? "Update Location"
                            : "Create Location"}
                    </Button>
                </div>
            )}

            {isViewMode && (
                <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-gray-700">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                    >
                        Close
                    </Button>
                </div>
            )}
        </form>
    );
}

export default ServiceLocationForm;
