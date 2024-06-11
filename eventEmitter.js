const EventEmitter = require('events');
class RabbitMQEmitter extends EventEmitter {}

const rabbitMQEmitter = new RabbitMQEmitter();

module.exports = rabbitMQEmitter;
