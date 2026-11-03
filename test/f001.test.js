const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createWorld, loadApp, root } = require('../testing/fakes');

const KEY = 'test-key-not-real';
const J2401 = 'J-2401 - Riverside Medical Office Bldg - Tenant Fit-Out';
const J2402 = 'J-2402 - Harbor Logistics Warehouse - Service Upgrade 2000A';

function boot(options) {
  const world = createWorld();
  if (!options || !options.noKey) world.props.setProperty('GEMINI_API_KEY', KEY);
  const app = loadApp(world, options && options.now);
  return { world, app };
}

function ready(options) {
  const ctx = boot(options);
  ctx.app.setup();
  return ctx;
}

function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function headers(app, name) {
  return host(app[name]);
}

function objects(sheet, headerList) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = host(sheet.getRange(2, 1, last - 1, headerList.length).getValues());
  return values.map((row) => {
    const obj = {};
    headerList.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function geminiOk(obj) {
  return {
    code: 200,
    body: {
      candidates: [{
        content: { parts: [{ text: JSON.stringify(obj) }] },
        finishReason: 'STOP',
      }],
    },
  };
}

function baseExtraction(overrides) {
  return Object.assign({
    summary: 'Crew worked the planned scope.',
    crew: [
      { name: 'Luis Ramirez', classification: 'Foreman', hours: 8 },
      { name: 'Aisha Grant', classification: 'Journeyman Wireman', hours: 8 },
      { name: 'Chris Dalton', classification: 'Apprentice', hours: 8 },
    ],
    total_hours: 24,
    work_completed: ['Pulled MC rooms 110-114'],
    issues: ['Ceiling grid in 113 blocks access'],
    possible_change_orders: [],
    material_shortages: [],
    confidence: 0.86,
  }, overrides || {});
}

function submit(app, fields) {
  const data = fields || {};
  app.onReportSubmit({
    namedValues: {
      Timestamp: [data.timestamp == null ? '2026-11-03 16:35:12' : data.timestamp],
      Job: [data.job || J2402],
      'Foreman name': [data.foreman || "Kevin O'Brien"],
      'Report date': [data.reportDate == null ? '2026-11-03' : data.reportDate],
      'Report text': [data.text || 'Worked the service upgrade.'],
      Photos: [data.photos || ''],
      'Voice note': [data.voice || ''],
    },
  });
}

function queue(world, response) {
  world.url.queue.push(response);
}

function child(folder, name) {
  const found = folder.getFoldersByName(name);
  assert.equal(found.hasNext(), true, 'missing folder ' + name);
  const item = found.next();
  assert.equal(found.hasNext(), false, 'duplicate folder ' + name);
  return item;
}

function jobFolder(world, label) {
  const demo = child(world.drive.getRootFolder(), 'Field-to-Office Demo');
  const jobs = child(demo, 'Jobs');
  return child(jobs, label);
}

function countNamed(folder, name) {
  const found = folder.getFoldersByName(name);
  let count = 0;
  while (found.hasNext()) {
    found.next();
    count += 1;
  }
  return count;
}

function dumpContainsKey(world) {
  const blob = JSON.stringify({
    logs: world.logs,
    alerts: world.ss.alerts,
    sheets: world.ss.getSheets().map((sheet) => sheet.getName()),
  });
  return blob.includes(KEY);
}

test('App.js parses as JavaScript', () => {
  execFileSync(process.execPath, ['--check', path.join(root, 'App.js')], { stdio: 'pipe' });
});

test('appsscript.json sets America/New_York, V8, and the scopes this script calls', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));
  assert.equal(manifest.timeZone, 'America/New_York');
  assert.equal(manifest.runtimeVersion, 'V8');
  [
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.storage',
  ].forEach((scope) => assert.ok(manifest.oauthScopes.includes(scope), scope));
  assert.equal(manifest.oauthScopes.includes('https://www.googleapis.com/auth/gmail.send'), false);
});

test('AT1 setup creates the five tabs, exact headers, three jobs, and a form linked to the sheet', () => {
  const { world, app } = ready();
  const expected = {
    'Job Log': headers(app, 'JOB_LOG_HEADERS'),
    'Crew Hours': headers(app, 'CREW_HEADERS'),
    Flags: headers(app, 'FLAG_HEADERS'),
    Jobs: headers(app, 'JOBS_HEADERS'),
  };
  Object.keys(expected).forEach((name) => {
    const sheet = world.ss.getSheetByName(name);
    assert.ok(sheet, name);
    assert.deepEqual(host(sheet.getRange(1, 1, 1, expected[name].length).getValues()[0]), expected[name]);
  });
  assert.ok(world.ss.getSheetByName('Dashboard'));
  const jobs = objects(world.ss.getSheetByName('Jobs'), expected.Jobs);
  assert.deepEqual(jobs.map((job) => job['Job #']), ['J-2401', 'J-2402', 'J-2403']);
  assert.equal(jobs[0]['Job Name'], 'Riverside Medical Office Bldg - Tenant Fit-Out');
  assert.equal(jobs[0].PM, 'Dana Ortiz');
  assert.equal(jobs[1].PM, 'Marcus Lee');
  assert.equal(jobs[2].PM, 'Priya Shah');
  assert.equal(jobs.every((job) => job.Active === true && job['Drive Folder ID']), true);
  const forms = Object.values(world.forms.forms);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].getTitle(), 'Field-to-Office Daily Report');
  assert.equal(forms[0].destId, world.ss.getId());
  assert.equal(forms[0].destType, 'SPREADSHEET');
  const items = forms[0].getItems();
  assert.deepEqual(items.map((item) => item.getTitle()), ['Job', 'Foreman name', 'Report date', 'Report text']);
  assert.equal(items[0].required, true);
  assert.equal(items[1].required, true);
  assert.equal(items[2].required, false);
  assert.equal(items[3].required, true);
  assert.deepEqual(host(items[0].choices), [J2401, J2402, 'J-2403 - Northgate Elementary - Fire Alarm Replacement']);
  assert.equal(world.ss.getSpreadsheetTimeZone(), 'America/New_York');
  assert.equal(world.ss.menu.name, 'Field-to-Office');
  assert.deepEqual(world.ss.menu.items.map((item) => item.label), ['Setup', 'Load sample reports']);
  assert.match(world.logs.join('\n'), /Form edit URL: https:\/\/docs.google.com\/forms\/d\/form-1\/edit/);
  assert.match(world.logs.join('\n'), /Photos/);
  assert.match(world.logs.join('\n'), /Voice note/);
  assert.equal(world.url.calls.length, 0);
});

test('AT2 each job folder has Daily Reports, Change Orders, and Photos, and the id is on Jobs', () => {
  const { world } = ready();
  const jobs = objects(world.ss.getSheetByName('Jobs'), headers(loadApp(world), 'JOBS_HEADERS'));
  jobs.forEach((job) => {
    const folder = world.drive.getFolderById(job['Drive Folder ID']);
    assert.equal(folder.getName(), job['Job #'] + ' - ' + job['Job Name']);
    ['Daily Reports', 'Change Orders', 'Photos'].forEach((name) => {
      assert.equal(folder.getFoldersByName(name).hasNext(), true, name);
    });
    assert.equal(folder.getFoldersByName('Daily Reports').next().getFoldersByName('2026-11-03').hasNext(), false);
  });
  const demo = child(world.drive.getRootFolder(), 'Field-to-Office Demo');
  assert.equal(demo.getFoldersByName('Jobs').hasNext(), true);
});

test('AT3 a second setup does not duplicate tabs, folders, the form, or the trigger', () => {
  const { world, app } = ready();
  app.setup();
  ['Job Log', 'Crew Hours', 'Flags', 'Dashboard', 'Jobs'].forEach((name) => {
    assert.equal(world.ss.getSheets().filter((sheet) => sheet.getName() === name).length, 1);
  });
  assert.equal(objects(world.ss.getSheetByName('Jobs'), headers(app, 'JOBS_HEADERS')).length, 3);
  assert.equal(countNamed(world.drive.getRootFolder(), 'Field-to-Office Demo'), 1);
  assert.equal(Object.keys(world.forms.forms).length, 1);
  assert.equal(world.scriptApp.triggers.length, 1);
  assert.equal(world.scriptApp.triggers[0].getHandlerFunction(), 'onReportSubmit');
  assert.equal(world.scriptApp.triggers[0].getEventType(), 'ON_FORM_SUBMIT');
  assert.equal(world.ss.getSheetByName('Form Responses 1') != null, true);
  assert.equal(Object.values(world.forms.forms)[0].getItems().length, 4);
  const jobsFolder = child(child(world.drive.getRootFolder(), 'Field-to-Office Demo'), 'Jobs');
  assert.equal(countNamed(jobsFolder, J2401), 1);
});

test('GEMINI_MODEL overrides the model and a blank property keeps the default', () => {
  const { world, app } = ready();
  const def = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
  queue(world, geminiOk(baseExtraction({ summary: 'Default model.' })));
  submit(app, { text: 'default model' });
  assert.equal(world.url.calls[0].url, def);
  world.props.setProperty('GEMINI_MODEL', '   ');
  queue(world, geminiOk(baseExtraction({ summary: 'Blank model.' })));
  submit(app, { text: 'blank model property' });
  assert.equal(world.url.calls[1].url, def);
  world.props.setProperty('GEMINI_MODEL', 'gemini-test-model');
  queue(world, geminiOk(baseExtraction({ summary: 'Override model.' })));
  submit(app, { text: 'override model' });
  assert.equal(
    world.url.calls[2].url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
  );
});

test('AT4 a text-only submission is logged first, then processed from one Gemini call', () => {
  const { world, app } = ready();
  const response = geminiOk(baseExtraction({ summary: 'Service upgrade feeder pull.', total_hours: 24 }));
  response.before = function () {
    const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
    assert.equal(row.Status, 'Processing');
    assert.equal(row['Report Text'], 'Worked the service upgrade.');
    assert.equal(row.Source, 'Form');
  };
  queue(world, response);
  submit(app, { text: 'Worked the service upgrade.' });
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.equal(row.Summary, 'Service upgrade feeder pull.');
  assert.equal(row['Total Hours'], 24);
  assert.equal(row.Source, 'Form');
  assert.match(row['Report ID'], /^R-\d{8}-\d{6}-[A-Z0-9]{4}$/);
  assert.equal(world.url.calls.length, 1);
  assert.equal(world.url.calls[0].url, app.GEMINI_URL);
  assert.equal(world.url.calls[0].options.headers['x-goog-api-key'], KEY);
  assert.equal(world.url.calls[0].options.muteHttpExceptions, true);
  assert.equal(world.url.calls[0].url.includes('?'), false);
  assert.equal(world.url.calls[0].payload.generationConfig.temperature, 0.2);
  assert.equal(world.url.calls[0].payload.generationConfig.responseMimeType, 'application/json');
  assert.equal(world.url.calls[0].payload.contents[0].parts.length, 1);
  assert.equal(world.lock.waits[0], 30000);
  assert.equal(dumpContainsKey(world), false);
});

test('AT5 three crew members become three Crew Hours rows whose hours sum to the report', () => {
  const { world, app } = ready();
  queue(world, geminiOk(baseExtraction()));
  submit(app, { job: J2401, foreman: 'Luis Ramirez', text: 'Three crew on site.' });
  const log = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  const crew = objects(world.ss.getSheetByName('Crew Hours'), headers(app, 'CREW_HEADERS'));
  assert.equal(crew.length, 3);
  assert.equal(crew.every((row) => row['Report ID'] === log['Report ID']), true);
  const sum = crew.reduce((total, row) => total + row.Hours, 0);
  assert.equal(sum, 24);
  assert.equal(sum, log['Total Hours']);
  assert.equal(log['Crew Count'], 3);
});

test('AT6 a change order is a Pending flag and the Status column has the review dropdown', () => {
  const { world, app } = ready();
  const quote = 'GC asked us to add 4 receptacles in Room 112, not on drawings';
  queue(world, geminiOk(baseExtraction({
    possible_change_orders: [{
      description: 'Add 4 duplex receptacles, Room 112',
      reason: 'Not on drawings; GC super requested',
      evidence_quote: quote,
    }],
  })));
  submit(app, { job: J2401, foreman: 'Luis Ramirez', text: quote });
  const flags = objects(world.ss.getSheetByName('Flags'), headers(app, 'FLAG_HEADERS'));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].Type, 'Change order');
  assert.equal(flags[0].Status, 'Pending');
  assert.equal(flags[0]['Evidence Quote'], quote);
  assert.equal(flags[0]['Reviewed By'], '');
  assert.equal(flags[0]['Reviewed At'], '');
  const rule = world.ss.getSheetByName('Flags').validations[0].rule;
  assert.deepEqual(host(rule.list), ['Pending', 'Approved', 'Rejected']);
  assert.equal(rule.allowInvalid, false);
});

test('AT7 a material shortage keeps quantity in Detail and fills Needed By', () => {
  const { world, app } = ready();
  queue(world, geminiOk(baseExtraction({
    crew: [{ name: "Kevin O'Brien", classification: 'Foreman', hours: 8 }],
    total_hours: 8,
    material_shortages: [{ item: '3/4" EMT', qty: '200 ft', needed_by: 'Thursday' }],
  })));
  submit(app, { text: 'We are short 200 ft of 3/4 EMT, need by Thursday.' });
  const flags = objects(world.ss.getSheetByName('Flags'), headers(app, 'FLAG_HEADERS'));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].Type, 'Material shortage');
  assert.match(String(flags[0].Detail), /200/);
  assert.equal(flags[0]['Needed By'], 'Thursday');
  assert.equal(flags[0].Status, 'Pending');
});

test('AT8 photos and a voice note are renamed into the date folder and linked', () => {
  const { world, app } = ready();
  const photo1 = world.drive.addFile({ name: 'site.JPG', mimeType: 'image/jpeg', size: 1000 });
  const photo2 = world.drive.addFile({ name: 'panel.PNG', mimeType: 'image/png', size: 2000 });
  const voice = world.drive.addFile({ name: 'note.m4a', mimeType: 'audio/mp4', size: 3000 });
  queue(world, geminiOk(baseExtraction()));
  submit(app, {
    job: J2401,
    foreman: 'Luis Ramirez',
    reportDate: '2026-11-03',
    photos: photo1.getUrl() + ', ' + photo2.getUrl(),
    voice: voice.getUrl(),
  });
  assert.equal(photo1.getName(), '2026-11-03_J-2401_Luis-Ramirez_1.jpg');
  assert.equal(photo2.getName(), '2026-11-03_J-2401_Luis-Ramirez_2.png');
  assert.equal(voice.getName(), '2026-11-03_J-2401_Luis-Ramirez_3.m4a');
  const dateFolder = child(child(jobFolder(world, J2401), 'Daily Reports'), '2026-11-03');
  [photo1, photo2, voice].forEach((file) => assert.equal(file.parent, dateFolder));
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row['Photo Links'], photo1.getUrl() + '\n' + photo2.getUrl());
  assert.equal(row['Voice Note Link'], voice.getUrl());
  assert.equal(row['Report Folder'], dateFolder.getUrl());
  assert.equal(world.url.calls[0].payload.contents[0].parts.length, 4);
});

test('AT9 an HTTP 400 or 401 keeps the row, the report text, and writes no crew or flags', () => {
  [400, 401].forEach((code) => {
    const { world, app } = ready();
    const response = {
      code,
      body: { error: { message: 'API key not valid' } },
      before() {
        const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
        assert.equal(row.Status, 'Processing');
        assert.equal(row['Report Text'], 'Original foreman text.');
      },
    };
    queue(world, response);
    submit(app, { text: 'Original foreman text.' });
    const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
    assert.equal(row.Status, 'Needs review');
    assert.equal(row.Errors, 'Gemini HTTP ' + code + ': API key not valid');
    assert.equal(row['Report Text'], 'Original foreman text.');
    assert.match(row['Raw AI Output'], /API key not valid/);
    assert.equal(objects(world.ss.getSheetByName('Crew Hours'), headers(app, 'CREW_HEADERS')).length, 0);
    assert.equal(objects(world.ss.getSheetByName('Flags'), headers(app, 'FLAG_HEADERS')).length, 0);
    assert.equal(world.url.calls.length, 1);
  });
});

test('AT10 invalid JSON is Needs review, says invalid JSON, and keeps the raw text', () => {
  const { world, app } = ready();
  queue(world, {
    code: 200,
    body: {
      candidates: [{ content: { parts: [{ text: 'this is not json' }] }, finishReason: 'STOP' }],
    },
  });
  submit(app);
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Needs review');
  assert.equal(row.Errors, 'invalid JSON');
  assert.equal(row['Raw AI Output'], 'this is not json');
  assert.equal(objects(world.ss.getSheetByName('Crew Hours'), headers(app, 'CREW_HEADERS')).length, 0);
  assert.equal(objects(world.ss.getSheetByName('Flags'), headers(app, 'FLAG_HEADERS')).length, 0);
});

test('AT11 an approved flag is unchanged by a later submission, and approval sends nothing', () => {
  const { world, app } = ready();
  queue(world, geminiOk(baseExtraction({
    possible_change_orders: [{
      description: 'Add receptacles',
      reason: 'Not on drawings',
      evidence_quote: 'add 4 receptacles',
    }],
  })));
  submit(app, { text: 'First report' });
  const flagsSheet = world.ss.getSheetByName('Flags');
  const headerList = headers(app, 'FLAG_HEADERS');
  flagsSheet.getRange(2, headerList.indexOf('Status') + 1).setValue('Approved');
  flagsSheet.getRange(2, headerList.indexOf('PM Note') + 1).setValue('Price as T&M');
  flagsSheet.getRange(2, headerList.indexOf('Reviewed By') + 1).setValue('Dana Ortiz');
  flagsSheet.getRange(2, headerList.indexOf('Reviewed At') + 1).setValue('2026-11-03 17:10:00');
  const before = host(flagsSheet.getRange(2, 1, 1, headerList.length).getValues());
  const filesBefore = Object.keys(world.drive.files).length;
  const dashboardBefore = host(app.dashboardCells().map((cell) => world.ss.getSheetByName('Dashboard').getRange(cell.row, cell.col).getValue()));
  queue(world, geminiOk(baseExtraction({ crew: [{ name: 'A', classification: 'Foreman', hours: 8 }], total_hours: 8 })));
  submit(app, { text: 'Second report', job: J2401, foreman: 'Luis Ramirez' });
  const after = host(flagsSheet.getRange(2, 1, 1, headerList.length).getValues());
  assert.deepEqual(after, before);
  assert.equal(Object.keys(world.drive.files).length, filesBefore);
  const source = fs.readFileSync(path.join(root, 'App.js'), 'utf8') + fs.readFileSync(path.join(root, 'Logic.js'), 'utf8');
  assert.equal(/\b(MailApp|GmailApp|sendEmail|timeBased|everyMinutes)\b/.test(source), false);
  assert.equal(world.scriptApp.triggers.every((trigger) => trigger.getEventType() === 'ON_FORM_SUBMIT'), true);
  const dashboardAfter = host(app.dashboardCells().map((cell) => world.ss.getSheetByName('Dashboard').getRange(cell.row, cell.col).getValue()));
  assert.deepEqual(dashboardAfter, dashboardBefore);
});

test('AT12 dashboard formulas cover today, hours, open flags, and the 15-minute assumption', () => {
  const { world, app } = ready();
  const sheet = world.ss.getSheetByName('Dashboard');
  app.dashboardCells().forEach((cell) => {
    assert.equal(sheet.getRange(cell.row, cell.col).getValue(), cell.value);
  });
  const values = app.dashboardCells().map((cell) => String(cell.value)).join('\n');
  assert.match(values, /Report Date|C2:C=TODAY\(\)/);
  assert.match(values, /QUERY\('Crew Hours'!/);
  assert.match(values, /COUNTIF\('Flags'!K2:K,"Pending"\)/);
  assert.match(values, /Assumption, not measured/);
  assert.match(values, /=B161\*B162/);
  assert.equal(app.dashboardCells().some((cell) => cell.value === 15), true);
});

test('AT13 loadSampleReports adds three sample rows once and skips them on the second run', () => {
  const { world, app } = ready();
  world.url.handler = function (call) {
    const text = call.payload.contents[0].parts[0].text;
    if (text.includes('receptacles')) {
      return geminiOk(baseExtraction({
        possible_change_orders: [{
          description: 'Add 4 receptacles',
          reason: 'Not on drawings',
          evidence_quote: 'GC asked us to add 4 receptacles in Room 112, not on drawings',
        }],
      }));
    }
    if (text.includes('3/4 EMT')) {
      return geminiOk(baseExtraction({
        crew: [
          { name: "Kevin O'Brien", classification: 'Foreman', hours: 8 },
          { name: 'Matt Ruiz', classification: 'Journeyman Wireman', hours: 8 },
        ],
        total_hours: 16,
        material_shortages: [{ item: '3/4" EMT', qty: '200 ft', needed_by: 'Thursday' }],
      }));
    }
    return geminiOk(baseExtraction({
      crew: [
        { name: 'Tom Kowalski', classification: 'Foreman', hours: 8 },
        { name: 'Elena Voss', classification: 'Journeyman Wireman', hours: 8 },
      ],
      total_hours: 16,
      summary: 'Detectors replaced.',
    }));
  };
  app.loadSampleReports();
  const logHeaders = headers(app, 'JOB_LOG_HEADERS');
  const first = objects(world.ss.getSheetByName('Job Log'), logHeaders);
  assert.equal(first.length, 3);
  assert.equal(first.every((row) => row.Source === 'Sample' && row.Status === 'Processed'), true);
  assert.deepEqual(first.map((row) => row['Job #']), ['J-2401', 'J-2402', 'J-2403']);
  const calls = world.url.calls.length;
  app.loadSampleReports();
  const second = objects(world.ss.getSheetByName('Job Log'), logHeaders);
  assert.equal(second.length, 3);
  assert.equal(world.url.calls.length, calls);
  const flags = objects(world.ss.getSheetByName('Flags'), headers(app, 'FLAG_HEADERS'));
  assert.equal(flags.some((row) => row.Type === 'Change order'), true);
  assert.equal(flags.some((row) => row.Type === 'Material shortage'), true);
});

test('AT14 the repo contains no Gemini API key', () => {
  let stdout = '';
  let status = 0;
  try {
    stdout = execFileSync('git', ['grep', '-nE', 'AIza[0-9A-Za-z_-]{20,}|GEMINI_API_KEY\\s*[:=]\\s*[\'"][^\'"]+'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (err) {
    status = err.status;
    stdout = err.stdout || '';
  }
  assert.equal(status, 1);
  assert.equal(stdout, '');
});

test('schema mismatch and a blocked response write no crew or flag rows', () => {
  const mismatch = ready();
  queue(mismatch.world, {
    code: 200,
    body: { candidates: [{ content: { parts: [{ text: '{"summary":"only"}' }] }, finishReason: 'STOP' }] },
  });
  submit(mismatch.app, { text: 'schema case' });
  let row = objects(mismatch.world.ss.getSheetByName('Job Log'), headers(mismatch.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Needs review');
  assert.match(row.Errors, /schema mismatch/);
  assert.equal(objects(mismatch.world.ss.getSheetByName('Crew Hours'), headers(mismatch.app, 'CREW_HEADERS')).length, 0);

  const blocked = ready();
  queue(blocked.world, { code: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } });
  submit(blocked.app, { text: 'blocked case' });
  row = objects(blocked.world.ss.getSheetByName('Job Log'), headers(blocked.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Needs review');
  assert.match(row.Errors, /blocked response/);
  assert.equal(objects(blocked.world.ss.getSheetByName('Flags'), headers(blocked.app, 'FLAG_HEADERS')).length, 0);
});

test('429 is retried once and then succeeds; a second 429 becomes Needs review', () => {
  const ok = ready();
  queue(ok.world, { code: 429, body: { error: { message: 'slow down' } } });
  queue(ok.world, geminiOk(baseExtraction({ summary: 'Recovered.' })));
  submit(ok.app, { text: 'retry me' });
  assert.equal(ok.world.url.calls.length, 2);
  assert.equal(objects(ok.world.ss.getSheetByName('Job Log'), headers(ok.app, 'JOB_LOG_HEADERS'))[0].Status, 'Processed');

  const fail = ready();
  queue(fail.world, { code: 429, body: 'rate' });
  queue(fail.world, { code: 503, body: 'unavailable' });
  submit(fail.app, { text: 'still failing' });
  const row = objects(fail.world.ss.getSheetByName('Job Log'), headers(fail.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(fail.world.url.calls.length, 2);
  assert.equal(row.Status, 'Needs review');
  assert.match(row.Errors, /Gemini HTTP 503/);
  assert.equal(objects(fail.world.ss.getSheetByName('Crew Hours'), headers(fail.app, 'CREW_HEADERS')).length, 0);
});

test('attachments over 15 MB are filed and the Gemini call is text only', () => {
  const { world, app } = ready();
  const huge = world.drive.addFile({
    name: 'site.jpg',
    mimeType: 'image/jpeg',
    size: 15 * 1024 * 1024 + 1,
  });
  queue(world, geminiOk(baseExtraction({ summary: 'Text only.' })));
  submit(app, { job: J2401, foreman: 'Luis Ramirez', photos: huge.getUrl() });
  assert.equal(huge.getName(), '2026-11-03_J-2401_Luis-Ramirez_1.jpg');
  assert.equal(huge.parent.getName(), '2026-11-03');
  assert.equal(huge.bytesReads, 0);
  assert.equal(world.url.calls[0].payload.contents[0].parts.length, 1);
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.match(row.Errors, /attachments skipped: size/);
  assert.equal(row['Photo Links'], huge.getUrl());
});

test('an unknown job is logged, leaves the file in place, and still records unknown job', () => {
  const { world, app } = ready();
  const photo = world.drive.addFile({ name: 'loose.jpg', mimeType: 'image/jpeg', size: 50 });
  const parentBefore = photo.parent;
  queue(world, geminiOk(baseExtraction()));
  submit(app, { job: 'J-9999 - Nowhere', photos: photo.getUrl() });
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row['Job #'], 'J-9999');
  assert.equal(row.Errors, 'unknown job');
  assert.equal(row.Status, 'Processed');
  assert.equal(row['Photo Links'], photo.getUrl());
  assert.equal(photo.parent, parentBefore);
  assert.equal(photo.getName(), 'loose.jpg');
  assert.equal(world.url.calls.length, 1);
  assert.equal(world.url.calls[0].payload.contents[0].parts.length, 1);
});

test('empty crew writes no Crew Hours rows and a total_hours mismatch stays Processed', () => {
  const empty = ready();
  queue(empty.world, geminiOk(baseExtraction({ crew: [], total_hours: 0, summary: 'No crew named.' })));
  submit(empty.app, { text: 'No names today.' });
  let row = objects(empty.world.ss.getSheetByName('Job Log'), headers(empty.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.equal(row['Crew Count'], 0);
  assert.equal(objects(empty.world.ss.getSheetByName('Crew Hours'), headers(empty.app, 'CREW_HEADERS')).length, 0);

  const mismatch = ready();
  queue(mismatch.world, geminiOk(baseExtraction({
    crew: [{ name: 'Luis Ramirez', classification: 'Foreman', hours: 8 }],
    total_hours: 20,
  })));
  submit(mismatch.app, { text: 'Hours disagree.' });
  row = objects(mismatch.world.ss.getSheetByName('Job Log'), headers(mismatch.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.equal(row['Total Hours'], 20);
  assert.match(row.Errors, /total_hours mismatch/);
  const crew = objects(mismatch.world.ss.getSheetByName('Crew Hours'), headers(mismatch.app, 'CREW_HEADERS'));
  assert.equal(crew.length, 1);
  assert.equal(crew[0].Hours, 8);
});

test('a file name already in the date folder takes the next index, and a failed move keeps the original link', () => {
  const collision = ready();
  const daily = child(jobFolder(collision.world, J2401), 'Daily Reports');
  const folder = daily.createFolder('2026-11-03');
  collision.world.drive.addFile({
    name: '2026-11-03_J-2401_Luis-Ramirez_1.jpg',
    mimeType: 'image/jpeg',
    size: 10,
    parent: folder,
  });
  const photo = collision.world.drive.addFile({ name: 'new.JPG', mimeType: 'image/jpeg', size: 10 });
  queue(collision.world, geminiOk(baseExtraction()));
  submit(collision.app, { job: J2401, foreman: 'Luis Ramirez', photos: photo.getUrl() });
  assert.equal(photo.getName(), '2026-11-03_J-2401_Luis-Ramirez_2.jpg');
  assert.equal(photo.parent, folder);

  const failed = ready();
  const stuck = failed.world.drive.addFile({ name: 'stuck.jpg', mimeType: 'image/jpeg', size: 10, failMove: true });
  queue(failed.world, geminiOk(baseExtraction({ summary: 'Filed the text.' })));
  submit(failed.app, { job: J2401, foreman: 'Luis Ramirez', photos: stuck.getUrl(), text: 'Move will fail.' });
  const row = objects(failed.world.ss.getSheetByName('Job Log'), headers(failed.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.equal(row['Photo Links'], stuck.getUrl());
  assert.match(row.Errors, /file move failed/);
  assert.equal(stuck.parent, null);
});

test('a blank report date uses the submission date in America/New_York', () => {
  const { world, app } = ready({ now: '2026-11-04T03:30:00.000Z' });
  queue(world, geminiOk(baseExtraction()));
  submit(app, { reportDate: '', timestamp: '' });
  const raw = world.ss.getSheetByName('Job Log').getRange(2, 3).getValue();
  assert.equal(app.isoDateInTimeZone(raw, app.TIME_ZONE), '2026-11-03');
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.match(row['Report ID'], /^R-20261103-223000-/);
});

test('setup finishes without a key, and a missing key does not drop the submission', () => {
  const { world, app } = boot({ noKey: true });
  app.setup();
  assert.ok(world.ss.getSheetByName('Job Log'));
  assert.equal(Object.keys(world.forms.forms).length, 1);
  assert.match(world.ss.alerts.join('\n'), /GEMINI_API_KEY is not set/);
  assert.match(world.logs.join('\n'), /Photos/);
  queue(world, geminiOk(baseExtraction()));
  submit(app, { text: 'No key yet.' });
  const row = objects(world.ss.getSheetByName('Job Log'), headers(app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Needs review');
  assert.match(row.Errors, /GEMINI_API_KEY is not set/);
  assert.equal(row['Report Text'], 'No key yet.');
  assert.equal(world.url.calls.length, 0);
  assert.equal(objects(world.ss.getSheetByName('Crew Hours'), headers(app, 'CREW_HEADERS')).length, 0);
});

test('a thrown fetch and a lock timeout still leave a Job Log row', () => {
  const timedOut = ready();
  queue(timedOut.world, { throw: 'Timeout' });
  submit(timedOut.app, { text: 'network died' });
  let row = objects(timedOut.world.ss.getSheetByName('Job Log'), headers(timedOut.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Needs review');
  assert.match(row.Errors, /Timeout/);
  assert.equal(row['Report Text'], 'network died');

  const locked = ready();
  locked.world.lock.fail = true;
  queue(locked.world, geminiOk(baseExtraction({ summary: 'Locked but logged.' })));
  submit(locked.app, { text: 'during lock timeout' });
  row = objects(locked.world.ss.getSheetByName('Job Log'), headers(locked.app, 'JOB_LOG_HEADERS'))[0];
  assert.equal(row.Status, 'Processed');
  assert.equal(row['Report Text'], 'during lock timeout');
});
