import { useSearchParams } from "react-router-dom";
import { Percent, TicketPercent } from "lucide-react";

import PillTabs from "../../../components/common/PillTabs";

import Vouchers from "./Vouchers";
import Discounts from "./Discounts";

/*
 * Admin Promotions (formerly the Vouchers page): codes customers enter at
 * checkout, and automatic vehicle discounts shown on the vehicle cards. The
 * tab lives in the URL (?tab=discounts) so it survives a reload or a link.
 */
const TABS = [
    { value: "vouchers", label: "Vouchers", icon: TicketPercent },
    { value: "discounts", label: "Discounts", icon: Percent },
];

const Promotions = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const tab =
        searchParams.get("tab") === "discounts" ? "discounts" : "vouchers";

    const handleTabChange = (next) =>
        setSearchParams(
            next === "vouchers" ? {} : { tab: next },
            { replace: true }
        );

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <PillTabs
                    value={tab}
                    onChange={handleTabChange}
                    options={TABS}
                    size="lg"
                    layoutId="promotions-tab"
                    label="Promotion type"
                />
            </div>

            {tab === "discounts" ? <Discounts /> : <Vouchers />}
        </div>
    );
};

export default Promotions;
