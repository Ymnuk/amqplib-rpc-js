# RCP-Server and RCP-Client under amqplib for Node.JS

	npm install amqplib

A library for organizing remote procedure calls based on the AMQP 0-9-1 protocol using the amqplib library.

## Use on the server side

```javascript

const Server = require('amqplib-rpc/Server');
//or
const Server = require('amqplib-rpc').Server;

const server = new Server({queue: "test"});

server.bind('method', (params, callback) => {
	//Do something
	callback(err, result);//Return result or error
});

server.run()
	.then(function(res) {
		//Should return true
	})
	.catch(function(err) {
		//Return "Error" if server not started
	});

```

To stop the server, use the server.stop()

## Use on the client side

```javascript

const Client = require('amqplib-rpc/Client');
//or
const client = require('amqplib-rpc').Client;

const client = new Client({queue: "test"});

client.run()
	.then(function(res) {
		//Should return true
		client.call('method', params, function(err, resu) {
			//Do something with result
		});
	})
	.catch(function(err) {
		//Return "Error" if client not started
	});
```

To stop the client, use the client.stop()

## Server options

- hostname - Address for connection to MQServer (default: 'localhost')
- port - Port for connection to MQServer (default: 5672)
- username - Username for connection to MQServer (default: 'guest')
- password - Password for connection to MQServer (default: 'guest')
- heartbeat - Heartbeat for testing connection to MQServer (default: 30 secs)
- queue - The name of the server queue. If the value is null, the name is generated automatically
- prefetch - Determines how many maximum messages the server can receive from the queue (default: 3)

## Client options

- hostname - Address for connection to MQServer (default: 'localhost')
- port - Port for connection to MQServer (default: 5672)
- username - Username for connection to MQServer (default: 'guest')
- password - Password for connection to MQServer (default: 'guest')
- heartbeat - Heartbeat for testing connection to MQServer (default: 30 secs)
- queue - The name of the queue to which the client requests will be sent to the server. If the value is null, the name is generated automatically