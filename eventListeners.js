const rabbitMQEmitter = require('./eventEmitter');

const { getRabbitMQConnection, setRabbitMQConnection } = require('./rabbitmq');
rabbitMQEmitter.on('errorRabbitMQConnection', async (err) => {
  console.error('From eventListeners: Error connecting to RabbitMQ:', err);

  setTimeout(async () => {
    await setRabbitMQConnection();
  }, 5000);
});

rabbitMQEmitter.on('errorRabbitMQChannel', (err) => {
  console.error('From eventListeners: Error creating RabbitMQ channel:', err);
});
