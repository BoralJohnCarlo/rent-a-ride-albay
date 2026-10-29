import { ArrowLeft, Check } from "lucide-react";

import Button from "../common/Button";
import Modal from "../common/Modal";
import DriverProfileContent from "./DriverProfileContent";

/*
 * A driver's profile shown in place over the booking form, so checking a
 * driver never navigates the customer away from an unfinished booking.
 * Pass `onSelect` to offer "Select this driver" alongside "Back to booking".
 */
const DriverProfileModal = ({
    driverId = null,
    onClose,
    onSelect,
    isSelected = false,
}) => (
    <Modal
        open={Boolean(driverId)}
        onClose={onClose}
        title="Driver Profile"
        size="xl"
        footer={
            <>
                <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ArrowLeft size={16} />}
                    onClick={onClose}
                >
                    Back to booking
                </Button>

                {onSelect && (
                    <Button
                        variant="brand"
                        size="sm"
                        leftIcon={<Check size={16} />}
                        disabled={isSelected}
                        onClick={() => {
                            onSelect(driverId);
                            onClose?.();
                        }}
                    >
                        {isSelected
                            ? "Selected"
                            : "Select this driver"}
                    </Button>
                )}
            </>
        }
    >
        {driverId && (
            <DriverProfileContent driverId={driverId} />
        )}
    </Modal>
);

export default DriverProfileModal;
