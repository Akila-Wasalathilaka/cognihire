const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_CONFIG = {
  host: '129.154.244.25',
  user: 'ubuntu',
  keyFile: 'ssh-key-2025-08-31.key',
  remotePath: 'cognihire'
};

// Files to sync from server
const FILES_TO_SYNC = [
  'styles/globals.css',
  'app/api/admin/analytics/overview/route.ts',
  'app/api/admin/candidates/route.ts',
  'app/api/admin/job-roles/route.ts',
  'app/api/admin/job-roles/[id]/route.ts',
  'app/api/admin/assessments/route.ts',
  'app/admin/dashboard/page.tsx',
  'app/admin/job-roles/page.tsx',
  'app/admin/candidates/page.tsx',
  'app/admin/assessments/page.tsx',
  'lib/db/oracle.ts',
  'lib/db/postgres.ts',
  'tsconfig.json',
  'tailwind.config.js',
  'package.json'
];

function downloadFile(remoteFile, localFile) {
  return new Promise((resolve, reject) => {
    const sshCommand = `ssh -i "${SERVER_CONFIG.keyFile}" ${SERVER_CONFIG.user}@${SERVER_CONFIG.host} "cat ${SERVER_CONFIG.remotePath}/${remoteFile}"`;
    
    console.log(`Downloading: ${remoteFile}`);
    
    exec(sshCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error downloading ${remoteFile}:`, error.message);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`Warning for ${remoteFile}:`, stderr);
      }
      
      // Ensure directory exists
      const dir = path.dirname(localFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(localFile, stdout);
      console.log(`✓ Downloaded: ${remoteFile} -> ${localFile}`);
      resolve();
    });
  });
}

async function syncAllFiles() {
  console.log('Starting file sync from server...\n');
  
  for (const file of FILES_TO_SYNC) {
    try {
      await downloadFile(file, file);
    } catch (error) {
      console.error(`Failed to sync ${file}:`, error.message);
    }
  }
  
  console.log('\n✅ File sync completed!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run build');
  console.log('2. Check for any remaining errors');
  console.log('3. Upload fixed files back to server if needed');
}

// Run the sync
syncAllFiles().catch(console.error);
