/**
 * Manual snapshot of the "2014-2015" tab of Stelele Viitorului's shared schedule sheet
 * (steleleviitorului.ro/livescore/) — the sheet owner has downloading/copying disabled for
 * viewers, so this can't be synced live like Elite U13's data; it's read and updated by hand
 * on request instead. Update this file (and SNAPSHOT_DATE below) when asked to refresh it.
 */
import type { CupaDay } from "./cupaTypes";

export const SNAPSHOT_DATE = "2026-08-23";
export const HIGHLIGHT_TEAM = "Coerver România";

export type { CupaMatch, CupaDay } from "./cupaTypes";

export const CUPA_2014_2015_DAYS: CupaDay[] = [
  {
    label: "Friday, Aug 28 — Group stage",
    matches: [
      { time: "10:30", group: "2015-B", home: "Coerver România", away: "Știința București" },
      { time: "11:20", group: "2015-A", home: "Arsenal Sports", away: "Academia Metaloglobus" },
      { time: "12:10", group: "2015-B", home: "Știința București", away: "Academia Udinese" },
      { time: "13:00", group: "2015-A", home: "Academia Metaloglobus", away: "CSS Nr. 2" },
      { time: "13:50", group: "2014-A", home: "Academia Metaloglobus", away: "FC Lotus" },
      { time: "14:40", group: "2015-A", home: "Dinamic Kids Videle", away: "CSS Nr. 2" },
      { time: "15:30", group: "2014-A", home: "FC Lotus", away: "Super Star Galben" },
      { time: "16:20", group: "2014-B", home: "Super Star Roșu", away: "Gloria Comana" },
      { time: "17:10", group: "2014-A", home: "IFA Freedom", away: "Super Star Galben" },
      { time: "18:00", group: "2014-B", home: "Super Star Roșu", away: "FC Lions" },
      { time: "18:50", group: "2015-B", home: "Coerver România", away: "Chimistul Valea Călugărească" },
      { time: "19:40", group: "2014-B", home: "FC Lions", away: "Micii Fotbaliști" },
    ],
  },
  {
    label: "Saturday, Aug 29 — Group stage",
    matches: [
      { time: "08:00", group: "2014-B", home: "Super Star Roșu", away: "Micii Fotbaliști" },
      { time: "08:50", group: "2014-B", home: "FC Lions", away: "Gloria Comana" },
      { time: "09:40", group: "2014-A", home: "Academia Metaloglobus", away: "Super Star Galben" },
      { time: "10:30", group: "2014-B", home: "Micii Fotbaliști", away: "Gloria Comana" },
      { time: "11:20", group: "2014-A", home: "Academia Metaloglobus", away: "IFA Freedom" },
      { time: "12:10", group: "2015-A", home: "Academia Metaloglobus", away: "Dinamic Kids Videle" },
      { time: "13:00", group: "2014-A", home: "FC Lotus", away: "IFA Freedom" },
      { time: "13:50", group: "2015-A", home: "Arsenal Sports", away: "Dinamic Kids Videle" },
      { time: "14:40", group: "2015-B", home: "Academia Udinese", away: "Chimistul Valea Călugărească" },
      { time: "15:30", group: "2015-A", home: "Arsenal Sports", away: "CSS Nr. 2" },
      { time: "16:20", group: "2015-B", home: "Știința București", away: "Chimistul Valea Călugărească" },
      { time: "17:10", group: "2015-B", home: "Coerver România", away: "Academia Udinese" },
    ],
  },
  {
    label: "Sunday, Aug 30 — Knockout stage",
    matches: [
      { time: "08:00", group: "2015", home: "Loc 4A", away: "Loc 4B" },
      { time: "08:50", group: "2014 · SF1", home: "Loc 1A", away: "Loc 2B" },
      { time: "09:40", group: "2014 · SF2", home: "Loc 1B", away: "Loc 2A" },
      { time: "10:30", group: "2015 · SF1", home: "Loc 1A", away: "Loc 2B" },
      { time: "11:20", group: "2015 · SF2", home: "Loc 1B", away: "Loc 2A" },
      { time: "12:10", group: "2014 · Finala mică", home: "Pierzătoare SF1", away: "Pierzătoare SF2" },
      { time: "13:00", group: "2015 · Finala mică", home: "Pierzătoare SF1", away: "Pierzătoare SF2" },
      { time: "13:50", group: "2014 · FINALA", home: "Câștigătoare SF1", away: "Câștigătoare SF2" },
      { time: "14:40", group: "2015 · FINALA", home: "Câștigătoare SF1", away: "Câștigătoare SF2" },
      { time: "15:30", group: "2015", home: "Loc 3A", away: "Loc 3B" },
      { time: "16:20", group: "2014", home: "Loc 3A", away: "Loc 3B" },
      { time: "17:10", group: "2014", home: "Loc 4A", away: "Loc 4B" },
    ],
  },
];
