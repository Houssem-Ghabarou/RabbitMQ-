const express = require('express');
const { getRabbitMQChannel } = require('./rabbitmq');
const app = express();
const port = 3000;

// require('./eventListeners');
app.use(express.json());

function handleData(data) {
  //   console.log('Data received inside function: ', data);
  return data;
}

const actions = {
  handleData: handleData,
};

async function sendRequestAndWaitForResponse(functionName, metadata) {
  try {
    const channel = await getRabbitMQChannel();

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
    console.log(e);
  }
}

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
    // no wait
    sendRequestAndWaitForResponse(functionName, metadata);

    res.json({ response: 'Request initiated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

(async () => {
  try {
    const channel = await getRabbitMQChannel();
    const responseQueue = 'response_queue';

    await channel.assertQueue(responseQueue, { durable: false });

    // Consume messages from the response queue
    channel.consume(
      responseQueue,
      (msg) => {
        const data = msg.content.toString();

        const { action, response } = JSON.parse(data);

        if (action) {
          console.log('This action has been called:', action);
          const result = actions?.[action](response);
          console.log('Result:', result);
        } else {
          console.log('No action found');
        }

        channel.ack(msg);
      },
      { noAck: false }
    );

    console.log('RabbitMQ Server is ready');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
})();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
