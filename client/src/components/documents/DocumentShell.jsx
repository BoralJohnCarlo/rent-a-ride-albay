import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../common/Button";
import {
    ACKNOWLEDGEMENT_NOTE,
    BRAND_NAME,
} from "../../utils/documentFormat";

/*
 * Frame for a printable document (receipt, booking statement): a toolbar
 * that's hidden when printing, and a white "paper" sheet that stays white in
 * dark mode — it's what prints, and a receipt should look like one. The
 * browser's Print dialog doubles as "Save as PDF".
 */

export const DocumentSection = ({ title, children }) => (
    <section className="mt-8 min-w-0 break-inside-avoid">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.14em] text-[#14161B]/55 uppercase">
            {title}
        </h2>
        {children}
    </section>
);

/* Two-column label/value list. `rows`: [[label, value], ...] */
export const DetailList = ({ rows }) => (
    // minmax(0, 1fr) + overflow-wrap:anywhere: a long unbroken value (an
    // email address) wraps inside its column instead of spilling over the
    // section next to it.
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(7rem,auto)_minmax(0,1fr)]">
        {rows
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([label, value]) => (
                <div key={label} className="contents">
                    <dt className="text-[#14161B]/55">{label}</dt>
                    <dd className="min-w-0 font-medium wrap-anywhere text-[#14161B]">{value}</dd>
                </div>
            ))}
    </dl>
);

const DocumentShell = ({ title, documentLabel, number, meta, children }) => {
    const navigate = useNavigate();

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/");
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F5F1] px-4 py-6 text-[#14161B] sm:py-10 dark:bg-gray-950 print:bg-white print:p-0">
            <title>{`${title} · ${BRAND_NAME}`}</title>

            <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    leftIcon={<ArrowLeft size={16} />}
                >
                    Back
                </Button>

                <Button
                    variant="dark"
                    size="sm"
                    onClick={() => window.print()}
                    leftIcon={<Printer size={16} />}
                >
                    Print / Save as PDF
                </Button>
            </div>

            <article className="mx-auto max-w-3xl rounded-2xl border border-[#14161B]/10 bg-white p-6 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
                <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#14161B]/10 pb-6">
                    <div>
                        <p className="flex items-center gap-2 text-lg font-bold">
                            {BRAND_NAME}
                            <span className="inline-block h-2 w-2 rounded-full bg-[#E29B3F]" />
                        </p>
                        <p className="text-sm text-[#14161B]/55">
                            Albay, Philippines
                        </p>
                    </div>

                    <div className="text-left sm:text-right">
                        <p className="text-xs font-semibold tracking-[0.14em] text-[#14161B]/55 uppercase">
                            {documentLabel}
                        </p>
                        {number && (
                            <p className="mt-1 font-mono text-lg font-semibold">
                                {number}
                            </p>
                        )}
                        {meta && (
                            <p className="mt-1 text-sm text-[#14161B]/55">
                                {meta}
                            </p>
                        )}
                    </div>
                </header>

                {children}

                <footer className="mt-10 border-t border-[#14161B]/10 pt-4 text-xs leading-5 text-[#14161B]/55">
                    {ACKNOWLEDGEMENT_NOTE}
                </footer>
            </article>
        </div>
    );
};

export default DocumentShell;
