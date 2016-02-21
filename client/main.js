//RASPBERRY PI VERSION

var awsIot = require('aws-iot-device-sdk');
var aws = require('aws-sdk');
aws.config.loadFromPath('credential.json');

var BUCKET_NAME = 'alarmsystem';
var s3 = new aws.S3();

//Define the topic
var topic = "topic_2";

var alarmEnable = false;
var securityBreach = false;
var roomBreach = 0;

//Initialize the device
var device = awsIot.device({
    host: "A1O92JCFLQCTDV.iot.us-west-2.amazonaws.com",
    port: 8883,
    clientId: "AlarmSystem",
    thingName: "AlarmSystem",
    caCert: "root-CA.crt",
    clientCert: "2a32211d16-certificate.pem.crt",
    privateKey: "2a32211d16-private.pem.key"
});

var timeout;
var count = 0;

//Action executed when the device connects to the server
device.on('connect', function () {

    console.log('Connected to the AWS.');
    device.subscribe(topic);

});

device.on('close', function () {
    console.log("Close");
    clearInterval(timeout);
    count = 0;
});

device.on('reconnect', function () {
    console.log('reconnect');
});

device.on('offline', function () {
    console.log('offline');
    clearInterval(timeout);
    count = 0;
});

device.on('error', function (error) {
    console.log('error', error);
    clearInterval(timeout);
    count = 0;
});

//Send command to the WebService
function sendCommand(topic, json) {

    //Publish the command
    device.publish(topic, json);

}

//Action executed when the device receives a message
device.on('message', function (topic, payload) {

    //Get the data
    var data = JSON.parse(payload.toString());

    //Select category
    if (data.category === "alarm") {
        manageAlarm(data);
    } else if (data.category === "light") {
        manageLight(data);
    }

});

//Manage the alarm 
function manageAlarm(data) {

    var message;

    //Execute command
    if (data.command === "enable") {
        alarmEnable = true;
        console.log("Alarm is Enabled");

        message = "Alarm was Enabled";

    } else if (data.command === "disable") {
        alarmEnable = false;
        securityBreach = false;
        roomBreach = 0;

        console.log("Alarm is Disabled");

        message = "Alarm was Disabled";

    } else if (data.command === "status") {

        //Check if the alarm is enable
        if (alarmEnable) {

            //Check if it has a security breach
            if (securityBreach) {

                message = "SECURITY BREACH - ROOM " + roomBreach;

            } else {
                message = "Alarm is Enabled";
            }

        } else {

            message = "Alarm is Disabled";
        }
    }

    //Send the message to the client
    sendCommand(topic, JSON.stringify({
        "message": message
    }));

}

//Manage the lights
function manageLight(data) {

    //Execute command
    if (data.command === "enable") {

        console.log("Light Enable");

    } else if (data.command === "disable") {

        console.log("Light Disabled");
    } else if (data.command === "status") {

        //Send the command to the WebService
        sendCommand(topic, JSON.stringify({
            category: "light",
            command: "status",
            data: {
                "enabled": [1, 2, 3],
                "disabled": [4, 5, 6]
            }
        }));

        console.log("Sending Light Status");

    }

}

//Take a snapshot from the webcam
function takeSnapshot() {

    var webcamPath = '/dev/video0';

    //Load the modules
    var fs = require('fs');
    var md5 = require('md5');
    var moment = require('moment');
    var ffmpeg = require('fluent-ffmpeg');

    //Define the unique name
    var filename = "snapshot" + md5(moment()) + '.png';

    //Access the webcam
    var salving = ffmpeg(webcamPath)
            .thumbnail({
                size: '1280x960',
                filename: filename,
                timemarks: ['1']
            }, 'snapshots', function (err) {

            });

    //When it is concluded
    salving.on('end', function () {

        //Read the file and upload
        fs.readFile('snapshots/' + filename, function (err, data) {

            if (err) {
                console.log(err);
            }

            //Define the params
            var params = {
                Bucket: BUCKET_NAME,
                Key: 'snapshots/' + filename,
                Body: data
            };

            //Upload the file
            s3.upload(params, function (err, data) {
                if (err)
                    console.log(err);

                //Send the key to the WebService;
                sendCommand(topic, JSON.stringify({
                    key: 'snapshots/' + filename
                }));

            });

        });
    });

}

//Read the console commands
process.stdin.setEncoding('utf8');

process.stdin.on('readable', function () {
    var chunk = process.stdin.read();

    if (chunk !== null) {

        //Check the sensors
        if (is_int(chunk)) {

            //Is the alarm is enable, it is a security breach
            if (alarmEnable) {

                securityBreach = true;
                roomBreach = chunk;

                //Send the message to the client
                sendCommand(topic, JSON.stringify({
                    "message": "SECURITY BREACH - ROOM " + roomBreach
                }));

                console.log("SECURITY BREACH - ROOM " + roomBreach);

            }

        } else if (chunk.replace('\n', '') === "d") {

            if (alarmEnable) {

                //Take a snapshot from the door
                takeSnapshot();

            }

        }

    }
});

//Check if the variable is an integer
function is_int(value) {
    if ((parseFloat(value) == parseInt(value)) && !isNaN(value)) {
        return true;
    } else {
        return false;
    }
}