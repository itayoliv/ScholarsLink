/** In-memory demo data used when MySQL is unreachable. */

export const DEMO_PASSWORD = '123456';

const now = new Date('2026-01-15T10:00:00.000Z');
const day = (offset) => new Date(Date.UTC(2026, 0, 10 + offset, 12, 0, 0));

function clone(value) {
  return structuredClone(value);
}

function publicUser(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return clone(rest);
}

function attachRelations() {
  // Reset relations attached by previous calls; otherwise each call nests the
  // prior call's attachments one level deeper and data grows exponentially.
  for (const placement of state.placements) {
    delete placement.supervisor;
    delete placement.memberships;
  }
  for (const join of state.joinRequests) {
    delete join.student;
    delete join.placement;
    delete join.reviewedBy;
  }
  for (const log of state.hourLogs) {
    delete log.student;
    delete log.placement;
    delete log.reviewedBy;
  }
  for (const membership of state.memberships) {
    delete membership.student;
    delete membership.placement;
  }

  const usersById = new Map(state.users.map((u) => [u.id, u]));
  const placementsById = new Map(state.placements.map((p) => [p.id, p]));

  for (const placement of state.placements) {
    placement.supervisor = publicUser(usersById.get(placement.supervisorId));
    placement.memberships = state.memberships
      .filter((m) => m.placementId === placement.id && m.active)
      .map((m) => ({
        ...clone(m),
        student: publicUser(usersById.get(m.studentId)),
      }));
  }

  for (const join of state.joinRequests) {
    join.student = publicUser(usersById.get(join.studentId));
    const placement = placementsById.get(join.placementId);
    join.placement = placement
      ? {
          ...clone(placement),
          supervisor: publicUser(usersById.get(placement.supervisorId)),
          memberships: placement.memberships,
        }
      : null;
    join.reviewedBy = join.reviewedById ? publicUser(usersById.get(join.reviewedById)) : null;
  }

  for (const log of state.hourLogs) {
    log.student = publicUser(usersById.get(log.studentId));
    const placement = placementsById.get(log.placementId);
    log.placement = placement
      ? {
          ...clone(placement),
          supervisor: publicUser(usersById.get(placement.supervisorId)),
          memberships: placement.memberships,
        }
      : null;
    log.reviewedBy = log.reviewedById ? publicUser(usersById.get(log.reviewedById)) : null;
  }

  for (const membership of state.memberships) {
    membership.student = publicUser(usersById.get(membership.studentId));
    const placement = placementsById.get(membership.placementId);
    membership.placement = placement
      ? {
          ...clone(placement),
          supervisor: publicUser(usersById.get(placement.supervisorId)),
        }
      : null;
  }
}

function createInitialState() {
  const users = [
    {
      id: 1,
      name: 'Demo Admin',
      email: 'adm@gmail.com',
      role: 'ADMIN',
      password: DEMO_PASSWORD,
      phone: null,
      formsCompleted: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      name: 'Demo Supervisor',
      email: 'sup@gmail.com',
      role: 'SUPERVISOR',
      password: DEMO_PASSWORD,
      phone: null,
      formsCompleted: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      name: 'Demo Student One',
      email: 'stu1@gmail.com',
      role: 'STUDENT',
      password: DEMO_PASSWORD,
      phone: null,
      formsCompleted: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      name: 'Demo Student Two',
      email: 'stu2@gmail.com',
      role: 'STUDENT',
      password: DEMO_PASSWORD,
      phone: null,
      formsCompleted: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const placements = [
    {
      id: 1,
      name: 'Community Library',
      description: 'Help with after-school reading programs.',
      supervisorId: 2,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const memberships = [
    {
      id: 1,
      studentId: 3,
      placementId: 1,
      active: true,
      startedAt: day(0),
      endedAt: null,
    },
    {
      id: 2,
      studentId: 4,
      placementId: 1,
      active: true,
      startedAt: day(1),
      endedAt: null,
    },
  ];

  const joinRequests = [
    {
      id: 1,
      studentId: 3,
      placementId: 1,
      status: 'APPROVED',
      note: 'Looking forward to helping.',
      reviewedById: 2,
      reviewedAt: day(0),
      createdAt: day(-2),
      updatedAt: day(0),
    },
    {
      id: 2,
      studentId: 4,
      placementId: 1,
      status: 'APPROVED',
      note: 'Available weekdays.',
      reviewedById: 2,
      reviewedAt: day(1),
      createdAt: day(-1),
      updatedAt: day(1),
    },
    {
      id: 3,
      studentId: 3,
      placementId: 1,
      status: 'PENDING',
      note: 'Requesting schedule change.',
      reviewedById: null,
      reviewedAt: null,
      createdAt: day(5),
      updatedAt: day(5),
    },
  ];

  const hourLogs = [
    {
      id: 1,
      studentId: 3,
      placementId: 1,
      date: day(2),
      hours: 3.5,
      description: 'Reading circle with grade 3.',
      status: 'APPROVED',
      reviewedById: 2,
      reviewedAt: day(3),
      createdAt: day(2),
      updatedAt: day(3),
    },
    {
      id: 2,
      studentId: 4,
      placementId: 1,
      date: day(4),
      hours: 2,
      description: 'Shelving and catalog updates.',
      status: 'PENDING',
      reviewedById: null,
      reviewedAt: null,
      createdAt: day(4),
      updatedAt: day(4),
    },
    {
      id: 3,
      studentId: 3,
      placementId: 1,
      date: day(6),
      hours: 4,
      description: 'Weekend literacy workshop.',
      status: 'PENDING',
      reviewedById: null,
      reviewedAt: null,
      createdAt: day(6),
      updatedAt: day(6),
    },
  ];

  let optionId = 1;
  const formOptions = [];
  const optionSeed = {
    gender: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
    ],
    maritalStatus: [
      { value: 'single', label: 'Single' },
      { value: 'married', label: 'Married' },
    ],
    spouseStatus: [
      { value: 'employed', label: 'Employed' },
      { value: 'student', label: 'Student' },
    ],
    militaryService: [
      { value: 'idf', label: 'IDF' },
      { value: 'exempt', label: 'Exempt' },
    ],
    academicInstitutionName: [
      { value: 'tel_aviv_university', label: 'Tel Aviv University' },
      { value: 'technion', label: 'Technion' },
    ],
    yearOfStudy: [
      { value: '1', label: 'Year 1' },
      { value: '2', label: 'Year 2' },
      { value: '3', label: 'Year 3' },
    ],
    fieldOfStudy: [
      { value: 'computer_science', label: 'Computer Science' },
      { value: 'law', label: 'Law' },
      { value: 'other', label: 'Other' },
    ],
  };

  for (const [fieldKey, options] of Object.entries(optionSeed)) {
    options.forEach((option, index) => {
      formOptions.push({
        id: optionId++,
        fieldKey,
        value: option.value,
        label: option.label,
        sortOrder: index,
        active: true,
      });
    });
  }

  return {
    users,
    placements,
    memberships,
    joinRequests,
    hourLogs,
    formOptions,
    nextIds: {
      users: 5,
      placements: 2,
      memberships: 3,
      joinRequests: 4,
      hourLogs: 4,
      formOptions: optionId,
    },
  };
}

const state = createInitialState();
attachRelations();

export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'adm@gmail.com', password: DEMO_PASSWORD },
  { role: 'SUPERVISOR', email: 'sup@gmail.com', password: DEMO_PASSWORD },
  { role: 'STUDENT', email: 'stu1@gmail.com', password: DEMO_PASSWORD },
  { role: 'STUDENT', email: 'stu2@gmail.com', password: DEMO_PASSWORD },
];

export function findUserByEmail(email) {
  return state.users.find((user) => user.email === String(email)) || null;
}

export function findUserById(id) {
  return state.users.find((user) => user.id === Number(id)) || null;
}

export function passwordMatchesDemo(plainPassword, user) {
  return user && String(plainPassword) === String(user.password);
}

export function createUser({ name, email, password, role, phone = null }) {
  const user = {
    id: state.nextIds.users++,
    name,
    email,
    password: String(password),
    role,
    phone,
    formsCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.users.push(user);
  attachRelations();
  return clone(user);
}

export function listUsers({ role } = {}) {
  let users = state.users;
  if (role) {
    users = users.filter((user) => user.role === role);
  }
  return users
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicUser);
}

export function listPlacements({ supervisorId } = {}) {
  attachRelations();
  let placements = state.placements.map((p) => clone(p));
  if (supervisorId) {
    const id = Number(supervisorId);
    placements = placements.filter((p) => p.supervisorId === id);
  }
  return placements.sort((a, b) => a.name.localeCompare(b.name));
}

export function createPlacement({ name, description, supervisorId }) {
  const placement = {
    id: state.nextIds.placements++,
    name,
    description: description || null,
    supervisorId: Number(supervisorId),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.placements.push(placement);
  attachRelations();
  return listPlacements().find((p) => p.id === placement.id);
}

export function listJoinRequests({ status, supervisorId, studentId } = {}) {
  attachRelations();
  let rows = state.joinRequests.map((row) => clone(row));
  if (status) rows = rows.filter((row) => row.status === status);
  if (studentId) rows = rows.filter((row) => row.studentId === Number(studentId));
  if (supervisorId) {
    const id = Number(supervisorId);
    rows = rows.filter((row) => row.placement?.supervisorId === id);
  }
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createJoinRequest({ studentId, placementId, note }) {
  const joinRequest = {
    id: state.nextIds.joinRequests++,
    studentId: Number(studentId),
    placementId: Number(placementId),
    status: 'PENDING',
    note: note || null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.joinRequests.push(joinRequest);
  attachRelations();
  return listJoinRequests().find((row) => row.id === joinRequest.id);
}

function activateMembership(studentId, placementId) {
  for (const membership of state.memberships) {
    if (membership.studentId === studentId && membership.active) {
      membership.active = false;
      membership.endedAt = new Date();
    }
  }
  state.memberships.push({
    id: state.nextIds.memberships++,
    studentId,
    placementId,
    active: true,
    startedAt: new Date(),
    endedAt: null,
  });
}

export function patchJoinRequest(id, { status, reviewerId }) {
  const request = state.joinRequests.find((row) => row.id === Number(id));
  if (!request) {
    const error = new Error('Join request not found.');
    error.status = 404;
    throw error;
  }

  request.status = status;
  request.reviewedById = Number(reviewerId);
  request.reviewedAt = new Date();
  request.updatedAt = new Date();

  if (status === 'APPROVED') {
    activateMembership(request.studentId, request.placementId);
  }

  attachRelations();
  return listJoinRequests().find((row) => row.id === request.id);
}

export function listHourLogs({ status, supervisorId, studentId } = {}) {
  attachRelations();
  let rows = state.hourLogs.map((row) => clone(row));
  if (status) rows = rows.filter((row) => row.status === status);
  if (studentId) rows = rows.filter((row) => row.studentId === Number(studentId));
  if (supervisorId) {
    const id = Number(supervisorId);
    rows = rows.filter((row) => row.placement?.supervisorId === id);
  }
  return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function createHourLog({ studentId, placementId, date, hours, description }) {
  const hourLog = {
    id: state.nextIds.hourLogs++,
    studentId: Number(studentId),
    placementId: Number(placementId),
    date: new Date(date),
    hours: Number(hours),
    description: description || null,
    status: 'PENDING',
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.hourLogs.push(hourLog);
  attachRelations();
  return listHourLogs().find((row) => row.id === hourLog.id);
}

export function patchHourLog(id, { status, reviewerId }) {
  const log = state.hourLogs.find((row) => row.id === Number(id));
  if (!log) {
    const error = new Error('Hour log not found.');
    error.status = 404;
    throw error;
  }

  log.status = status;
  log.reviewedById = Number(reviewerId);
  log.reviewedAt = new Date();
  log.updatedAt = new Date();
  attachRelations();
  return listHourLogs().find((row) => row.id === log.id);
}

export function listMemberships({ active, studentId, placementId } = {}) {
  attachRelations();
  let rows = state.memberships.map((row) => clone(row));
  if (studentId) rows = rows.filter((row) => row.studentId === Number(studentId));
  if (placementId) rows = rows.filter((row) => row.placementId === Number(placementId));
  if (active === true) rows = rows.filter((row) => row.active);
  if (active === false) rows = rows.filter((row) => !row.active);
  return rows.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

export function listFormOptions() {
  return clone(state.formOptions).sort((a, b) => {
    if (a.fieldKey === b.fieldKey) {
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
    }
    return a.fieldKey.localeCompare(b.fieldKey);
  });
}

export function getStudentSummary(studentId) {
  const student = findUserById(studentId);
  if (!student || student.role !== 'STUDENT') {
    return null;
  }

  attachRelations();
  const membership = state.memberships.find((row) => row.studentId === studentId && row.active) || null;
  const approvedHours = state.hourLogs
    .filter((row) => row.studentId === studentId && row.status === 'APPROVED')
    .reduce((sum, row) => sum + Number(row.hours), 0);

  return {
    student: publicUser(student),
    currentPlacement: membership
      ? {
          ...clone(state.placements.find((p) => p.id === membership.placementId)),
          supervisor: publicUser(findUserById(
            state.placements.find((p) => p.id === membership.placementId)?.supervisorId,
          )),
        }
      : null,
    membership: membership
      ? {
          id: membership.id,
          startedAt: membership.startedAt,
          active: membership.active,
        }
      : null,
    approvedHours,
  };
}

export function getAdminSummary() {
  const approvedHours = state.hourLogs
    .filter((row) => row.status === 'APPROVED')
    .reduce((sum, row) => sum + Number(row.hours), 0);

  return {
    students: state.users.filter((user) => user.role === 'STUDENT').length,
    supervisors: state.users.filter((user) => user.role === 'SUPERVISOR').length,
    placements: state.placements.length,
    pendingJoinRequests: state.joinRequests.filter((row) => row.status === 'PENDING').length,
    pendingHourLogs: state.hourLogs.filter((row) => row.status === 'PENDING').length,
    approvedHours,
  };
}

export function getStaticAdminSchemas() {
  const base = (entity, table, columns) => ({
    entity,
    table,
    columns: columns.map((column, index) => ({
      name: column.name,
      dataType: column.dataType || 'varchar',
      columnType: column.columnType || column.dataType || 'varchar(255)',
      isNullable: column.nullable ? 'YES' : 'NO',
      columnKey: column.columnKey || '',
      extra: '',
      defaultValue: null,
      ordinalPosition: index + 1,
      nullable: Boolean(column.nullable),
      generated: false,
      sensitive: Boolean(column.sensitive),
      readOnly: Boolean(column.readOnly),
    })),
  });

  return [
    base('users', 'User', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'name', dataType: 'varchar' },
      { name: 'email', dataType: 'varchar' },
      { name: 'role', dataType: 'enum' },
      { name: 'password', dataType: 'varchar', sensitive: true },
      { name: 'phone', dataType: 'varchar', nullable: true },
      { name: 'formsCompleted', dataType: 'tinyint' },
      { name: 'createdAt', dataType: 'datetime', readOnly: true },
      { name: 'updatedAt', dataType: 'datetime', readOnly: true },
    ]),
    base('placements', 'Placement', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'name', dataType: 'varchar' },
      { name: 'description', dataType: 'varchar', nullable: true },
      { name: 'supervisorId', dataType: 'int' },
      { name: 'createdAt', dataType: 'datetime', readOnly: true },
      { name: 'updatedAt', dataType: 'datetime', readOnly: true },
    ]),
    base('join-requests', 'JoinRequest', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'studentId', dataType: 'int' },
      { name: 'placementId', dataType: 'int' },
      { name: 'status', dataType: 'enum' },
      { name: 'note', dataType: 'varchar', nullable: true },
      { name: 'reviewedById', dataType: 'int', nullable: true },
      { name: 'reviewedAt', dataType: 'datetime', nullable: true, readOnly: true },
      { name: 'createdAt', dataType: 'datetime', readOnly: true },
      { name: 'updatedAt', dataType: 'datetime', readOnly: true },
    ]),
    base('hour-logs', 'HourLog', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'studentId', dataType: 'int' },
      { name: 'placementId', dataType: 'int' },
      { name: 'date', dataType: 'datetime' },
      { name: 'hours', dataType: 'decimal' },
      { name: 'description', dataType: 'varchar', nullable: true },
      { name: 'status', dataType: 'enum' },
      { name: 'reviewedById', dataType: 'int', nullable: true },
      { name: 'reviewedAt', dataType: 'datetime', nullable: true, readOnly: true },
      { name: 'createdAt', dataType: 'datetime', readOnly: true },
      { name: 'updatedAt', dataType: 'datetime', readOnly: true },
    ]),
    base('memberships', 'PlacementMembership', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'studentId', dataType: 'int' },
      { name: 'placementId', dataType: 'int' },
      { name: 'active', dataType: 'tinyint' },
      { name: 'startedAt', dataType: 'datetime' },
      { name: 'endedAt', dataType: 'datetime', nullable: true },
    ]),
    base('form-options', 'FormOption', [
      { name: 'id', dataType: 'int', readOnly: true, columnKey: 'PRI' },
      { name: 'fieldKey', dataType: 'varchar' },
      { name: 'value', dataType: 'varchar' },
      { name: 'label', dataType: 'varchar' },
      { name: 'sortOrder', dataType: 'int' },
      { name: 'active', dataType: 'tinyint' },
    ]),
  ];
}
