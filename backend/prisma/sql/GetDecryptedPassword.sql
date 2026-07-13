-- Looks up a user by name and returns the AES-decrypted password.
-- Passwords must be stored as: TO_BASE64(AES_ENCRYPT(plain, 'scholarslink_aes_key'))
-- Call: CALL GetDecryptedPassword('Alice');

DROP PROCEDURE IF EXISTS GetDecryptedPassword;

CREATE PROCEDURE GetDecryptedPassword(IN p_name VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci)
BEGIN
  SELECT
    u.name,
    u.email,
    CAST(
      AES_DECRYPT(FROM_BASE64(u.password), 'scholarslink_aes_key')
      AS CHAR CHARACTER SET utf8mb4
    ) COLLATE utf8mb4_unicode_ci AS decrypted_password
  FROM `User` u
  WHERE u.name = p_name COLLATE utf8mb4_unicode_ci;
END;
