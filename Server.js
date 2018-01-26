'use strict';

const EventEmitter = require('events').EventEmitter;

const uuid = require('uuid/v4');

const amqplib = require('amqplib');

class Server {

	/**
	 * Конструктор сервера
	 * @param {Object} options Параметры создания сервера
	 */
	constructor(options) {
		this.__hostname = options && options.hostname ? options.hostname : 'localhost';//Адрес сервера
		this.__port = options && options.port ? options.port : 5672;//Порт сервера
		this.__username = options && options.username ? options.username : 'guest';//Логин подключения
		this.__password = options && options.password ? options.password : 'guest';//Пароль подключения
		this.__heartbeat = options && options.heartbeat ? options.heartbeat : 30;//Проверка соединения
		this.__frameMax = options && options.frameMax ? options.frameMax : 0;//Размер фрейма
		this.__locale = options && options.locale ? options.locale : 'en_US';//Язык по умолчанию
		this.__vhost = options && options.vhost ? options.vhost : '/';//Путь до экземпляра
		this.__queueName = options && options.queue ? options.queue : `server-rpc-${uuid()}`;//Название очереди сервера
		this.__prefetch = options && options.prefetch && typeof(options.prefetch) == 'number' ? options.prefetch : 3;
		this.__reconnect = options && options.reconnect && typeof(options.reconnect) == 'boolean' ? options.reconnect : false;//Переподключаться, если был разрыв соединения
		this.__funcs = {};//Список функций

		this.__connection = null;
		this.__channel = null;
		this.__queue = null;

		this.__ee = new EventEmitter;

		//Событие запроса выполнения метода
		this.__ee.on('request', (obj) => {
			this.__handler(obj.msg, this);
		});
		//Событие отправки результата
		this.__ee.on('response', (obj) => {
			if(this.__channel) {
				if(obj.error) {
					this.__channel.sendToQueue(obj.replyTo, Buffer.from(JSON.stringify({error: obj.error})), {correlationId: obj.correlationId});
				} else {
					this.__channel.sendToQueue(obj.replyTo, Buffer.from(JSON.stringify({result: obj.result})), {correlationId: obj.correlationId});
				}
			}
		});
	}

	/**
	 * Привязка функций и запуск сервера
	 */
	async run() {
		try {
			this.__connection = await amqplib.connect({
				protocol: 'amqp',
				hostname: this.__hostname,
				port: this.__port,
				username: this.__username,
				password: this.__password,
				locale: this.__locale,
				frameMax: this.__frameMax,
				heartbeat: this.__heartbeat,
				vhost: this.__vhost
			});
		}catch(e){
			this.stop();
			throw e;
		}
		try {
			this.__channel = await this.__connection.createChannel();
			this.__channel.prefetch(this.__prefetch);
			this.__channel.on('close', () => {
				//TODO если канал закрыт
			});
			this.__channel.on('error', (err) => {
				console.error(err);
				//TODO если получена ошибка канала
			});
			this.__channel.on('return', (msg) => {
				//console.log(msg.content);
				//TODO если возвращено сообщение, которое не удалось отправить в очередь
			});
			this.__channel.on('drain', () => {
				//TODO Like a stream.Writable, a channel will emit 'drain', if it has previously returned false from #publish or #sendToQueue, once its write buffer has been emptied (i.e., once it is ready for writes again).
			});
		}catch(e){
			this.stop();
			throw e;
		}
		try{
			await this.__channel.assertQueue(this.__queueName, {
				/*exclusive: true,*/
				autoDelete: false,
				durable: true
			});
		}catch(e){
			this.stop();
			throw e;
		}
		let self = this;//Установка собственного объекта для обслуживания
		try {
			await this.__channel.consume(this.__queueName, (msg) => {
				self.__ee.emit('request', {/*self: self, */msg: msg});
			}, {
				durable: false
			});
		} catch(e) {
			this.stop();
			throw e;
		}
		return true;
	}

	/**
	 * Остановка сервера
	 */
	async stop() {
		this.__channel = null;
		try {
			if(this.__connection != null) {
				this.__connection.close();
			}
		}finally{
			this.__connection = null;
		}
		return true;
	}

	/**
	 * Привязка функции к удаленному вызову
	 * @param {String} name Название функции
	 * @param {Function} cb Обратный вызов в результате обработки функции
	 */
	bind(name, cb) {
		this.__funcs[name] = cb;
		return this.__funcs.hasOwnProperty(name);
	}

	unbind(name) {
		if(this.__funcs.hasOwnProperty(name)) {
			delete this.__funcs(name);
		}
	}

	hasFunction(name) {
		return this.__funcs.hasOwnProperty(name);
	}

	/**
	 * Обработчик полученных сообщений
	 * @param {Message} msg сообщение
	 * @param {Server} obj Объект собственного класса
	 */
	__handler(msg, obj) {
		//Обработчик сообщений
		let data = JSON.parse(msg.content.toString());
		let err = null;
		obj.__call(data.method, data.params, (err, result) => {
			//Возврат ответа и результат выполнения функции
			//console.log(err, result);
			let tmp = {
				correlationId: msg.properties.correlationId,
				replyTo: msg.properties.replyTo,
				error: err,
				result: result
			};
			if(obj.__channel) {
				obj.__channel.ack(msg);
			}
			obj.__ee.emit('response', tmp);
		});
	}

	/**
	 * Вызов функции
	 * @param {String} method Название вызываемой функции
	 * @param {Object} params Параметры
	 * @param {Function} cb Результат обработки
	 */
	__call(method, params, cb) {
		let err = null;
		if(!this.__funcs.hasOwnProperty(method)) {
			err = {code: -32601, name: method, message: "Method not found"};
			cb(err);
		} else {
			this.__funcs[method](params, (err, result) => {
				if(err) {
					cb({
						code: -32603,
						name: err.name,
						message: err.message,
						stack: err.stack
					});
				} else {
					cb(null, result);
				}
			});
		}
	}
}

module.exports = Server;