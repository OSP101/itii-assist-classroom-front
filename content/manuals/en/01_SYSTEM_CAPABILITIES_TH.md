# System capabilities overview

This overview summarizes the roles, core modules, major frontend surfaces, access control model, and high-level workflows supported by ITII Assist Classroom.

## 1) Core user roles

1. Admin
- Manage user accounts
- Manage student records
- Oversee courses and classrooms across the platform
- Review system-level logs and monitoring

2. Instructor
- Manage the courses they own
- Manage sections, assignments, grades, exams, attendance, and queues
- Approve or reject score edit requests
- Review activity logs and TA workload

3. TA
- Work inside assigned courses
- Grade work, manage attendance and queues, and manage teams when permissions allow
- Submit score edit requests or review requests when permissions allow

4. Student
- Check in to open attendance sessions
- Join queues for project review or consultation
- View personal scores
- View assignment status and learner-visible course information

## 2) Core platform modules

1. Authentication and security
- Login, logout, and refresh token
- OAuth (Google/GitHub/Apple)
- Session management
- 2FA (TOTP/Email)

2. Course management
- Create courses
- Manage sections
- Add or remove instructors and TAs
- Add or remove students in each section

3. Assignments and scores
- Create assignments, including sub-items
- Grade individual, group, or bulk submissions
- Review score summaries and matrix views
- Handle score edit requests with an approval workflow

4. Attendance
- Create attendance sessions
- Open and close sessions
- Support PIN, QR, and time or location-based rules
- Update attendance status per student or in bulk

5. Queue
- Open queue sessions
- Let students reserve a place in line
- Let TAs and instructors work through the queue in worker mode
- Show real-time status, including projector or display views

6. Exams and bonus points
- Configure exam score components
- Record exam scores per student or in bulk
- Add and summarize bonus points

7. Team management
- Create teams
- Manage team members
- Support bulk create and delete actions

8. Activity logs and monitoring
- Record important course-level events
- Support audits and TA workload summaries

## 3) Key frontend areas

1. Admin areas
- `/admin/users`
- `/admin/students`
- `/admin/courses`
- `/admin/classrooms`

2. Instructor and TA areas
- `/(instructor)/home`
- `/(instructor)/classroom/[id]`
- Sub-tabs such as overview, sections, assignments, attendance, queue, scores, approval, exam-scores, people, activity-log, and settings

3. Student areas
- `/check-in/[sessionId]`
- `/queue/book`
- `/myscore`
- `/permissions` for browser access checks such as location, notifications, and camera

## 4) Access control model

1. Role level
- `admin`, `instructor`, `ta`

2. Course access level
- A user must be a member of a course to access that course's data

3. Course permission level
- Fine-grained permissions such as `create_sections`, `manage_section_students`, `create_assignments`, `update_attendance_sessions`, `view_score_summary`, and `review_all`

Note:
- TA access is not identical for every person. It depends on the permissions assigned by the instructor in each course.

## 5) High-level workflows

1. Start of term
- Create course -> Create sections -> Add TAs -> Add students -> Configure assignments, exams, and attendance

2. During the term
- Open attendance sessions -> Open queues -> Review work and grade -> Handle score edit requests

3. End of term
- Check score completeness -> Apply policy-based adjustments -> Close the course -> Preserve evidence in the activity log
