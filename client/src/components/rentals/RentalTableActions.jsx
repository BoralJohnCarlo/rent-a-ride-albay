import {
    AlertTriangle,
    BadgeDollarSign,
    CalendarCheck2,
    Car,
    CheckCircle2,
    ClipboardCheck,
    CreditCard,
    Eye,
    FilePlus2,
    RotateCcw,
    ShieldCheck,
    UserRound,
    WalletCards,
    Wrench,
} from "lucide-react";

import Button from "../common/Button";
import CardActionMenu from "../cards/CardActionMenu";

const RentalTableActions = ({
    rental,
    onView,
    onPickup,
    onReturn,
    onReassignDriver,
    onDamageIssue,
    onCharge,
    onAdjustment,
    onPayment,
    onVerifyPayment,
    onSecurityDeposit,
    onVehicleOutcome,
    onComplete,
    onWaivePenalty,
    onAdjustPenalty,
    onAddPenaltyNote,
    onRefund,
    loading = false,
}) => {
    const status = rental?.status;

    const isOngoing = status === "Ongoing";
    const isCompleted = status === "Completed";
    const hasPenalty =
        rental?.lateReturn?.lateDurationMinutes > 0;

    const menuActions = [
        {
            label: "View Details",
            icon: Eye,
            onClick: () =>
                onView?.(rental),
        },
    ];

    if (isOngoing || isCompleted) {
        menuActions.push({
            label: "Record Refund",
            icon: BadgeDollarSign,
            onClick: () =>
                onRefund?.(rental),
        });
    }

    if (isOngoing) {
        menuActions.push(
            {
                label: "Process Pickup",
                icon: CalendarCheck2,
                onClick: () =>
                    onPickup?.(rental),
            },
            {
                label: "Process Return",
                icon: RotateCcw,
                onClick: () =>
                    onReturn?.(rental),
            },
            {
                label: "Reassign Driver",
                icon: UserRound,
                onClick: () =>
                    onReassignDriver?.(
                        rental
                    ),
            },
            {
                label: "Add Damage Issue",
                icon: Wrench,
                onClick: () =>
                    onDamageIssue?.(rental),
            },
            {
                label: "Add Charge",
                icon: WalletCards,
                onClick: () =>
                    onCharge?.(rental),
            },
            {
                label: "Add Adjustment",
                icon: FilePlus2,
                onClick: () =>
                    onAdjustment?.(rental),
            },
            {
                label: "Record Payment",
                icon: CreditCard,
                onClick: () =>
                    onPayment?.(rental),
            },
            {
                label: "Verify Payment",
                icon: ShieldCheck,
                onClick: () =>
                    onVerifyPayment?.(
                        rental
                    ),
            }
        );

        if (rental?.securityDeposit?.required) {
            menuActions.push({
                label: "Security Deposit",
                icon: WalletCards,
                onClick: () =>
                    onSecurityDeposit?.(
                        rental
                    ),
            });
        }

        menuActions.push(
            {
                label: "Vehicle Outcome",
                icon: Car,
                onClick: () =>
                    onVehicleOutcome?.(
                        rental
                    ),
            },
            {
                label: "Complete Rental",
                icon: CheckCircle2,
                onClick: () =>
                    onComplete?.(rental),
            }
        );
    }

    if (isCompleted) {
        menuActions.push({
            label: "View Vehicle Outcome",
            icon: ClipboardCheck,
            onClick: () =>
                onVehicleOutcome?.(
                    rental
                ),
        });
    }

    if (hasPenalty) {
        if (
            onWaivePenalty &&
            rental.lateReturn?.amount > 0
        ) {
            menuActions.push({
                label: "Waive Penalty",
                icon: AlertTriangle,
                onClick: () =>
                    onWaivePenalty({
                        rentalId: rental._id,
                    }),
                variant: "danger",
            });
        }

        if (onAdjustPenalty) {
            menuActions.push({
                label: "Adjust Penalty",
                icon: AlertTriangle,
                onClick: () =>
                    onAdjustPenalty({
                        rentalId: rental._id,
                    }),
            });
        }

        if (onAddPenaltyNote) {
            menuActions.push({
                label: "Add Penalty Note",
                icon: AlertTriangle,
                onClick: () =>
                    onAddPenaltyNote({
                        rentalId: rental._id,
                    }),
            });
        }
    }

    return (
        <div
            className="flex items-center justify-end gap-2"
            onClick={(event) =>
                event.stopPropagation()
            }
        >
            {isOngoing && (
                <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={loading}
                    onClick={() =>
                        onReturn?.(rental)
                    }
                >
                    Process Return
                </Button>
            )}

            <CardActionMenu
                actions={menuActions}
            />
        </div>
    );
};

export default RentalTableActions;
