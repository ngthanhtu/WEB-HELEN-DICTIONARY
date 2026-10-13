-- Run in TiDB SQL Editor as a provisioning administrator, AFTER schema.sql.
-- Replace the placeholder privately. Never commit or send the real password.
-- CREATE USER deliberately fails if the account already exists: inspect its
-- privileges instead of silently retaining a previously privileged account.
CREATE USER 'helen_app'@'%' IDENTIFIED BY '<REPLACE_WITH_STRONG_LOCAL_PASSWORD>';
GRANT SELECT, INSERT, UPDATE, DELETE ON helen_dictionary.* TO 'helen_app'@'%';
SHOW GRANTS FOR 'helen_app'@'%';
-- Render runtime: copy the exact username from TiDB Connect (prefix if required),
-- MYSQL_SSL=true, DATABASE_AUTO_MIGRATE=false. Do not grant ALL or GRANT OPTION.
-- Future schema migrations use separate administrator credentials, never this user.
