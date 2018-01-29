class RpcError extends Error {
	constructor(err) {
		super();
		if(err) {
			if(typeof(err) == 'object') {
				if(err.code) {
					this.code = err.code;
				}
				if(err.method) {
					this.method = err.method;
				}
				if(err.message) {
					this.message = err.message;
				}
				if(err.stack) {
					this.stack = err.stack;
				}
			} else {
				this.message = err;
			}
		}
	}
}

module.exports = RpcError;