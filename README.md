# Exam grade analysis

Full-stack app for uploading exam spreadsheets, storing marks in MongoDB, and viewing analytics (faculty and admin).

## Prerequisites

- Node.js 18+ and npm
- A MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

## Run locally

### 1. Server

```bash
cd server
npm install
```

Create `server/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/exam-grade-analysis
JWT_SECRET=your-long-random-secret
ADMIN_ID=your-admin-login-id
ADMIN_PASSWORD=your-admin-password
PORT=3000
```

- **`MONGO_URI`** — connection string used by Mongoose (required).
- **`JWT_SECRET`** — secret for signing JWTs (required).
- **`ADMIN_ID`** — only this user id may log in with role **admin** (required for admin UI).
- **`ADMIN_PASSWORD`** — plain-text admin password checked on login. For production, prefer **`ADMIN_PASSWORD_HASH`** (bcrypt hash) instead of a plain password; if `ADMIN_PASSWORD_HASH` is set, it is used and `ADMIN_PASSWORD` is ignored.
- **`PORT`** — API port (default `3000`).

Start the API:

```bash
npm run dev
```

The server listens on `http://localhost:3000` (or your `PORT`).

### 2. Client

In a second terminal:

```bash
cd client
npm install
```

Optional: create `client/.env` if you want the browser to call the API directly instead of using the Vite proxy:

```env
VITE_API_URL=http://localhost:3000
```

If **`VITE_API_URL` is omitted**, the dev server uses **same-origin** requests and Vite’s proxy forwards `/api` to `http://127.0.0.1:3000` (see `client/vite.config.js`).

Start the UI:

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:5173`).

## First admin user

Admin credentials are **not** stored in MongoDB. The server checks **`ADMIN_ID`** and **`ADMIN_PASSWORD`** (or **`ADMIN_PASSWORD_HASH`**) from `server/.env`.

1. Set `ADMIN_ID` and `ADMIN_PASSWORD` (or a bcrypt `ADMIN_PASSWORD_HASH`).
2. Restart the server after changing `.env`.
3. On the landing page, choose **Admin / HOD**, enter that id and password, and sign in.

### Faculty

Faculty accounts are created under **Admin → Faculty access** with a **user id**, **display label**, optional **email**, and **initial password** (at least 6 characters). They sign in on the same page with role **Faculty** and that user id and password. Existing faculty rows created before passwords were required will need a new account or a manual password hash update in the database.

To seed the sample account **faculty-prof** (Vaibhav Godbole, `godbolefragnel@edu.in`), add **`SEED_FACULTY_PASSWORD`** to `server/.env`, then from **`server/`** run:

`npm run seed:faculty-vaibhav`

Remove or rotate **`SEED_FACULTY_PASSWORD`** afterward if you do not want it kept in `.env`.

## First upload (`sem3.xlsx` sample)

1. Log in as **Faculty** (or use an admin account if your workflow allows uploads from that role).
2. Open **Upload** in the faculty sidebar.
3. Use a semester marks file named like **`sem3.xlsx`** (or your own file in the same column layout your app expects). If you have a `sem3.xlsx` sample, place it on your machine and drag it into the upload zone or pick it with the file chooser.
4. Submit the upload and wait for confirmation; parsed rows should appear in the table when the server finishes processing.

If you do not have `sem3.xlsx` yet, prepare an Excel file that matches the parsers and column mapping in the server upload utilities (see `server/src/utils/` and the upload controller), then upload it the same way.

## Project layout

- **`server/`** — Express API, Mongoose models, upload and analytics routes.
- **`client/`** — React (Vite) SPA with faculty and admin areas.

## Production build (client)

```bash
cd client
npm run build
```

Serve the `client/dist` static files behind your host; set **`VITE_API_URL`** at build time to your public API URL if the API is on another origin.
