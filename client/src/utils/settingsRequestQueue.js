// Settings responses contain a full snapshot. Keep reads and writes in order
// so a delayed response cannot restore values from before another save.
let pending = Promise.resolve();

export const queueSettingsRequest = (request) => {
    const result = pending.then(request);
    // A failed request must not prevent later saves or retries.
    pending = result.catch(() => {});
    return result;
};
