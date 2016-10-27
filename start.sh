#!/bin/bash
. /home/scotty/.nvm/nvm.sh
cd /home/scotty/waggoner-house-firebase-proxy
git fetch
git reset --hard origin/master
npm i
npm start
