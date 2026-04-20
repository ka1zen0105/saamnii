import { api } from "./index.js";

export async function fetchMyProfile() {
  const { data } = await api.get("/api/faculty/me");
  return data;
}

export async function patchMyProfile(body) {
  const { data } = await api.patch("/api/faculty/me", body);
  return data;
}

