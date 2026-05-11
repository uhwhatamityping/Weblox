const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    await downloadFile('https://lottie.host/e6fb21b7-776f-4a22-9162-11cd7e2c1acc/xJxpLbkKmB.lottie', path.join(publicDir, 'anim2.lottie'));
    console.log('Downloaded anim2.lottie');
    await downloadFile('https://lottie.host/d3e416f8-c6da-414e-ad22-44de95fa9e4a/DaKqJsivkY.lottie', path.join(publicDir, 'anim1.lottie'));
    console.log('Downloaded anim1.lottie');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
