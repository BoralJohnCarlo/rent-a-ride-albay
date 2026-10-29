import Badge from "../common/Badge";
import StatusChip from "../common/StatusChip";

import getConsignmentCardData from "../../utils/getConsignmentCardData";
import formatDate from "../../utils/formatDate";

const ConsignmentSummaryCard = ({
    consignment,
}) => {
    const {
        title,
        image,
        consignmentCode,
        status,
        ownership,
        plateNumber,
        submittedAt,
    } = getConsignmentCardData(
        consignment
    );

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="aspect-video overflow-hidden bg-gray-100">
                {image ? (
                    <img
                        src={image}
                        alt={title}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No Image Available
                    </div>
                )}
            </div>

            <div className="space-y-5 p-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                        {title}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                        {consignmentCode || "—"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <StatusChip
                        status={status}
                    />

                    {ownership && (
                        <Badge variant="secondary">
                            {ownership}
                        </Badge>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Plate Number
                        </p>

                        <p className="mt-1 font-medium text-gray-900">
                            {plateNumber ||
                                "—"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Submitted
                        </p>

                        <p className="mt-1 font-medium text-gray-900">
                            {submittedAt
                                ? formatDate(
                                      submittedAt
                                  )
                                : "—"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsignmentSummaryCard;