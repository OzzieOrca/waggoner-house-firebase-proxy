'use strict';

let firebase = require('firebase');
let SerialPort = require('serialport');
let _ = require('lodash');
let MessageQueue = require('./message-queue.js');

let db;
let rcs;
let refreshInterval = 10000;
let thermostatCache = {};
let messageQueue = new MessageQueue();
let lastZone; // Cache last zone form multi-packet responses

// Zone Control Unit (ZCU)/HVAC Setup
// ZCU 1 - Zone 1 and 2
// ZCU 2 - Zone 3
// ZCU 3 - Zone 4 and 5

init();

function init(){
    initFirebase();
    initSerial();
    emptyMessageQueue();
}

function initFirebase(){
    firebase.initializeApp({
        serviceAccount: 'secrets/waggoner-house-firebase-service-account.json',
        databaseURL: 'https://waggoner-house.firebaseio.com'
    });

    db = firebase.database();

    db.ref('thermostats/config/refreshInterval')
        .on("value", function(snapshot) {
            refreshInterval = snapshot.val();
        }, function (errorObject) {
            console.log("Error reading refreshInterval: " + errorObject);
        });

    db.ref('thermostats/zones')
        .on("child_changed", function(snapshot) {
            setThermostat(snapshot.key, snapshot.val());
        });
}

function initSerial(){
    rcs = new SerialPort('/dev/ttyUSB1', {
        baudRate: 9600
    });

    rcs.on('open', function() {
        requestStatus();
    });

    rcs.on('error', function(err) {
        console.log('Serial error: ', err.message);
    });

    rcs.on('data', handleResponse);
}

function requestStatus() {
    messageQueue.enqueue(
        _(5).range()
            .flatMap(zoneId => {
                zoneId++; // convert 0 offset to zones beginning at 1
                return [`A=${zoneId} R=1`, `A=${zoneId} R=2`];
            })
            .value(),
        true
    );

    console.log(`Waiting ${refreshInterval}ms before checking status`);
    setTimeout(requestStatus, refreshInterval);
}

function handleResponse(serialData){
    let message = serialData.toString();
    console.log('Received:', message);
    let statusObj = parseStatusMessage(message);
    if(statusObj !== undefined) {
        let zone = statusObj.zone;
        statusObj = _.omit(statusObj, 'zone');

        thermostatCache[zone] = statusObj;
        let ref = db.ref(`thermostats/zones/${zone}`);

        ref.update(statusObj, function (error) {
            if (error) {
                console.log("Data could not be saved." + error);
            }
        });
    }else{
        console.log('Parsed message empty');
    }
}

function parseStatusMessage(message){
    let messageTypes = {
        'O': 'zone',
        'T': 'currentTemperature',
        'SPH': 'setPointHeating',
        'SPC': 'setPointCooling',
        'M': 'currentMode',
        'FM': 'fanMode',
        'H1A': 'heatingStage1',
        'H2A': 'heatingStage2',
        'H3A': 'heatingStage3',
        'C1A': 'coolingStage1',
        'C2A': 'coolingStage2',
        'FA': 'fanStatus',
        'VA': 'ventDamperStatus',
        'D1': 'zoneDamper1Status',
        'D2': 'zoneDamper2Status',
        'SCP': 'minTimeStatus',
        'SM': 'systemModeStatus',
        'SF': 'systemFanStatus'
    };
    return _.chain(message.replace('\r', '').split(' '))
        .map(element => {
            element = element.split('=');
            return {
                type: element[0],
                value: element[1]
            }
        })
        .reduce((result, element) => {
            let key = messageTypes[element.type];
            let value = element.value;
            if(key && value){
                if(key === 'minTimeStatus'){
                    [result.minRunTimeStage1, result.minOffTimeStage1, result.minRunTimeStage2, result.minOffTimeStage2] = parseMinTime(value);
                }else{
                    result[key] = !isNaN(value) ? parseInt(value) : value;
                }
            }
            return result;
        }, {})
        .thru((result) => {
            result.zone = lastZone = result.zone || lastZone;
            return result;
        })
        .omitBy(_.isUndefined)
        .omitBy(_.isNull)
        .value();
}

function setThermostat(zone, data){
    let changes = getThermostatChanges(zone, data);
    if(changes.length === 0) return;

    messageQueue.enqueue(_.reduce(changes, (result, value) => {
        switch(value){
            case 'setPointHeating':
                result += ` SPH=${data.setPointHeating}`;
                break;
            case 'setPointCooling':
                result += ` SPC=${data.setPointCooling}`;
                break;
            case 'currentMode':
                result += ` M=${data.currentMode}`;
                break;
            case 'fanMode':
                result += ` F=${data.fanMode}`;
                break;
        }
        return result;
    }, `A=${zone}`));
}

function getThermostatChanges(zone, data){
    return _.reduce(data, (result, value, key) => {
        return _.isEqual(value, thermostatCache[zone][key]) ?
            result : result.concat(key);
    }, []);
}

function emptyMessageQueue(){
    let expectResponse;
    if(!messageQueue.isEmpty()){
        let messageObj = messageQueue.dequeue();
        sendMessage(messageObj.message);
        expectResponse = messageObj.expectResponse;
    }
    setTimeout(emptyMessageQueue, expectResponse ? 200 : 10);
}

function parseMinTime(value){
    return _(value)
        .split('')
        .flatMap(val => {
            return _(parseInt(val).toString(2))
                .padStart(2, '0')
                .split('')
                .map((val) => parseInt(val));
        });
}

function sendMessage(message){
    console.log('Sending message:', message);
    rcs.write(message + '\r', function (err) {
        if (err) {
            return console.log('Error on writing:', message, 'Error message:', err.message);
        }
    });
}