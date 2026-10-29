import api from "../lib/axios";

/* Settings → Terms & Policies. `type` is one of LEGAL_DOCUMENT_TYPES. */

export const getCurrentLegalDocument = async (type) => {
    const { data } = await api.get(`/legal-documents/public/${type}`);

    return data;
};

export const getLegalDocumentVersion = async (id) => {
    const { data } = await api.get(`/legal-documents/public/versions/${id}`);

    return data;
};

export const getLegalDocumentAdminView = async (type) => {
    const { data } = await api.get(`/legal-documents/${type}`);

    return data;
};

/*
 * `baseUpdatedAt`: when the draft the editor started from was last saved
 * (null if there was none), so another admin's newer draft is never
 * overwritten or deleted without them knowing.
 */
export const saveLegalDocumentDraft = async (type, content, baseUpdatedAt) => {
    const { data } = await api.put(`/legal-documents/${type}/draft`, {
        ...content,
        baseUpdatedAt: baseUpdatedAt ?? null,
    });

    return data;
};

export const discardLegalDocumentDraft = async (type, baseUpdatedAt) => {
    const { data } = await api.delete(`/legal-documents/${type}/draft`, {
        params: { baseUpdatedAt: baseUpdatedAt ?? "" },
    });

    return data;
};

export const publishLegalDocument = async (
    type,
    content,
    changeNote,
    baseDraftUpdatedAt,
    // The live version the editor showed and compared against.
    baseVersion
) => {
    const { data } = await api.post(`/legal-documents/${type}/publish`, {
        content,
        changeNote,
        baseDraftUpdatedAt: baseDraftUpdatedAt ?? null,
        baseVersion: baseVersion ?? null,
    });

    return data;
};
