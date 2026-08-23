/**
 * Manual snapshot of the "2016-2017" tab of Stelele Viitorului's shared schedule sheet
 * (steleleviitorului.ro/livescore/) — same restriction as the 2014-2015 snapshot: the
 * sheet owner has downloading/copying disabled for viewers, so this can't be synced live.
 * Update this file (and SNAPSHOT_DATE below) when asked to refresh it.
 *
 * Coerver fields two squads per age group ("Verde"/"Negru"), so unlike 2014-2015 there
 * isn't one single team name to match — HIGHLIGHT_TEAM_PREFIX below matches any of them.
 * The source sheet had a couple of spelling variants for the same squad (e.g. "Coerver
 * românia Verde", "Coerver României Verde") — normalized here to "Coerver România Verde"
 * for consistent display; the underlying matches are unchanged.
 */
export const SNAPSHOT_DATE = "2026-08-23";
export const HIGHLIGHT_TEAM_PREFIX = "Coerver";

import type { CupaDay } from "./cupaTypes";
export type { CupaMatch, CupaDay } from "./cupaTypes";

export const CUPA_2016_2017_DAYS: CupaDay[] = [
  {
    label: "Friday, Aug 28 — Group stage",
    matches: [
      { time: "12:10", field: "Field 5", group: "2016-E", home: "Super Star Roșu", away: "ȘCF. Pîrvu Ploiești" },
      { time: "12:10", field: "Field 6", group: "2017-C", home: "Asterra București", away: "ACS Luc Alb 2018" },
      { time: "13:00", field: "Field 5", group: "2016-D", home: "Coerver România Verde", away: "Super Star Galben" },
      { time: "13:00", field: "Field 6", group: "2017-A", home: "ACS Luc Vișiniu", away: "Super Star Galben" },
      { time: "13:50", field: "Field 5", group: "2016-B", home: "Academia Dinamo Roșu", away: "Coerver România Negru" },
      { time: "13:50", field: "Field 6", group: "2017-C", home: "Super Star Roșu", away: "Chimistul Valea Călugărească" },
      { time: "14:40", field: "Field 5", group: "2016-E", home: "FC Lions", away: "Unirea Bascov Alb" },
      { time: "14:40", field: "Field 6", group: "2017-B", home: "Academia Zep Constanța", away: "Academia Mutu Alb" },
      { time: "15:30", field: "Field 5", group: "2016-C", home: "Academia Dinamo Alb", away: "ȘCF. Marius Lăcătuș" },
      { time: "15:30", field: "Field 6", group: "2016-A", home: "Kinder Târgoviște", away: "FC Academic" },
      { time: "16:20", field: "Field 5", group: "2016-D", home: "CSS Caracal", away: "Unirea Bascov Albastru" },
      { time: "16:20", field: "Field 6", group: "2017-D", home: "Progresul Spartac", away: "Academia Mutu Roșu 2018" },
      { time: "17:10", field: "Field 5", group: "2016-B", home: "Progresul Spartac Bleu", away: "CS Ciolpani" },
      { time: "17:10", field: "Field 6", group: "2017-E", home: "Micii Fotbaliști", away: "Super Star Albastru" },
      { time: "18:00", field: "Field 5", group: "2017-A", home: "Coerver România Verde", away: "ACS The Lions Calarasi" },
      { time: "18:00", field: "Field 6", group: "2016-C", home: "Academia Didi Iași", away: "Progresul Spartac Albastru" },
      { time: "18:50", field: "Field 5", group: "2016-A", home: "Bihorul Beiuș", away: "Arsenal Sports" },
      { time: "18:50", field: "Field 6", group: "2017-E", home: "SCM Gloria Buzău", away: "Arsenal Sports" },
      { time: "19:40", field: "Field 5", group: "2017-B", home: "Știința București", away: "Coerver România Negru" },
      { time: "19:40", field: "Field 6", group: "2017-D", home: "Junior Botoșani", away: "FC Voluntari" },
    ],
  },
  {
    label: "Saturday, Aug 29 — Group stage",
    matches: [
      { time: "08:00", field: "Field 5", group: "2016-D", home: "CSS Caracal", away: "Super Star Galben" },
      { time: "08:00", field: "Field 6", group: "2017-B", home: "Academia Zep Constanța", away: "Coerver România Negru" },
      { time: "08:50", field: "Field 5", group: "2017-D", home: "Junior Botoșani", away: "Progresul Spartac" },
      { time: "08:50", field: "Field 6", group: "2016-C", home: "Academia Didi Iași", away: "Academia Dinamo Alb" },
      { time: "09:40", field: "Field 5", group: "2016-D", home: "Unirea Bascov Albastru", away: "Super Star Galben" },
      { time: "09:40", field: "Field 6", group: "2016-B", home: "Progresul Spartac Bleu", away: "Coerver România Negru" },
      { time: "10:30", field: "Field 5", group: "2017-D", home: "FC Voluntari", away: "Progresul Spartac" },
      { time: "10:30", field: "Field 6", group: "2016-C", home: "Academia Dinamo Alb", away: "Progresul Spartac Albastru" },
      { time: "11:20", field: "Field 5", group: "2016-E", home: "Super Star Roșu", away: "Unirea Bascov Alb" },
      { time: "11:20", field: "Field 6", group: "2016-B", home: "Academia Dinamo Roșu", away: "Progresul Spartac Bleu" },
      { time: "12:10", field: "Field 5", group: "2016-D", home: "Coerver România Verde", away: "CSS Caracal" },
      { time: "12:10", field: "Field 6", group: "2016-C", home: "Progresul Spartac Albastru", away: "ȘCF. Marius Lăcătuș" },
      { time: "13:00", field: "Field 5", group: "2016-A", home: "Bihorul Beiuș", away: "Kinder Târgoviște" },
      { time: "13:00", field: "Field 6", group: "2017-D", home: "FC Voluntari", away: "Academia Mutu Roșu 2018" },
      { time: "13:50", field: "Field 5", group: "2016-B", home: "Academia Dinamo Roșu", away: "CS Ciolpani" },
      { time: "13:50", field: "Field 6", group: "2016-E", home: "FC Lions", away: "Super Star Roșu" },
      { time: "14:40", field: "Field 5", group: "2017-D", home: "Junior Botoșani", away: "Academia Mutu Roșu 2018" },
      { time: "14:40", field: "Field 1", group: "2017-C", home: "Super Star Roșu", away: "Asterra București" },
      { time: "14:40", field: "Field 6", group: "2016-C", home: "Academia Didi Iași", away: "ȘCF. Marius Lăcătuș" },
      { time: "15:30", field: "Field 5", group: "2016-A", home: "Kinder Târgoviște", away: "Arsenal Sports" },
      { time: "15:30", field: "Field 1", group: "2017-A", home: "Coerver România Verde", away: "ACS Luc Vișiniu" },
      { time: "15:30", field: "Field 6", group: "2016-E", home: "FC Lions", away: "ȘCF. Pîrvu Ploiești" },
      { time: "16:20", field: "Field 5", group: "2016-B", home: "Coerver România Negru", away: "CS Ciolpani" },
      { time: "16:20", field: "Field 1", group: "2017-C", home: "Super Star Roșu", away: "ACS Luc Alb 2018" },
      { time: "16:20", field: "Field 6", group: "2017-C", home: "Asterra București", away: "Chimistul Valea Călugărească" },
      { time: "17:10", field: "Field 5", group: "2017-E", home: "SCM Gloria Buzău", away: "Super Star Albastru" },
      { time: "17:10", field: "Field 1", group: "2017-E", home: "Micii Fotbaliști", away: "Arsenal Sports" },
      { time: "17:10", field: "Field 6", group: "2016-A", home: "Arsenal Sports", away: "FC Academic" },
      { time: "18:00", field: "Field 5", group: "2017-A", home: "Coerver România Verde", away: "Super Star Galben" },
      { time: "18:00", field: "Field 4", group: "2016-E", home: "Unirea Bascov Alb", away: "ȘCF. Pîrvu Ploiești" },
      { time: "18:00", field: "Field 1", group: "2017-A", home: "ACS Luc Vișiniu", away: "ACS The Lions Calarasi" },
      { time: "18:00", field: "Field 6", group: "2017-B", home: "Știința București", away: "Academia Mutu Alb" },
      { time: "18:50", field: "Field 5", group: "2017-E", home: "Arsenal Sports", away: "Super Star Albastru" },
      { time: "18:50", field: "Field 4", group: "2016-D", home: "Coerver România Verde", away: "Unirea Bascov Albastru" },
      { time: "18:50", field: "Field 1", group: "2017-C", home: "ACS Luc Alb 2018", away: "Chimistul Valea Călugărească" },
      { time: "18:50", field: "Field 6", group: "2017-E", home: "SCM Gloria Buzău", away: "Micii Fotbaliști" },
      { time: "19:40", field: "Field 5", group: "2017-B", home: "Știința București", away: "Academia Zep Constanța" },
      { time: "19:40", field: "Field 4", group: "2016-A", home: "Bihorul Beiuș", away: "FC Academic" },
      { time: "19:40", field: "Field 1", group: "2017-A", home: "Super Star Galben", away: "ACS The Lions Calarasi" },
      { time: "19:40", field: "Field 6", group: "2017-B", home: "Coerver România Negru", away: "Academia Mutu Alb" },
    ],
  },
  {
    label: "Sunday, Aug 30 — Knockout stage",
    matches: [
      { time: "08:00", field: "Field 5", group: "2016 · Sfert 1", home: "Loc 1A", away: "Al treilea Loc 2" },
      { time: "08:00", field: "Field 1", group: "2017", home: "Loc 4C", away: "Loc 4E" },
      { time: "08:00", field: "Field 6", group: "2016 · Sfert 2", home: "Loc 1C", away: "Primul Loc 2" },
      { time: "08:50", field: "Field 5", group: "2016 · Sfert 3", home: "Loc 1B", away: "Al doilea Loc 2" },
      { time: "08:50", field: "Field 1", group: "2016", home: "Loc 4C", away: "Loc 4E" },
      { time: "08:50", field: "Field 6", group: "2016 · Sfert 4", home: "Loc 1D", away: "Loc 1E" },
      { time: "09:40", field: "Field 5", group: "2017 · Sfert 1", home: "Loc 1A", away: "Al treilea Loc 2" },
      { time: "09:40", field: "Field 6", group: "2017 · Sfert 2", home: "Loc 1C", away: "Primul Loc 2" },
      { time: "10:30", field: "Field 5", group: "2017 · Sfert 3", home: "Loc 1B", away: "Al doilea Loc 2" },
      { time: "10:30", field: "Field 6", group: "2017 · Sfert 4", home: "Loc 1D", away: "Loc 1E" },
      { time: "11:20", field: "Field 5", group: "2016 · SF1", home: "Câștigătoare Sfert 1", away: "Câștigătoare Sfert 2" },
      { time: "11:20", field: "Field 6", group: "2016 · SF2", home: "Câștigătoare Sfert 3", away: "Câștigătoare Sfert 4" },
      { time: "12:10", field: "Field 5", group: "2017 · SF1", home: "Câștigătoare Sfert 1", away: "Câștigătoare Sfert 2" },
      { time: "12:10", field: "Field 6", group: "2017 · SF2", home: "Câștigătoare Sfert 3", away: "Câștigătoare Sfert 4" },
      { time: "13:00", field: "Field 5", group: "2016", home: "Loc 2", away: "Loc 2" },
      { time: "13:00", field: "Field 6", group: "2017", home: "Loc 2", away: "Loc 2" },
      { time: "13:50", field: "Field 5", group: "2016 · Finala mică", home: "Pierzătoare SF1", away: "Pierzătoare SF2" },
      { time: "13:50", field: "Field 6", group: "2017 · Finala mică", home: "Pierzătoare SF1", away: "Pierzătoare SF2" },
      { time: "14:40", field: "Field 5", group: "2016 · FINALA", home: "Câștigătoare SF1", away: "Câștigătoare SF2" },
      { time: "14:40", field: "Field 6", group: "2017 · FINALA", home: "Câștigătoare SF1", away: "Câștigătoare SF2" },
      { time: "15:30", field: "Field 5", group: "2016", home: "Loc 3A", away: "Loc 3C" },
      { time: "15:30", field: "Field 6", group: "2017", home: "Loc 3A", away: "Loc 3C" },
      { time: "16:20", field: "Field 5", group: "2016", home: "Loc 3B", away: "Loc 3D" },
      { time: "16:20", field: "Field 6", group: "2017", home: "Loc 3B", away: "Loc 3D" },
      { time: "17:10", field: "Field 5", group: "2016", home: "Loc 3E", away: "Loc 4A" },
      { time: "17:10", field: "Field 6", group: "2017", home: "Loc 3E", away: "Loc 4A" },
      { time: "18:00", field: "Field 5", group: "2016", home: "Loc 4B", away: "Loc 4D" },
      { time: "18:00", field: "Field 6", group: "2017", home: "Loc 4B", away: "Loc 4D" },
    ],
  },
];
