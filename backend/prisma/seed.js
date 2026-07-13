import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
