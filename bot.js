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

hearManager.hear([/начать/i, "/start"], async (ctx) => {
  const [peer, created] = await Peer.findOrCreate({
    where: { id: ctx.peerId },
    defaults: {
      id: ctx.peerId,
      type: ctx.peerType
    }
  });

  if (created) {
    let greeting = "Бот успешно активирован! Теперь когда в группе 41 ИСИП-В "
    + "появится новое обсуждение в этот чат автоматически прийдёт сообщение "
    + "об этом.\n\n";

    if (peer.type === "user") {
      const user = (
        await service.api.users.get({ user_ids: peer.id, lang: 0 })
      )[0];
      greeting += `Спасибо, ${user.first_name}, что используешь бота!`;
    } else greeting += "Спасибо, что используете бота!";

    await ctx.send(greeting);

    bot.api.messages.send({
      random_id: generateRandomInt32(),
      user_id: config.get("adminId"),
      message: "🎉🎉 Новый клиент 🎉🎉\n\n"
      + `Тип: ${peer.type}\n`
      + `ID: ${peer.id}`
    });
  }
});

db.sync({ alter: true });
bot.updates.start().catch(console.error);
