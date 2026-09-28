# design-pal-codex

English · [简体中文](README.zh-CN.md)

Reusable UI component libraries and interactive previews for desktop web tools. The project supports design exploration and project adoption through Codex and Claude Code.

**Development build; user acceptance is pending.** Both agents have generated pages in isolated test projects, but that does not establish compatibility with an arbitrary business application.

## What is included

- Three structurally distinct libraries, each with two color themes and light and dark modes: 12 combinations in all.
- A library gallery, interactive component catalog, and comparable admin page previews. Form, table, navigation, chart, dialog, and feedback components can be mounted independently.
- Fixed local releases with integrity checks, explicit project adoption, isolated customization, version upgrades, and recovery of confirmed work.
- A shared `design-pal-codex` skill with project-scoped installation for Codex and Claude Code. Installation does not adopt a library on the user's behalf.
- A fictional task-queue example and a comparable page before component adoption.

All preview names, records, and metrics are fictional. Task controls, copy, and export examples do not call a model or a business service. Native desktop interfaces are outside the direct component target; one Electron development host has been tested, without shipping an installer.

## Run the source preview

Node.js 24 is required. From this repository:

```sh
npm ci
npm run build
npm run preview
```

Open <http://127.0.0.1:4173/>. The preview server listens only on the local machine. The original interaction prototype remains in `examples/preview/index.html` as a design reference.

A fixed release can run without the development repository or dependency installation. See [fixed releases](RELEASE.md) for creation, verification, and preview commands. Review a concrete adoption plan and the actual preview before applying it to a project; see [project adoption and recovery](PROJECT.md). To install the skills without overwriting another tool, see [agent skills](SKILLS.md).

## Components and examples

The [component usage guide](USAGE.md) covers mounting and lifecycle. Detailed guides are available for [forms](FORMS.md), [tables](TABLE.md), [navigation](NAVIGATION.md), and [feedback](FEEDBACK.md). Those detailed guides currently use Chinese prose; the code examples and API names are unchanged.

The [fictional application example](EXAMPLES.md) demonstrates search, filtering, pagination, editing, task details, and simulated state changes. It does not migrate a real project or perform a real model task.

## Checks

```sh
npm test
npm run test:browser
```

The browser checks require Playwright Chromium; prepare it with `npx playwright install chromium`. Passing tests does not replace actual agent runs or the user's visual acceptance.

## Naming and licenses

The package and its agent capability use the `design-pal-codex` prefix. The project does not register the generic `design-pal` skill name or replace another project's files. Published paths use English names; Chinese prose is available in the linked README.

The source is licensed under [MIT](LICENSE). The Phosphor Icons license and provenance are preserved in the [icon license](examples/preview/assets/LICENSE-phosphor.txt) and [source record](examples/preview/assets/SOURCE.md). Preview images were captured from fictional pages in this project.
