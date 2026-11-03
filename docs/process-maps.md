# Process maps: daily field report

We mapped this process before automating it. The automation follows the future-state map, not the other way round.

## Current state

```mermaid
flowchart LR
  subgraph Foreman
    A[Work day ends] --> B[Writes paper report or texts PM]
    B --> C[Photos stay on phone]
    B --> D[Notices extra work or short material]
  end
  subgraph PM
    E[Receives report hours or a day later] --> F[Retypes into log and timesheet]
    F --> G[Spots extra work late, if at all]
    D -. verbal or text .-> G
  end
  subgraph Office
    H[Chases missing reports and hours]
    I[Orders material after shortage hits site]
  end
  B --> E
  F --> H
  D -. found on site next day .-> I
```

**Pain points**
- Paper and text reports arrive late and in different formats.
- The PM spends about 15 min per report retyping (an illustrative estimate).
- Photos stay on personal phones, so there's no job record and no evidence for change orders.
- Extra work is noticed late, so change orders are submitted late or never, and revenue is lost.
- Material shortages are found on site, which means idle crew and rush orders.
- Crew hours are re-entered by hand, which invites payroll errors.

**Swimlanes:** Foreman, PM, Office. There is no system lane.

## Future state

```mermaid
flowchart LR
  subgraph Foreman
    A[Submits Google Form: job, text, photos, voice note]
  end
  subgraph AI_Script[AI + Script]
    B[onFormSubmit logs row first] --> C[Files uploads to Drive job folder]
    C --> D[Gemini extracts JSON]
    D -->|valid| E[Job Log + Crew Hours + Flags = Pending]
    D -->|fails| F[Job Log Status = Needs review, raw text kept]
  end
  subgraph PM
    G[Reviews Flags tab] --> H{Approve or Reject}
    H -->|Approved| I[Starts CO or orders material in normal process]
  end
  subgraph Office
    J[Dashboard: today's reports, hours by job, open flags, scorecard]
  end
  A --> B
  E --> G
  F --> G
  E --> J
  H --> J
```

**Improvements**
- One structured form from any phone. The job is picked from a list, not guessed.
- No retyping: summary, hours, and work items fill in automatically.
- Photos and voice notes are filed by job and date with standard names.
- Possible change orders and shortages are flagged the same day, with the foreman's own words as evidence.
- The PM approves every flag. Nothing goes out automatically.
- Failed AI runs are still logged, so no report is lost.
- The scorecard shows whether the pilot is worth keeping.

**Swimlanes:** Foreman, AI + Script, PM, Office.
