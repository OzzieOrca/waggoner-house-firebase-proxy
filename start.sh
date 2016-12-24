#!/bin/bash
cd ~/waggoner-house-firebase-proxy
git fetch
git reset --hard origin/master
npm i
npm start
