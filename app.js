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

    db.ref('thermostats')
        .on("child_changed", function(snapshot) {
            setThermostat(snapshot.val());
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
        _.range(5)
            .map(zoneId => {
                zoneId++; // convert 0 offset to zones beginning at 1
                return `A=${zoneId} R=1`;
            }),
        true
    );

    console.log(`Waiting ${refreshInterval}ms before checking status`);
    setTimeout(requestStatus, refreshInterval);
}

function handleResponse(serialData){
    let message = serialData.toString();
    console.log('Received:', message);
    let statusObj = parseStatusType1(message);

    thermostatCache[statusObj.zone] = statusObj;
    let ref = db.ref(`thermostats/zone${statusObj.zone}`);

    ref.update(statusObj, function(error) {
        if (error) {
            console.log("Data could not be saved." + error);
        }
    });
}

function parseStatusType1(message){
    return _(message.replace('\r', '').split(' '))
        .map(element => {
            element = element.split('=');
            return {
                type: element[0],
                value: element[1]
            }
        })
        .reduce((result, element) => {
            switch(element.type){
                case 'O':
                    result.zone = element.value;
                    break;
                case 'T':
                    result.currentTemperature = element.value;
                    break;
                case 'SPH':
                    result.setPointHeating = element.value;
                    break;
                case 'SPC':
                    result.setPointCooling = element.value;
                    break;
                case 'M':
                    result.currentMode = element.value;
                    break;
                case 'FM':
                    result.fanMode = element.value;
                    break;
            }
            return result;
        }, {});
}

function setThermostat(data){
    let changes = getThermostatChanges(data);
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
    }, `A=${data.zone}`));
}

function getThermostatChanges(data){
    return _.reduce(data, (result, value, key) => {
        return _.isEqual(value, thermostatCache[data.zone][key]) ?
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
    setTimeout(emptyMessageQueue, expectResponse ? 100 : 10)
}

function sendMessage(message){
    console.log('Sending message:', message);
    rcs.write(message + '\r', function (err) {
        if (err) {
            return console.log('Error on writing:', message, 'Error message:', err.message);
        }
    });
}