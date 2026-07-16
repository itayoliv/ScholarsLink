export const placementInclude = {
  supervisor: true,
  memberships: {
    where: { active: true },
    include: { student: true },
  },
};

export const joinRequestInclude = {
  student: true,
  placement: { include: { supervisor: true } },
  reviewedBy: true,
};

export const hourLogInclude = {
  student: true,
  placement: { include: { supervisor: true } },
  reviewedBy: true,
};

export const membershipInclude = {
  student: true,
  placement: { include: { supervisor: true } },
};
