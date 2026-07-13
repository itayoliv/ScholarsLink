import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, '../../debug-56999f.log');

function write(hypothesisId, message, data) {
  const payload = {
    sessionId: '56999f',
    runId: process.env.DEBUG_RUN_ID || 'pre-fix',
    hypothesisId,
    location: 'scripts/check-migrate-grants.js',
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`);
  fetch('http://127.0.0.1:7383/ingest/76763c12-b31d-43b3-8b80-eea38483679c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '56999f' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const grants = execSync(
  'docker exec scholarslink-mysql mysql -uroot -prootpassword -N -e "SHOW GRANTS FOR \'scholarslink_user\'@\'%\';"',
  { encoding: 'utf8' },
);

const lines = grants.trim().split(/\r?\n/).filter(Boolean);
write('A', 'Checked scholarslink_user grants', {
  grants: lines,
  hasCreatePrivilege: lines.some((line) => /CREATE/.test(line)),
  hasGlobalAll: lines.some((line) => /ALL PRIVILEGES ON \*\.\*/.test(line)),
  hasDbOnlyAll: lines.some((line) => /ALL PRIVILEGES ON `scholarslink`\.\*/.test(line)),
});
write('D', 'Migrate uses non-root app user', {
  dbUser: 'scholarslink_user',
  database: 'scholarslink',
});

console.log(lines.join('\n'));
