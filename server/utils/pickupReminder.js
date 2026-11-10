import { getPickupReference } from "../services/cancellationPolicyService.js";

export const pickupReminderDue = (startDate, now = new Date()) => {
    const pickup = getPickupReference(startDate);
    const remaining = pickup?.getTime() - now.getTime();
    return remaining > 0 && remaining <= 24 * 60 * 60 * 1000;
};
