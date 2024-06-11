const amqplib = require('amqplib');

// const rabbitMQEmitter = require('./eventEmitter');

let connection = null;
let channel = null;

function retryConnection() {
  console.log('retrying connection to RabbitMQ after 5 seconds...');
  setTimeout(async () => {
    await setRabbitMQConnection();
  }, 5000);
}

async function setRabbitMQConnection() {
  try {
    connection = await amqplib.connect('amqp://localhost');
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
      retryConnection();
    });
    connection.on('close', () => {
      console.error('RabbitMQ connection closed');
      retryConnection();
    });
  } catch (err) {
    console.error('Error setting RabbitMQ connection:', err);
    retryConnection();
  }
}

async function getRabbitMQConnection() {
  if (!connection) {
    await setRabbitMQConnection();
  }
  return connection;
}

function retryChannel() {
  console.log('retrying channel creation after 5 seconds...');
  setTimeout(async () => {
    await getRabbitMQChannel();
  }, 5000);
}

async function getRabbitMQChannel() {
  if (!channel) {
    const conn = await getRabbitMQConnection();
    channel = await conn.createChannel();
    channel.on('error', (err) => {
      console.error('RabbitMQ channel error:', err);
      retryChannel();
    });
  }
  return channel;
}

module.exports = {
  getRabbitMQConnection,
  getRabbitMQChannel,
  setRabbitMQConnection,
};
