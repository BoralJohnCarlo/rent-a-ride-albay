import {
    RETURN_TIMING_TEXT_CLASS,
    describeReturnTiming,
} from "../../utils/returnTiming";

/*
 * "Due back Oct 2, 10:00 AM · 1 hr 30 min late" under a returned booking's
 * return time, so both the due-back time and the actual return show.
 * `dueBackLabel` is the due-back time already formatted the page's way.
 */
const ReturnTimingNote = ({ dueBackAt, returnedAt, dueBackLabel }) => {
    const timing = describeReturnTiming(dueBackAt, returnedAt);

    return (
        <p className="mt-1 text-xs text-[#14161B]/55 dark:text-white/50">
            Due back {dueBackLabel}
            {timing && (
                <>
                    {" · "}
                    <span
                        className={`font-semibold ${RETURN_TIMING_TEXT_CLASS[timing.status]}`}
                    >
                        {timing.label}
                    </span>
                </>
            )}
        </p>
    );
};

export default ReturnTimingNote;
