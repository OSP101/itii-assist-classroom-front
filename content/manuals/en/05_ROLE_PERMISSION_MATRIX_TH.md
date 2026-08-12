# Role and permission matrix

Use this matrix as a quick reference for who can perform each workflow. Actual TA access still depends on the course permissions configured by the instructor.

Note:
- This table is a practical overview for manual usage
- Real TA access depends on the course permissions assigned by the instructor

## 1) Main permission overview

| Workflow | Admin | Instructor | TA | Student |
|---|---|---|---|---|
| Manage system users | Yes | No | No | No |
| Manage students at system level | Yes | Partial | Partial | No |
| Create courses | Yes | Yes | No | No |
| Access a course as a member | Yes | Yes | Yes | Yes, student view only |
| Manage sections | Yes | Yes | Yes, if permitted | No |
| Add or remove TAs and co-instructors | Yes | Yes | Yes, if permitted | No |
| Manage students in a section | Yes | Yes | Yes, if permitted | No |
| Create or edit assignments | Yes | Yes | Yes, if permitted | No |
| Grade work | Yes | Yes | Yes, if permitted | No |
| View score summary or matrix | Yes | Yes | Yes, if permitted | Own scores only |
| Submit score edit requests | Yes | Yes | Yes | No |
| Approve or reject score edit requests | Yes | Yes | Yes, if `review_all` is granted | No |
| Create attendance sessions | Yes | Yes | Yes, if permitted | No |
| Check in to attendance | No | No | No | Yes |
| Open or close queue sessions | Yes | Yes | Yes, if permitted | No |
| Join a queue | No | No | No | Yes |
| Manage teams | Yes | Yes | Yes, if permitted | No |
| Manage exam scores | Yes | Yes | Yes, if permitted | No |
| Add bonus points | Yes | Yes | Yes, if permitted | No |
| View course activity log | Yes | Yes | Usually not the main owner | No |

## 2) Common TA course permissions

| Permission | Meaning |
|---|---|
| `create_sections` | Create sections |
| `update_sections` | Edit sections |
| `delete_sections` | Delete sections |
| `manage_section_students` | Add or remove students in a section |
| `add_people` | Add TAs or co-instructors |
| `remove_people` | Remove TAs or co-instructors |
| `edit_member_permissions` | Edit member permissions |
| `create_assignments` | Create assignments |
| `update_assignments` | Edit assignments |
| `delete_assignments` | Delete assignments |
| `view_score_summary` | View score summary and matrix |
| `grade_*` or `edit_*` | Grade or edit scores according to policy |
| `review_all` | Approve or reject all score edit requests |
| `create_attendance_sessions` | Create attendance sessions |
| `update_attendance_sessions` | Edit, open, or close attendance sessions |
| `update_attendance_status` | Update attendance status per student or in bulk |
| `view_teams` | View teams |
| `create_teams` | Create teams |
| `update_teams` | Edit teams |
| `delete_teams` | Delete teams |
| `manage_team_members` | Add or remove team members |
| `view_exam_scores` | View exam scores |
| `create_exam_scores` or `update_exam_scores` | Record exam scores |
| `delete_exam_scores` | Delete exam scores |

## 3) Safer permission design guidelines

1. Start from least privilege
- Give each TA only the access required for the work they actually do

2. Separate TAs by workflow
- For example: grading TAs, attendance TAs, queue or in-class support TAs

3. Review permissions at important checkpoints
- Start of term, mid-term, and before final grading closes

4. Require instructor approval for higher-risk actions
- Approving score edit requests
- Large data changes that can affect learning outcomes