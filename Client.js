'use strict';

const TimeoutException = require('./libs/TimeoutException');
const RpcException = require('./libs/RpcError');

const amqplib = require('amqplib');
const uuid = require('uuid/v4');

const clonedeep = require('lodash.clonedeep');

class Client {

	/**
	 * Конструктор клиента
	 * @param {Object} options Параметры создания клиента
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
		this.__queueSelf = `client-rpc-${uuid()}`;//Собственная очередь для получения ответов от сервера
		this.__prefetch = options && options.prefetch && typeof(options.prefetch) == 'number' ? options.prefetch : 1;//Параллельное Количество получаемых сообщений
		this.__reconnect = options && options.reconnect && typeof(options.reconnect) == 'boolean' ? options.reconnect : false;//Переподключаться, если был разрыв соединения
		this.__reconnectTimeout = options && options.reconnectTimeout && typeof(options.reconnectTimeout) == "number" ? options.reconnectTimeout * 1000 : 30000;//Если установлен флаг переподключения, то выдержать таймаут перед переподключением
		this.__timeout = options && options.timeout && typeof(options.timeout) == 'number' ? options.timeout : 0;//Время ожидание ответа. 0 - бесконечно
		this.__correlations = {};//Список список корреляционных идентификаторов

		this.__connection = null;
		this.__channel = null;
		this.__queue = null;

		this.__fayulogger = null;

		this.__activated = false;//Соединение установлено

		this.__buffer = [];//Буффер в случае потери соединения
	}

	/**
	 * Отправка сообщения лога в систему логирования (если установлена)
	 * @param {String} level Уровень логирования
	 * @param {Object} msg Сообщение
	 */
	__sendLog(level, msg) {
		if(this.__fayulogger) {
			console.log('OK');
			switch(level.toLowerCase()) {
				case 'debug':
					for(let mod in this.__fayulogger.modules) {
						mod.debug(msg);
					}
					break;
				case 'info':
					for(let mod in this.__fayulogger.modules) {
						mod.info(msg);
					}
					break;
				case 'warn':
					for(let mod in this.__fayulogger.modules) {
						mod.warn(msg);
					}
					break;
				case 'severe':
					for(let mod in this.__fayulogger.modules) {
						mod.severe(msg);
					}
					break;
				case 'error':
					for(let mod in this.__fayulogger.modules) {
						mod.error(msg);
					}
					break;
				case 'fatal':
					for(let mod in this.__fayulogger.modules) {
						mod.fatal(msg);
					}
					break;
			}
		}
	}

	/**
	 * Остановка сервера
	 */
	async stop() {
		this.__activated = false;
		this.__onConnected = false;
		this.__channel = null;
		try {
			if(this.__connection != null) {
				this.__connection.close();
			}
		}finally{
			this.__connection = null;
		}
		if(this.__timeoutId !== null) {
			try {
				clearTimeout(this.__timeoutId);//Очищаем таймаут
			}catch(e){
				//Обработать исключение очистки таймаута, если оно возникнет
				this.__sendLog('error', {
					errName: e.name,
					stack: e.stack,
					message: e.message
				})
				throw e;
			}
			this.__timeoutId = null;
		}
		this.__sendLog('info', 'Closed connect');
		return true;
	}

	/**
	 * Подготовка соединения
	 */
	async __prepareConnect() {
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
			this.__sendLog('info', {
				protocol: 'amqp',
				hostname: this.__hostname,
				port: this.__port,
				username: this.__username,
				locale: this.__locale,
				frameMax: this.__frameMax,
				heartbeat: this.__heartbeat,
				vhost: this.__vhost
			})
		}catch(e){
			//console.error(e);
			//this.__reconnectAgain();
			if(this.__reconnect) {
				this.__reconnectAgain();
			} else {
				this.stop();
			}
			this.__sendLog("error", {
				errName: e.name,
				strack: e.stack
			})
			throw e;
		}
	}

	/**
	 * Повторно запускаем переподключение к серверу
	 */
	__reconnectAgain() {
		if(this.__activated && this.__reconnect) {
			setTimeout(() => {
				(async () => {
				this.run()
				})().then()
			}, this.__reconnectTimeout);
			//TODO Соединение было установлено, запускаем реконнект к серверу
		}
	}

	/**
	 * Подключаемся к каналу
	 */
	async __connect()
	{
		try {
			this.__channel = await this.__connection.createChannel();
			this.__channel.prefetch(this.__prefetch);
			this.__channel.on('close', () => {
				//console.error("Client disconnected");
				this.__onConnected = false;
				this.__reconnectAgain();
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
			this.__sendLog("info", "Channel created");
		}catch(e){
			if(this.__reconnect) {
				this.__reconnectAgain();
			} else {
				this.stop();
			}
			this.__sendLog("error", {
				errName: e.name,
				strack: e.stack
			})
			throw e;
		}
		await this.__linkingToQueues();
	}

	/**
	 * Привязываемся к каналам и функциям
	 */
	async __linkingToQueues() {
		try{
			await this.__channel.assertQueue(this.__queueSelf, {
				exclusive: true,
				autoDelete: true
			});
			this.__sendLog("info", `Connected to queue: ${this.__queueName}`);
		}catch(e){
			this.stop();
			this.__sendLog("error", {
				errName: e.name,
				strack: e.stack
			})
			throw e;
		}
		let self = this;//Установка собственного объекта для обслуживания
		try {
			await this.__channel.consume(this.__queueSelf, (msg) => {
				self.__handler(msg, self);
			}, {
				noAck: true
			});
			this.__sendLog('info', 'Linked consume');
		} catch(e) {
			this.stop();
			this.__sendLog("error", {
				errName: e.name,
				strack: e.stack
			})
			throw e;
		}
		if(this.__timeout > 0) {
			this.__timeoutId = setTimeout(this.__timeoutCall, 1000, this);
		} else {
			this.__timeoutId = null;
		}
		this.__onConnected = true;
		console.log("Client Conected");
		//console.log(this.__channel);
	}

	/**
	 * Привязка функций и запуск клиента
	 */
	async run() {
		this.__activated = true;//Говорим, что соединение установлено
		await this.__prepareConnect();
		await this.__connect();
		if(!this.__onConnected) {
			this.__reconnectAgain();
		}
		return true;
	}

	/**
	 * Поиск функций, который закончили свое ожидание и требуют возврат ошибки по тайм-ауту, в случае, когда сервер вовремя не вернул ответ
	 * @param {Client} obj Класс экземпляра клиента
	 */
	__timeoutCall(obj) {
		//Проверяем все идентификаторы корреляций вызванных функций
		let now = new Date();
		for(let i in obj.__correlations) {
			let corrId = obj.__correlations[i];
			let currDate = new Date(corrId.callDate);
			currDate.setSeconds(currDate.getSeconds() + obj.__timeout);
			if(+currDate <= +now) {
				if(corrId.callback && typeof(corrId.callback) == 'function') {
					//Вернуть ошибку по истечении времени ожидания ответа от сервера
					delete obj.__correlations[i];
					let e = new TimeoutException(corrId.method);
					/*this.__sendLog('error', {
						errName: e.name,
						method: e.method,
						message: e.message,
						code: e.code
					});*/
					corrId.callback(e);
				}
			}
		}
		obj.__timeoutId = setTimeout(obj.__timeoutCall, 1000, obj);
	}


	/**
	 * Обработка результатов выполнения удаленной процедуры
	 * @param {Message} msg 
	 * @param {Client} obj 
	 */
	__handler(msg, obj) {
		//Обработка результатов выполнения удаленной процедуры
		let data = JSON.parse(msg.content.toString());
		let err = data.error;
		let error = null;
		let result = data.result;
		let correlationId = msg.properties.correlationId;
		
		if(obj.__correlations.hasOwnProperty(correlationId)) {
			let corrId = obj.__correlations[correlationId];
			delete obj.__correlations[correlationId];
			if(corrId.callback != null && typeof(corrId.callback) == 'function') {
				if(err) {
					error = new RpcException(err);
				}
				corrId.callback(error, result);
			}
		}
	}

	/**
	 * Вызов удаленного метода
	 * @param {String} method Имя метода
	 * @param {Object} params Передаваемые параметры
	 * @param {Function} cb Функция обратного вызова когда метод завершен и возврат результата
	 */
	call(method, params, cb) {
		let parsed = false;
		let obj = {
			method: method,
			params: params,
			callDate: new Date(),
			callback: cb
		}
		let id = uuid();
		this.__correlations[id] = obj;
		this.__sendLog('info', {
			id: id,
			method: method,
			callDate: obj.callDate,
			replyTo: this.__queueSelf
		})
		
		if(this.__activated && this.__onConnected) {
			if(this.__buffer.length > 0) {
				let buff = this.__buffer;
				this.__buffer = [];
				for(let i = 0; i < buff.length; i++) {
					this.__channel.sendToQueue(this.__queueName, Buffer.from(JSON.stringify(buff[i].obj)), {
						correlationId: buff[i].id,
						replyTo: this.__queueSelf,
					});
				}
			}
			this.__channel.sendToQueue(this.__queueName, Buffer.from(JSON.stringify(obj)), {
				correlationId: id,
				replyTo: this.__queueSelf,
			});
		}
		//console.log(`Activated ${this.__activated}`);
		//console.log(`OnConnected ${this.__onConnected}`);
		if(this.__activated && !this.__onConnected) {
			this.__buffer.push({
				obj: obj,
				id: id
			})
		}
	}

	set FAYULogger(value) {
		this.__fayulogger = value;
	}

	get FAYULogger() {
		return this.__fayulogger;
	}


}

module.exports = Client;