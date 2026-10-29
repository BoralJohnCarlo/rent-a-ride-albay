/* Saves a Blob to the user's device under `fileName`. */
export const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Give the browser a moment to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* Today's date in Manila as "YYYY-MM-DD", for file names. */
export const manilaDateStamp = (date = new Date()) =>
    new Date(date.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

/* "Payment Received" -> "payment-received" */
export const toFileSlug = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
