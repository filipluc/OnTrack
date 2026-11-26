/**
 * hailafotbal.ro (the Romanian Football Federation's youth-league site) is a client-side
 * Angular app with no public API docs -- this reverse-engineers the same calls its own
 * frontend makes (found by inspecting its network traffic) to read the same public match
 * data any visitor's browser already sees. The credentials below are the app's own public
 * read-only service account, embedded in its shipped JS bundle -- not a private secret.
 * Shared by every competition read from hailafotbal.ro (Elite U13, Interliga U12, ...).
 */
export const FRF_API = "https://api.datalake.frf.ro";
const FRF_USER = "HaiLaFotbal";
const FRF_PASSWORD = "g2NmJb'{C/x#DqU[8cn57u";

export interface FrfTourRound {
  tourRoundId: string;
  seriesId: string;
  stageId: string;
  // tourNo is which "circuit" through every opponent this is (1st time round, 2nd, ...) --
  // NOT the sequential round/week number a human means by "round 7". That's orderdisplay.
  orderdisplay: number;
}

export interface FrfClub {
  name: string;
}

export interface FrfStadium {
  name: string;
  town: string;
}

export interface FrfMatch {
  matchId: string;
  startDate: string;
  homeGoals: number | null;
  awayGoals: number | null;
  sysCompetitionMatchStatusId: number | null;
  homeClub: FrfClub | null;
  awayClub: FrfClub | null;
  stadium: FrfStadium | null;
}

// Cached separately from any one competition's schedule since a token's own lifetime is much
// shorter than how often a match schedule realistically changes.
let cachedToken: { value: string; fetchedAt: number } | null = null;
const TOKEN_TTL_MS = 20 * 60 * 1000;

export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_TTL_MS) return cachedToken.value;
  const res = await fetch(`${FRF_API}/Auth/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiUser: FRF_USER, apiPassword: FRF_PASSWORD }),
  });
  if (!res.ok) throw new Error(`FRF auth failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  cachedToken = { value: data.token, fetchedAt: Date.now() };
  return data.token;
}

export async function frfPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${FRF_API}/HaiLaFotbal/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`FRF API ${path} failed: ${res.status}`);
  const json = (await res.json()) as { hasErrors: boolean; erorrMessages: string[]; responseData: T };
  if (json.hasErrors) throw new Error(`FRF API ${path} returned errors: ${JSON.stringify(json.erorrMessages)}`);
  return json.responseData;
}
