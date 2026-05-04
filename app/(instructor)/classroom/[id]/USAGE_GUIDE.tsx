/**
 * =====================================================
 * คำแนะนำการใช้งาน Components ที่สร้างไว้
 * =====================================================
 * 
 * Components ที่สร้างไว้:
 * 1. OverviewTab - แสดงภาพรวมรายวิชา
 * 2. SectionsTab - จัดการกลุ่มเรียน (students, permanent teams, weekly teams)
 * 3. PeopleTab - จัดการบุคลากร (instructor, TAs)
 * 4. AssignmentsTab - จัดการงาน
 * 5. ScoresTab - ลงคะแนน
 * 
 * การใช้งาน:
 * 
 * 1. Import components:
 */

import {
    OverviewTab,
    SectionsTab,
    PeopleTab,
    AssignmentsTab,
    OverviewSkeleton,
} from "./components";

/**
 * 2. ใน JSX ส่วน render tabs ให้แทนที่ด้วย:
 */

// ================================
// Overview Tab
// ================================
/*
{activeTab === "overview" && (
    isLoading ? (
        <OverviewSkeleton />
    ) : (
        <OverviewTab
            course={course}
            overview={overview}
            isLoading={isOverviewLoading}
            userRole={userRole}
            assignments={assignments}
            onNavigateToAssignments={() => setActiveTab("assignments")}
        />
    )
)}
*/

// ================================
// Sections Tab
// ================================
/*
{activeTab === "sections" && (
    <SectionsTab
        course={course}
        sectionSubTab={sectionSubTab}
        setSectionSubTab={setSectionSubTab}
        sectionSearchQuery={sectionSearchQuery}
        setSectionSearchQuery={setSectionSearchQuery}
        totalStudents={totalStudents}
        permanentTeams={permanentTeams}
        weeklyTeams={weeklyTeams}
        selectedWeek={selectedWeek}
        setSelectedWeek={setSelectedWeek}
        totalWeeks={totalWeeks}
        expandedSections={expandedSections}
        isTeamsLoading={isTeamsLoading}
        sectionStudents={sectionStudents}
        onToggleSection={toggleSection}
        onOpenAddSectionModal={() => setIsAddSectionModalOpen(true)}
        onOpenAddStudentModal={openAddStudentModal}
        onRemoveSection={handleRemoveSection}
        onOpenDeleteStudentModal={openDeleteStudentModal}
        onOpenCreateTeamModal={(type, method) => {
            setTeamCreationType(type);
            setTeamFormationMethod(method);
            setIsCreateTeamModalOpen(true);
        }}
        onOpenDeleteTeamModal={openDeleteTeamModal}
        onCopyTeamsFromWeek={copyTeamsFromWeek}
        onOpenBulkDeleteModal={openBulkDeleteModal}
        getFilteredSectionStudents={getFilteredSectionStudents}
        findStudentTeam={findStudentTeam}
    />
)}
*/

// ================================
// People Tab
// ================================
/*
{activeTab === "people" && (
    <PeopleTab
        course={course}
        isLoading={isLoading}
        isPeopleLoading={isPeopleLoading}
        onOpenAddTAModal={() => setIsAddTAModalOpen(true)}
        onRemoveTA={handleRemoveTA}
    />
)}
*/

// ================================
// Assignments Tab
// ================================
/*
{activeTab === "assignments" && (
    <AssignmentsTab
        assignments={assignments}
        setAssignments={setAssignments}
        isLoading={isAssignmentsLoading}
        expandedAssignments={expandedAssignments}
        setExpandedAssignments={setExpandedAssignments}
        onOpenCreateModal={() => {
            setNewAssignment({
                name: "",
                assignment_type: "individual",
                hasSubItems: false,
                subItems: [],
                maxScore: 10,
                dueDate: "",
                description: "",
            });
            setEditingAssignment(null);
            setIsAddAssignmentModalOpen(true);
        }}
        onOpenEditModal={(assignment) => {
            setEditingAssignment(assignment);
            setNewAssignment({
                name: assignment.name,
                assignment_type: assignment.assignment_type,
                week_number: assignment.week_number,
                hasSubItems: !!(assignment.subItems && assignment.subItems.length > 0),
                subItems: assignment.subItems?.map(s => ({
                    id: s.id,
                    name: s.name,
                    max_score: Number(s.max_score)
                })) || [],
                maxScore: Number(assignment.max_score),
                dueDate: assignment.due_date || "",
                description: assignment.description || "",
            });
            setIsAddAssignmentModalOpen(true);
        }}
    />
)}
*/

// ================================
// Scores Tab
// ================================
/*
{activeTab === "scores" && (
    <ScoresTab
        assignments={assignments}
        selectedAssignment={selectedAssignmentForScore}
        setSelectedAssignment={setSelectedAssignmentForScore}
        scoresData={scoresData}
        isLoading={isScoresLoading}
        scoreSearchQuery={scoreSearchQuery}
        setScoreSearchQuery={setScoreSearchQuery}
        scoreEntries={scoreEntries}
        setScoreEntries={setScoreEntries}
        isSaving={isSavingScores}
        groupsForScore={groupsForScore}
        onFetchScores={fetchScoresForAssignment}
        onSaveScores={saveAllScores}
        onOpenGroupScoreModal={() => {
            setSelectedGroupForScore(null);
            setGroupScoreValue(0);
            setGroupSubItemScores({});
            setIsGroupScoreModalOpen(true);
        }}
        onNavigateToAssignments={() => setActiveTab("assignments")}
    />
)}
*/

/**
 * =====================================================
 * หมายเหตุ:
 * =====================================================
 * 
 * - Modals ยังคงอยู่ใน page.tsx เนื่องจากต้องใช้ states จำนวนมาก
 * - ถ้าต้องการ refactor modals ด้วย สามารถสร้าง hook แยกสำหรับ
 *   จัดการ state ของแต่ละ modal ได้
 * 
 * - การลบ code เดิมออกจาก page.tsx:
 *   1. ลบ Skeleton components ที่ประกาศในไฟล์ (ใช้จาก ./components แทน)
 *   2. ลบ JSX ของแต่ละ tab content
 *   3. แทนที่ด้วย component imports
 * 
 * ไฟล์นี้เป็นเพียงคำแนะนำ สามารถลบได้หลังจากดูเสร็จแล้ว
 */

export {};
