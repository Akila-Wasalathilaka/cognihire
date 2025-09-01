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
  'lib/config/ai.ts',
  'app/api/ai/test/route.ts',
  'components/games/GameEngine.tsx',
  'tsconfig.json',
  'tailwind.config.js',
  'package.json',
  '.env.production',
  '.env.local'
];

function uploadFile(localFile, remoteFile) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(localFile)) {
      console.warn(`⚠️  Local file not found: ${localFile}`);
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
      
      console.log(`✅ Uploaded: ${localFile}`);
      resolve();
    });
  });
}

async function uploadAllFiles() {
  console.log('🚀 Starting file upload to server...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const file of FILES_TO_UPLOAD) {
    try {
      await uploadFile(file, file);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`✅ Successfully uploaded: ${successCount} files`);
  console.log(`❌ Failed uploads: ${errorCount} files`);
  
  if (errorCount === 0) {
    console.log('\n🎉 All files uploaded successfully!');
    console.log('\nNext steps:');
    console.log('1. SSH into server: ssh -i "ssh-key-2025-08-31.key" ubuntu@129.154.244.25');
    console.log('2. Navigate to project: cd cognihire');
    console.log('3. Build project: npm run build');
    console.log('4. Restart services: sudo systemctl restart cognihire-frontend');
    console.log('5. Check status: sudo systemctl status cognihire-frontend');
  } else {
    console.log('\n⚠️  Some files failed to upload. Please check the errors above.');
  }
}

// Run the upload
uploadAllFiles().catch(console.error);
