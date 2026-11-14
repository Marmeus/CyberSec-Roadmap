# Security Certification Roadmap

A static site for browsing 500+ cybersecurity certifications organised by area, domain, specialty, and level. The overview shows all areas side by side; each area also has its own dedicated page. On narrow screens the overview switches to a single-area view with horizontal swipe navigation.

This project is licensed [CC BY-SA 4.0](LICENSE).  Heavily based on unmaintained [Paul Jerimy's Security Certification Roadmap](https://github.com/PaulJerimy/SecCertRoadmapHTML).

## View it

For a local preview, serve the folder over HTTP so the browser can load the JSON files:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Data model

```
Area
└── Domain
    └── Specialty (optional)
        └── Certification
```

| Level | | |
|---|---|---|
| `expert` | `intermediate` | `beginner` |

All data lives in two hand-maintained JSON files. There is no build or extraction step.

### `data/domains.json`

Defines the full hierarchy and its visual properties.

```
{
  "source": { ... },          ← attribution metadata
  "levels": [ ... ],          ← expert / intermediate / beginner labels
  "areas": [
    {
      "id": "operations",
      "title": "Security Operations",
      "shortTitle": "Operations",
      "color": "#2e5688",     ← column header background
      "ink": "#ffffff",       ← text color on chips
      "description": "...",
      "domains": [
        {
          "id": "penetration-testing",
          "title": "Penetration Testing",
          "description": "...",
          "specialties": [
            { "id": "cloud", "title": "Cloud", "description": "..." }
          ]
        }
      ]
    }
  ]
}
```

**Areas** (8 total): `network`, `iam`, `engineering`, `asset`, `management`, `testing`, `software`, `operations`

**Operations domains**: `monitoring`, `forensics`, `incident-handling`, `penetration-testing`, `exploitation`, `red-team`

### `data/certifications.json`

511 certification objects. Every field is required unless noted.

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique slug, kebab-case |
| `abbreviation` | string | Short label shown on the chip |
| `name` | string | Full certification name |
| `url` | string | Official page |
| `details` | string[] | Tooltip lines (price, duration, format) |
| `level` | string | `expert` / `intermediate` / `beginner` |
| `crossDomain` | bool | `true` when the cert spans more than one area |
| `area` | string | Primary area id |
| `areas` | string[] | All areas it appears in (include `area`) |
| `domain` | string | Domain id within the primary area |
| `specialty` | string \| null | Specialty id within the domain, or `null` |
| `issuer` | string | Certifying body |
| `updatedAt` | string | Last reviewed, `YYYY-MM` |
| `description` | string | One-sentence tooltip description |

## Add a certification

Append an object to `data/certifications.json`:

```json
{
  "id": "example",
  "abbreviation": "EXAMPLE",
  "name": "Example Certification",
  "url": "https://example.com/example",
  "details": ["$299 exam", "90-day lab access"],
  "level": "intermediate",
  "crossDomain": false,
  "area": "operations",
  "areas": ["operations"],
  "domain": "penetration-testing",
  "specialty": "cloud",
  "issuer": "Example Corp",
  "updatedAt": "2026-11",
  "description": "One sentence describing what this certification validates."
}
```

For a cert that belongs in more than one area, set `crossDomain: true`, list all areas in `areas`, and set `area` to the primary one. It will appear in full under the primary area and under "Also placed here" in every other area.

## Add a domain

Add an object to the target area's `domains` array in `data/domains.json`:

```json
{
  "id": "cloud-security",
  "title": "Cloud Security",
  "description": "Certifications for cloud-native security engineering.",
  "specialties": []
}
```

Then set `"domain": "cloud-security"` on each certification that belongs there.

## Add a specialty

Add an object to the domain's `specialties` array in `data/domains.json`:

```json
{ "id": "containers", "title": "Containers", "description": "Container and Kubernetes security certifications." }
```

Then set `"specialty": "containers"` on the matching certifications. Set `"specialty": null` for certifications in the domain that do not belong to any specialty.

## Add an area

Add an object to the top-level `areas` array in `data/domains.json`:

```json
{
  "id": "privacy",
  "title": "Privacy",
  "shortTitle": "Privacy",
  "color": "#0f766e",
  "ink": "#ffffff",
  "description": "What this area covers.",
  "domains": [
    { "id": "core", "title": "Privacy", "description": "Certifications in this area.", "specialties": [] }
  ]
}
```

`id` becomes the URL fragment (`#/area/privacy`). `ink` is the text color used on certification chips; pick one that contrasts with `color`.

## Project structure

```
index.html                 ← single-page app shell
css/styles.css             ← all styles
js/app.js                  ← rendering, routing, filters, detail panel
data/
  domains.json             ← hierarchy, colors, descriptions
  certifications.json      ← all certifications
favicons/                  ← site icons
```
