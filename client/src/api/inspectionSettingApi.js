import api from "../lib/axios";

export const getInspectionSetting = () =>
    api.get("/inspection-settings");

export const getInspectionAvailability = () =>
    api.get("/inspection-settings/availability");

export const fetchInspectionSetting = () =>
    api.get("/inspection-settings");

export const updateInspectionSetting = (data) =>
    api.put("/inspection-settings", data);