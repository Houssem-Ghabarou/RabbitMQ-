const express = require('express');
const amqplib = require('amqplib');
const app = express();
const port = 3000;

app.use(express.json());

// Function to handle incoming data
function handleData(data) {
  return data;
}

// Actions object for handling different actions
const actions = {
  handleData: handleData,
};

// Function to send a request and wait for response
async function sendRequestAndWaitForResponse(functionName, metadata) {
  try {
    const channel = app.get('channel');
    const queue = 'request_queue';
    const responseQueue = 'response_queue';

    await channel.assertQueue(queue, { durable: false });
    await channel.assertQueue(responseQueue, { durable: false });

    const data = JSON.stringify({
      functionName,
      metadata,
    });

    // Send the request to the request queue
    channel.sendToQueue(queue, Buffer.from(data), {
      replyTo: responseQueue,
    });
  } catch (e) {
    console.log('Error sending request:', e);
    throw e; // Rethrow the error to be caught by the API endpoint handler
  }
}

// API endpoint to initiate a request
app.post('/api/request', async (req, res) => {
  const { functionName, params, method, authorization, api, body } = req.body;
  try {
    const metadata = {
      params: params ? params : null,
      method: method ? method : 'GET',
      authorization: authorization ? authorization : null,
      api: api ? api : null,
      body: body ? body : null,
    };

    // Send the request asynchronously, no wait for response
    sendRequestAndWaitForResponse(functionName, metadata);

    res.json({ response: 'Request initiated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to connect to RabbitMQ
function connectToRabbitMQ() {
  amqplib
    .connect('amqp://localhost')
    .then((conn) => {
      console.log('Connected to RabbitMQ');
      app.set('connection', conn);
      conn.on('error', (err) => {
        app.emit('errorRabbitMQConnection', err);
      });
      conn.on('close', () => {
        console.error('Connection to RabbitMQ closed');
        app.emit(
          'errorRabbitMQConnection',
          new Error('Connection to RabbitMQ closed')
        );
      });
      createChannelRabbitMQ();
    })
    .catch((err) => {
      console.error('Error connecting to RabbitMQ:', err);
      setTimeout(connectToRabbitMQ, 5000); // Retry connection after 5 seconds
    });
}

//  creating a channel on RabbitMQ
function createChannelRabbitMQ() {
  const conn = app.get('connection');
  conn
    .createChannel()
    .then((channel) => {
      console.log('Channel created');
      app.set('channel', channel);
      channel.on('error', (err) => {
        console.error('Channel error:', err);
        app.emit('errorRabbitMQChannel', err);
      });
      channel.on('close', () => {
        console.error('Channel closed');
        app.emit('errorRabbitMQChannel', new Error('Channel closed'));
      });
      initializeConsuming(channel); // Start consuming messages
    })
    .catch((err) => {
      console.error('Error creating RabbitMQ channel:', err);
      setTimeout(createChannelRabbitMQ, 5000); // Retry channel creation after 5 seconds
    });
}

// initialize consuming messages
function initializeConsuming(channel) {
  const responseQueue = 'response_queue';
  retryAssertQueue(channel, responseQueue)
    .then(() => {
      channel.consume(
        responseQueue,
        (msg) => {
          const data = msg.content.toString();
          const { action, response } = JSON.parse(data);

          if (action && actions[action]) {
            const result = actions[action](response);
            console.log('Result:', result);
          } else {
            console.log('No action found for:', action);
          }

          channel.ack(msg);
        },
        { noAck: false }
      );
    })
    .catch((err) => {
      console.error('Error asserting queue:', err);
      setTimeout(() => initializeConsuming(channel), 5000); // Retry initializing consuming after 5 seconds
    });
}

// Retry asserting a queue
async function retryAssertQueue(channel, queueName) {
  try {
    await channel.assertQueue(queueName, { durable: false });
    console.log(`Queue ${queueName} asserted successfully`);
  } catch (err) {
    console.error('Error asserting queue:', err);
  }
}

// RabbitMQ connection errros
app.on('errorRabbitMQConnection', async (err) => {
  console.error('Error connecting to RabbitMQ:', err);
  setTimeout(connectToRabbitMQ, 5000); // Retry connection after 5 seconds
});

// RabbitMQ channel errors
app.on('errorRabbitMQChannel', (err) => {
  console.error('Error with RabbitMQ channel:', err);
  setTimeout(createChannelRabbitMQ, 5000); // Retry channel creation after 5 seconds
});

// Initialize RabbitMQ connection
connectToRabbitMQ();

// Start Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
