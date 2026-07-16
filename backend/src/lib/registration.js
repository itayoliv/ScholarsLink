import { REQUIRED_REGISTRATION_FIELDS } from '../config/constants.js';

export function parseRegistrationBody(body = {}) {
  return {
    firstName: body.firstName ?? '',
    lastName: body.lastName ?? '',
    idNumber: body.idNumber ?? '',
    gender: body.gender ?? '',
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
    mailingAddress: body.mailingAddress ?? '',
    additionalAddress: body.additionalAddress || null,
    contactEmail: body.contactEmail ?? '',
    mobilePhone: body.mobilePhone ?? '',
    additionalPhone: body.additionalPhone || null,
    fatherName: body.fatherName ?? '',
    motherName: body.motherName ?? '',
    spouseName: body.spouseName || null,
    maritalStatus: body.maritalStatus ?? '',
    numberOfChildren: Number(body.numberOfChildren ?? 0),
    spouseStatus: body.spouseStatus || null,
    preMilitaryAcademyYear: Boolean(body.preMilitaryAcademyYear),
    militaryService: body.militaryService ?? '',
    loneSoldierStatus: Boolean(body.loneSoldierStatus),
    academicInstitutionName: body.academicInstitutionName ?? '',
    yearOfStudy: body.yearOfStudy ?? '',
    fieldOfStudy: body.fieldOfStudy ?? '',
    weeklyStudyHours: Number(body.weeklyStudyHours ?? 0),
    previousCouncilScholarship: Boolean(body.previousCouncilScholarship),
    volunteeringLocationFirstOption: body.volunteeringLocationFirstOption ?? '',
    firstOptionSubChoice: body.firstOptionSubChoice || null,
    volunteeringLocationSecondOption: body.volunteeringLocationSecondOption || null,
    thirdOptionSubChoice: body.thirdOptionSubChoice || null,
    volunteeringLocationThirdOption: body.volunteeringLocationThirdOption || null,
    secondOptionSubChoice: body.secondOptionSubChoice || null,
    personalExplanationLetter: body.personalExplanationLetter || null,
  };
}

export function missingRegistrationFields(registration) {
  const missing = [];

  for (const field of REQUIRED_REGISTRATION_FIELDS) {
    const value = registration?.[field];

    if (value === null || value === undefined || value === '') {
      missing.push(field);
      continue;
    }

    if (field === 'weeklyStudyHours' && Number(value) <= 0) {
      missing.push(field);
    }
  }

  return missing;
}

export function serializeRegistration(registration) {
  if (!registration) {
    return null;
  }

  const { files = [], ...fields } = registration;

  return {
    ...fields,
    files: files.map((file) => ({
      fileType: file.fileType,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt,
    })),
  };
}
