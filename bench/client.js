const Client = require('../Client');
const client = new Client({queue: "server_bench", reconnectTimeout: 3, reconnect: true});
client.run();

let buffer = [];
let num = 0;

setInterval(() => {
    num++;
    console.log(`Send: ${num}`);
    client.call('echo', num, (err, res) => {
        console.log(`Received: ${res}`);
    })
}, 1000);