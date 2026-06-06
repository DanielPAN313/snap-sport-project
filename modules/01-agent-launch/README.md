# Module 01: Agent Upload And One-Click Launch

Owner: TBD

## Scope

- Choose and document the upload format.
- Manage each agent's own repository metadata.
- Implement one-click launch/open behavior.
- Manage hackathon competition agents.

## Current V0 Decision

Do not execute uploaded code in the mirror server. V0 uses a manifest-style
upload:

- Basic profile: name, owner, tagline, description, category.
- Runtime pointers: chat URL, API URL, repository URL.
- Demo media: video URL.
- Hackathon metadata: event name, team name, track, status.

The first working target is: user A uploads an agent profile, user B sees it in
the shared gallery and clicks `Open Agent`.

## Files

- Page: `modules/web/agent-launch.html`
- Script: `modules/web/agent-launch.js`
- API/data: `/api/module-agent-launch/agents`, `data/module-agent-launch-agents.json`

## Later

- Add GitHub repo validation.
- Add Docker/sandbox launch only after the endpoint-based flow is stable.
- Add agent health checks.
