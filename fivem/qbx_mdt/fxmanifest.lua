fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'qbx_mdt'
author 'Operations Platform'
description 'In-game MDT for the operations platform (qbox)'
version '1.0.0'

dependencies {
    'qbx_core',
}

shared_script 'config.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/bridge.js',
    'html/style.css',
}
