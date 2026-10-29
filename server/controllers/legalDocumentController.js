import {
    assertLegalDocumentType,
    discardLegalDocumentDraft,
    getCurrentLegalDocument,
    getLegalDocumentAdminView,
    getPublishedLegalDocumentById,
    publishLegalDocument,
    saveLegalDocumentDraft,
} from "../services/legalDocumentService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleError = (res, error) =>
    errorResponse(
        res,
        error.message,
        error.statusCode || 400
    );

/* Public: the version in force, which the booking/registration/consignment
   screens show and send back the id of when it's accepted. */
export const getCurrent = async (req, res) => {
    try {
        const document = await getCurrentLegalDocument(req.params.type);

        return successResponse(
            res,
            "Document retrieved successfully.",
            document
        );
    } catch (error) {
        return handleError(res, error);
    }
};

/* Public: any published version, e.g. the one a booking accepted. */
export const getVersion = async (req, res) => {
    try {
        const document = await getPublishedLegalDocumentById(req.params.id);

        return successResponse(
            res,
            "Document version retrieved successfully.",
            document
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const getAdminView = async (req, res) => {
    try {
        const view = await getLegalDocumentAdminView(req.params.type);

        return successResponse(
            res,
            "Document retrieved successfully.",
            view
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const saveDraft = async (req, res) => {
    try {
        const draft = await saveLegalDocumentDraft(
            req.params.type,
            req.body,
            req.user._id,
            { baseUpdatedAt: req.body?.baseUpdatedAt }
        );

        return successResponse(res, "Draft saved.", draft);
    } catch (error) {
        return handleError(res, error);
    }
};

export const discardDraft = async (req, res) => {
    try {
        await discardLegalDocumentDraft(req.params.type, {
            baseUpdatedAt: req.query.baseUpdatedAt,
        });

        return successResponse(res, "Draft discarded.");
    } catch (error) {
        return handleError(res, error);
    }
};

export const publish = async (req, res) => {
    try {
        assertLegalDocumentType(req.params.type);

        const document = await publishLegalDocument(
            req.params.type,
            req.body?.content,
            {
                changeNote: req.body?.changeNote,
                userId: req.user._id,
                baseDraftUpdatedAt: req.body?.baseDraftUpdatedAt,
                baseVersion: req.body?.baseVersion,
            }
        );

        return successResponse(
            res,
            `Version ${document.version} published.`,
            document,
            201
        );
    } catch (error) {
        return handleError(res, error);
    }
};
