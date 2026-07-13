import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const PASSWORD_AES_KEY = process.env.PASSWORD_AES_KEY;

const defaultOptions = {
  gender: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ],
  maritalStatus: [
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
  ],
  spouseStatus: [
    { value: 'employed', label: 'Employed' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'student', label: 'Student' },
    { value: 'other', label: 'Other' },
  ],
  militaryService: [
    { value: 'idf', label: 'IDF' },
    { value: 'national_service', label: 'National service' },
    { value: 'volunteer_service', label: 'Volunteer service' },
    { value: 'exempt', label: 'Exempt' },
    { value: 'other', label: 'Other' },
  ],
  academicInstitutionName: [
    { value: 'hebrew_university', label: 'Hebrew University' },
    { value: 'tel_aviv_university', label: 'Tel Aviv University' },
    { value: 'technion', label: 'Technion' },
    { value: 'ben_gurion', label: 'Ben-Gurion University' },
    { value: 'bar_ilan', label: 'Bar-Ilan University' },
    { value: 'haifa_university', label: 'University of Haifa' },
    { value: 'open_university', label: 'Open University' },
    { value: 'other', label: 'Other' },
  ],
  yearOfStudy: [
    { value: '1', label: 'Year 1' },
    { value: '2', label: 'Year 2' },
    { value: '3', label: 'Year 3' },
    { value: '4', label: 'Year 4' },
    { value: '5_plus', label: 'Year 5+' },
    { value: 'graduate', label: 'Graduate studies' },
  ],
  fieldOfStudy: [
    { value: 'computer_science', label: 'Computer Science' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'medicine', label: 'Medicine' },
    { value: 'law', label: 'Law' },
    { value: 'business', label: 'Business / Economics' },
    { value: 'education', label: 'Education' },
    { value: 'social_sciences', label: 'Social Sciences' },
    { value: 'humanities', label: 'Humanities' },
    { value: 'natural_sciences', label: 'Natural Sciences' },
    { value: 'other', label: 'Other' },
  ],
};

const demoUsers = [
  { email: 'adm@gmail.com', name: 'Demo Admin', role: 'ADMIN', formsCompleted: false },
  { email: 'sup@gmail.com', name: 'Demo Supervisor', role: 'SUPERVISOR', formsCompleted: false },
  { email: 'stu1@gmail.com', name: 'Demo Student One', role: 'STUDENT', formsCompleted: true },
  { email: 'stu2@gmail.com', name: 'Demo Student Two', role: 'STUDENT', formsCompleted: true },
];

const DEMO_PASSWORD = '123456';

async function encryptPassword(plainPassword) {
  const rows = await prisma.$queryRaw`
    SELECT TO_BASE64(AES_ENCRYPT(${String(plainPassword)}, ${PASSWORD_AES_KEY})) AS encrypted
  `;
  return rows[0]?.encrypted;
}

async function upsertDemoUser(account) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } });
  const password = await encryptPassword(DEMO_PASSWORD);

  if (existing) {
    return prisma.user.update({
      where: { email: account.email },
      data: {
        name: account.name,
        role: account.role,
        password,
        formsCompleted: account.formsCompleted,
      },
    });
  }

  return prisma.user.create({
    data: {
      name: account.name,
      email: account.email,
      role: account.role,
      password,
      formsCompleted: account.formsCompleted,
    },
  });
}

async function seedDemoWorkflow(usersByEmail) {
  const supervisor = usersByEmail.get('sup@gmail.com');
  const student1 = usersByEmail.get('stu1@gmail.com');
  const student2 = usersByEmail.get('stu2@gmail.com');

  let placement = await prisma.placement.findFirst({
    where: { name: 'Community Library', supervisorId: supervisor.id },
  });

  if (!placement) {
    placement = await prisma.placement.create({
      data: {
        name: 'Community Library',
        description: 'Help with after-school reading programs.',
        supervisorId: supervisor.id,
      },
    });
  }

  for (const student of [student1, student2]) {
    const activeMembership = await prisma.placementMembership.findFirst({
      where: { studentId: student.id, active: true },
    });

    if (!activeMembership) {
      await prisma.placementMembership.create({
        data: {
          studentId: student.id,
          placementId: placement.id,
          active: true,
        },
      });
    }

    const existingJoin = await prisma.joinRequest.findFirst({
      where: { studentId: student.id, placementId: placement.id, status: 'APPROVED' },
    });

    if (!existingJoin) {
      await prisma.joinRequest.create({
        data: {
          studentId: student.id,
          placementId: placement.id,
          status: 'APPROVED',
          note: 'Seeded demo membership.',
          reviewedById: supervisor.id,
          reviewedAt: new Date(),
        },
      });
    }
  }

  const pendingJoin = await prisma.joinRequest.findFirst({
    where: { studentId: student1.id, placementId: placement.id, status: 'PENDING' },
  });

  if (!pendingJoin) {
    await prisma.joinRequest.create({
      data: {
        studentId: student1.id,
        placementId: placement.id,
        status: 'PENDING',
        note: 'Requesting schedule change.',
      },
    });
  }

  const approvedHours = await prisma.hourLog.findFirst({
    where: { studentId: student1.id, placementId: placement.id, status: 'APPROVED' },
  });

  if (!approvedHours) {
    await prisma.hourLog.create({
      data: {
        studentId: student1.id,
        placementId: placement.id,
        date: new Date('2026-01-12'),
        hours: 3.5,
        description: 'Reading circle with grade 3.',
        status: 'APPROVED',
        reviewedById: supervisor.id,
        reviewedAt: new Date('2026-01-13'),
      },
    });
  }

  const pendingHoursStu2 = await prisma.hourLog.findFirst({
    where: { studentId: student2.id, placementId: placement.id, status: 'PENDING' },
  });

  if (!pendingHoursStu2) {
    await prisma.hourLog.create({
      data: {
        studentId: student2.id,
        placementId: placement.id,
        date: new Date('2026-01-14'),
        hours: 2,
        description: 'Shelving and catalog updates.',
        status: 'PENDING',
      },
    });
  }

  const pendingHoursStu1 = await prisma.hourLog.findFirst({
    where: {
      studentId: student1.id,
      placementId: placement.id,
      status: 'PENDING',
      description: 'Weekend literacy workshop.',
    },
  });

  if (!pendingHoursStu1) {
    await prisma.hourLog.create({
      data: {
        studentId: student1.id,
        placementId: placement.id,
        date: new Date('2026-01-16'),
        hours: 4,
        description: 'Weekend literacy workshop.',
        status: 'PENDING',
      },
    });
  }
}

async function main() {
  for (const [fieldKey, options] of Object.entries(defaultOptions)) {
    for (const [index, option] of options.entries()) {
      await prisma.formOption.upsert({
        where: {
          fieldKey_value: {
            fieldKey,
            value: option.value,
          },
        },
        update: {
          label: option.label,
          sortOrder: index,
          active: true,
        },
        create: {
          fieldKey,
          value: option.value,
          label: option.label,
          sortOrder: index,
          active: true,
        },
      });
    }
  }

  console.log('Form options seeded.');

  if (!PASSWORD_AES_KEY) {
    console.warn('PASSWORD_AES_KEY missing — skipping demo user seed.');
    return;
  }

  const usersByEmail = new Map();
  for (const account of demoUsers) {
    const user = await upsertDemoUser(account);
    usersByEmail.set(user.email, user);
  }

  await seedDemoWorkflow(usersByEmail);
  console.log('Demo users and sample workflow seeded (adm/sup/stu1/stu2@gmail.com, password 123456).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
