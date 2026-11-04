# Set up the Daily Field Report

Run this on your personal Google account (a normal consumer Gmail account, not a company Workspace account). You create the Sheet, paste the script, run Setup, and paste the Gemini key into Script properties yourself. The key stays in that property. Do not put it in the script, the Sheet, chat, or git.

Only fictional jobs, people, photos, and reports go in. The AI Studio free tier may use what you send to improve Google's products.

## What this creates

Everything the script creates is in three places:

- The one Google Sheet you create below. Setup adds the tabs Job Log, Crew Hours, Flags, Dashboard, and Jobs. Linking the Form also adds Google's own Form Responses tab on that same Sheet.
- One Google Form, titled Field-to-Office Daily Report.
- One Drive folder named `Field-to-Office Demo`. Setup puts a `Jobs` folder under it, and a folder per sample job (`Daily Reports`, `Change Orders`, and `Photos`). Date folders are created when a report has a file.

The script project is bound to that Sheet. Setup installs one trigger, `onReportSubmit`. The script does not send email or chat, and approving a flag does not create a file.

## 1. Create the Sheet

1. Sign in to your personal Google account.
2. Create a blank Google Sheet.
3. Name it Field-to-Office.

## 2. Paste the script

1. In the Sheet, open Extensions → Apps Script.
2. Delete everything in the default `Code.gs` file.
3. Rename that file to `App`. Paste in the full contents of `App.js` from this repo.
4. Add a second script file named `Logic`. Paste in the full contents of `Logic.js`.
5. Open Project Settings and turn on **Show "appsscript.json" manifest file in editor**.
6. Open `appsscript.json` and replace it with the `appsscript.json` from this repo. Save every file.

`clasp` is optional. From this repo, after `clasp login` with this same account: `clasp create --type sheets --title "Field-to-Office"`, then `clasp push`. `.claspignore` keeps the tests and the docs out of the Apps Script project. Then open the Sheet clasp created and continue at step 3.

## 3. Set the Gemini key

Create a Gemini API key in Google AI Studio while signed in as this same account.

In the Apps Script editor: Project Settings → Script properties → Add script property.

- Name: `GEMINI_API_KEY`
- Value: paste the key only in that value field.

Do not put the key in code, in the Sheet, or in chat. The script reads that property and sends it only as the `x-goog-api-key` header on the Gemini request. Optional: add a script property named GEMINI_MODEL set to another model id; leave it unset to use gemini-3.5-flash-lite.

## 4. Run Setup and approve the prompts

1. Reload the spreadsheet.
2. Use the **Field-to-Office** menu and choose **Setup**. If the menu is not there yet, in the Apps Script editor choose the function `setup` in the toolbar and click Run.
3. Google asks you to authorize the script.

This project is your own script. It is not a published app, so Google has not reviewed it. The warning says Google hasn't verified this app. Choose **Advanced**, then **Go to the project (unsafe)**. That warning means the project has not been through Google's public-app review. Continue only because you just pasted this script. Do not use that Advanced link for an app you did not just install yourself. The exact button text can vary a little.

Then review the permissions and allow them. Each one is there for a specific step:

| Permission | Scope | Why |
|---|---|---|
| See, edit, create, and delete only the spreadsheets this script is installed in | `https://www.googleapis.com/auth/spreadsheets.currentonly` | Write Job Log, Crew Hours, Flags, Jobs, and the Dashboard formulas on this Sheet. |
| See, edit, create, and delete all of your Google Drive files | `https://www.googleapis.com/auth/drive` | Create `Field-to-Office Demo` and move Form uploads into the job folder. A narrower Drive scope cannot see files the Form uploaded. The script creates that one folder tree and moves those uploads. |
| View and manage your forms | `https://www.googleapis.com/auth/forms` | Create the Daily Report form and link its responses to this Sheet. |
| Connect to an external service | `https://www.googleapis.com/auth/script.external_request` | Call Gemini at `generativelanguage.googleapis.com`. The script does not call any other site. |
| Create and change triggers | `https://www.googleapis.com/auth/script.scriptapp` | Install the one `onReportSubmit` trigger so a submission runs when the Sheet is closed. |
| View and manage data associated with the application | `https://www.googleapis.com/auth/script.storage` | Read and write this script's properties: the Gemini key, the Drive folder id, and the Form id. This is not Gmail and not the rest of Drive. |

If Setup stops with an error that says the Form link needs `https://www.googleapis.com/auth/spreadsheets` (without `.currentonly`), change that one line in `appsscript.json`, save, and run Setup again. That broader scope can see every spreadsheet on the account. The script still only edits this Sheet and the Form it created.

Setup is safe to run twice. The second run does not add another tab, folder, form, or trigger.

When Setup finishes it logs the Form edit URL and tells you to add the two upload questions. If the key property is missing, it still finishes and the alert tells you how to add it. The same text is in the Apps Script Executions log.

## 5. Add the upload questions by hand

`FormApp` cannot create file-upload questions. In the Form editor (the edit URL from the alert or the log):

1. Add a question titled exactly `Photos`. Type: File upload. Images only. Multiple files. Maximum 10. Not required.
2. Add a question titled exactly `Voice note`. Type: File upload. Audio only. Maximum 1 file. Not required.

Leave Job, Foreman name, Report date, and Report text as Setup created them. People who upload a file must be signed in to a Google account. That is expected.

## 6. Load the sample reports

In the Sheet, choose Field-to-Office → **Load sample reports**.

That sends three fictional text-only reports, one for each sample job, through the same pipeline as a real submission. Source is `Sample`. Running it again adds nothing, because a sample whose text is already in Job Log is skipped.

The sample text includes one possible change order ("GC asked us to add 4 receptacles in Room 112, not on drawings") and one material shortage ("short 200 ft of 3/4 EMT, need by Thursday"). Whether those become flag rows depends on Gemini's answer. A failed call still leaves the Job Log row, with Status `Needs review`.

## 7. Submit a test report

1. Open the Form's responder link (Send or the eye icon in the Form editor). Stay signed in.
2. Pick a job, type a fictional foreman name, and type a fictional report. Leave Report date blank if you want the submission date. Optionally add a fictional photo and a short voice note.
3. Submit.
4. Within about a minute, Job Log should show a new row with Source `Form`. Status should become `Processed`, with a summary and total hours. Crew Hours and Flags fill in from the model's JSON.

If Gemini fails, the row is still there: Status `Needs review`, the error is in Errors, the original report text is unchanged, and that submission gets no Crew Hours or Flags rows. A row that stays `Processing` stopped before it finished (the run limit is 6 minutes). Check that row by hand.

Changing a flag to Approved or Rejected, and typing PM Note, Reviewed By, and Reviewed At, does not send email or create a file. The script never fills Reviewed By or Reviewed At.

Dashboard is formulas only. It shows today's reports, hours by job, open flags, and a scorecard. Est. minutes saved is the number of processed reports times the cell **Minutes saved per report** (15). The cell next to 15 says `Assumption, not measured`. The formulas use commas between arguments, which matches a United States spreadsheet locale. A parse error in those cells usually means the locale expects semicolons.

## Remove it afterwards

1. Extensions → Apps Script → Triggers (the alarm-clock icon). Delete the `onReportSubmit` trigger.
2. In Google Drive, delete the folder `Field-to-Office Demo`. That deletes the job folders and the files that were moved there.
3. If a Form upload folder is still in Drive (often named for the form), delete it too. Files that failed to move can still be in that folder.
4. Delete the Google Form Field-to-Office Daily Report.
5. Delete the Google Sheet. The bound script is deleted with it.
6. In Google AI Studio, delete or rotate the API key. If the script's access is still listed under your Google Account security page, remove it.

## Tests in this repo

From the repo root, with Node installed and no packages to install:

```bash
node --test
```

The tests fake Spreadsheet, Form, Drive, and UrlFetch. They do not call Google or Gemini. See `docs/features/F001-daily-field-report/TEST_REPORT.md` for what that does and does not prove.
