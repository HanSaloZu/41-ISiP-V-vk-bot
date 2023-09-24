import { HearManager } from "@vk-io/hear";
import config from "config";
import { VK } from "vk-io";
import db from "./db";
import Peer from "./models/Peer";
import Topic from "./models/Topic";

const service = new VK({
  token: config.get("serviceToken")
});

const bot = new VK({
  token: config.get("communityToken"),
  apiLimit: 18
});

const hearManager = new HearManager();

function generateRandomInt32() {
  return parseInt(Math.random() * 2 ** 32, 10);
}

bot.updates.on("message_new", hearManager.middleware);

db.sync({ alter: true });
bot.updates.start().catch(console.error);
