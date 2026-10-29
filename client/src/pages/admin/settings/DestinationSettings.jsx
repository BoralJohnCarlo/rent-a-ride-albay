import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    ArrowDown,
    ArrowUp,
    Car,
    ExternalLink,
    ImagePlus,
    MapPin,
    Motorbike,
    Pencil,
    Plus,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../../components/common/Button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import Input from "../../../components/common/Input";
import Modal from "../../../components/common/Modal";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";
import Textarea from "../../../components/common/Textarea";
import DestinationImage from "../../../components/explore/DestinationImage";

import {
    createDestination,
    deleteDestination,
    getAllDestinations,
    reorderDestinations,
    updateDestination,
    uploadDestinationImage,
} from "../../../api/destinationApi";

import {
    DESTINATION_CATEGORIES,
    HERO_WIDGET_LIMIT,
    RIDE_TYPES,
} from "../../../data/albayDestinations";

import useToast from "../../../hooks/toast/useToast";

const errorMessage = (error, fallback) =>
    error?.response?.data?.errors?.[0]?.msg ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

const CATEGORY_OPTIONS = DESTINATION_CATEGORIES.map((c) => ({
    value: c.key,
    label: c.label,
}));

const categoryLabel = (key) =>
    DESTINATION_CATEGORIES.find((c) => c.key === key)?.label ?? key;

const RIDE_ICONS = { Car, Motorcycle: Motorbike };

const EMPTY_FORM = {
    name: "",
    town: "",
    category: "nature",
    blurb: "",
    driveTime: "",
    road: "",
    bestTime: "",
    rideType: "Car",
    rideNote: "",
    image: "",
    featuredInHero: false,
    isActive: true,
};

/* -------------------------------------------------------------------------- */

const DestinationSettings = () => {
    const toast = useToast();

    const [destinations, setDestinations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const [deleting, setDeleting] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await getAllDestinations();
            setDestinations(response?.data ?? []);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to load destinations."));
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void load();
    }, [load]);

    const replaceOne = (saved) =>
        setDestinations((prev) => {
            const exists = prev.some((item) => item._id === saved._id);

            return exists
                ? prev.map((item) => (item._id === saved._id ? saved : item))
                : [...prev, saved];
        });

    /* Optimistic single-field toggle (shown / in widget). */
    const handleToggle = async (destination, field) => {
        const next = !destination[field];

        replaceOne({ ...destination, [field]: next });

        try {
            const response = await updateDestination(destination._id, {
                [field]: next,
            });
            replaceOne(response.data);
        } catch (error) {
            replaceOne(destination);
            toast.error(errorMessage(error, "Unable to update destination."));
        }
    };

    const handleMove = async (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= destinations.length) return;

        const previous = destinations;
        const reordered = [...destinations];
        [reordered[index], reordered[target]] = [
            reordered[target],
            reordered[index],
        ];

        setDestinations(reordered);

        try {
            await reorderDestinations(reordered.map((item) => item._id));
        } catch (error) {
            setDestinations(previous);
            toast.error(errorMessage(error, "Unable to save the new order."));
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;

        setDeleteLoading(true);

        try {
            await deleteDestination(deleting._id);
            setDestinations((prev) =>
                prev.filter((item) => item._id !== deleting._id)
            );
            toast.success("Destination removed.");
            setDeleting(null);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to remove destination."));
        } finally {
            setDeleteLoading(false);
        }
    };

    const shownCount = destinations.filter((d) => d.isActive).length;
    const featuredCount = destinations.filter((d) => d.featuredInHero).length;
    const widgetFull = featuredCount >= HERO_WIDGET_LIMIT;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <MapPin size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Explore Albay Destinations
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {shownCount} of {destinations.length} shown on
                                the Explore page · {featuredCount}/
                                {HERO_WIDGET_LIMIT} in the home page widget
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link to="/explore" target="_blank" rel="noreferrer">
                            <Button
                                variant="outline"
                                leftIcon={<ExternalLink size={15} />}
                            >
                                View page
                            </Button>
                        </Link>

                        <Button
                            onClick={() => {
                                setEditing(null);
                                setFormOpen(true);
                            }}
                            leftIcon={<Plus size={15} />}
                        >
                            Add destination
                        </Button>
                    </div>
                </div>

                <p className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-xs leading-5 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300">
                    <Sparkles size={13} className="mr-1 inline" />
                    Mark up to {HERO_WIDGET_LIMIT} destinations with the
                    sparkle to show them in the &quot;Albay&quot; widget on
                    the home page. If fewer are marked, the first ones in
                    this list fill the gaps. Use the arrows to reorder.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                </div>
            ) : destinations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                    <MapPin size={28} className="mx-auto text-gray-400" />
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                        No destinations yet
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        The Explore page shows a &quot;coming soon&quot;
                        message and the home page widget stays hidden until
                        at least one destination is shown.
                    </p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {destinations.map((destination, index) => (
                        <DestinationRow
                            key={destination._id}
                            destination={destination}
                            isFirst={index === 0}
                            isLast={index === destinations.length - 1}
                            widgetFull={widgetFull}
                            onMoveUp={() => handleMove(index, -1)}
                            onMoveDown={() => handleMove(index, 1)}
                            onToggleActive={() =>
                                handleToggle(destination, "isActive")
                            }
                            onToggleFeatured={() =>
                                handleToggle(destination, "featuredInHero")
                            }
                            onEdit={() => {
                                setEditing(destination);
                                setFormOpen(true);
                            }}
                            onDelete={() => setDeleting(destination)}
                        />
                    ))}
                </ul>
            )}

            <DestinationFormModal
                open={formOpen}
                destination={editing}
                widgetFull={widgetFull}
                onClose={() => setFormOpen(false)}
                onSaved={(saved) => {
                    replaceOne(saved);
                    setFormOpen(false);
                }}
            />

            <ConfirmDialog
                isOpen={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                onConfirm={handleDelete}
                loading={deleteLoading}
                title="Remove destination?"
                message={`"${deleting?.name ?? ""}" will be removed from the Explore page${
                    deleting?.featuredInHero ? " and the home page widget" : ""
                }. To keep it for later, hide it instead.`}
                confirmText="Remove"
            />
        </div>
    );
};

/* -------------------------------------------------------------------------- */

const iconButton =
    "rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white";

const DestinationRow = ({
    destination,
    isFirst,
    isLast,
    widgetFull,
    onMoveUp,
    onMoveDown,
    onToggleActive,
    onToggleFeatured,
    onEdit,
    onDelete,
}) => {
    const RideIcon = RIDE_ICONS[destination.rideType] || Car;
    const canFeature = destination.featuredInHero || !widgetFull;

    return (
        <li
            className={`flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-opacity sm:flex-row sm:items-center dark:bg-gray-900 ${
                destination.isActive
                    ? "border-gray-200 dark:border-gray-800"
                    : "border-dashed border-gray-300 opacity-70 dark:border-gray-700"
            }`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex shrink-0 flex-col">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={isFirst}
                        className={iconButton}
                        aria-label="Move up"
                    >
                        <ArrowUp size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={isLast}
                        className={iconButton}
                        aria-label="Move down"
                    >
                        <ArrowDown size={15} />
                    </button>
                </div>

                <DestinationImage
                    destination={destination}
                    iconSize={20}
                    className="h-16 w-24 shrink-0 rounded-xl"
                />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {destination.name}
                        </p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {categoryLabel(destination.category)}
                        </span>
                        {!destination.image && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                No photo
                            </span>
                        )}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {[destination.town, destination.driveTime]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <RideIcon size={13} />
                        {destination.rideType}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3 sm:justify-end sm:border-0 sm:pt-0 dark:border-gray-800">
                <button
                    type="button"
                    onClick={onToggleFeatured}
                    disabled={!canFeature}
                    title={
                        canFeature
                            ? destination.featuredInHero
                                ? "Shown in the home page widget — click to remove"
                                : "Show in the home page widget"
                            : `The widget already has ${HERO_WIDGET_LIMIT}. Remove one first.`
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        destination.featuredInHero
                            ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                >
                    <Sparkles size={13} />
                    {destination.featuredInHero ? "In widget" : "Widget"}
                </button>

                <div className="flex items-center gap-2 px-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    <Switch
                        id={`destination-active-${destination._id}`}
                        checked={Boolean(destination.isActive)}
                        onChange={onToggleActive}
                    />
                    {destination.isActive ? "Shown" : "Hidden"}
                </div>

                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        className={iconButton}
                        aria-label="Edit destination"
                    >
                        <Pencil size={15} />
                    </button>

                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label="Remove destination"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </li>
    );
};

/* -------------------------------------------------------------------------- */

const PhotoField = ({ value, category, name, onChange }) => {
    const toast = useToast();
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        setUploading(true);

        try {
            const response = await uploadDestinationImage(file);
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
                Photo
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
                <DestinationImage
                    destination={{ image: value, category, name }}
                    iconSize={22}
                    className="h-20 w-32 shrink-0 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700"
                />

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading}
                        leftIcon={<ImagePlus size={14} />}
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

            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Landscape JPG, PNG or WebP, up to 5MB. Use your own or
                licensed photos. Without one, a placeholder is shown.
            </p>
        </div>
    );
};

const DestinationFormModal = ({
    open,
    destination,
    widgetFull,
    onClose,
    onSaved,
}) => {
    const toast = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;

        setErrors({});
        setForm(
            destination
                ? Object.fromEntries(
                      Object.keys(EMPTY_FORM).map((key) => [
                          key,
                          destination[key] ?? EMPTY_FORM[key],
                      ])
                  )
                : EMPTY_FORM
        );
    }, [open, destination]);

    const setField = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const text = (field) => ({
        value: form[field],
        onChange: (event) => setField(field, event.target.value),
    });

    // Can't newly feature one when the widget is full; keeping an existing
    // featured one is always fine.
    const featureLocked =
        widgetFull && !destination?.featuredInHero && !form.featuredInHero;

    const handleSubmit = async (event) => {
        event?.preventDefault();

        const nextErrors = {};
        if (!form.name.trim()) nextErrors.name = "Name is required.";
        if (!form.blurb.trim()) nextErrors.blurb = "Description is required.";

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        setSaving(true);

        try {
            const payload = Object.fromEntries(
                Object.entries(form).map(([key, value]) => [
                    key,
                    typeof value === "string" ? value.trim() : value,
                ])
            );

            const response = destination
                ? await updateDestination(destination._id, payload)
                : await createDestination(payload);

            toast.success(
                destination ? "Destination updated." : "Destination added."
            );
            onSaved(response.data);
        } catch (error) {
            toast.error(errorMessage(error, "Unable to save destination."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title={destination ? "Edit destination" : "Add destination"}
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} loading={saving}>
                        {destination ? "Save changes" : "Add destination"}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        id="destination-name"
                        name="name"
                        label="Name"
                        required
                        maxLength={80}
                        error={errors.name}
                        placeholder="e.g. Cagsawa Ruins"
                        {...text("name")}
                    />

                    <Input
                        id="destination-town"
                        name="town"
                        label="Town / area"
                        maxLength={120}
                        placeholder="e.g. Daraga"
                        {...text("town")}
                    />

                    <Select
                        id="destination-category"
                        name="category"
                        label="Category"
                        options={CATEGORY_OPTIONS}
                        value={form.category}
                        onChange={(event) =>
                            setField("category", event.target.value)
                        }
                    />

                    <Select
                        id="destination-ride-type"
                        name="rideType"
                        label="Best ride (Find a ride filter)"
                        options={RIDE_TYPES}
                        value={form.rideType}
                        onChange={(event) =>
                            setField("rideType", event.target.value)
                        }
                    />
                </div>

                <Textarea
                    id="destination-blurb"
                    name="blurb"
                    label="Description"
                    rows={3}
                    maxLength={400}
                    error={errors.blurb}
                    helperText={`${form.blurb.length}/400`}
                    placeholder="What makes this place worth the trip?"
                    {...text("blurb")}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input
                        id="destination-drive-time"
                        name="driveTime"
                        label="Drive from Legazpi"
                        maxLength={40}
                        placeholder="e.g. 20 min"
                        {...text("driveTime")}
                    />
                    <Input
                        id="destination-road"
                        name="road"
                        label="Road"
                        maxLength={80}
                        placeholder="e.g. Paved, steep"
                        {...text("road")}
                    />
                    <Input
                        id="destination-best-time"
                        name="bestTime"
                        label="Best time"
                        maxLength={80}
                        placeholder="e.g. Sunset"
                        {...text("bestTime")}
                    />
                </div>

                <Input
                    id="destination-ride-note"
                    name="rideNote"
                    label="Ride tip"
                    maxLength={200}
                    placeholder="e.g. The narrow roads are easiest on a motorcycle."
                    {...text("rideNote")}
                />

                <PhotoField
                    value={form.image}
                    category={form.category}
                    name={form.name}
                    onChange={(url) => setField("image", url)}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            Shown on the Explore page
                        </span>
                        <Switch
                            id="destination-active"
                            checked={Boolean(form.isActive)}
                            onChange={(event) =>
                                setField("isActive", event.target.checked)
                            }
                        />
                    </label>

                    <label
                        className={`flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800 ${
                            featureLocked ? "opacity-60" : ""
                        }`}
                        title={
                            featureLocked
                                ? `The widget already has ${HERO_WIDGET_LIMIT}. Remove one first.`
                                : undefined
                        }
                    >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            In the home page widget
                        </span>
                        <Switch
                            id="destination-featured"
                            checked={Boolean(form.featuredInHero)}
                            disabled={featureLocked}
                            onChange={(event) =>
                                setField(
                                    "featuredInHero",
                                    event.target.checked
                                )
                            }
                        />
                    </label>
                </div>
            </form>
        </Modal>
    );
};

export default DestinationSettings;
