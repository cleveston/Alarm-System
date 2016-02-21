//MOBILE VERSION

var awsIot = require('aws-iot-device-sdk');
var aws = require('aws-sdk');
aws.config.loadFromPath('credential.json');
var BUCKET_NAME = 'alarmsystem';
var s3 = new aws.S3();
//Define the topic
var topic = "topic_2";
//Initialize the device
var device = awsIot.device({
    host: "A1O92JCFLQCTDV.iot.us-west-2.amazonaws.com",
    port: 8883,
    clientId: "userPhone",
    thingName: "userPhone",
    caCert: "root-CA.crt",
    clientCert: "84d7e42b94-certificate.pem.crt",
    privateKey: "84d7e42b94-private.pem.key"
});
//Action executed when the device connects to the server
device.on('connect', function () {
    console.log('Connected to the AWS.');
    device.subscribe(topic);
});
//Send command to the WebService
function sendCommand(topic, json) {

    //Publish the command
    device.publish(topic, json);
}

//Action executed when the device receives a message
device.on('message', function (topic, payload) {

    var shell = require('shelljs');
    //Get the data
    var data = JSON.parse(payload.toString());
    if (data.message !== undefined)
        console.log(">>>> " + data.message);
    else if (data.key !== undefined) {

        //Get the imagem from Amazon
        var s3 = new aws.S3();
        var params = {Bucket: BUCKET_NAME, Key: data.key};
        var file = require('fs').createWriteStream(data.key);
        var p = s3.getObject(params).createReadStream();
        var o = p.pipe(file);

        //On end, show the image
        p.on('end', function () {
            shell.exec('gwenview ' + data.key + ">> /dev/null");
        });

    }

});

//Read the console
process.stdin.setEncoding('utf8');
process.stdin.on('readable', function () {
    var chunk = process.stdin.read();
    if (chunk !== null) {

        var data = chunk.replace('\n', '').split(" ");
        sendCommand(topic, JSON.stringify({
            category: data[0],
            command: data[1],
            data: data[2]
        }));
    }
});
process.stdin.on('end', function () {
    process.stdout.write('end');
});