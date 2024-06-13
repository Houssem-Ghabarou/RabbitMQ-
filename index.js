import express from 'express';
import amqplib from 'amqplib';
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

function handleData(data) {
  return data;
}

const actions = {
  handleData: handleData,
};

async function sendRequestAndWaitForResponse(functionName, metadata) {
  try {
    const channel = app.get('channel');
    const queue = process.env.REQUEST_QUEUE || 'request_queue';
    const responseQueue = process.env.RESPONSE_QUEUE || 'response_queue';

    await channel?.assertQueue(queue, { durable: false });
    await channel?.assertQueue(responseQueue, { durable: false });

    const data = JSON.stringify({
      functionName,
      metadata,
    });

    // Sending the request to the request queue
    channel?.sendToQueue(queue, Buffer.from(data), {
      replyTo: responseQueue,
    });
  } catch (e) {
    console.error('Error sending request:', e);
  }
}

//request initiation
app.post('/api/request', async (req, res) => {
  const { functionName, params, method, authorization, api, body } = req.body;
  try {
    const metadata = {
      params: params || null,
      method: method || 'GET',
      authorization: authorization || null,
      api: api || null,
      body: body || null,
    };

    // no wait for the response
    sendRequestAndWaitForResponse(functionName, metadata);

    res.json({ response: 'Request initiated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// RabbitMQ connection
async function connectToRabbitMQ() {
  try {
    const connection = await amqplib.connect('amqp://localhost');

    app.set('connection', connection);
    createChannelRabbitMQ(); // Creating a channel after successful connection
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err);
    app.set('connection', null);
    app.emit('errorRabbitMQConnection', err);
  }
}
//  creating a channel on RabbitMQ
async function createChannelRabbitMQ() {
  try {
    const conn = app.get('connection');
    const channel = await conn?.createChannel();

    channel.on('error', (err) => {
      console.error('Error with RabbitMQ channel:', err);
      app.set('channel', null);
      app.emit('errorRabbitMQChannel', err);
    });
    channel.on('close', (err) => {
      console.log('RabbitMQ channel closed');
      app.set('channel', null);
      app.emit(
        'errorRabbitMQConnection',
        new Error('RabbitMQ channel closed so reconnection is needed')
      ); // triggering reconnection because the channel is closed
    });

    app.set('channel', channel);
    initializeConsuming(channel); // Initialize consuming messages after creating a channel
  } catch (err) {
    console.error('Error creating channel:', err);
    app.set('channel', null);
    app.emit('errorRabbitMQChannel', err); ////////////I NEED TO CHECK THIS IF IT IS WORKING*************************
  }
}

// initialize consuming messages
function initializeConsuming(channel) {
  const responseQueue = process.env.RESPONSE_QUEUE || 'response_queue';
  const MAX_CONSUMING_MESSAGES_PER_MINUTE = 1;
  retryAssertQueue(channel, responseQueue)
    .then(() => {
      setTimeout(() => {
        channel?.consume(
          responseQueue,
          async (msg) => {
            try {
              if (!msg) {
                console.error('No message received');
                return;
              }

              const data = msg.content.toString();
              if (!data) {
                console.error('No data found in message');
                channel.ack(msg);
                return;
              }

              const { action, response } = JSON.parse(data);

              if (action && actions?.[action]) {
                const result = actions?.[action](response);
                console.log('Result:', result);
              } else {
                console.log('No action found for:', action);
              }

              channel.ack(msg);
            } catch (error) {
              console.error('Error processing message:', error);
              if (msg) {
                channel.nack(msg, false, false); // Reject the message without requeueing
              }
            }
          },
          { noAck: false }
        );
      }, (1000 * 60) / MAX_CONSUMING_MESSAGES_PER_MINUTE);
    })
    .catch((err) => {
      console.error('Error asserting queue:', err);
      setTimeout(() => initializeConsuming(channel), 5000); // Retry initializing consuming after 5 seconds
    });
}

// Retry asserting a queue
async function retryAssertQueue(channel, queueName) {
  try {
    await channel?.assertQueue(queueName, { durable: false });
    console.log(`Queue ${queueName} asserted successfully`);
  } catch (err) {
    console.error('Error asserting queue:', err);
  }
}

// RabbitMQ connection errros
app.on('errorRabbitMQConnection', async (err) => {
  console.error('From express events:Error connecting to RabbitMQ:', err);
  setTimeout(connectToRabbitMQ, 5000); // Retry connection after 5 seconds
});

// RabbitMQ channel errors
app.on('errorRabbitMQChannel', (err) => {
  console.error('From express events:Error with RabbitMQ channel:', err);
  setTimeout(createChannelRabbitMQ, 5000); // Retry channel creation after 5 seconds
});

// Initialize RabbitMQ connection
connectToRabbitMQ();

// Start Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
