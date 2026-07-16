export const SESSION_COOKIE = 'scholarslink_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const validRoles = new Set(['STUDENT', 'SUPERVISOR', 'ADMIN']);
export const validRequestStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);
export const validHoursStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

export const FORM_OPTION_FIELD_KEYS = new Set([
  'gender',
  'maritalStatus',
  'spouseStatus',
  'militaryService',
  'academicInstitutionName',
  'yearOfStudy',
  'fieldOfStudy',
]);

export const REGISTRATION_FILE_TYPES = new Set([
  'CV',
  'PERSONAL_LETTER',
  'STUDENT_ID_COPY',
  'PARENT_ID_COPY',
  'ENROLLMENT_CERTIFICATE',
  'CLASS_SCHEDULE',
  'SERVICE_CERTIFICATE',
  'PRE_MILITARY_CERTIFICATE',
  'BANK_CONFIRMATION',
]);

export const MANDATORY_REGISTRATION_FILES = [
  'CV',
  'PERSONAL_LETTER',
  'STUDENT_ID_COPY',
  'PARENT_ID_COPY',
  'BANK_CONFIRMATION',
];

export const REQUIRED_REGISTRATION_FIELDS = [
  'firstName',
  'lastName',
  'idNumber',
  'gender',
  'dateOfBirth',
  'mailingAddress',
  'contactEmail',
  'mobilePhone',
  'fatherName',
  'motherName',
  'maritalStatus',
  'militaryService',
  'academicInstitutionName',
  'yearOfStudy',
  'fieldOfStudy',
  'weeklyStudyHours',
  'volunteeringLocationFirstOption',
  'personalExplanationLetter',
];
