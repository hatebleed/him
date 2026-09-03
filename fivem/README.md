# qbx_mdt — FiveM resource (qbox)

Runs the operations platform **inside the game**. Players open a tablet with
`/mdt` (or a keybind), and it shows live data from the same deployment the web
console uses — same records, same permissions, same audit trail.

You can see exactly what it looks like before you install anything: open
**FiveM Preview** in the web app. It loads the real in-game route
(`/nui`) inside a simulated game screen and speaks the same bridge the resource
speaks, so the preview and the game cannot drift apart.

---

## 1. How it fits together

```
player ──/mdt──▶ client.lua ──▶ server.lua ──handshake──▶ platform
                     │                                       │
                     │            { token, operator }         │
                     ▼                                       ▼
              html/index.html ──iframe + mdt:init──▶  /nui  (the tablet)
```

| Piece | Runs where | What it does |
|---|---|---|
| `server/main.lua` | Server | Job gate, handshake with the platform, token delivery, cooldown |
| `client/main.lua` | Client | Command/keybind, NUI focus, NUI callbacks (`close`, `notify`) |
| `html/index.html` + `bridge.js` | Client (NUI) | Hosts the tablet and brokers messages between the game and it |
| `/nui` on your deployment | Remote | The interface itself — the same code the preview shows |

**Nothing about identity or permissions is decided in Lua.** The server proves
itself with a shared secret (`FIVEM_API_KEY`) and receives a short-lived token.
That token carries the permissions of the account the character is linked to, so
a cadet and a supervisor see different things even with the same job.

---

## 2. Requirements

- A **qbox** server (`qbx_core`) on an up-to-date FiveM artifact.
- The platform deployed somewhere the **game server** can reach over HTTPS
  (the handshake is server-to-server, so a private network address is fine;
  the tablet itself is loaded by each player's game client, so the UI URL must
  be reachable from players too).
- `FIVEM_API_KEY` set on the platform to the same value as `Config.Api.ApiKey`.

---

## 3. Install

```bash
# 1. copy the folder into your resources
cp -r fivem/qbx_mdt resources/[local]/qbx_mdt

# 2. server.cfg
ensure qbx_core
ensure qbx_mdt
```

### Configure

Edit `qbx_mdt/config.lua`:

```lua
Config.Jobs = { police = 0, sheriff = 0, ambulance = 2 }  -- job = minimum grade

Config.Api = {
    BaseUrl = 'https://mdt.example.com',  -- your deployment, no trailing slash
    ApiKey  = 'the same value as FIVEM_API_KEY',
    UiPath  = '/nui',
}
```

On the platform (`.env`):

```env
FIVEM_API_KEY="a-long-random-secret"
FIVEM_TOKEN_TTL_HOURS="12"
FIVEM_AUTO_PROVISION="false"
FIVEM_JOB_ROLES='{"police":"operator","sheriff":"operator"}'
```

Restart the platform after changing `.env`, then `restart qbx_mdt`.

---

## 4. Linking characters

A character is not an account. There are two supported ways to connect them.

### Deliberate linking (default, recommended)

An administrator links a citizen id to an existing user once:

```bash
curl -X POST https://mdt.example.com/api/integrations/fivem/identities \
  -H "Content-Type: application/json" \
  -H "Cookie: him_session=<admin session cookie>" \
  -d '{ "citizenId": "ABC12345", "userId": "<user uuid>", "displayName": "Dana Whitfield" }'
```

```bash
# list links      GET    /api/integrations/fivem/identities
# remove a link   DELETE /api/integrations/fivem/identities/<id>
```

The player then opens `/mdt` and it just works. An unlinked character is told
to ask a supervisor — it is rejected with `IDENTITY_NOT_LINKED` and never
receives a token.

### Automatic provisioning (optional)

Set `FIVEM_AUTO_PROVISION="true"` and map jobs to role keys
(`FIVEM_JOB_ROLES`, or the `fivem.jobRoles` setting to change it without a
restart). The first time an unknown citizen id opens the tablet, the platform
creates an account with that role, links it, and returns a token.

Role keys are the ones in your deployment (`operator`, `supervisor`, `standard`,
`readonly`, `administrator` by default). Pick deliberately: `standard` can read
incidents but cannot see the operations wall, `operator` can work dispatch.

Provisioned accounts get a random unguessable password: they sign in through
the game, never through the sign-in form.

---

## 5. What players can do in game

| Screen | Route | Needs |
|---|---|---|
| Home | `/nui` | — readiness, active calls, BOLOs |
| Ops | `/nui/ops` | live sector view, call queue, unit board |
| Units | `/nui/units` | pick your callsign, set your own status (`units.status`) |
| Search | `/nui/search` | people, vehicles, incidents, cases with a detail sheet |
| Briefing | `/nui/briefing` | generated roll-call handover |

Every screen is permission-filtered server-side. A player without
`units.view` sees an empty board; without `units.status` the status buttons are
disabled — and the API refuses the write regardless of what the client sends.

`Esc` (or the close button) closes the tablet and returns control to the game.

---

## 6. Security notes

- **The API key never reaches a player.** Only the server performs the
  handshake; the client receives a token scoped to one account, expiring after
  `FIVEM_TOKEN_TTL_HOURS`.
- **The token is a bearer credential**, so deploy over HTTPS. It is held in
  session storage in the NUI and never written to disk by the resource.
- **Permissions come from the platform.** Disabling a role, suspending a user or
  unlinking a character takes effect on the next handshake (or immediately for
  reads, since every request is authorised server-side).
- **Requests carrying an integration token are exempt from the browser
  origin check** on purpose: the game's browser sends an opaque origin and has
  no cookie jar for this site. Exemption requires a *valid* token — a forged
  one is rejected rather than downgraded to the ambient session.
- Handshakes are rate limited per player (`Config.Limits.OpenCooldownMs`).

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "The MDT is unavailable." | Platform unreachable from the server or wrong URL | Check `Config.Api.BaseUrl` and that the server can reach it |
| "Invalid integration credentials." | Key mismatch | `FIVEM_API_KEY` must equal `Config.Api.ApiKey` |
| "This character is not linked…" | No link and provisioning is off | Link the citizen id (§4) or enable provisioning |
| "No role is mapped to the job …" | Provisioning on, job unmapped | Add the job to `FIVEM_JOB_ROLES` / `fivem.jobRoles` |
| Blank tablet | UI URL unreachable from the player's client | The tablet is loaded by the game client; the URL must be public |
| Tablet opens but shows no permissions | Linked to the wrong account, or the role lost permissions | Re-link, or check the account's roles |

To verify the handshake without the game:

```bash
curl -X POST https://mdt.example.com/api/integrations/fivem/handshake \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"citizenId":"ABC12345","job":"police","callsign":"A-12","characterName":"Dana Whitfield"}'
```

Then use the returned token:

```bash
curl https://mdt.example.com/api/ops-wall -H "Authorization: Bearer <token>"
```
