# Simple GRC BPM Platform

A minimal web application combining Governance, Risk & Compliance (GRC) with Business Process Management (BPM).

## Quick Start

### Install All Dependencies
```bash
npm run install:all
```

### Start Both Frontend and Backend
```bash
npm run dev
```

### Or Start Individually

**Backend (Server):**
```bash
cd server
npm install
npm run dev
```

**Frontend (Client):**
```bash
cd client
npm install
npm start
```

## Features

- **Risk Management**: View and manage organizational risks
- **Process Management**: Monitor business processes
- **Simple Interface**: Clean, responsive design
- **REST API**: Basic endpoints for data management

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/risks` - Get all risks
- `GET /api/processes` - Get all processes

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React
- **Styling**: CSS3

## Project Structure

```
grc-bpm-platform/
├── server/          # Node.js backend
│   ├── index.js     # Main server file
│   └── package.json
├── client/          # React frontend
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   └── package.json
├── package.json     # Root package.json
└── README.md
```

## Development

- Server runs on port 5000
- Client runs on port 3000
- The app fetches sample data from the backend API
