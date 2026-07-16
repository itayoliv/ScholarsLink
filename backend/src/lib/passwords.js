import { PASSWORD_AES_KEY } from '../env.js';
import { prisma } from '../prisma.js';
import { isDemoMode } from '../state.js';

export async function encryptPassword(plainPassword) {
  if (isDemoMode()) {
    return String(plainPassword);
  }

  const rows = await prisma.$queryRaw`
    SELECT TO_BASE64(AES_ENCRYPT(${String(plainPassword)}, ${PASSWORD_AES_KEY})) AS encrypted
  `;
  return rows[0]?.encrypted;
}

export async function passwordMatches(plainPassword, encryptedPassword) {
  if (isDemoMode()) {
    return String(plainPassword) === String(encryptedPassword);
  }

  const rows = await prisma.$queryRaw`
    SELECT CAST(AES_DECRYPT(FROM_BASE64(${encryptedPassword}), ${PASSWORD_AES_KEY}) AS CHAR) AS plain
  `;
  return rows[0]?.plain === String(plainPassword);
}
