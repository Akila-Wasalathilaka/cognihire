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

// Files to upload to server
const FILES_TO_UPLOAD = [
  'app/api/admin/analytics/overview/route.ts',
  'app/api/admin/candidates/route.ts',
  'app/api/admin/candidates/[id]/route.ts',
  'app/api/admin/job-roles/route.ts',
  'app/api/admin/job-roles/[id]/route.ts',
  'app/api/admin/assessments/route.ts',
  'app/api/admin/assessments/[id]/route.ts',
  'app/api/admin/job-roles/[id]/analyze/route.ts',
  '.env.local',
  '.env.production'
];

function uploadFile(localFile, remoteFile) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(localFile)) {
      console.log(`⚠️  File not found: ${localFile}, skipping...`);
      resolve();
      return;
    }

    const scpCommand = `scp -i "${SERVER_CONFIG.keyFile}" "${localFile}" ${SERVER_CONFIG.user}@${SERVER_CONFIG.host}:${SERVER_CONFIG.remotePath}/${remoteFile}`;
    
    console.log(`Uploading: ${localFile} -> ${remoteFile}`);
    
    exec(scpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error uploading ${localFile}:`, error.message);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`Warning for ${localFile}:`, stderr);
      }
      
      console.log(`✓ Uploaded: ${localFile} -> ${remoteFile}`);
      resolve();
    });
  });
}

async function uploadAllFiles() {
  console.log('Starting file upload to server...\n');
  
  for (const file of FILES_TO_UPLOAD) {
    try {
      await uploadFile(file, file);
    } catch (error) {
      console.error(`Failed to upload ${file}:`, error.message);
    }
  }
  
  console.log('\n✅ File upload completed!');
  console.log('\nNext steps:');
  console.log('1. SSH to server and restart services');
  console.log('2. Run: ssh -i ssh-key-2025-08-31.key ubuntu@129.154.244.25');
  console.log('3. cd cognihire && npm run build');
  console.log('4. sudo systemctl restart cognihire-frontend');
}

// Run the upload
uploadAllFiles().catch(console.error);
