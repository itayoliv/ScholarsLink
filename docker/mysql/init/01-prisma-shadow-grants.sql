-- Allow Prisma Migrate to create/drop its temporary shadow database.
GRANT CREATE, DROP, ALTER, REFERENCES, INDEX ON *.* TO 'scholarslink_user'@'%';
FLUSH PRIVILEGES;
