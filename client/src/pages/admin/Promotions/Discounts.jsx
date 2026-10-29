import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { motion } from "framer-motion";
import {
    Calendar,
    Car,
    Edit,
    Eye,
    Globe,
    Percent,
    Plus,
    Trash2,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Textarea from "../../../components/common/Textarea";
import Switch from "../../../components/common/Switch";
import Modal from "../../../components/common/Modal";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import PillSearch from "../../../components/common/PillSearch";
import CardActionMenu from "../../../components/cards/CardActionMenu";
import DiscountBadge from "../../../components/vehicle/DiscountBadge";

import useToast from "../../../hooks/toast/useToast";

import {
    getDiscounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
} from "../../../api/discountApi";
import { getVehicles } from "../../../api/vehicleApi";

import {
    DISCOUNT_SCOPE,
    DISCOUNT_SCOPE_LABELS,
    DISCOUNT_METHOD,
    DISCOUNT_METHOD_LABELS,
    DISCOUNT_STATUS,
    DISCOUNT_STATUS_LABELS,
    DISCOUNT_LABEL_MAX_LENGTH,
} from "../../../constants/discountConstants";

import { CARD_LAYOUT_TRANSITION } from "../../../constants/motionConstants";

const toOptions = (labels) =>
    Object.entries(labels).map(([value, label]) => ({ value, label }));

const scopeOptions = toOptions(DISCOUNT_SCOPE_LABELS);
const methodOptions = toOptions(DISCOUNT_METHOD_LABELS);
const statusOptions = toOptions(DISCOUNT_STATUS_LABELS);

// One-click starting points for common sales (name and badge only).
const PRESETS = [
    { name: "Holiday Sale", label: "Holiday Sale" },
    { name: "Summer Sale", label: "Summer Deal" },
    { name: "Rainy Season Promo", label: "Rainy Day Deal" },
    { name: "Weekend Special", label: "Weekend Deal" },
];

const errorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

const peso = (value) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

// A discount's day in Philippine time, the same calendar the server checks.
const toManilaDateKey = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
          })
        : "";

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-PH", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "—";

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model, vehicle?.year]
        .filter(Boolean)
        .join(" ") || "Vehicle";

/* Mirrors the server's pricing: never more than the rate itself. */
const previewRate = (dailyRate, method, value) => {
    const base = Number(dailyRate) || 0;
    const amount = Number(value) || 0;
    const off =
        method === DISCOUNT_METHOD.PERCENTAGE
            ? (base * Math.min(amount, 100)) / 100
            : Math.min(amount, base);

    return Math.round((base - off) * 100) / 100;
};

/*
 * What customers see right now: an "Active" discount outside its days
 * isn't applied, so the card says Scheduled/Ended instead.
 */
const getDisplayStatus = (discount) => {
    if (discount.status !== DISCOUNT_STATUS.ACTIVE) {
        return {
            label: "Inactive",
            className:
                "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        };
    }

    if (discount.dateState === "expired") {
        return {
            label: "Ended",
            className:
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        };
    }

    if (discount.dateState === "upcoming") {
        return {
            label: "Scheduled",
            className:
                "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        };
    }

    return {
        label: "Running",
        className:
            "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
};

const getInitialState = (discount) => ({
    name: discount?.name ?? "",
    label: discount?.label ?? "",
    description: discount?.description ?? "",
    scope: discount?.scope ?? DISCOUNT_SCOPE.ALL_VEHICLES,
    vehicles:
        discount?.vehicles?.map((vehicle) =>
            String(vehicle?._id ?? vehicle)
        ) ?? [],
    discountMethod:
        discount?.discountMethod ?? DISCOUNT_METHOD.PERCENTAGE,
    discountValue: discount?.discountValue ?? "",
    startDate: toManilaDateKey(discount?.startDate),
    endDate: toManilaDateKey(discount?.endDate),
    status: discount?.status ?? DISCOUNT_STATUS.ACTIVE,
});

const DiscountForm = ({
    mode,
    discount,
    vehicles,
    loading,
    onSubmit,
    onCancel,
}) => {
    const toast = useToast();
    const isViewMode = mode === "view";

    const [formData, setFormData] = useState(() =>
        getInitialState(discount)
    );
    const [vehicleSearch, setVehicleSearch] = useState("");

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
            ...(name === "discountMethod" ? { discountValue: "" } : {}),
        }));
    };

    const toggleVehicle = (vehicleId) =>
        setFormData((previous) => ({
            ...previous,
            vehicles: previous.vehicles.includes(vehicleId)
                ? previous.vehicles.filter((id) => id !== vehicleId)
                : [...previous.vehicles, vehicleId],
        }));

    const filteredVehicles = useMemo(() => {
        const query = vehicleSearch.trim().toLowerCase();

        if (!query) {
            return vehicles;
        }

        return vehicles.filter((vehicle) =>
            [
                vehicleName(vehicle),
                vehicle.plateNumber,
                vehicle.vehicleCode,
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLowerCase().includes(query)
                )
        );
    }, [vehicles, vehicleSearch]);

    // A sample rate for the preview: the first chosen vehicle, else ₱2,000.
    const sampleVehicle =
        formData.scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES
            ? vehicles.find((vehicle) =>
                  formData.vehicles.includes(String(vehicle._id))
              )
            : null;
    const sampleRate = Number(sampleVehicle?.pricing?.dailyRate) || 2000;

    const previewDiscount =
        Number(formData.discountValue) > 0
            ? {
                  name: formData.name,
                  label: formData.label,
                  discountMethod: formData.discountMethod,
                  discountValue: Number(formData.discountValue),
                  amountOff:
                      sampleRate -
                      previewRate(
                          sampleRate,
                          formData.discountMethod,
                          formData.discountValue
                      ),
              }
            : null;

    const handleSubmit = (event) => {
        event.preventDefault();

        const value = Number(formData.discountValue);

        if (!(value > 0)) {
            toast.error("Please enter a discount value greater than 0.");
            return;
        }

        if (
            formData.discountMethod === DISCOUNT_METHOD.PERCENTAGE &&
            value > 100
        ) {
            toast.error("Percentage discount cannot exceed 100.");
            return;
        }

        if (!formData.startDate || !formData.endDate) {
            toast.error("Choose the days the discount runs.");
            return;
        }

        if (formData.endDate < formData.startDate) {
            toast.error("End date can't be before the start date.");
            return;
        }

        if (
            formData.scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES &&
            formData.vehicles.length === 0
        ) {
            toast.error("Select at least one vehicle for this discount.");
            return;
        }

        onSubmit?.({
            ...formData,
            discountValue: value,
            vehicles:
                formData.scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES
                    ? formData.vehicles
                    : [],
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {mode === "create" && (
                <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Quick start
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.name}
                                type="button"
                                onClick={() =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        ...preset,
                                    }))
                                }
                                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-rose-700 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                    <Input
                        label="Discount Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Christmas Holiday Sale 2026"
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Input
                        label="Badge Label"
                        name="label"
                        value={formData.label}
                        onChange={handleChange}
                        placeholder="Holiday Sale"
                        maxLength={DISCOUNT_LABEL_MAX_LENGTH}
                        helperText="Shown on vehicle cards. Leave empty to show just the amount off."
                        disabled={isViewMode}
                    />
                </div>

                <div className="flex flex-col justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Card preview
                    </p>

                    {previewDiscount ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <DiscountBadge discount={previewDiscount} />

                            <span className="text-sm">
                                <span className="mr-1.5 text-gray-400 line-through">
                                    {peso(sampleRate)}
                                </span>
                                <span className="font-bold text-green-700 dark:text-green-400">
                                    {peso(
                                        previewRate(
                                            sampleRate,
                                            formData.discountMethod,
                                            formData.discountValue
                                        )
                                    )}
                                </span>
                                <span className="text-xs text-gray-500">
                                    /day
                                </span>
                            </span>
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-gray-400">
                            Enter a discount to preview it.
                        </p>
                    )}
                </div>

                <div className="md:col-span-2">
                    <Textarea
                        label="Description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Internal note about this promotion…"
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Select
                        label="Discount Method"
                        name="discountMethod"
                        value={formData.discountMethod}
                        onChange={handleChange}
                        options={methodOptions}
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Input
                        label={
                            formData.discountMethod ===
                            DISCOUNT_METHOD.PERCENTAGE
                                ? "Discount (%)"
                                : "Amount Off Per Day (₱)"
                        }
                        name="discountValue"
                        type="number"
                        value={formData.discountValue}
                        onChange={handleChange}
                        placeholder={
                            formData.discountMethod ===
                            DISCOUNT_METHOD.PERCENTAGE
                                ? "15"
                                : "300"
                        }
                        min="0"
                        max={
                            formData.discountMethod ===
                            DISCOUNT_METHOD.PERCENTAGE
                                ? "100"
                                : undefined
                        }
                        step="any"
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Input
                        label="Start Date"
                        name="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Input
                        label="End Date"
                        name="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={handleChange}
                        helperText="Inclusive. Applies to bookings made on these days."
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Select
                        label="Applies To"
                        name="scope"
                        value={formData.scope}
                        onChange={handleChange}
                        options={scopeOptions}
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Select
                        label="Status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        options={statusOptions}
                        required
                        disabled={isViewMode}
                    />
                </div>

                {formData.scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES && (
                    <div className="md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Select Vehicles
                            </span>

                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formData.vehicles.length} selected
                            </span>
                        </div>

                        <Input
                            name="vehicleSearch"
                            value={vehicleSearch}
                            onChange={(event) =>
                                setVehicleSearch(event.target.value)
                            }
                            placeholder="Search by name, plate, or code…"
                            disabled={isViewMode}
                        />

                        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                            {filteredVehicles.length === 0 ? (
                                <p className="p-2 text-sm text-gray-500 dark:text-gray-400">
                                    {vehicles.length === 0
                                        ? "No vehicles available."
                                        : "No matching vehicles."}
                                </p>
                            ) : (
                                filteredVehicles.map((vehicle) => {
                                    const id = String(vehicle._id);
                                    const rate = Number(
                                        vehicle.pricing?.dailyRate
                                    );
                                    const checked =
                                        formData.vehicles.includes(id);

                                    return (
                                        <div
                                            key={id}
                                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                        >
                                            <Switch
                                                checked={checked}
                                                onChange={() =>
                                                    toggleVehicle(id)
                                                }
                                                disabled={isViewMode}
                                                aria-label={`Include ${vehicleName(vehicle)}`}
                                            />

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                    {vehicleName(vehicle)}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {vehicle.plateNumber ||
                                                        vehicle.vehicleCode}
                                                </p>
                                            </div>

                                            <div className="shrink-0 text-right text-xs">
                                                {checked &&
                                                Number(
                                                    formData.discountValue
                                                ) > 0 ? (
                                                    <>
                                                        <p className="text-gray-400 line-through">
                                                            {peso(rate)}
                                                        </p>
                                                        <p className="font-semibold text-green-700 dark:text-green-400">
                                                            {peso(
                                                                previewRate(
                                                                    rate,
                                                                    formData.discountMethod,
                                                                    formData.discountValue
                                                                )
                                                            )}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-gray-500 dark:text-gray-400">
                                                        {peso(rate)}/day
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                Applied automatically to the daily rate — customers don't
                enter a code. When several discounts cover a vehicle, the
                biggest saving wins (they don't stack). Vouchers still apply
                on top. Existing bookings keep the price they were made at.
            </p>

            {!isViewMode && (
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button type="submit" loading={loading}>
                        {mode === "create"
                            ? "Create Discount"
                            : "Save Changes"}
                    </Button>
                </div>
            )}
        </form>
    );
};

const DiscountCard = ({ discount, onView, onEdit, onDelete }) => {
    const status = getDisplayStatus(discount);
    const isGlobal = discount.scope === DISCOUNT_SCOPE.ALL_VEHICLES;
    const vehicleCount = discount.vehicles?.length ?? 0;

    return (
        <motion.article
            layout
            layoutId={`discount-${discount._id}`}
            transition={{ layout: CARD_LAYOUT_TRANSITION }}
            className="group overflow-visible rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/30">
                        <Percent
                            size={22}
                            className="text-rose-600 dark:text-rose-400"
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                                {discount.name}
                            </h3>
                            <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                            >
                                {status.label}
                            </span>
                        </div>

                        <div className="mt-1.5">
                            <DiscountBadge discount={discount} />
                        </div>
                    </div>
                </div>

                <CardActionMenu
                    actions={[
                        {
                            label: "View",
                            icon: Eye,
                            onClick: () => onView(discount),
                        },
                        {
                            label: "Edit",
                            icon: Edit,
                            onClick: () => onEdit(discount),
                        },
                        {
                            label: "Delete",
                            icon: Trash2,
                            variant: "danger",
                            onClick: () => onDelete(discount),
                        },
                    ]}
                />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs font-medium text-gray-400">
                        Applies To
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        {isGlobal ? (
                            <Globe size={14} className="text-gray-400" />
                        ) : (
                            <Car size={14} className="text-gray-400" />
                        )}
                        {isGlobal
                            ? "All vehicles"
                            : `${vehicleCount} ${
                                  vehicleCount === 1 ? "vehicle" : "vehicles"
                              }`}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-gray-400">
                        Runs
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(discount.startDate)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        to {formatDate(discount.endDate)}
                    </p>
                </div>
            </div>
        </motion.article>
    );
};

const Discounts = () => {
    const toast = useToast();

    const [discounts, setDiscounts] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [dialog, setDialog] = useState({
        isOpen: false,
        mode: null,
        discount: null,
    });
    const [deleteTarget, setDeleteTarget] = useState(null);

    const loadDiscounts = useCallback(async () => {
        try {
            const response = await getDiscounts();
            setDiscounts(response?.data ?? []);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to load discounts."));
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        void loadDiscounts();

        getVehicles()
            .then((response) =>
                setVehicles(
                    (response?.data ?? []).filter(
                        (vehicle) => vehicle.status !== "Archived"
                    )
                )
            )
            .catch(() =>
                toast.error("Unable to load vehicles for discounts.")
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadDiscounts]);

    const filteredDiscounts = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return discounts;
        }

        return discounts.filter((discount) =>
            [discount.name, discount.label, discount.description]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(keyword))
        );
    }, [discounts, search]);

    const openDialog = (mode, discount = null) =>
        setDialog({ isOpen: true, mode, discount });

    const closeDialog = () => {
        if (!submitting) {
            setDialog((current) => ({ ...current, isOpen: false }));
        }
    };

    const handleSubmit = async (payload) => {
        setSubmitting(true);

        try {
            if (dialog.mode === "create") {
                await createDiscount(payload);
                toast.success("Discount created.");
            } else {
                await updateDiscount(dialog.discount._id, payload);
                toast.success("Discount updated.");
            }

            setSubmitting(false);
            setDialog((current) => ({ ...current, isOpen: false }));
            await loadDiscounts();
        } catch (error) {
            toast.error(errorMessage(error, "Unable to save the discount."));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) {
            return;
        }

        setSubmitting(true);

        try {
            await deleteDiscount(deleteTarget._id);
            toast.success("Discount deleted.");
            setSubmitting(false);
            setDeleteTarget(null);
            await loadDiscounts();
        } catch (error) {
            toast.error(errorMessage(error, "Unable to delete the discount."));
        } finally {
            setSubmitting(false);
        }
    };

    const runningCount = discounts.filter(
        (discount) =>
            discount.status === DISCOUNT_STATUS.ACTIVE &&
            discount.dateState === "current"
    ).length;

    const countLabel = loading
        ? "Loading discounts…"
        : `${discounts.length} ${
              discounts.length === 1 ? "discount" : "discounts"
          } · ${runningCount} running now`;

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                        <PillSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search discounts…"
                            label="Search discounts"
                            className="min-w-0 flex-1"
                        />

                        <Button
                            type="button"
                            size="sm"
                            onClick={() => openDialog("create")}
                            leftIcon={<Plus size={16} />}
                            className="h-11 shrink-0 whitespace-nowrap rounded-full! px-5!"
                        >
                            Create Discount
                        </Button>
                    </div>

                    <p
                        className="text-xs text-gray-500 dark:text-gray-400"
                        aria-live="polite"
                    >
                        {countLabel}
                    </p>
                </div>

                {!loading && filteredDiscounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                            {search.trim()
                                ? `No discounts match "${search.trim()}"`
                                : "No discounts yet"}
                        </p>
                        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                            {search.trim()
                                ? ""
                                : "Run a site-wide sale (holiday, summer) or discount specific vehicles."}
                        </p>
                    </div>
                ) : (
                    <motion.div
                        layout
                        transition={{ layout: CARD_LAYOUT_TRANSITION }}
                        className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {filteredDiscounts.map((discount) => (
                            <DiscountCard
                                key={discount._id}
                                discount={discount}
                                onView={(item) => openDialog("view", item)}
                                onEdit={(item) => openDialog("edit", item)}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </motion.div>
                )}
            </div>

            <Modal
                isOpen={dialog.isOpen}
                onClose={closeDialog}
                title={
                    dialog.mode === "create"
                        ? "Create Discount"
                        : dialog.mode === "edit"
                          ? "Edit Discount"
                          : "Discount Details"
                }
                size="xl"
                closeOnOverlayClick={!submitting}
                closeOnEscape={!submitting}
            >
                {dialog.isOpen && (
                    <DiscountForm
                        key={`${dialog.mode}-${dialog.discount?._id ?? "new"}`}
                        mode={dialog.mode}
                        discount={dialog.discount}
                        vehicles={vehicles}
                        loading={submitting}
                        onSubmit={handleSubmit}
                        onCancel={closeDialog}
                    />
                )}
            </Modal>

            <ConfirmDialog
                isOpen={Boolean(deleteTarget)}
                onClose={() => !submitting && setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Discount"
                message={`Delete "${deleteTarget?.name}"? Bookings already made with it keep their price.`}
                confirmText="Delete"
                confirmVariant="danger"
                loading={submitting}
            />
        </>
    );
};

export default Discounts;
