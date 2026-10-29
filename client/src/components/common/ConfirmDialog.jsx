import Button from "./Button";
import Modal from "./Modal";

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to continue?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmVariant = "danger",
    loading = false,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText}
                    </Button>

                    <Button
                        variant={confirmVariant}
                        onClick={onConfirm}
                        loading={loading}
                    >
                        {confirmText}
                    </Button>
                </>
            }
        >
            <p className="text-gray-600 dark:text-gray-300">
                {message}
            </p>
        </Modal>
    );
};

export default ConfirmDialog;