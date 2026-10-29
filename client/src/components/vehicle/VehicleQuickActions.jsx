import {
    Eye,
    Pencil,
    Trash2,
    CheckCircle,
} from "lucide-react";

import Button from "../common/Button";

import CardSection from "../cards/CardSection";

import createCardActions from "../../utils/createCardActions";

const ICONS = {
    View: Eye,
    Edit: Pencil,
    Delete: Trash2,
    Approve: CheckCircle,
};

const VehicleQuickActions = ({
    vehicle,
    showApproval = false,
    onView,
    onEdit,
    onApprove,
    onDelete,
}) => {
    const actions =
        createCardActions({
            item: vehicle,
            onView,
            onEdit,
            onApprove,
            onDelete,
            showApproval,
            approved:
                vehicle.isApproved,
        });

    return (
        <CardSection
            title="Quick Actions"
            subtitle="Available actions for this vehicle."
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {actions.map(
                    (action) => {
                        const Icon =
                            ICONS[
                                action.label
                            ];

                        return (
                            <Button
                                key={
                                    action.label
                                }
                                type="button"
                                variant={
                                    action.variant ??
                                    "outline"
                                }
                                onClick={
                                    action.onClick
                                }
                                className="justify-start gap-2"
                            >
                                {Icon && (
                                    <Icon
                                        size={
                                            18
                                        }
                                    />
                                )}

                                {
                                    action.label
                                }
                            </Button>
                        );
                    }
                )}
            </div>
        </CardSection>
    );
};

export default VehicleQuickActions;