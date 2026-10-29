import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Plus,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Textarea from "../../../components/common/Textarea";
import Switch from "../../../components/common/Switch";
import Modal from "../../../components/common/Modal";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import PillSearch from "../../../components/common/PillSearch";
import VoucherCardGrid from "../../../components/cards/VoucherCardGrid";

import useVoucher from "../../../hooks/promotions/useVoucher";
import useUser from "../../../hooks/users/useUser";
import useToast from "../../../hooks/toast/useToast";

import {
    VOUCHER_TYPE_LABELS,
    VOUCHER_DISCOUNT_METHOD_LABELS,
    VOUCHER_STATUS_LABELS,
    VOUCHER_ASSIGNMENT_TYPE_LABELS,
    VOUCHER_TYPE,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_STATUS,
    VOUCHER_ASSIGNMENT_TYPE,
} from "../../../constants/voucherConstants";

const voucherTypeOptions = Object.entries(
    VOUCHER_TYPE_LABELS
).map(
    ([value, label]) => ({
        value,
        label,
    })
);

const discountMethodOptions = Object.entries(
    VOUCHER_DISCOUNT_METHOD_LABELS
).map(
    ([value, label]) => ({
        value,
        label,
    })
);

const statusOptions = Object.entries(
    VOUCHER_STATUS_LABELS
).map(
    ([value, label]) => ({
        value,
        label,
    })
);

const VoucherForm = ({
    mode = "create",
    voucher = null,
    loading = false,
    errors = null,
    users = [],
    onSubmit,
    onCancel,
}) => {
    const toast = useToast();

    const [formData, setFormData] =
        useState(
            () => getInitialState(voucher, mode)
        );

    const [searchQuery, setSearchQuery] =
        useState("");

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

        if (
            typeof errors ===
            "object"
        ) {
            return {
                ...errors,
            };
        }

        return {};
    }, [errors]);

    const handleInputChange = (event) => {
        const {
            name,
            value,
        } = event.target;

        setFormData((previous) => {
            const next = {
                ...previous,
                [name]: value,
            };

            if (
                name ===
                    "assignmentType" &&
                value ===
                    VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS
            ) {
                next.assignedTo = [];
            }

            if (
                name === "discountMethod"
            ) {
                next.discountValue = "";
            }

            return next;
        });
    };

    const handleUserToggle = (userId) => {
        setFormData((previous) => {
            const current =
                previous.assignedTo ||
                [];

            if (
                current.includes(
                    userId
                )
            ) {
                return {
                    ...previous,
                    assignedTo:
                        current.filter(
                            (id) =>
                                id !==
                                userId
                        ),
                };
            }

            return {
                ...previous,
                assignedTo: [
                    ...current,
                    userId,
                ],
            };
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (
            formData.startDate &&
            formData.endDate &&
            new Date(formData.endDate) <=
                new Date(formData.startDate)
        ) {
            toast.error(
                "End date must be after start date."
            );

            return;
        }

        if (
            !formData.discountValue ||
            Number(formData.discountValue) <=
                0
        ) {
            toast.error(
                "Please enter a discount value greater than 0."
            );

            return;
        }

        if (
            formData.discountMethod ===
                VOUCHER_DISCOUNT_METHOD.PERCENTAGE &&
            Number(formData.discountValue) > 100
        ) {
            toast.error(
                "Percentage discount cannot exceed 100."
            );

            return;
        }

        if (
            formData.assignmentType ===
                VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS &&
            (formData.assignedTo?.length ?? 0) === 0
        ) {
            toast.error(
                "Select at least one customer for this voucher."
            );

            return;
        }

        const parsedData = {
            ...formData,
            discountValue: Number(
                formData.discountValue
            ),
            maxUsagesPerUser:
                formData.maxUsagesPerUser !==
                    "" &&
                formData.maxUsagesPerUser !==
                    null &&
                formData.maxUsagesPerUser !==
                    undefined
                    ? Number(
                          formData.maxUsagesPerUser
                      )
                    : 1,
        };

        onSubmit?.(parsedData);
    };

    const isViewMode =
        mode === "view";

    const showUserSelector =
        formData.assignmentType ===
        VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS;

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) {
            return users;
        }

        const query = searchQuery
            .toLowerCase()
            .trim();

        return users.filter(
            (user) =>
                `${user.firstName} ${user.lastName}`
                    .toLowerCase()
                    .includes(query) ||
                user.email
                    ?.toLowerCase()
                    .includes(query)
        );
    }, [users, searchQuery]);

    const isAllSelected =
        filteredUsers.length > 0 &&
        filteredUsers.every((user) =>
            formData.assignedTo?.some(
                (id) =>
                    id.toString() ===
                    (user._id ??
                        user.id).toString()
            )
        );

    const handleSelectAll = () => {
        if (isAllSelected) {
            setFormData(
                (previous) => ({
                    ...previous,
                    assignedTo: [],
                })
            );
        } else {
            setFormData(
                (previous) => ({
                    ...previous,
                    assignedTo:
                        filteredUsers.map(
                            (user) =>
                                user._id ??
                                user.id
                        ),
                })
            );
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                    <Input
                        label="Voucher Name"
                        name="name"
                        value={
                            formData.name
                        }
                        onChange={
                            handleInputChange
                        }
                        placeholder="Summer Promotion 2024"
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.name
                        }
                    />
                </div>

                <div className="md:col-span-2">
                    <Textarea
                        label="Description"
                        name="description"
                        value={
                            formData.description
                        }
                        onChange={
                            handleInputChange
                        }
                        placeholder="Describe the offer..."
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.description
                        }
                    />
                </div>

                <div>
                    <Select
                        label="Voucher Type"
                        name="type"
                        value={
                            formData.type
                        }
                        onChange={
                            handleInputChange
                        }
                        options={
                            voucherTypeOptions
                        }
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.type
                        }
                    />
                </div>

                <div>
                    <Select
                        label="Discount Method"
                        name="discountMethod"
                        value={
                            formData.discountMethod
                        }
                        onChange={
                            handleInputChange
                        }
                        options={
                            discountMethodOptions
                        }
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.discountMethod
                        }
                    />
                </div>

                <div>
                    <Input
                        label={
                            formData.discountMethod ===
                            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
                                ? "Discount Percentage (%)"
                                : "Discount Amount (₱)"
                        }
                        name="discountValue"
                        type="number"
                        value={
                            formData.discountValue
                        }
                        onChange={
                            handleInputChange
                        }
                        placeholder={
                            formData.discountMethod ===
                            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
                                ? "10"
                                : "100"
                        }
                        required
                        min="0"
                        max={
                            formData.discountMethod ===
                            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
                                ? "100"
                                : undefined
                        }
                        step="any"
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.discountValue
                        }
                    />
                </div>

                <div>
                    <Select
                        label="Assignment Type"
                        name="assignmentType"
                        value={
                            formData.assignmentType
                        }
                        onChange={
                            handleInputChange
                        }
                        options={[
                            {
                                value:
                                    VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
                                label:
                                    VOUCHER_ASSIGNMENT_TYPE_LABELS[
                                        VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS
                                    ],
                            },
                            {
                                value:
                                    VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS,
                                label:
                                    VOUCHER_ASSIGNMENT_TYPE_LABELS[
                                        VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS
                                    ],
                            },
                        ]}
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.assignmentType
                        }
                    />
                </div>

                {showUserSelector && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Select Customers
                        </label>

                        <Input
                            name="userSearch"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder="Search by name or email..."
                            disabled={
                                isViewMode
                            }
                        />

                        <div className="mt-2 flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-t-lg px-3 py-2 bg-gray-50 dark:bg-gray-800">
                            <Switch
                                checked={
                                    isAllSelected
                                }
                                onChange={
                                    handleSelectAll
                                }
                                disabled={
                                    isViewMode ||
                                    filteredUsers.length ===
                                        0
                                }
                            />

                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {isAllSelected
                                    ? "Deselect All"
                                    : "Select All"}
                            </span>

                            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                                {formData.assignedTo
                                    ?.length ?? 0}{" "}
                                selected
                            </span>
                        </div>

                        <div className="max-h-48 overflow-y-auto border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg p-3 space-y-2">
                            {users.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No customers available.
                                </p>
                            ) : filteredUsers.length ===
                              0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No matching customers
                                    found.
                                </p>
                            ) : (
                                filteredUsers.map(
                                    (user) => (
                                        <div
                                            key={
                                                user._id ??
                                                user.id
                                            }
                                            className="flex items-center gap-3"
                                        >
                                            <Switch
                                                checked={
                                                    formData.assignedTo
                                                        ?.some(
                                                            (id) =>
                                                                id.toString() ===
                                                                (user._id ?? user.id).toString()
                                                        ) ??
                                                    false
                                                }
                                                onChange={() =>
                                                    handleUserToggle(
                                                        user._id ??
                                                            user.id
                                                    )
                                                }
                                                disabled={
                                                    isViewMode
                                                }
                                            />

                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {user.firstName}{" "}
                                                    {user.lastName}
                                                </p>

                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {
                                                        user.email
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )
                                )
                            )}
                        </div>

                        {validationErrors.assignedTo && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {
                                    validationErrors.assignedTo
                                }
                            </p>
                        )}
                    </div>
                )}

                <div>
                    <Input
                        label="Start Date"
                        name="startDate"
                        type="date"
                        value={
                            formData.startDate
                        }
                        onChange={
                            handleInputChange
                        }
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.startDate
                        }
                    />
                </div>

                <div>
                    <Input
                        label="End Date"
                        name="endDate"
                        type="date"
                        value={
                            formData.endDate
                        }
                        onChange={
                            handleInputChange
                        }
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.endDate
                        }
                    />
                </div>

                <div>
                    <Input
                        label="Max Usages Per User"
                        name="maxUsagesPerUser"
                        type="number"
                        value={
                            formData.maxUsagesPerUser
                        }
                        onChange={
                            handleInputChange
                        }
                        min="1"
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.maxUsagesPerUser
                        }
                    />
                </div>

                <div className="md:col-span-2">
                    <Select
                        label="Status"
                        name="status"
                        value={
                            formData.status
                        }
                        onChange={
                            handleInputChange
                        }
                        options={
                            statusOptions
                        }
                        required
                        disabled={
                            isViewMode
                        }
                        error={
                            validationErrors.status
                        }
                    />
                </div>
            </div>

            {!isViewMode && (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
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
                        {mode === "create"
                            ? "Create Voucher"
                            : "Save Changes"}
                    </Button>
                </div>
            )}
        </form>
    );
};

/*
 * The voucher's calendar day in Philippine time (YYYY-MM-DD), matching how
 * the server checks validity. Plain toISOString() took the UTC day, which
 * shows the day before for auto-issued vouchers created in the Manila
 * morning.
 */
const toDateInputValue = (
    dateString
) => {
    if (!dateString) {
        return "";
    }

    const date = new Date(
        dateString
    );

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(
        "en-CA",
        {
            timeZone: "Asia/Manila",
        }
    );
};

const getInitialState = (voucher, mode) => {
    if (!voucher || mode === "create") {
        return {
            name: "",
            description: "",
            type: VOUCHER_TYPE.RESERVATION_FEE,
            discountMethod:
                VOUCHER_DISCOUNT_METHOD.PERCENTAGE,
            discountValue: "",
            startDate: "",
            endDate: "",
            maxUsagesPerUser: 1,
            status: VOUCHER_STATUS.ACTIVE,
            assignmentType:
                VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
            assignedTo: [],
        };
    }

    return {
        name: voucher.name ?? "",
        description: voucher.description ?? "",
        type: voucher.type ?? VOUCHER_TYPE.RESERVATION_FEE,
        discountMethod:
            voucher.discountMethod ??
            VOUCHER_DISCOUNT_METHOD.PERCENTAGE,
        discountValue:
            voucher.discountValue ?? "",
        startDate: toDateInputValue(
            voucher.startDate
        ),
        endDate: toDateInputValue(
            voucher.endDate
        ),
        maxUsagesPerUser:
            voucher.maxUsagesPerUser ?? 1,
        status:
            voucher.status ??
            VOUCHER_STATUS.ACTIVE,
        assignmentType:
            voucher.assignmentType ??
            VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
        assignedTo:
            voucher.assignedTo
                ?.map(
                    (u) =>
                        typeof u === "string"
                            ? u
                            : u?._id ?? u?.id
                ) ?? [],
    };
};

/* Thunk rejections carry either a plain message string or { message, errors }. */
const getErrorMessage = (error, fallback) =>
    typeof error === "string"
        ? error
        : error?.message || fallback;

const Vouchers = () => {
    const toast = useToast();

    const {
        vouchers,
        loading,
        error,
        filters,
        fetchVouchers,
        addVoucher,
        editVoucher,
        removeVoucher,
        clearError,
    } = useVoucher();

    const {
        users,
        getUsers: fetchUsersList,
    } = useUser();

    /*
     * Vouchers are redeemed by customers only; the user list includes every
     * account (admins, partners), which used to show up in the picker.
     */
    const customers = useMemo(
        () =>
            (users ?? []).filter(
                (user) => user?.role === "customer"
            ),
        [users]
    );

    const [dialog, setDialog] =
        useState({
            mode: null,
            voucher: null,
            isOpen: false,
        });

    const [deleteDialog, setDeleteDialog] =
        useState({
            isOpen: false,
            voucher: null,
        });

    const [submitting, setSubmitting] =
        useState(false);

    // Field errors from the server for the open form.
    const [formErrors, setFormErrors] =
        useState(null);

    useEffect(() => {
        void fetchVouchers(filters);
    }, [fetchVouchers, filters]);

    useEffect(() => {
        fetchUsersList().catch(() => {
            toast.error(
                "Unable to load customers for voucher assignment."
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchUsersList]);

    /*
     * Only loading the list reports through the store's error; create,
     * update and delete failures are handled where they're awaited (they
     * used to be toasted twice, the second time as an object).
     */
    useEffect(() => {
        if (!error) {
            return;
        }

        if (typeof error === "string") {
            toast.error(error);
        }

        clearError();
    }, [error, toast, clearError]);

    const handleOpen = (mode, voucher = null) => {
        setFormErrors(null);

        /*
         * The form is built from the voucher that was clicked (the list
         * already carries everything it shows). It used to read the store's
         * "selected voucher", which was still the previously opened one (or
         * empty) when the form mounted, so Edit showed stale data.
         */
        setDialog({
            mode,
            voucher:
                mode === "create"
                    ? null
                    : voucher,
            isOpen: true,
        });
    };

    const handleClose = () => {
        if (!submitting) {
            setDialog((current) => ({
                ...current,
                isOpen: false,
            }));

            setFormErrors(null);
        }
    };

    const handleDeleteOpen = (voucher) => {
        setDeleteDialog({
            isOpen: true,
            voucher,
        });
    };

    const handleDeleteClose = () => {
        if (!submitting) {
            setDeleteDialog({
                isOpen: false,
                voucher: null,
            });
        }
    };

    const handleSubmit = async (payload) => {
        setSubmitting(true);
        setFormErrors(null);

        try {
            if (dialog.mode === "create") {
                const result =
                    await addVoucher(payload);

                const createdCode =
                    result?.data?.code;

                if (createdCode) {
                    // toast.success(message, title, duration) - passing an
                    // options object here crashed the page after every
                    // successful create.
                    toast.success(
                        `Code: ${createdCode}`,
                        "Voucher created",
                        8000
                    );
                } else {
                    toast.success(
                        "Voucher created successfully."
                    );
                }
            } else if (
                dialog.mode === "edit"
            ) {
                await editVoucher(
                    dialog.voucher?._id ??
                        dialog.voucher?.id,
                    payload
                );

                toast.success(
                    "Voucher updated successfully."
                );
            }

            setSubmitting(false);
            setDialog((current) => ({
                ...current,
                isOpen: false,
            }));

            await fetchVouchers(filters);
        } catch (submitError) {
            if (
                Array.isArray(submitError?.errors) &&
                submitError.errors.length > 0
            ) {
                setFormErrors(submitError.errors);
            }

            toast.error(
                getErrorMessage(
                    submitError,
                    "Unable to save the voucher."
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog.voucher) {
            return;
        }

        setSubmitting(true);

        try {
            await removeVoucher(
                deleteDialog.voucher
                    ._id ??
                    deleteDialog.voucher.id
            );

            toast.success(
                "Voucher deleted successfully."
            );

            setSubmitting(false);
            setDeleteDialog({
                isOpen: false,
                voucher: null,
            });

            await fetchVouchers(filters);
        } catch (deleteError) {
            toast.error(
                getErrorMessage(
                    deleteError,
                    "Unable to delete the voucher."
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyCode = useCallback(
        async (code) => {
            try {
                await navigator.clipboard.writeText(
                    code
                );

                toast.success(
                    `Code "${code}" copied!`
                );
            } catch {
                toast.error(
                    "Failed to copy code."
                );
            }
        },
        [toast]
    );

    const dialogVoucherId =
        dialog.voucher?._id ??
        dialog.voucher?.id ??
        "new";

    const [search, setSearch] =
        useState("");

    // Filtered in the browser: the full list is already loaded.
    const filteredVouchers = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return vouchers;
        }

        return vouchers.filter((voucher) =>
            [
                voucher.name,
                voucher.code,
                voucher.description,
                VOUCHER_TYPE_LABELS[voucher.type],
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value)
                        .toLowerCase()
                        .includes(keyword)
                )
        );
    }, [vouchers, search]);

    const isSearching = search.trim().length > 0;

    const countLabel =
        loading && vouchers.length === 0
            ? "Loading vouchers…"
            : isSearching
              ? `${filteredVouchers.length} of ${vouchers.length} ${
                    vouchers.length === 1 ? "voucher" : "vouchers"
                }`
              : `${vouchers.length} ${
                    vouchers.length === 1 ? "voucher" : "vouchers"
                }`;

    return (
        <>
            <div className="space-y-6">
                {/* Controls, centred like the other admin pages: search pill
                    with the create action beside it. The navbar already
                    names the page. */}
                <div className="flex flex-col items-center gap-2">
                    <div className="flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                        <PillSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search by name, code, or type…"
                            label="Search vouchers"
                            className="min-w-0 flex-1"
                        />

                        <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                                handleOpen(
                                    "create"
                                )
                            }
                            leftIcon={<Plus size={16} />}
                            className="h-11 shrink-0 whitespace-nowrap rounded-full! px-5!"
                        >
                            Create Voucher
                        </Button>
                    </div>

                    <p
                        className="text-xs text-gray-500 dark:text-gray-400"
                        aria-live="polite"
                    >
                        {countLabel}
                    </p>
                </div>

                {isSearching &&
                filteredVouchers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                            No vouchers match "{search.trim()}"
                        </p>

                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="mt-3 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Clear search
                        </button>
                    </div>
                ) : (
                    <VoucherCardGrid
                        vouchers={filteredVouchers}
                        onView={(voucher) =>
                            handleOpen("view", voucher)
                        }
                        onEdit={(voucher) =>
                            handleOpen("edit", voucher)
                        }
                        onDelete={handleDeleteOpen}
                        onCopyCode={handleCopyCode}
                    />
                )}
            </div>

            <Modal
                isOpen={dialog.isOpen}
                onClose={handleClose}
                title={
                    dialog.mode === "create"
                        ? "Create Voucher"
                        : dialog.mode === "edit"
                        ? "Edit Voucher"
                        : "Voucher Details"
                }
                size="xl"
                closeOnOverlayClick={
                    !submitting
                }
                closeOnEscape={
                    !submitting
                }
            >
                {dialog.isOpen && (
                    <VoucherForm
                        // Fresh form state for each voucher/mode opened.
                        key={`${dialog.mode}-${dialogVoucherId}`}
                        mode={dialog.mode}
                        voucher={dialog.voucher}
                        loading={submitting}
                        errors={formErrors}
                        users={customers}
                        onSubmit={handleSubmit}
                        onCancel={handleClose}
                    />
                )}
            </Modal>

            <ConfirmDialog
                isOpen={
                    deleteDialog.isOpen
                }
                onClose={
                    handleDeleteClose
                }
                onConfirm={handleDelete}
                title="Delete Voucher"
                message={
                    `Are you sure you want to delete "${deleteDialog.voucher?.name}" (${deleteDialog.voucher?.code})? This action cannot be undone.`
                }
                confirmText="Delete"
                confirmVariant="danger"
                loading={submitting}
            />
        </>
    );
};

export default Vouchers;
