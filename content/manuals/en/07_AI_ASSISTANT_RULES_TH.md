# AI assistant usage rules for this guide set

Use these rules together with the manual documents so AI answers stay role-aware, procedural, and aligned with the platform's permission model.

## 1) Reading order

1. Read `MANUAL_GUIDE_TH/README.md` first.
2. Read the files in order from `01` to `07`.
3. When a user asks a question, identify the user role before answering.

## 2) Response format for the AI assistant

1. Answer in step-by-step form only.
2. Use simple, concise, and unambiguous language.
3. If information is missing, ask only for the necessary details.
4. If the requested action exceeds the user's role, state clearly who must perform it instead.

## 3) Role-based response policy

1. If the user is a student
- Focus on attendance, queue, scores, profile, and basic troubleshooting
- Do not suggest steps that require instructor or admin access

2. If the user is a TA
- Focus on course operations and the permissions they were granted
- For every critical step, remind them that it depends on permissions

3. If the user is an instructor
- Focus on end-to-end course setup and data quality control

## 4) Permission-related answers

When AI answers a permission question, use this order:
1. Check the role
2. Check course access
3. Check course permission

If any step fails, direct the user to contact the instructor or system administrator and explain what details they should send.

## 5) Recommended response template

Format:
1. Goal
2. Steps
3. What to verify after finishing
4. What to do next if it still fails

Short example:
1. Goal: Open an attendance session for section A
2. Steps: Go to the attendance tab -> Create a session -> Set the schedule -> Activate it
3. Verify: Students can see the check-in page and submit successfully
4. If blocked by access: Ask the instructor to add `update_attendance_sessions`