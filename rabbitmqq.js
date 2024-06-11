const amqplib = require('amqplib');

async function connectToRabbitMQ(app) {
  try {
    const connection = await amqplib
      .connect('amqp://localhost')
      .catch((err) => {
        console.log('errrrrrrrrrrrrrrrrrrrrrrrrrrror');
        app.emit('errorRabbitMQConnection', err);
      });
    if (connection) {
      console.log('Connected to RabbitMQ');
      app.set('connection', connection);
    }
    return connection;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

async function createChannel(app) {
  try {
    const connection = app.get('connection');
    if (!connection) {
      throw new Error('No RabbitMQ connection available');
    }
    const channel = await connection.createChannel().catch((err) => {
      app.emit('errorRabbitMQChannel', err);
    });
    if (channel) {
      app.set('channel', channel);
    }
    return channel;
  } catch (error) {
    console.error('Failed to create channel:', error);
    throw error;
  }
}

function getChannel(app) {
  const channel = app.get('channel');
  if (!channel) {
    throw new Error('No RabbitMQ channel available');
  }
  return channel;
}

function getConnection(app) {
  const connection = app.get('connection');
  if (!connection) {
    throw new Error('No RabbitMQ connection available');
  }
  return connection;
}

module.exports = {
  connectToRabbitMQ,
  createChannel,
  getChannel,
  getConnection,
};
