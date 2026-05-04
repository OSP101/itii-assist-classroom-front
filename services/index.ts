export { apiService } from './api.service';
export { authService } from './auth.service';
export { twoFactorService } from './twoFactor.service';
export { oauthService } from './oauth.service';
export { userService } from './user.service';
export { studentService } from './student.service';
export { courseService } from './course.service';
export { default as assignmentService } from './assignment.service';
export { default as scoreService } from './score.service';
export { default as examScoreService } from './examScore.service';
export type { User, LoginCredentials, LoginResponse, AuthState, Session } from './auth.service';
export type { TwoFactorLoginData } from './twoFactor.service';
export type { 
  User as UserModel, 
  CreateUserDto, 
  UpdateUserDto, 
  UserListParams, 
  UserListResponse, 
  UserStats 
} from './user.service';
export type {
  Student,
  CreateStudentDto,
  UpdateStudentDto,
  StudentListParams,
  StudentListResponse,
  StudentStats,
} from './student.service';
export type {
  Course,
  CourseSection,
  Instructor,
  TA,
  CreateCourseDto,
  UpdateCourseDto,
  CourseListParams,
  CourseListResponse,
  CourseStats,
  SectionStudent,
} from './course.service';
export type {
  Assignment,
  AssignmentSubItem,
  CreateAssignmentData,
  UpdateAssignmentData,
} from './assignment.service';
export type {
  Student as ScoreStudent,
  StudentScore,
  ScoresData,
  Group,
  ScoreEditRequest,
} from './score.service';
export { default as systemLogService } from './systemLog.service';
export * from './systemLog.service';
export { default as attendanceService } from './attendance.service';
export type {
  AttendanceSession,
  AttendanceRecord,
  CreateAttendanceData,
  StudentCheckInData,
} from './attendance.service';
export { default as queueService } from './queue.service';
export { monitoringService } from './monitoring.service';
export type {
  QueueSession,
  QueueWorker,
  QueueBooking,
  QueueDeskStatus,
  DeskWithStatus,
  CreateQueueSessionData,
  UpdateQueueSessionData,
  CreateBookingData,
  CompleteBookingData,
  ProjectorViewData,
  VerifyPINResponse,
} from './queue.service';