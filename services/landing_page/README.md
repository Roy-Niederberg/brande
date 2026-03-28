# Qabu Landing Page

Welcome to the Qabu Landing Page project! This is a modern, responsive React application built with Vite and Tailwind CSS.

## Running Locally

To build and view this project on your local machine, follow these steps:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### 1. Install Dependencies
Open your terminal, navigate to the project folder, and run:
```bash
npm install
```

### 2. Start the Development Server
Run the following command to start the local development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000` (or the port specified in your terminal) to view the app.

### 3. Build for Production (Optional)
To create a production-ready build, run:
```bash
npm run build
```

## Running with Docker

If you prefer using Docker to run the application in an isolated container, a `Dockerfile` has been included for you. Follow these steps:

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) installed on your computer.

### 1. Build the Docker Image
Open your terminal in the project folder and run:
```bash
docker build -t qabu-landing-page .
```

### 2. Run the Docker Container
Start the container and map the port to your local machine:
```bash
docker run -p 8080:80 qabu-landing-page
```
Open your browser and navigate to `http://localhost:8080` to view the app.

---

## How to Change the Background Videos

The hero section of the landing page features a looping playlist of background videos. You can easily customize these videos by editing the `src/App.tsx` file.

Open `src/App.tsx` and locate the `Hero` component. You will see an array named `videos`:

```tsx
const videos = [
  "https://assets.mixkit.co/videos/17469/17469-720.mp4",
  "https://assets.mixkit.co/videos/4171/4171-720.mp4"
];
```

### Option 1: Using a Link (URL)
If your video is hosted online, simply replace the existing URLs in the array with your new video link:

```tsx
const videos = [
  "https://your-website.com/path/to/your-video.mp4",
  // You can add as many videos as you want!
];
```

### Option 2: Using a Local File
If you have a video file on your computer that you want to use:

1. Place your video file inside the `public` directory of your project. You can create a subfolder like `public/videos/` to keep things organized.
2. Update the `videos` array in `src/App.tsx` to point to the local path. Start the path with a forward slash `/` (which represents the `public` folder):

```tsx
const videos = [
  "/videos/my-clinic-video.mp4"
];
```
*(Note: Files in the `public` folder are served at the root path `/` of your website).*

### Supported Video File Types
For the best compatibility across all web browsers (Chrome, Safari, Firefox, mobile devices), it is highly recommended to use:
* **`.mp4`** (specifically encoded with H.264 video and AAC audio) - **Best Choice**
* **`.webm`** (great for web, smaller file sizes, but slightly less support on older Apple devices)
* **`.ogg`**

*Tip: Keep your video file sizes small (ideally under 5-10MB) and ensure they are muted if they are just for background visuals so your website loads quickly!*
