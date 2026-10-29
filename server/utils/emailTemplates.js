/*
 * The one look every outgoing email shares: brand header, greeting, message,
 * an optional details table, an optional button and the footer. Inline styles
 * only — most mail clients drop <style> blocks. Every caller-supplied string
 * is escaped, so user-entered text (reasons, notes, names) can't inject HTML.
 */

export const BRAND_NAME = "Rent-A-Ride Albay";

const COLORS = {
    ink: "#14161B",
    muted: "#6b7280",
    line: "#e5e7eb",
    paper: "#F7F5F1",
    amber: "#E29B3F",
};

export const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export const formatPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

/* "Sat, October 3, 2026, 02:00 PM" in Philippine time. */
export const formatEmailDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              weekday: "short",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";

/*
 * An absolute link into the web app for a path like "/customer/bookings/x".
 * Null when CLIENT_URL isn't configured, so the email just has no button.
 */
export const appLink = (path) => {
    const base = String(process.env.CLIENT_URL || "").replace(/\/+$/, "");

    if (!base || !path) {
        return null;
    }

    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const paragraphsOf = (value) =>
    (Array.isArray(value) ? value : [value])
        .filter((paragraph) => paragraph !== null && paragraph !== undefined && paragraph !== "");

/*
 * Builds { subject, html, text } for an email.
 *   heading    — the large title in the body
 *   greetingName — "Hello <name>," (omitted when empty)
 *   paragraphs — string or string[] shown above the details
 *   rows       — [[label, value], ...] shown as a two-column table
 *   code       — { value, caption } a one-time code shown large under the
 *                paragraphs (e.g. a password reset code)
 *   action     — { label, url } rendered as a button (skipped without a url)
 *   footnote   — small print under everything (string or string[])
 */
export const renderEmail = ({
    subject,
    heading,
    greetingName = "",
    paragraphs = [],
    rows = [],
    code = null,
    action = null,
    footnote = [],
}) => {
    const body = paragraphsOf(paragraphs);
    const notes = paragraphsOf(footnote);
    const tableRows = (rows || []).filter(
        (row) => Array.isArray(row) && row[0]
    );

    const greetingHtml = greetingName
        ? `<p style="margin: 0 0 16px;">Hello ${escapeHtml(greetingName)},</p>`
        : "";

    const paragraphsHtml = body
        .map(
            (paragraph) =>
                `<p style="margin: 0 0 16px; line-height: 1.55;">${escapeHtml(paragraph)}</p>`
        )
        .join("");

    const rowsHtml = tableRows.length
        ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 8px 0 20px;">${tableRows
              .map(
                  ([label, value]) => `
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid ${COLORS.line}; color: ${COLORS.muted}; vertical-align: top;">${escapeHtml(label)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid ${COLORS.line}; font-weight: 600; color: ${COLORS.ink}; text-align: right;">${escapeHtml(value ?? "—")}</td>
                </tr>`
              )
              .join("")}</table>`
        : "";

    const codeHtml = code?.value
        ? `<div style="margin: 8px 0 24px; padding: 20px; border-radius: 14px; background: ${COLORS.paper}; border: 1px dashed ${COLORS.amber}; text-align: center;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 10px; color: ${COLORS.ink};">${escapeHtml(code.value)}</div>
                ${code.caption ? `<div style="margin-top: 8px; font-size: 12px; color: ${COLORS.muted};">${escapeHtml(code.caption)}</div>` : ""}
            </div>`
        : "";

    const actionHtml = action?.url
        ? `<p style="margin: 8px 0 24px;"><a href="${escapeHtml(action.url)}" style="display: inline-block; padding: 12px 22px; border-radius: 999px; background: ${COLORS.ink}; color: #ffffff; text-decoration: none; font-weight: 600;">${escapeHtml(action.label || "Open")}</a></p>`
        : "";

    const footnoteHtml = notes
        .map(
            (note) =>
                `<p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.muted}; line-height: 1.5;">${escapeHtml(note)}</p>`
        )
        .join("");

    const html = `
<div style="background: ${COLORS.paper}; padding: 24px 12px; font-family: Arial, Helvetica, sans-serif; color: ${COLORS.ink};">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid ${COLORS.line};">
        <div style="padding: 18px 24px; background: ${COLORS.ink}; color: #ffffff; font-weight: 700; letter-spacing: 0.02em;">
            ${escapeHtml(BRAND_NAME)}<span style="display: inline-block; width: 8px; height: 8px; margin-left: 8px; border-radius: 999px; background: ${COLORS.amber};"></span>
        </div>
        <div style="padding: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 20px;">${escapeHtml(heading || subject)}</h2>
            ${greetingHtml}
            ${paragraphsHtml}
            ${codeHtml}
            ${rowsHtml}
            ${actionHtml}
            ${footnoteHtml}
        </div>
        <div style="padding: 14px 24px; border-top: 1px solid ${COLORS.line}; font-size: 12px; color: ${COLORS.muted};">
            ${escapeHtml(BRAND_NAME)} · Albay, Philippines. This is an automated message — please don't reply to it.
        </div>
    </div>
</div>`;

    const text = [
        heading || subject,
        "",
        greetingName ? `Hello ${greetingName},` : null,
        greetingName ? "" : null,
        ...body.flatMap((paragraph) => [paragraph, ""]),
        code?.value ? `Your code: ${code.value}` : null,
        code?.caption ? code.caption : null,
        code?.value ? "" : null,
        ...tableRows.map(([label, value]) => `${label}: ${value ?? "—"}`),
        tableRows.length ? "" : null,
        action?.url ? `${action.label || "Open"}: ${action.url}` : null,
        action?.url ? "" : null,
        ...notes,
        notes.length ? "" : null,
        BRAND_NAME,
    ]
        .filter((line) => line !== null)
        .join("\n");

    return { subject, html, text };
};
