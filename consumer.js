import AWS from 'aws-sdk';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const sqs = new AWS.SQS({ region: 'us-east-1' });
const QUEUE_URL = process.env.QUEUE_URL;
const DLQ_URL = process.env.DLQ_URL;
const API_HOST = process.env.API_HOST;

console.log("👂 Listening for messages from:", QUEUE_URL);

async function processMessage(message) {
  const mc_id = JSON.parse(message.Body).mc_id;
  console.log("➡️ Received:", mc_id);

  try {
    const response = await axios.post(`${API_HOST}/fulfill/status`, { mc_id });
    console.log("✅ Processed:", response.data);
  } catch (err) {
    console.error("❌ API failed for", mc_id, "-", err.message);
    if (DLQ_URL) {
      await sqs.sendMessage({
        QueueUrl: DLQ_URL,
        MessageBody: JSON.stringify({ mc_id, error: err.message }),
      }).promise();
      console.log("↩️ Sent to DLQ:", mc_id);
    }
  }

  await sqs.deleteMessage({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: message.ReceiptHandle,
  }).promise();
}

async function poll() {
  const { Messages } = await sqs.receiveMessage({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 10,
  }).promise();

  if (Messages && Messages.length > 0) {
    for (const message of Messages) {
      await processMessage(message);
    }
  } else {
    console.log("🔁 No messages to process");
  }

  setTimeout(poll, 5000);
}

poll();
// ⏲ Exit after 5 minutes (300000 ms)
setTimeout(() => {
  console.log("🛑 Time limit reached (5 minutes). Exiting gracefully...");
  process.exit(0);
}, 5 * 60 * 1000);