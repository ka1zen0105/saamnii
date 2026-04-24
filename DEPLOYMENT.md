# Deployment (Vercel + Render)

## 1) Backend on Render

- Create a new **Web Service** in Render from this repo.
- Render Blueprint is included as `render.yaml` (or configure manually with `rootDir=server`).
- Required env vars in Render:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `ADMIN_ID`
  - `ADMIN_PASSWORD`
  - `SEED_FACULTY_PASSWORD`
- Optional:
  - `SUBJECT_TEMPLATE_PATH` (absolute path on Render instance if you host a fixed template file there)

After deploy, note your API URL:
- Example: `https://saamnii-api.onrender.com`

## 2) Frontend on Vercel

- Import the same repo into Vercel.
- Set **Root Directory** to `client`.
- Build command: `npm run build`
- Output directory: `dist`
- Add env var:
  - `VITE_API_URL=https://<your-render-service>.onrender.com`

Deploy and open the Vercel URL.

## 3) Post-deploy check

- Backend health: `https://<render-url>/api/health`
- Frontend should load and login should call Render API.
- If CORS/network issues appear, ensure Vercel `VITE_API_URL` points to the Render backend URL exactly.
