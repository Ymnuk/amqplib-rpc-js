function TimeoutException(name) {
	this.name = name ? name : 'TimeoutException';
	this.message = 'Timeout';
	this.code = -32604;
	this.stack = (new Error()).stack;
}

module.exports = TimeoutException;