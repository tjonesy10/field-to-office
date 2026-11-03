const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadLogic(nowIso) {
  const sandbox = {};
  if (nowIso) sandbox.Date = fakeDate(nowIso);
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(root, 'Logic.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'Logic.js' });
  return sandbox;
}

function fakeDate(iso) {
  const fixed = new Date(iso).getTime();
  function FakeDate(...args) {
    if (args.length === 0) return new Date(fixed);
    return new Date(...args);
  }
  FakeDate.UTC = Date.UTC;
  FakeDate.parse = Date.parse;
  FakeDate.now = function () { return fixed; };
  FakeDate.prototype = Date.prototype;
  return FakeDate;
}

function extraction(overrides) {
  return Object.assign({
    summary: 'Crew roughed in rooms 110-114.',
    crew: [
      { name: 'Luis Ramirez', classification: 'Foreman', hours: 8 },
      { name: 'Aisha Grant', classification: 'Journeyman Wireman', hours: 8 },
    ],
    total_hours: 16,
    work_completed: ['Pulled MC rooms 110-114'],
    issues: [],
    possible_change_orders: [],
    material_shortages: [],
    confidence: 0.8,
  }, overrides || {});
}

test('Logic.js parses as JavaScript', () => {
  execFileSync(process.execPath, ['--check', path.join(root, 'Logic.js')], { stdio: 'pipe' });
});

test('report id uses America/New_York and a 4-character suffix', () => {
  const logic = loadLogic();
  const when = new Date('2026-11-03T21:30:45.000Z');
  assert.equal(logic.makeReportId(when, 'K7QF'), 'R-20261103-163045-K7QF');
  assert.equal(logic.randomChars(4, function () { return 0; }), 'AAAA');
});

test('blank report date is the submission date in America/New_York, including across midnight', () => {
  const logic = loadLogic();
  const lateEvening = new Date('2026-11-04T03:30:00.000Z');
  assert.equal(logic.isoDateInTimeZone(lateEvening, logic.TIME_ZONE), '2026-11-03');
  assert.equal(logic.reportDateIso('', lateEvening), '2026-11-03');
  const justAfterMidnight = new Date('2026-11-04T05:30:00.000Z');
  assert.equal(logic.reportDateIso('', justAfterMidnight), '2026-11-04');
  const summerEvening = new Date('2026-07-15T03:30:00.000Z');
  assert.equal(logic.reportDateIso('  ', summerEvening), '2026-07-14');
  assert.equal(logic.reportDateIso('2026-11-02', lateEvening), '2026-11-02');
  assert.equal(logic.reportDateIso('11/2/2026', lateEvening), '2026-11-02');
  const midnight = logic.sheetMidnight('2026-11-03', logic.TIME_ZONE);
  assert.equal(midnight.toISOString(), '2026-11-03T05:00:00.000Z');
  assert.equal(logic.isoDateInTimeZone(midnight, logic.TIME_ZONE), '2026-11-03');
});

test('foreman slug keeps letters, digits, and hyphens', () => {
  const logic = loadLogic();
  assert.equal(logic.foremanSlug('Luis Ramirez'), 'Luis-Ramirez');
  assert.equal(logic.foremanSlug("Kevin O'Brien"), 'Kevin-OBrien');
  assert.equal(logic.foremanSlug('  Ana   Lee  '), 'Ana-Lee');
});

test('file names use the report date, job, foreman, and a skipped index', () => {
  const logic = loadLogic();
  assert.equal(logic.extensionFor('site.JPG', 'image/jpeg'), 'jpg');
  assert.equal(logic.extensionFor('note.m4a', 'audio/mp4'), 'm4a');
  assert.equal(logic.extensionFor('voice', 'audio/mpeg'), 'mp3');
  assert.equal(logic.extensionFor('noext', 'image/png'), 'png');
  const taken = { '2026-11-03_J-2401_Luis-Ramirez_1.jpg': true };
  const names = logic.allocateFileNames(
    '2026-11-03',
    'J-2401',
    'Luis Ramirez',
    [{ ext: 'jpg' }, { ext: 'png' }],
    function (name) { return !!taken[name]; }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(names.map(function (item) { return item.name; }))), [
    '2026-11-03_J-2401_Luis-Ramirez_2.jpg',
    '2026-11-03_J-2401_Luis-Ramirez_3.png',
  ]);
});

test('job choice parsing and file urls', () => {
  const logic = loadLogic();
  assert.deepEqual(
    JSON.parse(JSON.stringify(logic.parseJobChoice('J-2401 - Riverside Medical Office Bldg - Tenant Fit-Out'))),
    { jobNumber: 'J-2401', jobNameFromChoice: 'Riverside Medical Office Bldg - Tenant Fit-Out' }
  );
  assert.equal(logic.fileIdFromUrl('https://drive.google.com/open?id=abc_DEF-123'), 'abc_DEF-123');
  assert.equal(logic.fileIdFromUrl('https://drive.google.com/file/d/abc_DEF-123/view'), 'abc_DEF-123');
  assert.deepEqual(
    JSON.parse(JSON.stringify(logic.splitFileList(['https://drive.google.com/open?id=one, https://drive.google.com/open?id=two']))),
    ['https://drive.google.com/open?id=one', 'https://drive.google.com/open?id=two']
  );
});

test('schema accepts an empty crew and nullable shortage fields, and rejects a mismatch of types', () => {
  const logic = loadLogic();
  const emptyCrew = extraction({ crew: [], total_hours: 0, confidence: 0 });
  assert.equal(logic.validateExtraction(emptyCrew).ok, true);
  assert.equal(logic.hoursMismatchNote(0, []), '');
  const shortage = extraction({
    material_shortages: [{ item: '3/4" EMT', qty: null, needed_by: 'Thursday' }],
  });
  assert.equal(logic.validateExtraction(shortage).ok, true);
  const missing = extraction();
  delete missing.summary;
  const result = logic.validateExtraction(missing);
  assert.equal(result.ok, false);
  assert.match(result.error, /schema mismatch/);
  assert.equal(logic.validateExtraction(extraction({ confidence: 1.2 })).ok, false);
  assert.match(logic.hoursMismatchNote(20, extraction().crew), /total_hours mismatch/);
});

test('gemini body parser distinguishes invalid JSON, schema mismatch, and a blocked response', () => {
  const logic = loadLogic();
  const valid = logic.parseGeminiHttpBody(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(extraction()) }] }, finishReason: 'STOP' }],
  }));
  assert.equal(valid.ok, true);
  const invalid = logic.parseGeminiHttpBody(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'this is not json' }] }, finishReason: 'STOP' }],
  }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'invalid JSON');
  assert.equal(invalid.raw, 'this is not json');
  const wholeBody = logic.parseGeminiHttpBody('not json at all');
  assert.equal(wholeBody.error, 'invalid JSON');
  const mismatch = logic.parseGeminiHttpBody(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'only this' }) }] }, finishReason: 'STOP' }],
  }));
  assert.match(mismatch.error, /schema mismatch/);
  const blocked = logic.parseGeminiHttpBody(JSON.stringify({
    promptFeedback: { blockReason: 'SAFETY' },
  }));
  assert.match(blocked.error, /blocked response/);
  assert.equal(
    logic.httpErrorMessage(400, JSON.stringify({ error: { message: 'API key not valid' } })),
    'Gemini HTTP 400: API key not valid'
  );
  assert.equal(logic.truncateRaw('x'.repeat(45001)).length, 45000);
});

test('crew and flag rows keep the report id and do not invent review fields', () => {
  const logic = loadLogic();
  const when = logic.sheetMidnight('2026-11-03', logic.TIME_ZONE);
  const value = extraction({
    possible_change_orders: [{
      description: 'Add 4 receptacles, Room 112',
      reason: 'Not on drawings',
      evidence_quote: 'GC asked us to add 4 receptacles in Room 112, not on drawings',
    }],
    material_shortages: [{ item: '3/4" EMT', qty: '200 ft', needed_by: 'Thursday' }],
  });
  const crew = logic.buildCrewRows('R-1', when, 'J-2401', 'Luis Ramirez', value.crew);
  assert.equal(crew.length, 2);
  assert.equal(crew[0][0], 'R-1');
  assert.equal(crew[0][4], 'Luis Ramirez');
  assert.equal(logic.sumCrewHours(value.crew), 16);
  const flags = logic.buildFlagRows('R-1', when, 'J-2401', 'Dana Ortiz', value);
  assert.equal(flags[0][0], 'R-1-F1');
  assert.equal(flags[0][5], 'Change order');
  assert.equal(flags[0][10], 'Pending');
  assert.equal(flags[0][11], '');
  assert.equal(flags[0][12], '');
  assert.equal(flags[1][0], 'R-1-F2');
  assert.equal(flags[1][5], 'Material shortage');
  assert.equal(flags[1][7], '200 ft');
  assert.equal(flags[1][9], 'Thursday');
  assert.equal(logic.buildCrewRows('R-1', when, 'J-2401', 'Luis Ramirez', []).length, 0);
});

test('samples cover three jobs and include one change-order phrase and one shortage phrase', () => {
  const logic = loadLogic();
  const samples = logic.sampleReports();
  const jobs = logic.sampleJobs();
  assert.deepEqual(
    JSON.parse(JSON.stringify(samples.map(function (sample) { return sample.jobNumber; }))),
    ['J-2401', 'J-2402', 'J-2403']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(jobs.map(function (job) { return job.number; }))),
    ['J-2401', 'J-2402', 'J-2403']
  );
  const text = samples.map(function (sample) { return sample.reportText; }).join('\n');
  assert.match(text, /GC asked us to add 4 receptacles in Room 112, not on drawings/);
  assert.match(text, /short 200 ft of 3\/4 EMT, need by Thursday/);
});

test('gemini model defaults to gemini-3.5-flash-lite and accepts an override', () => {
  const logic = loadLogic();
  const def = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
  assert.equal(logic.DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite');
  assert.equal(logic.GEMINI_URL, def);
  assert.equal(logic.geminiModelId(null), 'gemini-3.5-flash-lite');
  assert.equal(logic.geminiModelId(''), 'gemini-3.5-flash-lite');
  assert.equal(logic.geminiModelId('   '), 'gemini-3.5-flash-lite');
  assert.equal(logic.geminiGenerateUrl(''), def);
  assert.equal(
    logic.geminiGenerateUrl('gemini-test-model'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
  );
});

test('gemini request uses the schema, temperature 0.2, and no API key', () => {
  const logic = loadLogic();
  const prompt = logic.buildPrompt({
    jobNumber: 'J-2402',
    foreman: "Kevin O'Brien",
    reportDateIso: '2026-11-03',
    reportText: 'Worked the gear.',
    hasAttachments: false,
  });
  assert.match(prompt, /Extract only what the report states/);
  assert.match(prompt, /Quote the foreman's own words/);
  assert.match(prompt, /outside the original scope/);
  const request = logic.buildGeminiRequest(prompt, [{ mimeType: 'image/jpeg', base64: 'YQ==' }]);
  assert.equal(request.generationConfig.temperature, 0.2);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(
    JSON.parse(JSON.stringify(request.generationConfig.responseSchema.required)),
    JSON.parse(JSON.stringify(logic.responseSchema().required))
  );
  assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.equal(JSON.stringify(request).includes('AIza'), false);
});

test('dashboard formulas are labels plus FILTER, QUERY, and COUNTIF only', () => {
  const logic = loadLogic();
  const cells = logic.dashboardCells();
  const byLabel = {};
  cells.forEach(function (cell) {
    if (cell.col === 1 && typeof cell.value === 'string' && !cell.value.startsWith('=')) byLabel[cell.value] = cell;
  });
  assert.ok(byLabel["Today's reports"]);
  assert.ok(byLabel['Hours by job']);
  assert.ok(byLabel['Open flags']);
  assert.ok(byLabel['Pilot scorecard']);
  const values = cells.map(function (cell) { return String(cell.value); }).join('\n');
  assert.match(values, /FILTER\('Job Log'!A2:V,'Job Log'!C2:C=TODAY\(\)\)/);
  assert.match(values, /QUERY\('Crew Hours'!A1:G,"select C, sum\(G\)/);
  assert.match(values, /COUNTIF\('Flags'!K2:K,"Pending"\)/);
  assert.match(values, /COUNTIF\('Job Log'!S2:S,"Processed"\)/);
  assert.match(values, /COUNTA\('Flags'!A2:A\)/);
  assert.match(values, /COUNTIF\('Flags'!K2:K,"Approved"\)/);
  assert.match(values, /Assumption, not measured/);
  const minutes = cells.find(function (cell) { return cell.value === 15; });
  assert.equal(minutes.row, logic.DASH_ROWS.minutesEach);
  const saved = cells.find(function (cell) { return cell.value === '=B161*B162'; });
  assert.equal(saved.row, logic.DASH_ROWS.minutesSaved);
  const ordered = ['Today\'s reports', 'Hours by job', 'Open flags', 'Pilot scorecard'];
  const rows = ordered.map(function (label) { return byLabel[label].row; });
  assert.deepEqual(rows, rows.slice().sort(function (a, b) { return a - b; }));
});

test('initial job log row is Processing and keeps the report text', () => {
  const logic = loadLogic();
  const row = logic.buildInitialJobLogRow({
    reportId: 'R-20261103-163045-AAAA',
    submittedAt: new Date('2026-11-03T21:30:45.000Z'),
    reportDate: logic.sheetMidnight('2026-11-03', logic.TIME_ZONE),
    jobNumber: 'J-2402',
    jobName: 'Harbor Logistics Warehouse - Service Upgrade 2000A',
    pm: 'Marcus Lee',
    foreman: "Kevin O'Brien",
    reportText: 'Worked the gear.',
    source: 'Form',
  });
  assert.equal(row.length, logic.JOB_LOG_HEADERS.length);
  assert.equal(row[logic.JOB_LOG_HEADERS.indexOf('Status')], 'Processing');
  assert.equal(row[logic.JOB_LOG_HEADERS.indexOf('Report Text')], 'Worked the gear.');
  assert.equal(row[logic.JOB_LOG_HEADERS.indexOf('Source')], 'Form');
  assert.equal(row[logic.JOB_LOG_HEADERS.indexOf('Summary')], '');
});
