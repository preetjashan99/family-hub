# Daily Life Assistant — Family Hub

A simple full-stack web app for managing a family's daily life: study tasks,
groceries, bills, calendar events, and smart notifications (with phone alerts).

## Project structure (frontend and backend are SEPARATE)

```
assignment/
├── frontend/              <-- The browser part (HTML / CSS / JS)
│   ├── index.html         (page structure)
│   ├── style.css          (look and feel)
│   └── script.js          (talks to the backend with fetch())
│
└── backend/               <-- The server part (Node.js + Express)
    ├── server.js          (API routes that read/write data)
    ├── package.json       (dependencies: express, cors)
    └── data.json          (created on first run — THIS is where the
                            backend stores everything on disk)
```

## Where does the backend store data?

In **`backend/data.json`**.

Every time you add, edit, or delete something on the frontend, the backend
writes the latest state into that JSON file. Open it with any text editor
to see exactly what is stored.

## How to run

You need Node.js installed (https://nodejs.org).

```bash
cd assignment/backend
npm install        # downloads express + cors
npm start          # starts the server on http://localhost:3000
```

Then open **http://localhost:3000** in your browser.

The same server serves the frontend and the API:

| URL                                | What it does                       |
|------------------------------------|------------------------------------|
| `http://localhost:3000/`           | Loads the frontend (index.html)    |
| `http://localhost:3000/api/state`  | Returns all family data as JSON    |
| `http://localhost:3000/api/healthz`| Health check                       |

## API routes (REST)

| Method | Path                  | Purpose                       |
|--------|-----------------------|-------------------------------|
| GET    | `/api/state`          | Get everything                |
| POST   | `/api/tasks`          | Add a study task              |
| PATCH  | `/api/tasks/:id`      | Update (e.g., mark done)      |
| DELETE | `/api/tasks/:id`      | Delete a task                 |
| POST   | `/api/notes`          | Add a note                    |
| DELETE | `/api/notes/:id`      | Delete a note                 |
| POST   | `/api/grocery`        | Add a grocery item            |
| PATCH  | `/api/grocery/:id`    | Toggle purchased / edit       |
| DELETE | `/api/grocery/:id`    | Delete a grocery item         |
| POST   | `/api/bills`          | Add a bill                    |
| PATCH  | `/api/bills/:id`      | Toggle paid / edit            |
| DELETE | `/api/bills/:id`      | Delete a bill                 |
| POST   | `/api/events`         | Add a calendar event          |
| DELETE | `/api/events/:id`     | Delete an event               |
| PUT    | `/api/budget`         | Update the monthly budget     |

## Phone notifications

1. Open the site on your phone (use your computer's local IP, e.g.
   `http://192.168.1.5:3000`, while both devices are on the same Wi-Fi).
2. Tap the **🔔 Enable Alerts** button at the top.
3. Allow notifications when the browser asks.
4. Now overdue bills, low groceries, and due study tasks will pop up on your
   phone — even when the tab is in the background — and the phone will vibrate.

The notifications are powered by the browser's **Notifications API** plus the
**Vibration API** (`navigator.vibrate`). No external service required.

## Features

- **Dashboard** — summary cards + AI-style suggestions
  ("ghar da kharcha zyada ho reha", "milk khatam hon wala hai")
- **Student** — study task planner with priority/due dates + notes
- **Mother** — grocery list with low-stock flags + monthly budget tracker
- **Father** — bill tracker (overdue / due-soon / paid)
- **Calendar** — shared family events, color-coded per member
- **Notifications** — combined alerts feed + phone push

## Tech used

- **Frontend:** plain HTML, CSS, vanilla JavaScript (no framework, no build)
- **Backend:** Node.js + Express, file-based storage (data.json)
- **Mobile alerts:** Web Notifications API + Vibration API
