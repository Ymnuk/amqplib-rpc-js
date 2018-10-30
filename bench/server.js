const Server = require('../Server');
const server = new Server({queue: "server_bench", reconnectTimeout: 3, reconnect: true});

server.bind('echo', (num, cb) => {
    cb(null, num);
});

server.run();