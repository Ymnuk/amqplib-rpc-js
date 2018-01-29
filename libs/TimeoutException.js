class TimeoutException extends Error {
	constructor(method) {
		super();
		this.name = 'TimeoutException';
		this.method = method;
		this.message = 'Timeout';
		this.code = -32604;
	}
}

/*function TimeoutException(method) {
	this.name = 'TimeoutException';
	this.method = method;
	this.message = 'Timeout';
	this.code = -32604;
	this.stack = (new Error()).stack;
}*/

module.exports = TimeoutException;