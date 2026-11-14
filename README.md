# Security Certification Roadmap

A static site for browsing cybersecurity certifications by area, section, subsection, and level. The overview has a column for each area, with its sections side by side and levels stacked from expert at the top to beginner at the bottom. Each area also has its own page with the same layout.

This project is licensed [CC BY-SA 4.0](LICENSE).

## View it

Deploy to Vercel with no build step:

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Leave the framework preset as **Other** and the build command blank.
3. Click **Deploy**.

For a local preview, serve the folder over HTTP so the page can load the JSON files:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

On a narrow screen the overview shows one area at a time, using the same layout as the area pages.

## Hierarchy

```
Area (domain)
└── Section
    └── Subsection (optional)
        └── Certification
```

- **Area** is one of the eight top-level groups (Network, IAM, Engineering, Asset, Management, Testing, Software, Operations). The data files call it a `domain`.
- **Section** is a column inside an area, such as Forensics or GRC.
- **Subsection** is an optional group inside a section. Certifications with no subsection appear first in that section, then each subsection under its own heading.
- **Level** is Expert, Intermediate, or Beginner, from the source chart.

## How the pieces fit

- [`data/domains.json`](data/domains.json) is the hand-maintained list of areas, their sections, and any subsections. It also holds colors, descriptions, and level labels.
- [`data/certifications.json`](data/certifications.json) is generated. Each certification has an abbreviation, name, official URL, tooltip details (including price when the source chart recorded one), `domain`, `section`, `subsection` (or `null`), `level`, source-chart `row` and `column`, and `columnSpan`.
- [`upstream/Security-Certification-Roadmap9.html`](upstream/Security-Certification-Roadmap9.html) is a pinned copy of the source chart, used only by the extractor. The commit is recorded in [`upstream/PIN.txt`](upstream/PIN.txt).
- [`js/app.js`](js/app.js) draws the overview, the area pages (`#/area/operations` and the other area ids), search, and the detail panel.

A certification takes the level label whose marker sits nearest its row on the source chart. Wide cells that cross an area boundary are marked `crossDomain`, list every area in `domains`, and appear under "Also placed here" in each extra area.

The source chart names these sections: Cloud/SysOps, *nix, ICS/IoT, GRC, Forensics, Incident Handling, Penetration Testing, and Exploitation. Penetration Testing is split into subsections: Web, Mobile, API, Network, Wireless, and Cloud. Certifications that are not tied to one of those, such as OSCP, stay at the top of the section. The API subsection is defined and has no certification yet, because the source chart does not name one. Columns with no label are grouped as Leadership and programs, Professional schemes, Other engineering, and Monitoring and detection. Rename those titles in `domains.json` if you want different names. Blue-team and red-team operations stay inside Security Operations.

## Add an area

Add an object to `domains` in [`data/domains.json`](data/domains.json):

```json
{
  "id": "privacy",
  "title": "Privacy",
  "shortTitle": "Privacy",
  "color": "#0f766e",
  "ink": "#ffffff",
  "description": "What this area covers.",
  "sections": [
    {"id": "core", "title": "Privacy", "description": "Certifications in this area.", "subsections": []}
  ]
}
```

`id` is the URL fragment (`#/area/privacy`). `ink` is the text color used on certification chips.

## Add a section

Add an object to that area’s `sections` array:

```json
{"id": "gdpr", "title": "GDPR", "description": "Data protection law certifications.", "subsections": []}
```

Then set `"section": "gdpr"` on each certification that belongs there. The id must match exactly. Section order in the file is the column order.

## Add a subsection

Inside a section, add an object to its `subsections` array:

```json
{"id": "dpo", "title": "Data protection officer", "description": "", "subsections": []}
```

Then set `"subsection": "dpo"` on the certifications that belong under it. Certifications in the same section but with `"subsection": null` appear above the subsection headings.

## Add a certification

Append an object to [`data/certifications.json`](data/certifications.json). `row` and `column` only affect sort order inside a level.

```json
{
  "id": "example",
  "abbreviation": "EXAMPLE",
  "name": "Example Certification",
  "url": "https://example.com/example",
  "details": ["$100 exam"],
  "domain": "operations",
  "domains": ["operations"],
  "section": "penetration-testing",
  "subsection": null,
  "level": "intermediate",
  "row": 20,
  "column": 41,
  "columnSpan": 1,
  "crossDomain": false
}
```

Set `crossDomain` to `true` and list every area in `domains` when the certification should appear in more than one column. The `domain` value is where it is filed; the other areas show it under “Also placed here”.

## Regenerate from the source chart

Regenerating overwrites `data/certifications.json`, including certifications added by hand. `domains.json` is left alone.

```bash
python3 -m pip install -r scripts/requirements.txt
python3 scripts/extract_certs.py
```

`scripts/extract_certs.py` needs BeautifulSoup. It replays the source chart’s CSS grid: the area comes from the certification’s CSS class, the section from the column band, and the level from the nearest Expert, Intermediate, or Beginner marker. It always writes `subsection` as `null`, so set subsections by hand afterward.
