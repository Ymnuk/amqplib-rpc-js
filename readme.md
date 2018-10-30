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

//If you need verify params for correct, use schema json
server.bindSchema('method', {/*schema*/})

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
		//"res" should return true
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
- reconnect - Flag with server trying reconnection to MQ-server (default: false)
- reconnectTimeout - Each Seconds server trying reconnect to MQ-server

## Client options

- hostname - Address for connection to MQServer (default: 'localhost')
- port - Port for connection to MQServer (default: 5672)
- username - Username for connection to MQServer (default: 'guest')
- password - Password for connection to MQServer (default: 'guest')
- heartbeat - Heartbeat for testing connection to MQServer (default: 30 secs)
- queue - The name of the queue to which the client requests will be sent to the server. If the value is null, the name is generated automatically
- timeout - The parameter is intended for setting the waiting for a response from the server. If the waiting time is longer than the set time, then there will be a generated TimeoutException error. The time is set in seconds. (default: 0 (infinity))

## FAYULogger

Server and Client support logging with FAYULogger. You can create class FAUYLogger, create modules and transports, set into Server and/or Client:

```javascript
const FAYULogger = require('fayulogger');
//Something for create Server and/or Client

let logger = new FAYULogger();
//Create and binding modules and transports
server.FAYULogger = logger;
client.FAYULogger = logger;
```

## Warning

Module in develop.

## Changelog

### 0.1.3

Added support json-schema for verify parameters

### 0.1.1

Change attribute "name" in error on "method"
Change just error on class "RpcError"