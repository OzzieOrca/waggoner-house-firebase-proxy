'use strict';

let firebase = require('firebase');
let SerialPort = require('serialport');
let _ = require('lodash');

let db;
let rcs;
let refreshInterval = 10000;

init();

function init(){
    initFirebase();
    initSerial();
}

function initFirebase(){
    firebase.initializeApp({
        serviceAccount: 'secrets/waggoner-house-firebase-service-account.json',
        databaseURL: 'https://waggoner-house.firebaseio.com'
    });

    db = firebase.database();

    let ref = db.ref('thermostats/config/refreshInterval');
    ref.on("value", function(snapshot) {
        refreshInterval = snapshot.val();
    }, function (errorObject) {
        console.log("Error reading refreshInterval: " + errorObject);
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
    _.range(5)
        .map(n => n + 1)
        .map(zoneId => `A=${zoneId} R=1\r`)
        .forEach(message => {
            console.log('Sending message:', message);
            rcs.write(message, function (err) {
                if (err) {
                    return console.log('Error on writing:', message, 'Error message:', err.message);
                }
            });
        });

    console.log(`Waiting ${refreshInterval}ms before checking status`);
    setTimeout(requestStatus, refreshInterval);
}

function handleResponse(serialData){
    let message = serialData.toString();
    console.log('Received:', message);
    let statusObj = parseStatusType1(message);

    let ref = db.ref(`thermostats/zone${statusObj.zone}`);
    statusObj = _.omit(statusObj, 'zone');

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