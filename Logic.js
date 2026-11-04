/**
 * Pure helpers for the daily field report. No Google service calls.
 * These functions are global in Apps Script (container-bound V8 project).
 */

var TIME_ZONE = 'America/New_York';
var DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_URL = geminiGenerateUrl(DEFAULT_GEMINI_MODEL);
var MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
var RAW_OUTPUT_LIMIT = 45000;
var REPORT_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

var JOB_LOG_HEADERS = [
  'Report ID',
  'Submitted At',
  'Report Date',
  'Job #',
  'Job Name',
  'PM',
  'Foreman',
  'Report Text',
  'Summary',
  'Total Hours',
  'Crew Count',
  'Work Completed',
  'Issues',
  'Flags Raised',
  'Confidence',
  'Photo Links',
  'Voice Note Link',
  'Report Folder',
  'Status',
  'Errors',
  'Raw AI Output',
  'Source',
];

var CREW_HEADERS = [
  'Report ID',
  'Report Date',
  'Job #',
  'Foreman',
  'Crew Member',
  'Classification',
  'Hours',
];

var FLAG_HEADERS = [
  'Flag ID',
  'Report ID',
  'Report Date',
  'Job #',
  'PM',
  'Type',
  'Description',
  'Detail',
  'Evidence Quote',
  'Needed By',
  'Status',
  'PM Note',
  'Reviewed By',
  'Reviewed At',
];

var JOBS_HEADERS = ['Job #', 'Job Name', 'PM', 'Drive Folder ID', 'Active'];

var SAMPLE_JOBS = [
  {
    number: 'J-2401',
    name: 'Riverside Medical Office Bldg - Tenant Fit-Out',
    pm: 'Dana Ortiz',
  },
  {
    number: 'J-2402',
    name: 'Harbor Logistics Warehouse - Service Upgrade 2000A',
    pm: 'Marcus Lee',
  },
  {
    number: 'J-2403',
    name: 'Northgate Elementary - Fire Alarm Replacement',
    pm: 'Priya Shah',
  },
];

var MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

var DASH_ROWS = {
  todayLabel: 1,
  todayFormula: 2,
  hoursLabel: 104,
  hoursFormula: 105,
  flagsLabel: 120,
  flagsCount: 121,
  flagsList: 122,
  scoreLabel: 160,
  processed: 161,
  minutesEach: 162,
  minutesSaved: 163,
  flagsRaised: 164,
  flagsApproved: 165,
};

function sampleJobs() {
  return SAMPLE_JOBS.map(function (job) {
    return { number: job.number, name: job.name, pm: job.pm };
  });
}

function jobChoiceLabel(job) {
  return job.number + ' - ' + job.name;
}

function sampleReports() {
  return [
    {
      jobNumber: 'J-2401',
      foreman: 'Luis Ramirez',
      reportText:
        'Pulled MC for rooms 110-114. Crew: Luis Ramirez, Foreman, 8 hours; Aisha Grant, Journeyman Wireman, 8 hours; Chris Dalton, Apprentice, 8 hours. Ceiling grid in 113 blocks access. GC asked us to add 4 receptacles in Room 112, not on drawings.',
    },
    {
      jobNumber: 'J-2402',
      foreman: "Kevin O'Brien",
      reportText:
        "Set the new 2000A switchgear section and pulled feeders to the west panels. Crew: Kevin O'Brien, Foreman, 8 hours; Matt Ruiz, Journeyman Wireman, 8 hours. We are short 200 ft of 3/4 EMT, need by Thursday.",
    },
    {
      jobNumber: 'J-2403',
      foreman: 'Tom Kowalski',
      reportText:
        'Replaced two smoke detectors on the second floor and tested the NAC circuit. Crew: Tom Kowalski, Foreman, 8 hours; Elena Voss, Journeyman Wireman, 8 hours. No extra work. Material on hand.',
    },
  ];
}

function partsInTimeZone_(date, timeZone) {
  var formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  var parts = {};
  formatter.formatToParts(date).forEach(function (part) {
    parts[part.type] = part.value;
  });
  if (parts.hour === '24') parts.hour = '00';
  ['year', 'month', 'day', 'hour', 'minute', 'second'].forEach(function (key) {
    if (parts[key] && parts[key].length === 1) parts[key] = '0' + parts[key];
  });
  return parts;
}

function formatInTimeZone(date, timeZone, pattern) {
  var parts = partsInTimeZone_(date, timeZone);
  var map = {
    yyyy: parts.year,
    MM: parts.month,
    dd: parts.day,
    HH: parts.hour,
    mm: parts.minute,
    ss: parts.second,
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, function (token) {
    return map[token];
  });
}

function tzOffsetMs_(date, timeZone) {
  var parts = partsInTimeZone_(date, timeZone);
  var asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

function zonedWallTimeToUtc(year, month, day, hour, minute, second, timeZone) {
  var utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  var offset = tzOffsetMs_(new Date(utcGuess), timeZone);
  var corrected = utcGuess - offset;
  var offset2 = tzOffsetMs_(new Date(corrected), timeZone);
  return new Date(utcGuess - offset2);
}

function isoDateInTimeZone(date, timeZone) {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

function sheetMidnight(isoDate, timeZone) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!match) return null;
  return zonedWallTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    0,
    0,
    0,
    timeZone
  );
}

function makeReportId(date, suffix) {
  return 'R-' + formatInTimeZone(date, TIME_ZONE, 'yyyyMMdd-HHmmss') + '-' + suffix;
}

function randomChars(length, rng) {
  var out = '';
  var i;
  for (i = 0; i < length; i++) {
    var index = Math.floor(rng() * REPORT_ID_ALPHABET.length);
    out += REPORT_ID_ALPHABET.charAt(index);
  }
  return out;
}

function foremanSlug(name) {
  var spaced = String(name || '').trim().replace(/\s+/g, '-');
  var cleaned = spaced.replace(/[^\p{L}\p{N}-]/gu, '');
  cleaned = cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'foreman';
}

function extensionFor(fileName, mimeType) {
  var name = String(fileName || '');
  var dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    var fromName = name.substring(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (fromName) return fromName;
  }
  var mime = String(mimeType || '').toLowerCase();
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  var slash = mime.indexOf('/');
  if (slash >= 0 && slash < mime.length - 1) {
    var subtype = mime.substring(slash + 1).replace(/[^a-z0-9]/g, '');
    if (subtype) return subtype;
  }
  return 'bin';
}

function allocateFileNames(dateIso, jobNumber, foreman, files, nameExists) {
  var slug = foremanSlug(foreman);
  var n = 1;
  return files.map(function (file) {
    var name = '';
    while (true) {
      name = dateIso + '_' + jobNumber + '_' + slug + '_' + n + '.' + file.ext;
      if (!nameExists(name)) break;
      n++;
    }
    var used = n;
    n++;
    return { name: name, n: used };
  });
}

function parseJobChoice(choice) {
  var text = String(choice || '').trim();
  var match = /^(J-\d+)\s+-\s+([\s\S]+)$/.exec(text);
  if (!match) return { jobNumber: text, jobNameFromChoice: '' };
  return { jobNumber: match[1], jobNameFromChoice: match[2].trim() };
}

function parseFormDate(raw) {
  var text = String(raw || '').trim();
  if (!text) return '';
  var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (us) {
    var month = ('0' + us[1]).slice(-2);
    var day = ('0' + us[2]).slice(-2);
    return us[3] + '-' + month + '-' + day;
  }
  return '';
}

function parseTimestampToDate(raw, timeZone) {
  if (raw instanceof Date && !isNaN(raw.getTime())) return new Date(raw.getTime());
  var text = String(raw || '').trim();
  if (!text) return null;
  var iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (iso) {
    return zonedWallTimeToUtc(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6]),
      timeZone
    );
  }
  var us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/.exec(text);
  if (us) {
    var hour = Number(us[4]);
    var ampm = us[7] ? us[7].toLowerCase() : '';
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return zonedWallTimeToUtc(
      Number(us[3]),
      Number(us[1]),
      Number(us[2]),
      hour,
      Number(us[5]),
      us[6] ? Number(us[6]) : 0,
      timeZone
    );
  }
  return null;
}

function reportDateIso(reportDateRaw, submittedAt) {
  return parseFormDate(reportDateRaw) || isoDateInTimeZone(submittedAt, TIME_ZONE);
}

function fileIdFromUrl(url) {
  var text = String(url || '').trim();
  if (!text) return '';
  var idParam = /[?&]id=([a-zA-Z0-9_-]+)/.exec(text);
  if (idParam) return idParam[1];
  var filePath = /\/d\/([a-zA-Z0-9_-]+)/.exec(text);
  if (filePath) return filePath[1];
  var folderPath = /\/folders\/([a-zA-Z0-9_-]+)/.exec(text);
  if (folderPath) return folderPath[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;
  return '';
}

function splitFileList(entries) {
  var out = [];
  if (entries == null || entries === '') return out;
  var list = Array.isArray(entries) ? entries : [entries];
  list.forEach(function (entry) {
    String(entry == null ? '' : entry).split(/,\s*/).forEach(function (piece) {
      var trimmed = piece.trim();
      if (trimmed) out.push(trimmed);
    });
  });
  return out;
}

function responseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      crew: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            classification: { type: 'STRING' },
            hours: { type: 'NUMBER' },
          },
          required: ['name', 'classification', 'hours'],
        },
      },
      total_hours: { type: 'NUMBER' },
      work_completed: { type: 'ARRAY', items: { type: 'STRING' } },
      issues: { type: 'ARRAY', items: { type: 'STRING' } },
      possible_change_orders: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            reason: { type: 'STRING' },
            evidence_quote: { type: 'STRING' },
          },
          required: ['description', 'reason', 'evidence_quote'],
        },
      },
      material_shortages: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            item: { type: 'STRING' },
            qty: { type: 'STRING', nullable: true },
            needed_by: { type: 'STRING', nullable: true },
          },
          required: ['item'],
        },
      },
      confidence: { type: 'NUMBER' },
    },
    required: [
      'summary',
      'crew',
      'total_hours',
      'work_completed',
      'issues',
      'possible_change_orders',
      'material_shortages',
      'confidence',
    ],
  };
}

function buildPrompt(input) {
  var lines = [
    'You extract a structured daily field report for an electrical contractor.',
    'Extract only what the report states.',
    'Leave out anything you cannot find.',
    "Quote the foreman's own words for evidence.",
    'Flag work that sounds outside the original scope as a possible change order.',
    'classification uses IBEW-style titles such as Foreman, Journeyman Wireman, and Apprentice.',
    'needed_by is an ISO date if one is stated, otherwise free text such as "Thursday".',
    'confidence is a number from 0 to 1.',
  ];
  if (input.hasAttachments) {
    lines.push('Photos and/or a voice note are attached. Use only what they actually show or say.');
  }
  lines.push('');
  lines.push('Job number: ' + (input.jobNumber || ''));
  lines.push('Foreman: ' + (input.foreman || ''));
  lines.push('Report date: ' + (input.reportDateIso || ''));
  lines.push('Report text:');
  lines.push(input.reportText || '');
  return lines.join('\n');
}

function geminiModelId(raw) {
  var text = String(raw == null ? '' : raw).trim();
  return text || DEFAULT_GEMINI_MODEL;
}

function geminiGenerateUrl(modelId) {
  return 'https://generativelanguage.googleapis.com/v1beta/models/' + geminiModelId(modelId) + ':generateContent';
}

function buildGeminiRequest(prompt, attachments) {
  var parts = [{ text: prompt }];
  (attachments || []).forEach(function (attachment) {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.base64,
      },
    });
  });
  return {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema(),
      temperature: 0.2,
    },
  };
}

function isFiniteNumber_(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringListOk_(value) {
  return Array.isArray(value) && value.every(function (item) { return typeof item === 'string'; });
}

function validateExtraction(obj) {
  var problems = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'schema mismatch' };
  }
  if (typeof obj.summary !== 'string') problems.push('summary');
  if (!Array.isArray(obj.crew)) {
    problems.push('crew');
  } else {
    obj.crew.forEach(function (member, index) {
      if (!member || typeof member !== 'object' || Array.isArray(member)) {
        problems.push('crew[' + index + ']');
        return;
      }
      if (typeof member.name !== 'string') problems.push('crew[' + index + '].name');
      if (typeof member.classification !== 'string') problems.push('crew[' + index + '].classification');
      if (!isFiniteNumber_(member.hours)) problems.push('crew[' + index + '].hours');
    });
  }
  if (!isFiniteNumber_(obj.total_hours)) problems.push('total_hours');
  if (!stringListOk_(obj.work_completed)) problems.push('work_completed');
  if (!stringListOk_(obj.issues)) problems.push('issues');
  if (!Array.isArray(obj.possible_change_orders)) {
    problems.push('possible_change_orders');
  } else {
    obj.possible_change_orders.forEach(function (item, index) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        problems.push('possible_change_orders[' + index + ']');
        return;
      }
      if (typeof item.description !== 'string') problems.push('possible_change_orders[' + index + '].description');
      if (typeof item.reason !== 'string') problems.push('possible_change_orders[' + index + '].reason');
      if (typeof item.evidence_quote !== 'string') problems.push('possible_change_orders[' + index + '].evidence_quote');
    });
  }
  if (!Array.isArray(obj.material_shortages)) {
    problems.push('material_shortages');
  } else {
    obj.material_shortages.forEach(function (item, index) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        problems.push('material_shortages[' + index + ']');
        return;
      }
      if (typeof item.item !== 'string') problems.push('material_shortages[' + index + '].item');
      if (item.qty != null && typeof item.qty !== 'string') problems.push('material_shortages[' + index + '].qty');
      if (item.needed_by != null && typeof item.needed_by !== 'string') {
        problems.push('material_shortages[' + index + '].needed_by');
      }
    });
  }
  if (!isFiniteNumber_(obj.confidence) || obj.confidence < 0 || obj.confidence > 1) problems.push('confidence');
  if (problems.length) return { ok: false, error: 'schema mismatch: ' + problems.join(', ') };
  return { ok: true, value: obj };
}

function parseGeminiHttpBody(bodyText) {
  var raw = bodyText == null ? '' : String(bodyText);
  var body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: 'invalid JSON', raw: raw };
  }
  if (body && body.promptFeedback && body.promptFeedback.blockReason) {
    return {
      ok: false,
      error: 'Gemini blocked response: ' + body.promptFeedback.blockReason,
      raw: raw,
    };
  }
  var candidates = body && body.candidates;
  if (!candidates || !candidates.length) {
    return { ok: false, error: 'Gemini returned no candidates', raw: raw };
  }
  var finish = candidates[0].finishReason || '';
  if (finish === 'SAFETY' || finish === 'BLOCKLIST' || finish === 'PROHIBITED_CONTENT' || finish === 'SPII' || finish === 'RECITATION') {
    return { ok: false, error: 'Gemini blocked response: ' + finish, raw: raw };
  }
  var parts = (candidates[0].content && candidates[0].content.parts) || [];
  var text = parts.map(function (part) { return part && part.text ? part.text : ''; }).join('');
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err2) {
    return { ok: false, error: 'invalid JSON', raw: text || raw };
  }
  var validated = validateExtraction(parsed);
  if (!validated.ok) return { ok: false, error: validated.error, raw: text || raw };
  return { ok: true, value: validated.value, raw: text };
}

function httpErrorMessage(code, body) {
  var detail = '';
  try {
    var parsed = JSON.parse(body);
    if (parsed && parsed.error && parsed.error.message) detail = String(parsed.error.message);
  } catch (err) {
    detail = String(body || '').replace(/\s+/g, ' ').trim();
    if (detail.length > 300) detail = detail.substring(0, 300);
  }
  if (detail) return 'Gemini HTTP ' + code + ': ' + detail;
  return 'Gemini HTTP ' + code;
}

function truncateRaw(text) {
  var value = text == null ? '' : String(text);
  if (value.length <= RAW_OUTPUT_LIMIT) return value;
  return value.substring(0, RAW_OUTPUT_LIMIT);
}

function sumCrewHours(crew) {
  return (crew || []).reduce(function (sum, member) {
    return sum + Number(member.hours);
  }, 0);
}

function hoursMismatchNote(totalHours, crew) {
  var sum = sumCrewHours(crew);
  if (Math.abs(sum - Number(totalHours)) <= 0.001) return '';
  return 'total_hours mismatch: total_hours ' + totalHours + ' != sum of crew hours ' + sum;
}

function linesJoin(values) {
  if (!values || !values.length) return '';
  return values.join('\n');
}

function rowFromMap(headers, map) {
  return headers.map(function (header) {
    if (Object.prototype.hasOwnProperty.call(map, header) && map[header] != null) return map[header];
    return '';
  });
}

function buildInitialJobLogRow(fields) {
  return rowFromMap(JOB_LOG_HEADERS, {
    'Report ID': fields.reportId,
    'Submitted At': fields.submittedAt,
    'Report Date': fields.reportDate,
    'Job #': fields.jobNumber,
    'Job Name': fields.jobName || '',
    PM: fields.pm || '',
    Foreman: fields.foreman,
    'Report Text': fields.reportText,
    Status: 'Processing',
    Source: fields.source,
  });
}

function buildCrewRows(reportId, reportDate, jobNumber, foreman, crew) {
  return (crew || []).map(function (member) {
    return rowFromMap(CREW_HEADERS, {
      'Report ID': reportId,
      'Report Date': reportDate,
      'Job #': jobNumber,
      Foreman: foreman,
      'Crew Member': member.name,
      Classification: member.classification,
      Hours: member.hours,
    });
  });
}

function buildFlagRows(reportId, reportDate, jobNumber, pm, extraction) {
  var rows = [];
  var n = 1;
  (extraction.possible_change_orders || []).forEach(function (item) {
    rows.push(rowFromMap(FLAG_HEADERS, {
      'Flag ID': reportId + '-F' + n,
      'Report ID': reportId,
      'Report Date': reportDate,
      'Job #': jobNumber,
      PM: pm || '',
      Type: 'Change order',
      Description: item.description,
      Detail: item.reason,
      'Evidence Quote': item.evidence_quote,
      'Needed By': '',
      Status: 'Pending',
    }));
    n++;
  });
  (extraction.material_shortages || []).forEach(function (item) {
    rows.push(rowFromMap(FLAG_HEADERS, {
      'Flag ID': reportId + '-F' + n,
      'Report ID': reportId,
      'Report Date': reportDate,
      'Job #': jobNumber,
      PM: pm || '',
      Type: 'Material shortage',
      Description: item.item,
      Detail: item.qty == null ? '' : item.qty,
      'Evidence Quote': '',
      'Needed By': item.needed_by == null ? '' : item.needed_by,
      Status: 'Pending',
    }));
    n++;
  });
  return rows;
}

function joinErrors(list) {
  var out = [];
  (list || []).forEach(function (item) {
    var text = String(item || '').trim();
    if (text && out.indexOf(text) === -1) out.push(text);
  });
  return out.join('; ');
}

function findJob(jobs, jobNumber) {
  var i;
  for (i = 0; i < jobs.length; i++) {
    if (jobs[i].number === jobNumber) return jobs[i];
  }
  return null;
}

function namedValuesFromEvent(event) {
  if (event && event.namedValues) return event.namedValues;
  var values = (event && event.values) || [];
  var titles = ['Timestamp', 'Job', 'Foreman name', 'Report date', 'Report text', 'Photos', 'Voice note'];
  var named = {};
  titles.forEach(function (title, index) {
    named[title] = [values[index] == null ? '' : String(values[index])];
  });
  return named;
}

function firstNamed(named, title) {
  var values = named[title];
  if (!values || !values.length || values[0] == null) return '';
  return String(values[0]).trim();
}

function dashboardCells() {
  var rows = DASH_ROWS;
  return [
    { row: rows.todayLabel, col: 1, value: "Today's reports" },
    {
      row: rows.todayFormula,
      col: 1,
      value: '=IFERROR(FILTER(\'Job Log\'!A2:V,\'Job Log\'!C2:C=TODAY()),"None")',
    },
    { row: rows.hoursLabel, col: 1, value: 'Hours by job' },
    {
      row: rows.hoursFormula,
      col: 1,
      value: '=IFERROR(QUERY(\'Crew Hours\'!A1:G,"select C, sum(G) where C is not null group by C label C \'Job #\', sum(G) \'Hours\'",1),"None")',
    },
    { row: rows.flagsLabel, col: 1, value: 'Open flags' },
    { row: rows.flagsCount, col: 1, value: 'Open flag count' },
    { row: rows.flagsCount, col: 2, value: '=COUNTIF(\'Flags\'!K2:K,"Pending")' },
    {
      row: rows.flagsList,
      col: 1,
      value: '=IFERROR(FILTER(\'Flags\'!A2:N,\'Flags\'!K2:K="Pending"),"None")',
    },
    { row: rows.scoreLabel, col: 1, value: 'Pilot scorecard' },
    { row: rows.processed, col: 1, value: 'Reports processed' },
    { row: rows.processed, col: 2, value: '=COUNTIF(\'Job Log\'!S2:S,"Processed")' },
    { row: rows.minutesEach, col: 1, value: 'Minutes saved per report' },
    { row: rows.minutesEach, col: 2, value: 15 },
    { row: rows.minutesEach, col: 3, value: 'Assumption, not measured' },
    { row: rows.minutesSaved, col: 1, value: 'Est. minutes saved' },
    { row: rows.minutesSaved, col: 2, value: '=B' + rows.processed + '*B' + rows.minutesEach },
    { row: rows.flagsRaised, col: 1, value: 'Flags raised' },
    { row: rows.flagsRaised, col: 2, value: "=COUNTA('Flags'!A2:A)" },
    { row: rows.flagsApproved, col: 1, value: 'Flags approved' },
    { row: rows.flagsApproved, col: 2, value: '=COUNTIF(\'Flags\'!K2:K,"Approved")' },
  ];
}
