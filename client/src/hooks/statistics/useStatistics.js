import { useCallback } from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getStatistics,
    clearStatisticsError,
    resetStatisticsState,
} from "../../store/statistics";


const useStatistics = () => {
    const dispatch = useDispatch();

    const {
        data,
        loading,
        error,
    } = useSelector(
        (state) => state.statistics
    );


    const fetchStats = useCallback(
        (period = "30d") => {
            return dispatch(
                getStatistics(
                    period
                )
            );
        },
        [dispatch]
    );


    const clearError = useCallback(() => {
        dispatch(clearStatisticsError());
    }, [dispatch]);


    const resetState = useCallback(() => {
        dispatch(resetStatisticsState());
    }, [dispatch]);


    return {
        data,
        loading,
        error,

        fetchStats,
        clearError,
        resetState,
    };
};


export default useStatistics;
