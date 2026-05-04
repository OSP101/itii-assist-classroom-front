"use client";

import { useScoreSummaryTab, ScoreSummaryTabView } from "./score-summary";

interface ScoreSummaryTabProps {
    courseId: string;
    isCourseActive?: boolean;
}

/**
 * ScoreSummaryTab Container Component
 * 
 * This is a container component that:
 * 1. Uses the useScoreSummaryTab hook to manage all state and business logic
 * 2. Passes data and handlers to the memoized ScoreSummaryTabView component
 * 
 * Benefits:
 * - Separation of concerns (logic vs presentation)
 * - Easier testing (can test hook and view separately)
 * - Reduced re-renders through React.memo in ScoreSummaryTabView
 */
export default function ScoreSummaryTab({ courseId, isCourseActive = true }: ScoreSummaryTabProps) {
    const {
        // State
        selectedTab,
        selectedSection,
        searchQuery,
        isLoading,
        hoverRowId,
        hoverColKey,
        scoreModal,
        matrixData,

        // Computed
        filteredStudents,
        columns,
        assignmentGroups,
        totalMaxScore,
        classAverage,
        labCount,
        assignmentCount,
        groupCount,

        // Actions
        setSelectedTab,
        setSelectedSection,
        setSearchQuery,
        setHoverRowId,
        setHoverColKey,
        handleScoreClick,
        closeScoreModal,
    } = useScoreSummaryTab({ courseId });

    return (
        <ScoreSummaryTabView
            selectedTab={selectedTab}
            selectedSection={selectedSection}
            searchQuery={searchQuery}
            isLoading={isLoading}
            hoverRowId={hoverRowId}
            hoverColKey={hoverColKey}
            scoreModal={scoreModal}
            matrixData={matrixData}
            filteredStudents={filteredStudents}
            columns={columns}
            assignmentGroups={assignmentGroups}
            totalMaxScore={totalMaxScore}
            classAverage={classAverage}
            labCount={labCount}
            assignmentCount={assignmentCount}
            groupCount={groupCount}
            onSetSelectedTab={setSelectedTab}
            onSetSelectedSection={setSelectedSection}
            onSetSearchQuery={setSearchQuery}
            onSetHoverRowId={setHoverRowId}
            onSetHoverColKey={setHoverColKey}
            onScoreClick={handleScoreClick}
            onCloseScoreModal={closeScoreModal}
            isCourseActive={isCourseActive}
        />
    );
}
