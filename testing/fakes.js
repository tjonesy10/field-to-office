const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function iterator(items) {
  let index = 0;
  return {
    hasNext() {
      return index < items.length;
    },
    next() {
      if (index >= items.length) throw new Error('iterator exhausted');
      const item = items[index];
      index += 1;
      return item;
    },
  };
}

function lettersToCol(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseA1(a1) {
  const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a1);
  if (!match) throw new Error('bad range ' + a1);
  const row = Number(match[2]);
  const col = lettersToCol(match[1]);
  if (!match[3]) return { row, col, numRows: 1, numCols: 1 };
  return {
    row,
    col,
    numRows: Number(match[4]) - row + 1,
    numCols: lettersToCol(match[3]) - col + 1,
  };
}

function createSheet(name) {
  const data = [];
  const sheet = {
    validations: [],
    formats: [],
    checkboxes: false,
    getName() {
      return name;
    },
    getLastRow() {
      for (let row = data.length; row >= 1; row -= 1) {
        const line = data[row - 1] || [];
        if (line.some((cell) => cell !== '' && cell != null)) return row;
      }
      return 0;
    },
    appendRow(values) {
      data.push(values.map((value) => (value == null ? '' : value)));
    },
    getRange(...args) {
      let startRow;
      let startCol;
      let numRows;
      let numCols;
      let a1 = null;
      if (typeof args[0] === 'string') {
        const parsed = parseA1(args[0]);
        startRow = parsed.row;
        startCol = parsed.col;
        numRows = parsed.numRows;
        numCols = parsed.numCols;
        a1 = args[0];
      } else {
        startRow = args[0];
        startCol = args[1];
        numRows = args.length >= 3 ? args[2] : 1;
        numCols = args.length >= 4 ? args[3] : 1;
      }
      function read(row, col) {
        const line = data[row - 1] || [];
        const value = line[col - 1];
        return value == null ? '' : value;
      }
      function write(row, col, value) {
        while (data.length < row) data.push([]);
        const line = data[row - 1];
        while (line.length < col) line.push('');
        line[col - 1] = value;
      }
      return {
        getValue() {
          return read(startRow, startCol);
        },
        setValue(value) {
          write(startRow, startCol, value);
        },
        getValues() {
          const out = [];
          for (let r = 0; r < numRows; r += 1) {
            const line = [];
            for (let c = 0; c < numCols; c += 1) line.push(read(startRow + r, startCol + c));
            out.push(line);
          }
          return out;
        },
        setValues(values) {
          values.forEach((line, r) => {
            line.forEach((value, c) => write(startRow + r, startCol + c, value));
          });
        },
        setNumberFormat(format) {
          sheet.formats.push({ a1, format, startRow, startCol, numRows, numCols });
        },
        setDataValidation(rule) {
          sheet.validations.push({ a1, rule, startRow, startCol, numRows, numCols });
        },
        insertCheckboxes() {
          sheet.checkboxes = true;
        },
      };
    },
  };
  return sheet;
}

function createSpreadsheet() {
  const sheets = {};
  const order = [];
  const ss = {
    alerts: [],
    menu: null,
    timezone: 'Etc/UTC',
    getId() {
      return 'spreadsheet-1';
    },
    setSpreadsheetTimeZone(zone) {
      this.timezone = zone;
    },
    getSpreadsheetTimeZone() {
      return this.timezone;
    },
    getSheetByName(name) {
      return sheets[name] || null;
    },
    insertSheet(name) {
      if (sheets[name]) throw new Error('sheet exists: ' + name);
      const sheet = createSheet(name);
      sheets[name] = sheet;
      order.push(name);
      return sheet;
    },
    getSheets() {
      return order.map((name) => sheets[name]);
    },
  };
  return ss;
}

function createDrive() {
  let seq = 1;
  const folders = {};
  const files = {};

  function makeFolder(name, parent) {
    const id = 'folder-' + seq;
    seq += 1;
    const folder = {
      id,
      name,
      parent,
      children: {},
      fileIds: [],
      getId() {
        return id;
      },
      getName() {
        return name;
      },
      getUrl() {
        return 'https://drive.google.com/drive/folders/' + id;
      },
      createFolder(childName) {
        const child = makeFolder(childName, folder);
        if (!folder.children[childName]) folder.children[childName] = [];
        folder.children[childName].push(child);
        return child;
      },
      getFoldersByName(childName) {
        return iterator((folder.children[childName] || []).slice());
      },
      getFilesByName(fileName) {
        const matches = folder.fileIds.map((fid) => files[fid]).filter((file) => file && file.name === fileName);
        return iterator(matches);
      },
    };
    folders[id] = folder;
    return folder;
  }

  const root = makeFolder('My Drive', null);

  function addFile(spec) {
    const id = 'file-' + seq;
    seq += 1;
    const file = {
      id,
      name: spec.name,
      mimeType: spec.mimeType || 'application/octet-stream',
      size: spec.size || 0,
      parent: spec.parent || null,
      failMove: !!spec.failMove,
      bytesReads: 0,
      getId() {
        return this.id;
      },
      getName() {
        return this.name;
      },
      setName(value) {
        this.name = value;
        return this;
      },
      getSize() {
        return this.size;
      },
      getMimeType() {
        return this.mimeType;
      },
      getUrl() {
        return 'https://drive.google.com/file/d/' + this.id + '/view';
      },
      moveTo(dest) {
        if (this.failMove) throw new Error('move failed');
        if (this.parent) this.parent.fileIds = this.parent.fileIds.filter((fid) => fid !== this.id);
        this.parent = dest;
        if (dest.fileIds.indexOf(this.id) === -1) dest.fileIds.push(this.id);
        return this;
      },
      getBlob() {
        const self = this;
        return {
          getBytes() {
            self.bytesReads += 1;
            return [1, 2, 3];
          },
          getName() {
            return self.name;
          },
          getContentType() {
            return self.mimeType;
          },
        };
      },
    };
    files[id] = file;
    if (file.parent) file.parent.fileIds.push(id);
    return file;
  }

  return {
    root,
    files,
    folders,
    addFile,
    getRootFolder() {
      return root;
    },
    getFolderById(id) {
      if (!folders[id]) throw new Error('folder not found ' + id);
      return folders[id];
    },
    getFileById(id) {
      if (!files[id]) throw new Error('file not found ' + id);
      return files[id];
    },
  };
}

function createForms(ss) {
  const forms = {};
  function addItem(form, type) {
    const item = {
      type,
      title: '',
      required: false,
      choices: null,
      setTitle(value) {
        this.title = value;
        return this;
      },
      setRequired(value) {
        this.required = !!value;
        return this;
      },
      setChoiceValues(values) {
        this.choices = values.slice();
        return this;
      },
      getTitle() {
        return this.title;
      },
      asListItem() {
        if (this.type !== 'LIST') throw new Error('not a list');
        return this;
      },
    };
    form.items.push(item);
    return item;
  }
  return {
    forms,
    DestinationType: { SPREADSHEET: 'SPREADSHEET' },
    create(title) {
      const id = 'form-' + (Object.keys(forms).length + 1);
      const form = {
        id,
        title,
        items: [],
        destId: null,
        destType: null,
        getId() {
          return id;
        },
        getTitle() {
          return title;
        },
        getEditUrl() {
          return 'https://docs.google.com/forms/d/' + id + '/edit';
        },
        setDestination(type, spreadsheetId) {
          if (this.destId) throw new Error('destination already set');
          this.destId = spreadsheetId;
          this.destType = type;
          if (!ss.getSheetByName('Form Responses 1')) ss.insertSheet('Form Responses 1');
          return this;
        },
        addListItem() {
          return addItem(this, 'LIST');
        },
        addTextItem() {
          return addItem(this, 'TEXT');
        },
        addParagraphTextItem() {
          return addItem(this, 'PARAGRAPH');
        },
        addDateItem() {
          return addItem(this, 'DATE');
        },
        getItems() {
          return this.items;
        },
      };
      forms[id] = form;
      return form;
    },
    openById(id) {
      if (!forms[id]) throw new Error('form not found ' + id);
      return forms[id];
    },
  };
}

function createProps() {
  const store = {};
  return {
    getProperty(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setProperty(key, value) {
      store[key] = String(value);
    },
    getProperties() {
      return Object.assign({}, store);
    },
    deleteProperty(key) {
      delete store[key];
    },
  };
}

function createScriptApp() {
  const triggers = [];
  return {
    triggers,
    getProjectTriggers() {
      return triggers.slice();
    },
    newTrigger(handler) {
      const spec = { handler, event: null };
      const builder = {
        forSpreadsheet() {
          return builder;
        },
        onFormSubmit() {
          spec.event = 'ON_FORM_SUBMIT';
          return builder;
        },
        create() {
          const trigger = {
            getHandlerFunction() {
              return spec.handler;
            },
            getEventType() {
              return spec.event;
            },
          };
          triggers.push(trigger);
          return trigger;
        },
      };
      return builder;
    },
  };
}

function createUrl() {
  const url = {
    calls: [],
    queue: [],
    handler: null,
    fetch(urlString, options) {
      const payload = options && options.payload ? JSON.parse(options.payload) : null;
      const call = { url: urlString, options, payload };
      this.calls.push(call);
      const next = this.handler ? this.handler(call) : this.queue.shift();
      if (!next) throw new Error('UrlFetchApp.fetch had no stubbed response');
      if (typeof next.before === 'function') next.before(call);
      if (next.throw) throw new Error(next.throw);
      const body = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
      return {
        getResponseCode() {
          return next.code;
        },
        getContentText() {
          return body;
        },
      };
    },
  };
  return url;
}

function createLock() {
  const lock = {
    waits: [],
    releases: 0,
    fail: false,
    getScriptLock() {
      const handle = {
        waitLock(ms) {
          lock.waits.push(ms);
          if (lock.fail) throw new Error('lock timeout');
        },
        releaseLock() {
          lock.releases += 1;
        },
      };
      return handle;
    },
  };
  return lock;
}

function fakeDate(iso) {
  const fixed = new Date(iso).getTime();
  function FakeDate(...args) {
    if (args.length === 0) return new Date(fixed);
    return new Date(...args);
  }
  FakeDate.UTC = Date.UTC;
  FakeDate.parse = Date.parse;
  FakeDate.now = function () {
    return fixed;
  };
  FakeDate.prototype = Date.prototype;
  return FakeDate;
}

function createWorld() {
  const ss = createSpreadsheet();
  const drive = createDrive();
  const forms = createForms(ss);
  const props = createProps();
  const scriptApp = createScriptApp();
  const url = createUrl();
  const lock = createLock();
  const logs = [];
  return {
    ss,
    drive,
    forms,
    props,
    scriptApp,
    url,
    lock,
    logs,
    services: {
      SpreadsheetApp: {
        getActive() {
          return ss;
        },
        getActiveSpreadsheet() {
          return ss;
        },
        getUi() {
          return {
            createMenu(name) {
              const menu = { name, items: [] };
              const chain = {
                addItem(label, fnName) {
                  menu.items.push({ label, fnName });
                  return chain;
                },
                addToUi() {
                  ss.menu = menu;
                  return chain;
                },
              };
              return chain;
            },
            alert(message) {
              ss.alerts.push(String(message));
            },
          };
        },
        newDataValidation() {
          const rule = { type: null, list: null, allowInvalid: true };
          const builder = {
            requireValueInList(list) {
              rule.type = 'list';
              rule.list = list.slice();
              return builder;
            },
            requireCheckbox() {
              rule.type = 'checkbox';
              return builder;
            },
            setAllowInvalid(flag) {
              rule.allowInvalid = flag;
              return builder;
            },
            build() {
              return rule;
            },
          };
          return builder;
        },
      },
      FormApp: forms,
      DriveApp: {
        getRootFolder() {
          return drive.getRootFolder();
        },
        getFolderById(id) {
          return drive.getFolderById(id);
        },
        getFileById(id) {
          return drive.getFileById(id);
        },
      },
      UrlFetchApp: url,
      PropertiesService: {
        getScriptProperties() {
          return props;
        },
      },
      Utilities: {
        base64Encode(data) {
          return Buffer.from(data).toString('base64');
        },
      },
      ScriptApp: scriptApp,
      LockService: lock,
      Logger: {
        log(message) {
          logs.push(String(message));
        },
      },
    },
  };
}

function loadApp(world, nowIso) {
  const sandbox = Object.assign({}, world.services, { console });
  if (nowIso) sandbox.Date = fakeDate(nowIso);
  vm.createContext(sandbox);
  ['Logic.js', 'App.js'].forEach((file) => {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  });
  sandbox.__logs = world.logs;
  return sandbox;
}

module.exports = { createWorld, loadApp, root };
