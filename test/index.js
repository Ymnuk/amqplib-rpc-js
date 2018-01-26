const vows = require('vows');
const assert = require('assert');
const Server = require('../Server');
const Client = require('../Client');

const server = new Server({queue: "test"});
const client = new Client({
	queue: "test",
	timeout: 20
});

//Числа фибоначчи
function fibonacci(n) {
	let a = 1,
	b = 1;
	for (var i = 3; i <= n; i++) {
		var c = a + b;
		a = b;
		b = c;
	}
	return b;
}

vows
	.describe('Testing RPC Server-Client')
		.addBatch({
			'Create RPC-Server': {
				topic: function () {
					server.run()
						.then(res => {
							this.callback(res);
						})
						.catch(err => {
							this.callback(err);
						});
				},
				'Should return "TRUE"': (topic) => {
					assert.equal(topic, true);
				}
			},
			'Binding function': {
				topic: () => {
					server.bind('fibonacci', (num, cb) => {
						cb(null, fibonacci(num));
					});
					//Функция с таймаутом для эмуляции долгого выполнения удаленной процедуры
					server.bind('longTime', (par, cb) => {
						setTimeout((obj) => {
							obj();
						}, 30000, cb);
					});
					return true;
				},
				'Verify binding function': () => {
					assert.equal(server.hasFunction('fibonacci'), true);
				}
			}
		})
		.addBatch({
			"Create RPC-Client": {
				topic: function() {
					client.run()
						.then(res => {
							this.callback(res);
						})
						.catch(err => {
							this.callback(err);
						});
				},
				'Should return "TRUE"': (topic) => {
					assert.equal(topic, true);
				}
			}
		})
		.addBatch({
			'Call function': {
				topic: function() {
					client.call('fibonacci', 5, (err, result) => {
						this.callback(err, result);
					});
				},
				'Should return 5': (err, result) => {
					if(err) {
						assert.fail(err);
					} else {
						assert.equal(result, 5);
					}
				}
			}
		})
		.addBatch({
			'Call function again': {
				topic: function() {
					client.call('fibonacci', 6, (err, result) => {
						this.callback(err, result);
					});
				},
				'Should return 8': (err, result) => {
					if(err) {
						assert.fail(err);
					} else {
						assert.equal(result, 8);
					}
				}
			}
		})
		.addBatch({
			'Testing "method not found"': {
				topic: function() {
					client.call('fibanother', null, (err, res) => {
						this.callback(err, res);
					});
				},
				'Should return -32601': function(err, res) {
					if(err) {
						assert.equal(err.code, -32601);
					} else {
						assert.fail('Error return code');
					}
				},
				'Should return name method "fibanother"': function(err, result) {
					if(err) {
						assert.equal(err.name, 'fibanother');
					} else {
						assert.fail('Error return name');
					}
				},
				'Should return message "Method not found"': function(err, res) {
					if(err) {
						assert.equal(err.message, 'Method not found');
					} else {
						assert.fail('Error return message');
					}
				}
			},
			'Testing error by "timeout"': {
				topic: function() {
					client.call('longTime', null, (err, res) => {
						this.callback(err, res);
					});
				},
				'Should return -32604': function(err, res) {
					if(err) {
						assert.equal(err.code, -32604);
					} else {
						assert.fail('Error return code');
					}
				},
				'Should return name method "longTime"': function(err, result) {
					if(err) {
						assert.equal(err.name, 'longTime');
					} else {
						assert.fail('Error return name');
					}
				},
				'Should return "Timeout"': function(err, res) {
					if(err) {
						assert.equal(err.message, 'Timeout');
					} else {
						assert.fail('Error return message');
					}
				}
			}
		})
		.addBatch({
			'Waiting where message is acked for next test': {
				topic: function() {
					setTimeout((self) => {
						self.callback(true);
					}, 10000, this);
				},
				'Waiting is complete': function(topic) {
					assert.ok(topic);
				}
			}
		})
		.addBatch({
			'Testing performance': {
				topic: function() {
					//Подготовка массива для тестирования производительности
					let startDate = new Date();
					let endDate = null;
					let count = 0;
					for(let i = 0; i < 20000; i++) {
						client.call('fibonacci', i, (err, res) => {
							count++;
							if(count === 20000) {
								endDate = new Date();
								this.callback(startDate, endDate);
							}
						});
					}
				},
				'Should less or equal 20 secs': (startDate, endDate) => {
					assert.ok((endDate - startDate) <= 20000);
				}
			}
		})
		.addBatch({
			'Close RPC-Server': {
				topic: function() {
					server.stop()
						.then(res => {
							this.callback(res);
						})
						.catch(err => {
							this.callback(err);
						})
				},
				'Server stopped': (res) => {
					assert.equal(res, true);
				}
			},
			'Close RPC-Client': {
				topic: function() {
					client.stop()
						.then(res => {
							this.callback(res);
						})
						.catch(res => {
							this.callback(err);
						})
				},
				'Client stopped': (res) => {
					assert.equal(res, true);
				}
			}
		})
	.export(module);