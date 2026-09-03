--[[
    qbx_mdt — configuration.

    The MDT itself lives on your platform deployment; this resource is the
    bridge between the game and it:

        player  --(/mdt)-->  server  --handshake-->  platform  --token-->  NUI

    Nothing about identity or permissions is decided in Lua. The game server
    proves itself with a shared secret and receives a short-lived token; the
    token carries the permissions of the account the character is linked to.
]]

Config = {}

--- Command that opens the tablet (chat command `/mdt`).
Config.Command = 'mdt'

--- Optional keybind (FiveM keymap name, e.g. 'F4'). Set to false to disable.
Config.Keybind = 'F4'
Config.KeybindDescription = 'Open the MDT'

--- Jobs allowed to open the MDT, with the minimum grade.
--- The platform still decides what each linked account can see or write.
Config.Jobs = {
    police = 0,
    sheriff = 0,
    ambulance = 2,
}

--- Your platform deployment.
Config.Api = {
    --- Base URL, no trailing slash. Must be reachable from the *server*.
    BaseUrl = 'https://mdt.example.com',
    --- Handshake path (exchange a character for a token).
    HandshakePath = '/api/integrations/fivem/handshake',
    --- Shared secret; the same value as FIVEM_API_KEY on the platform.
    --- Keep this out of client-side files: it is only read on the server.
    ApiKey = 'change-me',
    --- Path of the in-game UI (the /nui route group).
    UiPath = '/nui',
    --- Milliseconds before a handshake request is abandoned.
    TimeoutMs = 8000,
}

--- Character details sent with the handshake (audit and display only; they
--- never grant permissions — the linked account's roles do that).
Config.Identity = {
    --- Where the callsign comes from: 'metadata', 'badge' or 'none'.
    CallsignSource = 'metadata',
    --- Metadata key qbox stores the callsign in.
    CallsignKey = 'callsign',
}

--- How often the tablet re-runs its own queries (milliseconds). The platform
--- also pushes updates over its event stream while the tablet is open.
Config.Refresh = {
    OpsWallMs = 15000,
}

--- Guard rails.
Config.Limits = {
    --- Minimum milliseconds between two open requests from the same player.
    OpenCooldownMs = 1500,
    --- Close the tablet automatically when the player's job changes.
    CloseOnJobChange = true,
}
