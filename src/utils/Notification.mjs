import axios from 'axios';

const api = (url) => axios.create({
  baseURL: url,
});

const generateMessage = (obj) => {
  const keys = Object.keys(obj);
  return keys.reduce((acc, key) => {
    let value = obj[key] !== undefined ? obj[key] : '';
    if (key === 'network') {
      value = `*${value}*`;
    }
    const text = `${key.slice(0, 1).toUpperCase()}${key.slice(1, key.length)}: ${value}\n`;
    return `${acc}${text}`;
  }, '');
};

const postToChannel = async (webhookUrl, message) => {
  if (!webhookUrl) {
    console.log('SLACK_WEB_HOOK_NOT_FOUND');
    return null;
  }
  const body = {
    text: message,
  };
  try {
    await api(webhookUrl).post('', body);
    return null;
  } catch (err) {
    console.log('SLACK_NOTIFICATION_ERROR', err);
    return null;
  }
};

const send = (data) => {
  const channel = process.env.SLACK_WEB_HOOK;
  const slackMessage = generateMessage(data);
  return postToChannel(channel, slackMessage);
};

export default {
  send,
};