class RpcError extends Error {
	constructor(param) {
		super(param);
		this.name = "RpcError";
	}
}

let test = new RpcError();
console.log(test);
console.log(test instanceof RpcError);