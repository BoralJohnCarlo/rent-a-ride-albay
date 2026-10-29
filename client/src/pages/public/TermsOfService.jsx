import { motion } from "framer-motion";
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

import useLegalDocument from "../../hooks/legal/useLegalDocument";

import { LEGAL_DOCUMENT_TYPES } from "../../constants/legalDocuments";
import { formatLegalDate } from "../../utils/legalDocumentFormat";

const BRAND = "Rent-A-Ride Albay";

/* The title with the brand name in yellow, as the page always showed it. */
const renderTitle = (title) => {
    const at = title.lastIndexOf(BRAND);

    if (at < 0) {
        return title;
    }

    return (
        <>
            {title.slice(0, at)}
            <span className="text-yellow-500">{BRAND}</span>
            {title.slice(at + BRAND.length)}
        </>
    );
};

/*
 * The public Terms of Service: the published version from Settings → Terms
 * & Policies (nobody accepts these; they're for reading).
 */
const TermsOfService = () => {
    const { document, error, reload } = useLegalDocument(
        LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE
    );

    const sections = (document?.sections ?? []).map((section, index) => ({
        number: String(index + 1).padStart(2, "0"),
        key: section.key,
        title: section.title,
        paragraphs: section.items
            .map((item) => item.text)
            .filter(Boolean),
    }));

    return (
        <>
            <Section
                spacing="XL"
                className="bg-gray-50"
            >
                <PageContainer>
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 24,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.6,
                        }}
                        className="
                            mx-auto
                            max-w-3xl
                            text-center
                        "
                    >
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0.95,
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                            }}
                            transition={{
                                duration: 0.45,
                                delay: 0.1,
                            }}
                            className="
                                mx-auto
                                inline-flex
                                items-center
                                gap-2
                                rounded-full
                                border
                                border-yellow-200
                                bg-yellow-50
                                px-4
                                py-2
                                text-sm
                                font-semibold
                                text-yellow-700
                            "
                        >
                            <FileText size={16} />
                            Terms of Service
                        </motion.div>

                        <h1
                            className="
                                mt-6
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                sm:text-5xl
                            "
                        >
                            {renderTitle(
                                document?.title ||
                                    `Terms for Using ${BRAND}`
                            )}
                        </h1>

                        {document?.intro && (
                            <p
                                className="
                                    mx-auto
                                    mt-5
                                    max-w-2xl
                                    text-base
                                    leading-7
                                    text-gray-600
                                    sm:text-lg
                                "
                            >
                                {document.intro}
                            </p>
                        )}

                        {document && (
                            <p className="mt-4 text-xs font-medium text-gray-500">
                                Version {document.version}
                                {document.publishedAt &&
                                    ` · Effective ${formatLegalDate(
                                        document.publishedAt
                                    )}`}
                            </p>
                        )}
                    </motion.div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="bg-white"
            >
                <PageContainer>
                    <div className="mx-auto max-w-4xl">
                        {!document && (
                            <div className="flex flex-col items-center gap-3 rounded-3xl border border-gray-200 bg-white px-6 py-14 text-center">
                                {error ? (
                                    <>
                                        <AlertCircle
                                            size={24}
                                            className="text-red-500"
                                        />
                                        <p className="text-sm text-gray-600">
                                            {error}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={reload}
                                            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-400"
                                        >
                                            <RefreshCw size={15} />
                                            Try again
                                        </button>
                                    </>
                                ) : (
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-yellow-500" />
                                )}
                            </div>
                        )}

                        {document?.notice?.body && (
                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 20,
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                            className="
                                mb-8
                                overflow-hidden
                                rounded-3xl
                                border
                                border-yellow-200
                                bg-yellow-50
                                p-6
                                shadow-sm
                                sm:p-7
                            "
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-2xl
                                        bg-yellow-500
                                        text-gray-950
                                        shadow-sm
                                    "
                                >
                                    <ShieldCheck
                                        size={23}
                                        strokeWidth={1.8}
                                    />
                                </div>

                                <div>
                                    <h2
                                        className="
                                            text-base
                                            font-bold
                                            tracking-tight
                                            text-gray-900
                                            sm:text-lg
                                        "
                                    >
                                        {document.notice.title}
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            whitespace-pre-line
                                            text-sm
                                            leading-7
                                            text-gray-600
                                        "
                                    >
                                        {document.notice.body}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                        )}

                        <div className="space-y-5">
                            {sections.map(
                                ({
                                    number,
                                    key,
                                    title,
                                    paragraphs,
                                }) => (
                                    <motion.article
                                        key={key}
                                        id={key}
                                        initial={{
                                            opacity: 0,
                                            y: 20,
                                        }}
                                        whileInView={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        viewport={{
                                            once: true,
                                            amount: 0.15,
                                        }}
                                        transition={{
                                            duration: 0.45,
                                        }}
                                        className="
                                            group
                                            rounded-3xl
                                            border
                                            border-gray-200
                                            bg-white
                                            p-6
                                            shadow-sm
                                            transition-all
                                            duration-300
                                            hover:-translate-y-1
                                            hover:border-gray-300
                                            hover:shadow-lg
                                            sm:p-7
                                        "
                                    >
                                        <div className="flex items-start gap-5">
                                            <span
                                                className="
                                                    flex
                                                    h-11
                                                    w-11
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    rounded-2xl
                                                    bg-gray-950
                                                    text-xs
                                                    font-bold
                                                    text-yellow-500
                                                    shadow-sm
                                                    transition-colors
                                                    duration-300
                                                    group-hover:bg-yellow-500
                                                    group-hover:text-gray-950
                                                "
                                            >
                                                {number}
                                            </span>

                                            <div className="min-w-0">
                                                <h2
                                                    className="
                                                        text-lg
                                                        font-bold
                                                        tracking-tight
                                                        text-gray-900
                                                        sm:text-xl
                                                    "
                                                >
                                                    {title}
                                                </h2>

                                                {paragraphs.map(
                                                    (paragraph, index) => (
                                                        <p
                                                            key={index}
                                                            className="
                                                                mt-3
                                                                whitespace-pre-line
                                                                text-sm
                                                                leading-7
                                                                text-gray-600
                                                            "
                                                        >
                                                            {paragraph}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </motion.article>
                                )
                            )}
                        </div>

                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 20,
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                            className="
                                mt-8
                                overflow-hidden
                                rounded-3xl
                                bg-gray-950
                                p-7
                                shadow-xl
                                sm:p-9
                            "
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-2xl
                                        bg-yellow-500
                                        text-gray-950
                                    "
                                >
                                    <CheckCircle2
                                        size={22}
                                        strokeWidth={1.8}
                                    />
                                </div>

                                <div>
                                    <h2
                                        className="
                                            text-xl
                                            font-black
                                            tracking-tight
                                            text-white
                                            sm:text-2xl
                                        "
                                    >
                                        Questions about these
                                        terms?
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            max-w-2xl
                                            text-sm
                                            leading-7
                                            text-gray-400
                                        "
                                    >
                                        If you need clarification
                                        regarding the platform or
                                        rental process, visit the
                                        Contact page for
                                        assistance.
                                    </p>

                                    <a
                                        href="/contact"
                                        className="
                                            mt-6
                                            inline-flex
                                            items-center
                                            justify-center
                                            rounded-xl
                                            bg-yellow-500
                                            px-5
                                            py-3
                                            text-sm
                                            font-bold
                                            text-gray-950
                                            transition-all
                                            duration-200
                                            hover:bg-yellow-400
                                            hover:shadow-lg
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-yellow-500
                                            focus:ring-offset-2
                                            focus:ring-offset-gray-950
                                        "
                                    >
                                        Contact Us
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>
        </>
    );
};

export default TermsOfService;