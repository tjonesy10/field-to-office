/**
 * Bound-spreadsheet entry points: setup, the form trigger, and sample reports.
 * Google service calls live here. Row and request shapes live in Logic.js.
 */

function onOpen() {
  installMenu_();
}

function setup() {
  var ss = spreadsheet_();
  ss.setSpreadsheetTimeZone(TIME_ZONE);
  ensureSheet_('Job Log', JOB_LOG_HEADERS);
  ensureSheet_('Crew Hours', CREW_HEADERS);
  var flags = ensureSheet_('Flags', FLAG_HEADERS);
  var dashboard = ensureSheet_('Dashboard');
  var jobsSheet = ensureSheet_('Jobs', JOBS_HEADERS);
  ensureFlagValidation_(flags);
  ensureFormats_();
  var jobs = sampleJobs();
  ensureDriveTree_(jobs);
  writeJobs_(jobsSheet, jobs);
  var form = ensureForm_(jobs);
  ensureTrigger_();
  installMenu_();
  writeDashboard_(dashboard);
  finishSetupNotice_(form);
}

function onReportSubmit(event) {
  withLock_(function () {
    processSubmission_(event, 'Form');
  });
}

function loadSampleReports() {
  var jobsByNumber = {};
  readJobs_().forEach(function (job) {
    jobsByNumber[job.number] = job;
  });
  var seen = {};
  readReportTexts_().forEach(function (text) {
    seen[text] = true;
  });
  sampleReports().forEach(function (sample) {
    if (seen[sample.reportText]) return;
    var job = jobsByNumber[sample.jobNumber];
    var event = {
      namedValues: {
        Timestamp: [formatInTimeZone(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm:ss')],
        Job: [job ? jobChoiceLabel(job) : sample.jobNumber],
        'Foreman name': [sample.foreman],
        'Report date': [''],
        'Report text': [sample.reportText],
      },
    };
    withLock_(function () {
      processSubmission_(event, 'Sample');
    });
    seen[sample.reportText] = true;
  });
}

function withLock_(fn) {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
  } catch (err) {
    Logger.log('Continuing without the script lock so the submission is still logged.');
  }
  try {
    return fn();
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (ignore) {}
    }
  }
}

function processSubmission_(event, source) {
  var input = normalizeSubmission_(event);
  var job = findJob(readJobs_(), input.jobNumber);
  var reportId = makeReportId(input.submittedAt, randomChars(4, Math.random));
  var reportDate = sheetMidnight(input.reportDateIso, TIME_ZONE);
  var rowIndex = appendRow_(sheetByName_('Job Log'), buildInitialJobLogRow({
    reportId: reportId,
    submittedAt: input.submittedAt,
    reportDate: reportDate,
    jobNumber: input.jobNumber,
    jobName: job ? job.name : '',
    pm: job ? job.pm : '',
    foreman: input.foreman,
    reportText: input.reportText,
    source: source,
  }));

  var errors = [];
  var photoLinks = [];
  var voiceLink = '';
  var folderUrl = '';
  var attachments = [];

  if (!job || !job.folderId) {
    // The job is not on the Jobs tab. Keep the files where the Form put them.
    errors.push('unknown job');
    photoLinks = input.photoUrls.slice();
    voiceLink = input.voiceUrl || '';
  } else {
    var filed = fileUploads_(job, input.reportDateIso, input);
    errors = filed.errors.slice();
    photoLinks = filed.photoLinks;
    voiceLink = filed.voiceLink;
    folderUrl = filed.folderUrl;
    attachments = filed.attachments;
  }

  updateJobLogRow_(rowIndex, {
    'Photo Links': linesJoin(photoLinks),
    'Voice Note Link': voiceLink,
    'Report Folder': folderUrl,
    Errors: joinErrors(errors),
  });

  var gemini = callGemini_(input, attachments);
  if (!gemini.ok) {
    updateJobLogRow_(rowIndex, {
      Status: 'Needs review',
      Errors: joinErrors(errors.concat([gemini.error])),
      'Raw AI Output': truncateRaw(gemini.raw),
    });
    return;
  }

  var mismatch = hoursMismatchNote(gemini.value.total_hours, gemini.value.crew);
  if (mismatch) errors.push(mismatch);
  var flags = buildFlagRows(reportId, reportDate, input.jobNumber, job ? job.pm : '', gemini.value);
  var crewRows = buildCrewRows(reportId, reportDate, input.jobNumber, input.foreman, gemini.value.crew);
  updateJobLogRow_(rowIndex, {
    Summary: gemini.value.summary,
    'Total Hours': gemini.value.total_hours,
    'Crew Count': gemini.value.crew.length,
    'Work Completed': linesJoin(gemini.value.work_completed),
    Issues: linesJoin(gemini.value.issues),
    'Flags Raised': flags.length,
    Confidence: gemini.value.confidence,
    Status: 'Processed',
    Errors: joinErrors(errors),
  });
  crewRows.forEach(function (row) {
    appendRow_(sheetByName_('Crew Hours'), row);
  });
  flags.forEach(function (row) {
    appendRow_(sheetByName_('Flags'), row);
  });
}

function normalizeSubmission_(event) {
  var named = namedValuesFromEvent(event);
  var choice = parseJobChoice(firstNamed(named, 'Job'));
  var submittedAt = parseTimestampToDate(firstNamed(named, 'Timestamp'), TIME_ZONE) || new Date();
  var voice = splitFileList(named['Voice note']);
  return {
    jobNumber: choice.jobNumber,
    foreman: firstNamed(named, 'Foreman name'),
    reportText: firstNamed(named, 'Report text'),
    reportDateIso: reportDateIso(firstNamed(named, 'Report date'), submittedAt),
    submittedAt: submittedAt,
    photoUrls: splitFileList(named.Photos),
    voiceUrl: voice.length ? voice[0] : '',
  };
}

function fileUploads_(job, reportDateIso, input) {
  var result = {
    errors: [],
    photoLinks: [],
    voiceLink: '',
    folderUrl: '',
    attachments: [],
    totalBytes: 0,
  };
  var items = [];
  input.photoUrls.forEach(function (url) {
    items.push({ url: url, kind: 'photo' });
  });
  if (input.voiceUrl) items.push({ url: input.voiceUrl, kind: 'voice' });
  if (!items.length) return result;

  var dateFolder = jobDateFolder_(job, reportDateIso, result);
  if (!dateFolder) {
    items.forEach(function (item) {
      keepOriginalLink_(result, item);
    });
    return result;
  }
  result.folderUrl = dateFolder.getUrl();

  var opened = items.map(function (item) {
    return { item: item, file: openUpload_(item.url, result) };
  });
  var namable = [];
  opened.forEach(function (entry) {
    if (entry.file) namable.push({ ext: entry.file.ext });
  });
  var names = allocateFileNames(reportDateIso, job.number, input.foreman, namable, function (name) {
    return dateFolder.getFilesByName(name).hasNext();
  });

  var nameIndex = 0;
  var totalBytes = 0;
  opened.forEach(function (entry) {
    if (!entry.file) {
      keepOriginalLink_(result, entry.item);
      return;
    }
    totalBytes += entry.file.size;
    var allocated = names[nameIndex];
    nameIndex++;
    var link = entry.item.url;
    try {
      entry.file.handle.moveTo(dateFolder);
      entry.file.handle.setName(allocated.name);
      entry.moved = true;
      link = entry.file.handle.getUrl();
    } catch (err) {
      result.errors.push('file move failed: ' + entry.item.url);
      entry.moved = false;
    }
    if (entry.item.kind === 'photo') result.photoLinks.push(link);
    else result.voiceLink = link;
  });

  result.totalBytes = totalBytes;
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    result.errors.push('attachments skipped: size');
    return result;
  }

  opened.forEach(function (entry) {
    if (!entry.file || !entry.moved) return;
    try {
      result.attachments.push({
        mimeType: entry.file.mimeType,
        base64: Utilities.base64Encode(entry.file.handle.getBlob().getBytes()),
      });
    } catch (err) {
      result.errors.push('attachment read failed');
    }
  });
  return result;
}

function openUpload_(url, result) {
  var id = fileIdFromUrl(url);
  if (!id) {
    result.errors.push('file move failed: could not read file id');
    return null;
  }
  try {
    var file = DriveApp.getFileById(id);
    return {
      handle: file,
      ext: extensionFor(file.getName(), file.getMimeType()),
      size: Number(file.getSize()) || 0,
      mimeType: file.getMimeType() || 'application/octet-stream',
    };
  } catch (err) {
    result.errors.push('file move failed: ' + id);
    return null;
  }
}

function jobDateFolder_(job, reportDateIso, result) {
  try {
    var jobFolder = DriveApp.getFolderById(job.folderId);
    var daily = getOrCreateChildFolder_(jobFolder, 'Daily Reports');
    return getOrCreateChildFolder_(daily, reportDateIso);
  } catch (err) {
    result.errors.push('file move failed: job folder missing');
    return null;
  }
}

function keepOriginalLink_(result, item) {
  if (item.kind === 'photo') result.photoLinks.push(item.url);
  else result.voiceLink = item.url;
}

function callGemini_(input, attachments) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GEMINI_API_KEY');
  if (!key) return { ok: false, error: 'GEMINI_API_KEY is not set', raw: '' };
  var url = geminiGenerateUrl(props.getProperty('GEMINI_MODEL'));

  var prompt = buildPrompt({
    jobNumber: input.jobNumber,
    foreman: input.foreman,
    reportDateIso: input.reportDateIso,
    reportText: input.reportText,
    hasAttachments: attachments.length > 0,
  });
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify(buildGeminiRequest(prompt, attachments)),
    muteHttpExceptions: true,
  };

  var lastCode = 0;
  var lastBody = '';
  var attempt;
  for (attempt = 1; attempt <= 2; attempt++) {
    var response;
    try {
      response = UrlFetchApp.fetch(url, options);
    } catch (err) {
      var message = err && err.message ? err.message : String(err);
      return { ok: false, error: 'Gemini request failed: ' + message, raw: '' };
    }
    lastCode = response.getResponseCode();
    lastBody = response.getContentText();
    if (lastCode === 429 || lastCode >= 500) {
      if (attempt === 1) continue;
      return { ok: false, error: httpErrorMessage(lastCode, lastBody), raw: lastBody };
    }
    if (lastCode < 200 || lastCode >= 300) {
      return { ok: false, error: httpErrorMessage(lastCode, lastBody), raw: lastBody };
    }
    return parseGeminiHttpBody(lastBody);
  }
  return { ok: false, error: httpErrorMessage(lastCode, lastBody), raw: lastBody };
}

function ensureSheet_(name, headers) {
  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (!headers || !headers.length) return sheet;
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var same = headers.every(function (header, index) {
    return current[index] === header;
  });
  if (!same && sheet.getLastRow() <= 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureFlagValidation_(sheet) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Approved', 'Rejected'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('K2:K1000').setDataValidation(rule);
}

function ensureFormats_() {
  sheetByName_('Job Log').getRange('B2:B1000').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheetByName_('Job Log').getRange('C2:C1000').setNumberFormat('yyyy-mm-dd');
  sheetByName_('Crew Hours').getRange('B2:B1000').setNumberFormat('yyyy-mm-dd');
  sheetByName_('Flags').getRange('C2:C1000').setNumberFormat('yyyy-mm-dd');
  sheetByName_('Flags').getRange('N2:N1000').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function writeJobs_(sheet, jobs) {
  var existing = {};
  var last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, 4).getValues().forEach(function (row, index) {
      if (row[0]) existing[String(row[0])] = index + 2;
    });
  }
  jobs.forEach(function (job) {
    var rowNumber = existing[job.number];
    if (rowNumber) {
      if (!sheet.getRange(rowNumber, 4).getValue()) {
        sheet.getRange(rowNumber, 4).setValue(job.folderId);
      }
      return;
    }
    sheet.appendRow([job.number, job.name, job.pm, job.folderId, true]);
  });
  var end = sheet.getLastRow();
  if (end >= 2) sheet.getRange(2, 5, end - 1, 1).insertCheckboxes();
}

function ensureDriveTree_(jobs) {
  var root = ensureDemoRoot_();
  var jobsFolder = getOrCreateChildFolder_(root, 'Jobs');
  jobs.forEach(function (job) {
    var folder = getOrCreateChildFolder_(jobsFolder, jobChoiceLabel(job));
    getOrCreateChildFolder_(folder, 'Daily Reports');
    getOrCreateChildFolder_(folder, 'Change Orders');
    getOrCreateChildFolder_(folder, 'Photos');
    job.folderId = folder.getId();
  });
}

function ensureDemoRoot_() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('FTO_ROOT_FOLDER_ID');
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (err) {
      // Stored id is stale. Find or create the demo folder below.
    }
  }
  var root = DriveApp.getRootFolder();
  var matches = root.getFoldersByName('Field-to-Office Demo');
  var folder = matches.hasNext() ? matches.next() : root.createFolder('Field-to-Office Demo');
  props.setProperty('FTO_ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function getOrCreateChildFolder_(parent, name) {
  var found = parent.getFoldersByName(name);
  if (found.hasNext()) return found.next();
  return parent.createFolder(name);
}

function ensureForm_(jobs) {
  var props = PropertiesService.getScriptProperties();
  var form = null;
  var existingId = props.getProperty('FTO_FORM_ID');
  if (existingId) {
    try {
      form = FormApp.openById(existingId);
    } catch (err) {
      form = null;
    }
  }
  if (!form) {
    form = FormApp.create('Field-to-Office Daily Report');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet_().getId());
    props.setProperty('FTO_FORM_ID', form.getId());
  }
  ensureFormQuestions_(form, jobs);
  return form;
}

function ensureFormQuestions_(form, jobs) {
  var titles = {};
  form.getItems().forEach(function (item) {
    titles[item.getTitle()] = item;
  });
  var choices = jobs.map(function (job) {
    return jobChoiceLabel(job);
  });
  if (!titles.Job) {
    form.addListItem().setTitle('Job').setRequired(true).setChoiceValues(choices);
  } else {
    titles.Job.asListItem().setChoiceValues(choices);
  }
  if (!titles['Foreman name']) {
    form.addTextItem().setTitle('Foreman name').setRequired(true);
  }
  if (!titles['Report date']) {
    form.addDateItem().setTitle('Report date').setRequired(false);
  }
  if (!titles['Report text']) {
    form.addParagraphTextItem().setTitle('Report text').setRequired(true);
  }
}

function ensureTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function (trigger) {
    return trigger.getHandlerFunction() === 'onReportSubmit';
  });
  if (exists) return;
  ScriptApp.newTrigger('onReportSubmit')
    .forSpreadsheet(spreadsheet_())
    .onFormSubmit()
    .create();
}

function installMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('Field-to-Office')
    .addItem('Setup', 'setup')
    .addItem('Load sample reports', 'loadSampleReports')
    .addToUi();
}

function writeDashboard_(sheet) {
  if (sheet.getRange(1, 1).getValue() === "Today's reports") return;
  dashboardCells().forEach(function (cell) {
    sheet.getRange(cell.row, cell.col).setValue(cell.value);
  });
}

function finishSetupNotice_(form) {
  var lines = [
    'Form edit URL: ' + form.getEditUrl(),
    'Add the file-upload questions by hand in the Form editor. FormApp cannot create file-upload items.',
    'Photos: File upload, images only, multiple files, maximum 10, not required.',
    'Voice note: File upload, audio only, 1 file, not required.',
  ];
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    lines.push('Setup finished. GEMINI_API_KEY is not set. In the Apps Script editor open Project Settings, then Script properties, and add a property named GEMINI_API_KEY. Paste the key only there. Do not put it in code, in this Sheet, or in chat.');
  }
  var message = lines.join('\n');
  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (err) {
    Logger.log('Alert was not shown.');
  }
}

function readJobs_() {
  var sheet = spreadsheet_().getSheetByName('Jobs');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 4).getValues().filter(function (row) {
    return row[0];
  }).map(function (row) {
    return {
      number: String(row[0]),
      name: String(row[1] || ''),
      pm: String(row[2] || ''),
      folderId: String(row[3] || ''),
    };
  });
}

function readReportTexts_() {
  var sheet = spreadsheet_().getSheetByName('Job Log');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var column = JOB_LOG_HEADERS.indexOf('Report Text') + 1;
  return sheet.getRange(2, column, last - 1, 1).getValues().map(function (row) {
    return String(row[0] || '');
  });
}

function appendRow_(sheet, values) {
  sheet.appendRow(values);
  return sheet.getLastRow();
}

function updateJobLogRow_(rowIndex, updates) {
  var sheet = sheetByName_('Job Log');
  var range = sheet.getRange(rowIndex, 1, 1, JOB_LOG_HEADERS.length);
  var row = range.getValues()[0];
  JOB_LOG_HEADERS.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(updates, header)) row[index] = updates[header];
  });
  range.setValues([row]);
}

function spreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheetByName_(name) {
  var sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet ' + name + '. Run setup first.');
  return sheet;
}
