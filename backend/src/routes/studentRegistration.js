import { Router } from 'express';
import {
  MANDATORY_REGISTRATION_FILES,
  REGISTRATION_FILE_TYPES,
} from '../config/constants.js';
import { parseId } from '../lib/parse.js';
import {
  missingRegistrationFields,
  parseRegistrationBody,
  serializeRegistration,
} from '../lib/registration.js';
import { stripPassword } from '../lib/sanitize.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getUserFromSession,
  requireStudent,
} from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { prisma } from '../prisma.js';
import { demoUnavailable, isDemoMode } from '../state.js';

const router = Router();

router.get('/registration', asyncHandler(async (req, res) => {
  const student = await requireStudent(req);

  if (isDemoMode()) {
    return res.json({
      studentId: student.id,
      firstName: '',
      lastName: '',
      idNumber: '',
      gender: '',
      dateOfBirth: null,
      mailingAddress: '',
      contactEmail: student.email,
      mobilePhone: '',
      fatherName: '',
      motherName: '',
      maritalStatus: '',
      militaryService: '',
      academicInstitutionName: '',
      yearOfStudy: '',
      fieldOfStudy: '',
      weeklyStudyHours: 0,
      volunteeringLocationFirstOption: '',
      personalExplanationLetter: null,
      files: [],
    });
  }
  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
    include: {
      files: {
        select: {
          fileType: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
    },
  });

  res.json(serializeRegistration(registration));
}));

router.put('/registration', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Saving registration');
  }

  const student = await requireStudent(req);
  const data = parseRegistrationBody(req.body);

  if (data.dateOfBirth && Number.isNaN(data.dateOfBirth.getTime())) {
    return res.status(400).json({ error: 'dateOfBirth must be a valid date.' });
  }

  if (!Number.isInteger(data.numberOfChildren) || data.numberOfChildren < 0) {
    return res.status(400).json({ error: 'numberOfChildren must be a non-negative integer.' });
  }

  if (!Number.isFinite(data.weeklyStudyHours) || data.weeklyStudyHours < 0) {
    return res.status(400).json({ error: 'weeklyStudyHours must be a non-negative number.' });
  }

  const registration = await prisma.studentRegistration.upsert({
    where: { studentId: student.id },
    create: { studentId: student.id, ...data },
    update: data,
    include: {
      files: {
        select: {
          fileType: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
    },
  });

  res.json(serializeRegistration(registration));
}));

router.post('/registration/files/:fileType', upload.single('file'), asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Registration file uploads');
  }

  const student = await requireStudent(req);
  const fileType = String(req.params.fileType || '').toUpperCase();

  if (!REGISTRATION_FILE_TYPES.has(fileType)) {
    return res.status(400).json({ error: 'Invalid file type.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'A file is required.' });
  }

  let registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
  });

  if (!registration) {
    registration = await prisma.studentRegistration.create({
      data: { studentId: student.id },
    });
  }

  const saved = await prisma.registrationFile.upsert({
    where: {
      registrationId_fileType: {
        registrationId: registration.id,
        fileType,
      },
    },
    create: {
      registrationId: registration.id,
      fileType,
      fileName: req.file.originalname || `${fileType}.bin`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      data: req.file.buffer,
    },
    update: {
      fileName: req.file.originalname || `${fileType}.bin`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      data: req.file.buffer,
      uploadedAt: new Date(),
    },
    select: {
      fileType: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
    },
  });

  res.status(201).json(saved);
}));

router.get('/registration/files/:fileType', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Registration file downloads');
  }

  const user = await getUserFromSession(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const fileType = String(req.params.fileType || '').toUpperCase();

  if (!REGISTRATION_FILE_TYPES.has(fileType)) {
    return res.status(400).json({ error: 'Invalid file type.' });
  }

  let studentId = user.id;

  if (user.role === 'ADMIN' && req.query.studentId) {
    studentId = parseId(req.query.studentId, 'studentId');
  } else if (user.role !== 'STUDENT' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  } else if (user.role === 'ADMIN' && !req.query.studentId) {
    return res.status(400).json({ error: 'studentId is required for admin downloads.' });
  }

  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId },
  });

  if (!registration) {
    return res.status(404).json({ error: 'Registration not found.' });
  }

  const file = await prisma.registrationFile.findUnique({
    where: {
      registrationId_fileType: {
        registrationId: registration.id,
        fileType,
      },
    },
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
  res.setHeader('Content-Length', String(file.fileSize));
  res.send(Buffer.from(file.data));
}));

router.post('/registration/submit', asyncHandler(async (req, res) => {
  if (isDemoMode()) {
    throw demoUnavailable('Submitting registration');
  }

  const student = await requireStudent(req);
  const registration = await prisma.studentRegistration.findUnique({
    where: { studentId: student.id },
    include: { files: true },
  });

  if (!registration) {
    return res.status(400).json({ error: 'Save the registration form before submitting.' });
  }

  const missingFields = missingRegistrationFields(registration);
  const uploadedTypes = new Set(registration.files.map((file) => file.fileType));
  const missingFiles = MANDATORY_REGISTRATION_FILES.filter((type) => !uploadedTypes.has(type));

  if (missingFields.length > 0 || missingFiles.length > 0) {
    return res.status(400).json({
      error: 'Registration is incomplete.',
      missingFields,
      missingFiles,
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: student.id },
    data: { formsCompleted: true },
  });

  res.json(stripPassword(updatedUser));
}));

export default router;
