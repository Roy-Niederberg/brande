import https from 'https';

const urls = [
  'https://cdn.coverr.co/videos/coverr-a-doctor-examining-a-patient-5272/1080p.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-medical-team-in-the-operating-room-4034-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-doctor-with-a-stethoscope-in-a-hospital-4036-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-female-doctor-examining-a-patient-4033-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-dentist-examining-a-patients-teeth-4032-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-doctor-examining-a-patient-with-a-stethoscope-4028-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-doctor-working-in-her-office-4030-large.mp4'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(url, res.statusCode);
  }).on('error', (e) => {
    console.error(url, e.message);
  });
});
