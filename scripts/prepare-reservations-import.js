#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT_PATH = path.resolve(__dirname, "reservations_input.csv");
const DEFAULT_ROOMS_PATH = path.resolve(__dirname, "rooms_rows.csv");
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, "reservations_import.csv");
const PRAGUE_TIME_ZONE = "Europe/Prague";
const TRAINING_SESSION_DURATION_MINUTES = 4 * 60;
const PERSONAL_FALLBACK_DURATION_MINUTES = 60;

const OUTPUT_COLUMNS = [
  "id",
  "room_id",
  "owner_profile_id",
  "title",
  "person_count",
  "start_at",
  "end_at",
  "cancelled_at",
  "cancelled_by_profile_id",
  "created_at",
  "updated_at",
  "created_by_profile_id",
  "updated_by_profile_id",
];

/**
 * Normalizes header labels for robust index lookup.
 * @param {string | undefined} value
 * @returns {string}
 */
const normalizeHeader = (value) => (value ?? "").replace(/^\uFEFF/, "").trim();

/**
 * Reads a simple CLI argument value: --key=value
 * @param {string} name
 * @returns {string | undefined}
 */
const getArgValue = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

/**
 * Parses CSV content supporting quoted values and escaped quotes.
 * @param {string} content
 * @returns {string[][]}
 */
const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      const nextChar = content[i + 1];
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";

      const hasValues = row.some((value) => value.trim().length > 0);
      if (hasValues) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    const hasValues = row.some((value) => value.trim().length > 0);
    if (hasValues) {
      rows.push(row);
    }
  }

  return rows;
};

/**
 * Escapes a single CSV field value.
 * @param {unknown} value
 * @returns {string}
 */
const toCsvField = (value) => {
  const stringValue = value == null ? "" : String(value);
  const escaped = stringValue.replaceAll('"', '""');
  return `"${escaped}"`;
};

/**
 * Serializes rows into CSV text with quoted fields.
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string}
 */
const toCsv = (rows) => {
  const lines = [OUTPUT_COLUMNS.map(toCsvField).join(",")];
  for (const row of rows) {
    const values = OUTPUT_COLUMNS.map((column) => toCsvField(row[column]));
    lines.push(values.join(","));
  }
  return `${lines.join("\n")}\n`;
};

/**
 * Extracts normalized room code from source room field.
 * Example: "D126 - vepředu" -> "d126"
 * @param {string} rawRoom
 * @returns {string | null}
 */
const getRoomCode = (rawRoom) => {
  const match = rawRoom.match(/(d\d{3})/i);
  return match ? match[1].toLowerCase() : null;
};

/**
 * Parses source date format: DD.MM.YYYY H:mm
 * @param {string} value
 * @returns {{ day: number; month: number; year: number; hour: number; minute: number } | null}
 */
const parseLegacyDate = (value) => {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
};

/**
 * Gets Europe/Prague UTC offset in minutes for a UTC instant.
 * @param {Date} utcDate
 * @returns {number}
 */
const getPragueOffsetMinutes = (utcDate) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PRAGUE_TIME_ZONE,
    timeZoneName: "shortOffset",
  });
  const tzPart = formatter
    .formatToParts(utcDate)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = tzPart?.match(/^GMT([+-]\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unable to parse timezone offset for ${utcDate.toISOString()}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  return hours * 60 + Math.sign(hours || 1) * minutes;
};

/**
 * Converts a Prague local date/time into UTC Date.
 * @param {{ day: number; month: number; year: number; hour: number; minute: number }} localDate
 * @returns {Date}
 */
const pragueLocalToUtcDate = (localDate) => {
  let utcMillis = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    localDate.hour,
    localDate.minute,
    0,
  );

  for (let i = 0; i < 4; i += 1) {
    const offsetMinutes = getPragueOffsetMinutes(new Date(utcMillis));
    const nextUtcMillis =
      Date.UTC(localDate.year, localDate.month - 1, localDate.day, localDate.hour, localDate.minute, 0) -
      offsetMinutes * 60_000;

    if (nextUtcMillis === utcMillis) {
      break;
    }

    utcMillis = nextUtcMillis;
  }

  return new Date(utcMillis);
};

/**
 * Formats UTC Date to PostgreSQL timestamptz text.
 * @param {Date} date
 * @returns {string}
 */
const formatUtcForPostgres = (date) => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const sec = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}+00`;
};

/**
 * Parses timestamp in `YYYY-MM-DD HH:mm:ss+00` format.
 * @param {string} value
 * @returns {Date | null}
 */
const parsePostgresUtcTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value.replace(" ", "T").replace("+00", "Z"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Checks whether two time ranges overlap.
 * [aStart, aEnd) overlaps [bStart, bEnd) when starts before other ends on both sides.
 * @param {Date} aStart
 * @param {Date} aEnd
 * @param {Date} bStart
 * @param {Date} bEnd
 * @returns {boolean}
 */
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Removes overlapping reservations per room, keeping first reserved entries.
 * "First reserved" is sorted by created_at ASC, then source row order ASC.
 * @param {Array<Record<string, unknown> & { __sourceRow: number }>} rows
 * @returns {{ keptRows: Array<Record<string, unknown>>; skipped: string[] }}
 */
const removeOverlapsFirstReservedWins = (rows) => {
  const sorted = [...rows].sort((a, b) => {
    const createdA = parsePostgresUtcTimestamp(String(a.created_at))?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const createdB = parsePostgresUtcTimestamp(String(b.created_at))?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    return (a.__sourceRow ?? Number.MAX_SAFE_INTEGER) - (b.__sourceRow ?? Number.MAX_SAFE_INTEGER);
  });

  const keptRows = [];
  const keptByRoom = new Map();
  const skipped = [];

  for (const row of sorted) {
    const roomId = String(row.room_id ?? "");
    const start = parsePostgresUtcTimestamp(String(row.start_at ?? ""));
    const end = parsePostgresUtcTimestamp(String(row.end_at ?? ""));
    const sourceRow = Number(row.__sourceRow ?? 0);

    if (!roomId || !start || !end) {
      skipped.push(`Row ${sourceRow || "?"}: invalid data while overlap filtering`);
      continue;
    }

    const existing = keptByRoom.get(roomId) ?? [];
    const hasOverlap = existing.some((kept) =>
      rangesOverlap(start, end, kept.start, kept.end),
    );

    if (hasOverlap) {
      skipped.push(`Row ${sourceRow || "?"}: overlap skipped (first reserved wins)`);
      continue;
    }

    existing.push({ start, end });
    keptByRoom.set(roomId, existing);

    const { __sourceRow, ...cleanRow } = row;
    keptRows.push(cleanRow);
  }

  return { keptRows, skipped };
};

/**
 * Converts source date/time text into UTC timestamp for Supabase import.
 * @param {string} value
 * @returns {string | null}
 */
const convertDateTime = (value) => {
  const parsed = parseLegacyDate(value);
  if (!parsed) {
    return null;
  }

  const utcDate = pragueLocalToUtcDate(parsed);
  return formatUtcForPostgres(utcDate);
};

/**
 * Picks best reservation title from source row.
 * @param {string} title
 * @param {string} tsTitle
 * @returns {string}
 */
const getReservationTitle = (title, tsTitle) => {
  const normalizedTsTitle = tsTitle.trim();
  if (normalizedTsTitle.length > 0) {
    return normalizedTsTitle.startsWith("TS - ")
      ? normalizedTsTitle
      : `TS - ${normalizedTsTitle}`;
  }

  const normalizedTitle = title.trim();
  if (normalizedTitle.length > 0) {
    return normalizedTitle;
  }

  return "Bez nazvu";
};

/**
 * Builds room code -> room id lookup map.
 * @param {string[][]} roomsRows
 * @returns {Map<string, string>}
 */
const buildRoomIdMap = (roomsRows) => {
  const [header, ...rows] = roomsRows;
  const normalizedHeader = header.map(normalizeHeader);
  const idIndex = normalizedHeader.indexOf("id");
  const codeIndex = normalizedHeader.indexOf("code");

  if (idIndex === -1 || codeIndex === -1) {
    throw new Error("rooms_rows.csv must contain 'id' and 'code' columns");
  }

  const map = new Map();
  for (const row of rows) {
    const code = row[codeIndex]?.trim().toLowerCase();
    const id = row[idIndex]?.trim();
    if (!code || !id) {
      continue;
    }
    map.set(code, id);
  }

  return map;
};

/**
 * Transforms source CSV rows into reservation import rows.
 * @param {string[][]} reservationRows
 * @param {Map<string, string>} roomIdByCode
 * @returns {{ rows: Array<Record<string, unknown>>; skipped: string[] }}
 */
const transformRows = (reservationRows, roomIdByCode) => {
  const [header, ...rows] = reservationRows;
  const normalizedHeader = header.map(normalizeHeader);

  const roomIndex = normalizedHeader.indexOf("Room");
  const titleIndex = normalizedHeader.indexOf("Title");
  const startIndex = normalizedHeader.indexOf("Začátek rezervace");
  const endIndex = normalizedHeader.indexOf("Konec rezervace");
  const tsIndex = normalizedHeader.indexOf("TS");
  const createdIndex = normalizedHeader.indexOf("Created");

  const requiredColumns = [roomIndex, titleIndex, startIndex, endIndex, tsIndex, createdIndex];
  if (requiredColumns.some((index) => index === -1)) {
    throw new Error(
      "reservations_input.csv must contain: Room, Title, Začátek rezervace, Konec rezervace, TS, Created",
    );
  }

  const transformed = [];
  const skipped = [];

  rows.forEach((row, rowOffset) => {
    const rowNumber = rowOffset + 2;
    const sourceRoom = row[roomIndex]?.trim() ?? "";
    const roomCode = getRoomCode(sourceRoom);
    const roomId = roomCode ? roomIdByCode.get(roomCode) : undefined;

    if (!roomId) {
      skipped.push(`Row ${rowNumber}: room not found (${sourceRoom || "empty"})`);
      return;
    }

    const startTime = convertDateTime(row[startIndex] ?? "");
    let endTime = convertDateTime(row[endIndex] ?? "");
    const tsTitle = row[tsIndex] ?? "";
    const isTrainingSession = tsTitle.trim().length > 0;

    if (!startTime || !endTime) {
      skipped.push(`Row ${rowNumber}: invalid start/end time`);
      return;
    }

    const startDate = parsePostgresUtcTimestamp(startTime);
    const endDate = parsePostgresUtcTimestamp(endTime);

    if (!startDate || !endDate) {
      skipped.push(`Row ${rowNumber}: failed to parse transformed start/end time`);
      return;
    }

    if (endDate <= startDate) {
      const fallbackMinutes = isTrainingSession
        ? TRAINING_SESSION_DURATION_MINUTES
        : PERSONAL_FALLBACK_DURATION_MINUTES;

      const adjustedEndDate = new Date(startDate.getTime() + fallbackMinutes * 60_000);
      endTime = formatUtcForPostgres(adjustedEndDate);
      skipped.push(`Row ${rowNumber}: adjusted end time to keep end_at > start_at`);
    }

    const createdAt = convertDateTime(row[createdIndex] ?? "") ?? formatUtcForPostgres(new Date());
    const actorProfileId = getArgValue("actor-profile-id") ?? "";

    transformed.push({
      id: crypto.randomUUID(),
      room_id: roomId,
      owner_profile_id: "",
      title: getReservationTitle(row[titleIndex] ?? "", tsTitle),
      person_count: "",
      start_at: startTime,
      end_at: endTime,
      cancelled_at: "",
      cancelled_by_profile_id: "",
      created_at: createdAt,
      updated_at: createdAt,
      created_by_profile_id: actorProfileId,
      updated_by_profile_id: actorProfileId,
      __sourceRow: rowNumber,
    });
  });

  const { keptRows, skipped: overlapSkipped } = removeOverlapsFirstReservedWins(transformed);

  return { rows: keptRows, skipped: [...skipped, ...overlapSkipped] };
};

/**
 * Main execution entrypoint.
 */
const main = async () => {
  const inputPath = path.resolve(getArgValue("input") ?? DEFAULT_INPUT_PATH);
  const roomsPath = path.resolve(getArgValue("rooms") ?? DEFAULT_ROOMS_PATH);
  const outputPath = path.resolve(getArgValue("output") ?? DEFAULT_OUTPUT_PATH);

  const [inputContent, roomsContent] = await Promise.all([
    fs.readFile(inputPath, "utf8"),
    fs.readFile(roomsPath, "utf8"),
  ]);

  const inputRows = parseCsv(inputContent);
  const roomRows = parseCsv(roomsContent);

  const roomIdByCode = buildRoomIdMap(roomRows);
  const { rows, skipped } = transformRows(inputRows, roomIdByCode);
  const outputCsv = toCsv(rows);

  await fs.writeFile(outputPath, outputCsv, "utf8");

  console.log(`Created ${rows.length} rows in ${outputPath}`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} rows:`);
    skipped.forEach((message) => console.log(`- ${message}`));
  }
};

main().catch((error) => {
  console.error("Failed to prepare reservations import:", error);
  process.exitCode = 1;
});
