import Modal from "../common/Modal";
import Alert from "../common/Alert";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import InspectConsignmentForm from "./InspectConsignmentForm";

const InspectConsignmentDialog = ({
    open,
    consignment,
    loading = false,
    onClose,
    onSubmit,
}) => {
    if (!consignment) {
        return null;
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Vehicle Inspection"
            size="lg"
        >
            <div className="space-y-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Record the result of the physical
                    vehicle inspection before the
                    consignment can be approved.
                </p>

                <Alert
                    variant="info"
                    title="Inspection Required"
                    message="The vehicle must pass inspection before this consignment can be approved."
                />

                <ConsignmentSummaryCard
                    consignment={consignment}
                />

                <InspectConsignmentForm
                    loading={loading}
                    onCancel={onClose}
                    onSubmit={onSubmit}
                />
            </div>
        </Modal>
    );
};

export default InspectConsignmentDialog;
