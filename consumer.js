const AWS = require('aws-sdk');
const axios = require('axios');

const sqs = new AWS.SQS({ region: 'us-east-1' });

const {
  API_HOST,
  QUEUE_URL,
  DLQ_URL
} = process.env;

async function pollQueue() {
  try {
    const result = await sqs.receiveMessage({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 30
    }).promise();

    if (!result.Messages) {
      console.log("No messages found");
      return;
    }

    for (const msg of result.Messages) {
      const { mc_id } = JSON.parse(msg.Body);

      try {
        const response = await axios.post(`${API_HOST}/fulfill/status`, { mc_id });
        console.log("✅ Processed:", response.data);

        await sqs.deleteMessage({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle
        }).promise();
      } catch (err) {
        console.error(`❌ Failed for ${mc_id}. Sending to DLQ...`);

        await sqs.sendMessage({
          QueueUrl: DLQ_URL,
          MessageBody: JSON.stringify({ mc_id, error: err.message })
        }).promise();

        await sqs.deleteMessage({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle
        }).promise();
      }
    }
  } catch (e) {
    console.error("💥 Poller failed:", e.message);
  }
}

setInterval(pollQueue, 5000);
