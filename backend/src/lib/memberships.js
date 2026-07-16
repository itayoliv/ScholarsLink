export async function activateMembershipForJoin(tx, studentId, placementId) {
  await tx.placementMembership.updateMany({
    where: { studentId, active: true },
    data: { active: false, endedAt: new Date() },
  });

  await tx.placementMembership.create({
    data: { studentId, placementId },
  });
}
