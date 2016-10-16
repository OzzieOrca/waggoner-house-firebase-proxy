'use strict';

let firebase = require('firebase');
let SerialPort = require('serialport');

init();

function init(){
    firebase.initializeApp({
        serviceAccount: 'secrets/waggoner-house-firebase-service-account.json',
        databaseURL: 'https://waggoner-house.firebaseio.com'
    });

    let rcs = new SerialPort('/dev/ttyUSB1', {
        baudRate: 9600
    });

    rcs.on('open', function() {
        requestStatus(rcs);
    });

    rcs.on('error', function(err) {
        console.log('Error: ', err.message);
    });

    let db = firebase.database();
    let ref = db.ref("test/status");

    rcs.on('data', function (data) {
        ref.set(data, function(error) {
            if (error) {
                console.log("Data could not be saved." + error);
            } else {
                requestStatus(rcs);
            }
        });
    });
}

function requestStatus(rcs){
    rcs.write('A=1 R=1\r', function(err) {
        if (err) {
            return console.log('Error on write: ', err.message);
        }
        console.log('message written');
    });
}
