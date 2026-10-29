import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ImagePlus,
    MessageSquareQuote,
    Pencil,
    Plus,
    Search,
    Star,
    Trash2,
    X,
} from "lucide-react";

import Avatar from "../../../components/common/Avatar";
import Button from "../../../components/common/Button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import Input from "../../../components/common/Input";
import Modal from "../../../components/common/Modal";
import Switch from "../../../components/common/Switch";
import Textarea from "../../../components/common/Textarea";

import {
    createTestimonial,
    createTestimonialFromReview,
    deleteTestimonial,
    getAllTestimonials,
    updateTestimonial,
    uploadTestimonialImage,
} from "../../../api/testimonialApi";
import { getAllReviews } from "../../../api/reviewApi";

import useToast from "../../../hooks/toast/useToast";

const errorMessage = (error, fallback) =>
    error?.response?.data?.errors?.[0]?.msg ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

const EMPTY_FORM = {
    name: "",
    role: "Customer",
    message: "",
    rating: 5,
    avatar: "",
    photo: "",
};

/* -------------------------------------------------------------------------- */

const TestimonialSettings = () => {
    const toast = useToast();

    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await getAllTestimonials();
            setTestimonials(response?.data ?? []);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to load testimonials."));
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void load();
    }, [load]);

    const usedReviewIds = useMemo(
        () =>
            new Set(
                testimonials
                    .map((item) => item.review)
                    .filter(Boolean)
                    .map(String)
            ),
        [testimonials]
    );

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (testimonial) => {
        setEditing(testimonial);
        setFormOpen(true);
    };

    const handleSaved = (saved) => {
        setTestimonials((prev) => {
            const exists = prev.some((item) => item._id === saved._id);

            return exists
                ? prev.map((item) =>
                      item._id === saved._id ? saved : item
                  )
                : [saved, ...prev];
        });
    };

    const handleToggleActive = async (testimonial) => {
        const next = !testimonial.isActive;

        handleSaved({ ...testimonial, isActive: next });

        try {
            const response = await updateTestimonial(testimonial._id, {
                isActive: next,
            });
            handleSaved(response.data);
        } catch (error) {
            handleSaved(testimonial);
            toast.error(errorMessage(error, "Unable to update testimonial."));
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;

        setDeleteLoading(true);

        try {
            await deleteTestimonial(deleting._id);
            setTestimonials((prev) =>
                prev.filter((item) => item._id !== deleting._id)
            );
            toast.success("Testimonial removed.");
            setDeleting(null);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to remove testimonial."));
        } finally {
            setDeleteLoading(false);
        }
    };

    const activeCount = testimonials.filter((item) => item.isActive).length;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
                            <MessageSquareQuote size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Homepage Testimonials
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {activeCount} of {testimonials.length} shown
                                on the homepage. Add your own or feature a
                                customer&apos;s booking review.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPickerOpen(true)}
                            leftIcon={<Star size={15} />}
                        >
                            Use a customer review
                        </Button>

                        <Button
                            onClick={openCreate}
                            leftIcon={<Plus size={15} />}
                        >
                            Add testimonial
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                </div>
            ) : testimonials.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                    <MessageSquareQuote
                        size={28}
                        className="mx-auto text-gray-400"
                    />
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                        No testimonials yet
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        The homepage testimonials section stays hidden
                        until at least one testimonial is shown.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {testimonials.map((testimonial) => (
                        <TestimonialAdminCard
                            key={testimonial._id}
                            testimonial={testimonial}
                            onEdit={() => openEdit(testimonial)}
                            onDelete={() => setDeleting(testimonial)}
                            onToggle={() => handleToggleActive(testimonial)}
                        />
                    ))}
                </div>
            )}

            <TestimonialFormModal
                open={formOpen}
                testimonial={editing}
                onClose={() => setFormOpen(false)}
                onSaved={(saved) => {
                    handleSaved(saved);
                    setFormOpen(false);
                }}
            />

            <ReviewPickerModal
                open={pickerOpen}
                usedReviewIds={usedReviewIds}
                onClose={() => setPickerOpen(false)}
                onAdded={handleSaved}
            />

            <ConfirmDialog
                isOpen={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                onConfirm={handleDelete}
                loading={deleteLoading}
                title="Remove testimonial?"
                message={`"${deleting?.name ?? ""}" will be removed from the homepage and this list.${
                    deleting?.source === "review"
                        ? " The original customer review is not affected."
                        : ""
                }`}
                confirmText="Remove"
            />
        </div>
    );
};

/* -------------------------------------------------------------------------- */

const Stars = ({ rating = 5, size = 13 }) => (
    <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, index) => (
            <Star
                key={index}
                size={size}
                fill={index < rating ? "currentColor" : "none"}
                className={
                    index < rating
                        ? "text-yellow-500"
                        : "text-gray-300 dark:text-gray-600"
                }
            />
        ))}
    </div>
);

const TestimonialAdminCard = ({ testimonial, onEdit, onDelete, onToggle }) => (
    <div
        className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-opacity dark:bg-gray-900 ${
            testimonial.isActive
                ? "border-gray-200 dark:border-gray-800"
                : "border-dashed border-gray-300 opacity-70 dark:border-gray-700"
        }`}
    >
        {testimonial.photo && (
            <img
                src={testimonial.photo}
                alt=""
                className="h-36 w-full object-cover"
            />
        )}

        <div className="flex flex-1 flex-col p-5">
            <div className="flex items-center gap-3">
                <Avatar
                    src={testimonial.avatar}
                    name={testimonial.name}
                    size="sm"
                />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {testimonial.name}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {testimonial.role}
                    </p>
                </div>

                <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        testimonial.source === "review"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                >
                    {testimonial.source === "review" ? "Review" : "Manual"}
                </span>
            </div>

            <div className="mt-3">
                <Stars rating={testimonial.rating} />
            </div>

            <p className="mt-2 line-clamp-4 flex-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                “{testimonial.message}”
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    <Switch
                        id={`testimonial-active-${testimonial._id}`}
                        checked={Boolean(testimonial.isActive)}
                        onChange={onToggle}
                    />
                    {testimonial.isActive ? "Shown" : "Hidden"}
                </div>

                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                        aria-label="Edit testimonial"
                    >
                        <Pencil size={15} />
                    </button>

                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label="Remove testimonial"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    </div>
);

/* -------------------------------------------------------------------------- */

const ImageField = ({ label, helperText, value, onChange, round = false }) => {
    const toast = useToast();
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        setUploading(true);

        try {
            const response = await uploadTestimonialImage(file);
            onChange(response?.data?.url ?? "");
        } catch (error) {
            toast.error(errorMessage(error, "Unable to upload image."));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {label}
            </p>

            <div className="mt-2 flex items-center gap-3">
                <div
                    className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/40 ${
                        round ? "h-16 w-16 rounded-full" : "h-16 w-24 rounded-xl"
                    }`}
                >
                    {value ? (
                        <img
                            src={value}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <ImagePlus size={18} />
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading}
                        onClick={() => inputRef.current?.click()}
                    >
                        {value ? "Replace" : "Upload"}
                    </Button>

                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange("")}
                            leftIcon={<X size={14} />}
                        >
                            Remove
                        </Button>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFile}
                />
            </div>

            {helperText && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {helperText}
                </p>
            )}
        </div>
    );
};

const TestimonialFormModal = ({ open, testimonial, onClose, onSaved }) => {
    const toast = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;

        setErrors({});
        setForm(
            testimonial
                ? {
                      name: testimonial.name ?? "",
                      role: testimonial.role ?? "",
                      message: testimonial.message ?? "",
                      rating: testimonial.rating ?? 5,
                      avatar: testimonial.avatar ?? "",
                      photo: testimonial.photo ?? "",
                  }
                : EMPTY_FORM
        );
    }, [open, testimonial]);

    const setField = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (event) => {
        event?.preventDefault();

        const nextErrors = {};
        if (!form.name.trim()) nextErrors.name = "Name is required.";
        if (!form.message.trim())
            nextErrors.message = "Description is required.";

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        setSaving(true);

        try {
            const payload = {
                ...form,
                name: form.name.trim(),
                role: form.role.trim(),
                message: form.message.trim(),
            };

            const response = testimonial
                ? await updateTestimonial(testimonial._id, payload)
                : await createTestimonial(payload);

            toast.success(
                testimonial ? "Testimonial updated." : "Testimonial added."
            );
            onSaved(response.data);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to save testimonial."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title={testimonial ? "Edit testimonial" : "Add testimonial"}
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} loading={saving}>
                        {testimonial ? "Save changes" : "Add testimonial"}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        id="testimonial-name"
                        name="name"
                        label="Name"
                        required
                        value={form.name}
                        onChange={(event) =>
                            setField("name", event.target.value)
                        }
                        error={errors.name}
                        placeholder="e.g. Maria S."
                    />

                    <Input
                        id="testimonial-role"
                        name="role"
                        label="Role / label"
                        value={form.role}
                        onChange={(event) =>
                            setField("role", event.target.value)
                        }
                        placeholder="e.g. Customer, Family trip"
                    />
                </div>

                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Rating
                    </p>
                    <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setField("rating", value)}
                                className="rounded p-0.5 transition hover:scale-110"
                                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                            >
                                <Star
                                    size={22}
                                    fill={
                                        value <= form.rating
                                            ? "currentColor"
                                            : "none"
                                    }
                                    className={
                                        value <= form.rating
                                            ? "text-yellow-500"
                                            : "text-gray-300 dark:text-gray-600"
                                    }
                                />
                            </button>
                        ))}
                    </div>
                </div>

                <Textarea
                    id="testimonial-message"
                    name="message"
                    label="Description"
                    rows={4}
                    value={form.message}
                    onChange={(event) =>
                        setField("message", event.target.value)
                    }
                    error={errors.message}
                    helperText={`${form.message.length}/1000`}
                    placeholder="What did they say about their experience?"
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <ImageField
                        label="Person's image"
                        helperText="Optional — initials are shown if empty."
                        value={form.avatar}
                        onChange={(url) => setField("avatar", url)}
                        round
                    />

                    <ImageField
                        label="Extra image (optional)"
                        helperText="e.g. a photo from their trip."
                        value={form.photo}
                        onChange={(url) => setField("photo", url)}
                    />
                </div>
            </form>
        </Modal>
    );
};

/* -------------------------------------------------------------------------- */

const ReviewPickerModal = ({ open, usedReviewIds, onClose, onAdded }) => {
    const toast = useToast();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [addingId, setAddingId] = useState(null);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);

        getAllReviews()
            .then((response) => {
                if (!cancelled) setReviews(response?.data ?? []);
            })
            .catch((error) => {
                if (!cancelled)
                    toast.error(errorMessage(error, "Unable to load reviews."));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, toast]);

    const visibleReviews = useMemo(() => {
        const query = search.trim().toLowerCase();

        return reviews
            .filter((review) => review.comment?.trim())
            .filter((review) => {
                if (!query) return true;

                return [
                    review.customer?.firstName,
                    review.customer?.lastName,
                    review.comment,
                    review.vehicle?.brand,
                    review.vehicle?.model,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
            });
    }, [reviews, search]);

    const handleAdd = async (review) => {
        setAddingId(review._id);

        try {
            const response = await createTestimonialFromReview(review._id);
            onAdded(response.data);
            toast.success("Review added as a testimonial.");
        } catch (error) {
            toast.error(errorMessage(error, "Unable to add review."));
        } finally {
            setAddingId(null);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title="Use a customer review"
        >
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Uses the customer&apos;s profile image, their comment and the
                photo they uploaded (if any). You can edit it afterwards.
                Reviews without a comment aren&apos;t listed.
            </p>

            <div className="mt-4">
                <Input
                    id="review-search"
                    name="reviewSearch"
                    placeholder="Search by customer, vehicle or comment"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    leftIcon={<Search size={16} />}
                />
            </div>

            <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                    </div>
                ) : visibleReviews.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No reviews with comments found.
                    </p>
                ) : (
                    visibleReviews.map((review) => {
                        const used = usedReviewIds.has(String(review._id));
                        const customerName = [
                            review.customer?.firstName,
                            review.customer?.lastName,
                        ]
                            .filter(Boolean)
                            .join(" ");

                        return (
                            <div
                                key={review._id}
                                className="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                            >
                                <Avatar
                                    src={review.customer?.profileImage}
                                    name={customerName}
                                    size="sm"
                                />

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {customerName || "Customer"}
                                        </p>
                                        <Stars rating={review.rating} size={12} />
                                    </div>

                                    {review.vehicle && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {review.vehicle.brand}{" "}
                                            {review.vehicle.model}
                                        </p>
                                    )}

                                    <p className="mt-1.5 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
                                        “{review.comment}”
                                    </p>
                                </div>

                                {review.image && (
                                    <img
                                        src={review.image}
                                        alt=""
                                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                                    />
                                )}

                                <div className="shrink-0 self-center">
                                    <Button
                                        size="sm"
                                        variant={used ? "ghost" : "primary"}
                                        disabled={used}
                                        loading={addingId === review._id}
                                        onClick={() => handleAdd(review)}
                                    >
                                        {used ? "Added" : "Add"}
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Modal>
    );
};

export default TestimonialSettings;
