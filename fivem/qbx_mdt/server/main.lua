--[[
    qbx_mdt — server.

    Responsibilities, and only these:
      1. Decide whether a character may open the MDT (job + grade).
      2. Exchange that character for a short-lived platform token.
      3. Hand the token to that player's client, which passes it to the NUI.

    Every record the tablet shows is fetched by the platform itself, so an
    in-game operator can never see more than the account they are linked to.
]]

local QBX = exports.qbx_core

local lastOpenRequest = {}

local function notify(source, message, kind)
    if QBX and QBX.Notify then
        QBX:Notify(source, message, kind or 'primary')
    else
        TriggerClientEvent('chat:addMessage', source, { args = { 'MDT', message } })
    end
end

--- Job gate: is this character allowed to open the tablet at all?
local function jobAllowed(job)
    if not job then return false end
    local minimum = Config.Jobs[job.name]
    if minimum == nil then return false end
    return (job.grade.level or job.grade or 0) >= minimum
end

--- Callsign resolution, configurable per server.
local function callsignFor(player)
    if Config.Identity.CallsignSource == 'none' then return nil end
    if Config.Identity.CallsignSource == 'metadata' then
        local metadata = player.PlayerData.metadata or {}
        return metadata[Config.Identity.CallsignKey]
    end
    return player.PlayerData.job and player.PlayerData.job.grade and player.PlayerData.job.grade.name or nil
end

--- Exchanges the character for a token. Returns a table, or nil + reason.
local function handshake(player, source)
    local citizenId = player.PlayerData.citizenid
    local job = player.PlayerData.job
    local charinfo = player.PlayerData.charinfo or {}

    local body = json.encode({
        citizenId = citizenId,
        characterName = ('%s %s'):format(charinfo.firstname or '', charinfo.lastname or ''):gsub('^%s+', ''):gsub('%s+$', ''),
        job = job and job.name or nil,
        grade = job and (job.grade.level or job.grade) or nil,
        callsign = callsignFor(player),
        serverId = source,
        resource = GetCurrentResourceName(),
    })

    local url = ('%s%s'):format(Config.Api.BaseUrl, Config.Api.HandshakePath)
    local promise = promise.new()

    PerformHttpRequest(url, function(status, responseText, headers)
        if status ~= 200 then
            local ok, decoded = pcall(json.decode, responseText or '')
            local message = 'The MDT is unavailable.'
            if ok and decoded and decoded.error and decoded.error.message then
                message = decoded.error.message
            end
            promise:resolve({ ok = false, message = message, status = status })
            return
        end

        local ok, decoded = pcall(json.decode, responseText or '')
        if not ok or not decoded or not decoded.data or not decoded.data.token then
            promise:resolve({ ok = false, message = 'The MDT returned an unexpected response.' })
            return
        end
        promise:resolve({ ok = true, data = decoded.data })
    end, 'POST', body, {
        ['Content-Type'] = 'application/json',
        ['X-API-Key'] = Config.Api.ApiKey,
        ['Accept'] = 'application/json',
    })

    -- PerformHttpRequest is asynchronous; Citizen.Await keeps this handler
    -- synchronous without blocking the server tick.
    return Citizen.Await(promise)
end

RegisterNetEvent('qbx_mdt:server:requestOpen', function()
    local source = source
    local player = QBX and QBX:GetPlayer(source)
    if not player then return end

    if not jobAllowed(player.PlayerData.job) then
        notify(source, 'You are not authorised to use the MDT.', 'error')
        return
    end

    -- A cheap guard against a client spamming the handshake endpoint.
    local now = GetGameTimer()
    if lastOpenRequest[source] and now - lastOpenRequest[source] < Config.Limits.OpenCooldownMs then
        return
    end
    lastOpenRequest[source] = now

    local result = handshake(player, source)
    if not result or not result.ok then
        notify(source, (result and result.message) or 'The MDT is unavailable.', 'error')
        return
    end

    TriggerClientEvent('qbx_mdt:client:open', source, {
        token = result.data.token,
        expiresAt = result.data.expiresAt,
        operator = result.data.operator,
        character = result.data.character,
        permissions = result.data.permissions,
        roles = result.data.roles,
        ui = {
            baseUrl = Config.Api.BaseUrl,
            path = (result.data.ui and result.data.ui.path) or Config.Api.UiPath,
        },
        refresh = Config.Refresh,
    })
end)

-- A player leaving frees their cooldown slot.
AddEventHandler('playerDropped', function()
    lastOpenRequest[source] = nil
end)

-- Job changes (duty toggles, /setjob) invalidate what the tablet is showing.
if Config.Limits.CloseOnJobChange then
    RegisterNetEvent('qbx_core:server:onJobUpdate', function(source, job)
        lastOpenRequest[source] = nil
        if not jobAllowed(job) then
            TriggerClientEvent('qbx_mdt:client:close', source)
        end
    end)
end

-- An administrator can clear the cooldowns if a handshake ever gets stuck.
RegisterCommand('mdtreset', function(source)
    if source ~= 0 then return end
    lastOpenRequest = {}
    print('[qbx_mdt] open cooldowns cleared')
end, true)
