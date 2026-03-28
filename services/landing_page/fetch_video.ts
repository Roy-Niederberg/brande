import https from 'https';

https.get('https://mixkit.co/free-stock-video/female-doctor-visiting-a-sick-girl-4554/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/https:\/\/[^"']+\.mp4/g);
    if (matches) {
      console.log(matches[0]);
    } else {
      console.log("No mp4 found");
    }
  });
});
