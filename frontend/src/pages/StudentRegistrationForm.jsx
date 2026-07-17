import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRequest, apiUpload } from '../api';
import { useAuth } from '../auth';
import Layout from '../components/Layout';

const emptyForm = {
  firstName: '',
  lastName: '',
  idNumber: '',
  gender: '',
  dateOfBirth: '',
  mailingAddress: '',
  additionalAddress: '',
  contactEmail: '',
  mobilePhone: '',
  additionalPhone: '',
  fatherName: '',
  motherName: '',
  spouseName: '',
  maritalStatus: '',
  numberOfChildren: '0',
  spouseStatus: '',
  preMilitaryAcademyYear: false,
  militaryService: '',
  loneSoldierStatus: false,
  academicInstitutionName: '',
  yearOfStudy: '',
  fieldOfStudy: '',
  weeklyStudyHours: '',
  previousCouncilScholarship: false,
  volunteeringLocationFirstOption: '',
  firstOptionSubChoice: '',
  volunteeringLocationSecondOption: '',
  thirdOptionSubChoice: '',
  volunteeringLocationThirdOption: '',
  secondOptionSubChoice: '',
  personalExplanationLetter: '',
};

const fileSlots = [
  { type: 'CV', mandatory: true },
  { type: 'PERSONAL_LETTER', mandatory: true },
  { type: 'STUDENT_ID_COPY', mandatory: true },
  { type: 'PARENT_ID_COPY', mandatory: true },
  { type: 'ENROLLMENT_CERTIFICATE', mandatory: false },
  { type: 'CLASS_SCHEDULE', mandatory: false },
  { type: 'SERVICE_CERTIFICATE', mandatory: false },
  { type: 'PRE_MILITARY_CERTIFICATE', mandatory: false },
  { type: 'BANK_CONFIRMATION', mandatory: true },
];

function registrationToForm(registration, user) {
  if (!registration) {
    return {
      ...emptyForm,
      contactEmail: user?.email || '',
      mobilePhone: user?.phone || '',
      firstName: user?.name?.split(' ')?.[0] || '',
      lastName: user?.name?.split(' ')?.slice(1).join(' ') || '',
    };
  }

  return {
    firstName: registration.firstName || '',
    lastName: registration.lastName || '',
    idNumber: registration.idNumber || '',
    gender: registration.gender || '',
    dateOfBirth: registration.dateOfBirth ? String(registration.dateOfBirth).slice(0, 10) : '',
    mailingAddress: registration.mailingAddress || '',
    additionalAddress: registration.additionalAddress || '',
    contactEmail: registration.contactEmail || user?.email || '',
    mobilePhone: registration.mobilePhone || user?.phone || '',
    additionalPhone: registration.additionalPhone || '',
    fatherName: registration.fatherName || '',
    motherName: registration.motherName || '',
    spouseName: registration.spouseName || '',
    maritalStatus: registration.maritalStatus || '',
    numberOfChildren: String(registration.numberOfChildren ?? 0),
    spouseStatus: registration.spouseStatus || '',
    preMilitaryAcademyYear: Boolean(registration.preMilitaryAcademyYear),
    militaryService: registration.militaryService || '',
    loneSoldierStatus: Boolean(registration.loneSoldierStatus),
    academicInstitutionName: registration.academicInstitutionName || '',
    yearOfStudy: registration.yearOfStudy || '',
    fieldOfStudy: registration.fieldOfStudy || '',
    weeklyStudyHours: registration.weeklyStudyHours ? String(registration.weeklyStudyHours) : '',
    previousCouncilScholarship: Boolean(registration.previousCouncilScholarship),
    volunteeringLocationFirstOption: registration.volunteeringLocationFirstOption || '',
    firstOptionSubChoice: registration.firstOptionSubChoice || '',
    volunteeringLocationSecondOption: registration.volunteeringLocationSecondOption || '',
    thirdOptionSubChoice: registration.thirdOptionSubChoice || '',
    volunteeringLocationThirdOption: registration.volunteeringLocationThirdOption || '',
    secondOptionSubChoice: registration.secondOptionSubChoice || '',
    personalExplanationLetter: registration.personalExplanationLetter || '',
  };
}

export default function StudentRegistrationForm() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState(() => registrationToForm(null, user));
  const [options, setOptions] = useState([]);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState('');

  const optionsByField = useMemo(() => {
    const grouped = {};

    for (const option of options.filter((item) => item.active)) {
      if (!grouped[option.fieldKey]) {
        grouped[option.fieldKey] = [];
      }

      grouped[option.fieldKey].push(option);
    }

    return grouped;
  }, [options]);

  const filesByType = useMemo(() => {
    const map = {};
    for (const file of files) {
      map[file.fileType] = file;
    }
    return map;
  }, [files]);

  async function loadData() {
    setLoading(true);

    try {
      const [nextOptions, registration] = await Promise.all([
        apiRequest('/form-options'),
        apiRequest('/student/registration'),
      ]);

      setOptions(nextOptions);
      setForm(registrationToForm(registration, user));
      setFiles(registration?.files || []);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user.id]);

  if (user.formsCompleted) {
    return <Navigate to="/student" replace />;
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function saveForm(event, { silent = false } = {}) {
    event?.preventDefault();
    setSaving(true);
    if (!silent) {
      setMessage('');
    }

    try {
      const saved = await apiRequest('/student/registration', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          numberOfChildren: Number(form.numberOfChildren) || 0,
          weeklyStudyHours: Number(form.weeklyStudyHours) || 0,
        }),
      });
      setForm(registrationToForm(saved, user));
      setFiles(saved?.files || []);
      if (!silent) {
        setMessage(t('registration.draftSaved'));
      }
      return saved;
    } catch (error) {
      setMessage(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(fileType, file) {
    if (!file) {
      return;
    }

    setUploadingType(fileType);
    setMessage('');

    try {
      await saveForm(undefined, { silent: true });
      const body = new FormData();
      body.append('file', file);
      const uploaded = await apiUpload(`/student/registration/files/${fileType}`, body);
      setFiles((prev) => {
        const next = prev.filter((item) => item.fileType !== fileType);
        return [...next, uploaded];
      });
      setMessage(t('registration.fileUploaded', { name: file.name }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploadingType('');
    }
  }

  async function submitRegistration() {
    setSubmitting(true);
    setMessage('');

    try {
      await saveForm(undefined, { silent: true });
      await apiRequest('/student/registration/submit', { method: 'POST' });
      await refreshUser();
      navigate('/student', { replace: true });
    } catch (error) {
      const missingFields = error.details?.missingFields || [];
      const missingFiles = error.details?.missingFiles || [];
      const details = [
        missingFields.length ? t('registration.missingFields', { fields: missingFields.join(', ') }) : null,
        missingFiles.length ? t('registration.missingFiles', { files: missingFiles.join(', ') }) : null,
      ].filter(Boolean).join(' ');
      setMessage(details || error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function SelectField({ name, label, required = false }) {
    return (
      <label className="form-field">
        <span>{label}{required ? ' *' : ''}</span>
        <select
          value={form[name]}
          onChange={(event) => setField(name, event.target.value)}
          required={required}
        >
          <option value="">{t('common.select')}</option>
          {(optionsByField[name] || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function BooleanField({ name, label }) {
    return (
      <label className="form-field">
        <span>{label} *</span>
        <select
          value={form[name] ? 'true' : 'false'}
          onChange={(event) => setField(name, event.target.value === 'true')}
        >
          <option value="false">{t('common.no')}</option>
          <option value="true">{t('common.yes')}</option>
        </select>
      </label>
    );
  }

  return (
    <Layout
      title={t('registration.title')}
      subtitle={t('registration.subtitle')}
    >
      {message ? <p className="status">{message}</p> : null}
      {loading ? <p className="muted">{t('registration.loadingForm')}</p> : null}

      <form className="panel registration-form" onSubmit={saveForm} noValidate>
        <h2>{t('registration.personalDetails')}</h2>

        <label className="form-field">
          <span>{t('registration.firstName')} *</span>
          <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.lastName')} *</span>
          <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.idNumber')} *</span>
          <input value={form.idNumber} onChange={(event) => setField('idNumber', event.target.value)} required />
        </label>
        <SelectField name="gender" label={t('registration.gender')} required />
        <label className="form-field">
          <span>{t('registration.dateOfBirth')} *</span>
          <input type="date" value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.mailingAddress')} *</span>
          <input value={form.mailingAddress} onChange={(event) => setField('mailingAddress', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.additionalAddress')}</span>
          <input value={form.additionalAddress} onChange={(event) => setField('additionalAddress', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.email')} *</span>
          <input type="email" value={form.contactEmail} onChange={(event) => setField('contactEmail', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.mobilePhone')} *</span>
          <input type="tel" value={form.mobilePhone} onChange={(event) => setField('mobilePhone', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.additionalPhone')}</span>
          <input type="tel" value={form.additionalPhone} onChange={(event) => setField('additionalPhone', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.fatherName')} *</span>
          <input value={form.fatherName} onChange={(event) => setField('fatherName', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.motherName')} *</span>
          <input value={form.motherName} onChange={(event) => setField('motherName', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.spouseName')}</span>
          <input value={form.spouseName} onChange={(event) => setField('spouseName', event.target.value)} />
        </label>
        <SelectField name="maritalStatus" label={t('registration.maritalStatus')} required />
        <label className="form-field">
          <span>{t('registration.numberOfChildren')} *</span>
          <input type="number" min="0" step="1" value={form.numberOfChildren} onChange={(event) => setField('numberOfChildren', event.target.value)} required />
        </label>
        <SelectField name="spouseStatus" label={t('registration.spouseStatus')} />
        <BooleanField name="preMilitaryAcademyYear" label={t('registration.preMilitaryYear')} />
        <SelectField name="militaryService" label={t('registration.militaryService')} required />
        <BooleanField name="loneSoldierStatus" label={t('registration.loneSoldier')} />
        <SelectField name="academicInstitutionName" label={t('registration.academicInstitution')} required />
        <SelectField name="yearOfStudy" label={t('registration.yearOfStudy')} required />
        <SelectField name="fieldOfStudy" label={t('registration.fieldOfStudy')} required />
        <label className="form-field">
          <span>{t('registration.weeklyStudyHours')} *</span>
          <input type="number" min="1" step="1" value={form.weeklyStudyHours} onChange={(event) => setField('weeklyStudyHours', event.target.value)} required />
        </label>
        <BooleanField name="previousCouncilScholarship" label={t('registration.previousScholarship')} />
        <label className="form-field">
          <span>{t('registration.volunteeringFirst')} *</span>
          <input value={form.volunteeringLocationFirstOption} onChange={(event) => setField('volunteeringLocationFirstOption', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>{t('registration.firstSub')}</span>
          <input value={form.firstOptionSubChoice} onChange={(event) => setField('firstOptionSubChoice', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.volunteeringSecond')}</span>
          <input value={form.volunteeringLocationSecondOption} onChange={(event) => setField('volunteeringLocationSecondOption', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.thirdSub')}</span>
          <input value={form.thirdOptionSubChoice} onChange={(event) => setField('thirdOptionSubChoice', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.volunteeringThird')}</span>
          <input value={form.volunteeringLocationThirdOption} onChange={(event) => setField('volunteeringLocationThirdOption', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.secondSub')}</span>
          <input value={form.secondOptionSubChoice} onChange={(event) => setField('secondOptionSubChoice', event.target.value)} />
        </label>
        <label className="form-field">
          <span>{t('registration.personalLetter')} *</span>
          <textarea
            value={form.personalExplanationLetter}
            onChange={(event) => setField('personalExplanationLetter', event.target.value)}
          />
        </label>

        <div className="actions form-actions">
          <button type="submit" className="secondary" disabled={saving || submitting}>
            {saving ? t('registration.saving') : t('registration.saveDraft')}
          </button>
        </div>
      </form>

      <section className="panel registration-files">
        <h2>{t('registration.requiredDocs')}</h2>
        <p className="muted">{t('registration.uploadHelp')}</p>

        <div className="file-slot-list">
          {fileSlots.map((slot) => {
            const current = filesByType[slot.type];

            return (
              <article className="file-slot" key={slot.type}>
                <div>
                  <strong>{t(`registration.files.${slot.type}`)}</strong>
                  <span className="muted">
                    {slot.mandatory ? t('registration.mandatory') : t('registration.optional')}
                  </span>
                  <p className="muted">
                    {current
                      ? t('registration.uploadedFile', { name: current.fileName })
                      : t('registration.notUploaded')}
                  </p>
                </div>
                <label className="file-upload-button">
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      uploadFile(slot.type, file);
                      event.target.value = '';
                    }}
                    disabled={Boolean(uploadingType)}
                  />
                  <span className="button-like secondary">
                    {uploadingType === slot.type
                      ? t('registration.uploading')
                      : current
                        ? t('registration.replaceFile')
                        : t('registration.uploadFile')}
                  </span>
                </label>
              </article>
            );
          })}
        </div>

        <div className="actions form-actions">
          <button type="button" onClick={submitRegistration} disabled={saving || submitting || loading}>
            {submitting ? t('registration.submitting') : t('registration.submitRegistration')}
          </button>
        </div>
      </section>
    </Layout>
  );
}
