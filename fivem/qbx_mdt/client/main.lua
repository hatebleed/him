--[[
    qbx_mdt — client.

    Opens the in-game UI, gives it keyboard and mouse focus, and hands it the
    token the server obtained. The UI itself lives on the platform: this
    resource only brokers the session and owns the focus, which is what a
    resource has to do for NUI to behave in game.
]]

local QBX = exports.qbx_core

local isOpen = false
local currentJob = nil

local function setNuiFocus(focus)
    SetNuiFocus(focus, focus)
    SetNuiFocusKeepInput(false)
end

--- Tells the UI to close itself; the UI asks the host first (see html/bridge.js)
--- so focus is always released through this path.
local function closeUi()
    if not isOpen then return end
    isOpen = false
    setNuiFocus(false)
    SendNUIMessage({ action = 'close' })
end

--- The resource's own NUI callbacks. These are reachable from the resource's
--- page (nui://qbx_mdt/html/index.html) regardless of what it embeds.
RegisterNUICallback('close', function(_, cb)
    closeUi()
    cb({})
end)

--- Notifications raised inside the tablet (status changes, failures) are shown
--- through the framework's own notify, not inside the NUI.
RegisterNUICallback('notify', function(data, cb)
    local level = (data and data.level) or 'primary'
    local message = (data and data.message) or ''
    -- NUI callbacks run outside a player context: notify the local player.
    if QBX and QBX.Notify then
        QBX:Notify(message, level == 'error' and 'error' or level == 'success' and 'success' or 'primary')
    end
    cb({ ok = true })
end)

RegisterNetEvent('qbx_mdt:client:open', function(payload)
    if isOpen then return end
    isOpen = true
    setNuiFocus(true)
    SendNUIMessage({
        action = 'open',
        token = payload.token,
        expiresAt = payload.expiresAt,
        operator = payload.operator,
        character = payload.character,
        permissions = payload.permissions,
        roles = payload.roles,
        ui = payload.ui,
        refresh = payload.refresh,
    })
end)

RegisterNetEvent('qbx_mdt:client:close', function()
    closeUi()
end)

RegisterCommand(Config.Command, function()
    if isOpen then
        closeUi()
        return
    end
    TriggerServerEvent('qbx_mdt:server:requestOpen')
end, false)

if Config.Keybind then
    RegisterKeyMapping(Config.Command, Config.KeybindDescription or 'Open the MDT', 'keyboard', Config.Keybind)
end

-- The tablet must never survive a resource stop or a character swap.
AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    closeUi()
end)

-- Keep track of the job so a duty toggle can close the tablet client-side too.
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job)
    currentJob = job and job.name
    if isOpen and Config.Limits.CloseOnJobChange and not Config.Jobs[currentJob] then
        closeUi()
    end
end)

exports('isOpen', function()
    return isOpen
end)
