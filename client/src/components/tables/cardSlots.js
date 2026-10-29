/*
 * Where a column goes in the phone card. `column.mobile` can force it:
 * "title" | "lead" (beside the title, e.g. an expand chevron or pin) |
 * "field" | "full" (field spanning both columns) | "footer" | "hide".
 * Otherwise: header-less columns lead, the first labelled column is the
 * title, an "actions" column is the footer, everything else is a field.
 */
export const getCardSlots = (columns) => {
    const slots = {
        lead: [],
        title: null,
        fields: [],
        footer: [],
    };

    columns.forEach((column) => {
        const forced = column.mobile;

        if (forced === "hide") return;

        if (forced === "lead") {
            slots.lead.push(column);
        } else if (forced === "footer") {
            slots.footer.push(column);
        } else if (forced === "title") {
            slots.title = column;
        } else if (forced === "field" || forced === "full") {
            slots.fields.push(column);
        } else if (!column.header) {
            slots.lead.push(column);
        } else if (
            column.key === "actions" ||
            /^actions?$/i.test(String(column.header))
        ) {
            slots.footer.push(column);
        } else if (!slots.title) {
            slots.title = column;
        } else {
            slots.fields.push(column);
        }
    });

    return slots;
};
