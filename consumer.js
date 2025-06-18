import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const REGION = process.env.REGION || 'us-east-1';
const QUEUE_URL = process.env.QUEUE_URL;
const DLQ_URL = process.env.DLQ_URL;
const API_HOST = process.env.API_HOST;

const sqs = new SQSClient({ region: REGION });

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
      await sqs.send(new SendMessageCommand({
        QueueUrl: DLQ_URL,
        MessageBody: JSON.stringify({ mc_id, error: err.message }),
      }));
      console.log("↩️ Sent to DLQ:", mc_id);
    }
  }

  await sqs.send(new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: message.ReceiptHandle,
  }));
}

async function poll() {
  const result = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 10,
  }));

  if (result.Messages && result.Messages.length > 0) {
    for (const message of result.Messages) {
      await processMessage(message);
    }
  } else {
    console.log("🔁 No messages to process");
  }

  setTimeout(poll, 5000);
}

poll();

setTimeout(() => {
  console.log("🛑 Time limit reached (5 minutes). Exiting gracefully...");
  process.exit(0);
}, 5 * 60 * 1000);
