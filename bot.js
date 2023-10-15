import { HearManager } from "@vk-io/hear";
import config from "config";
import cron from "node-cron";
import { VK } from "vk-io";
import db from "./db";
import logger from "./logger";
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

bot.updates.on("chat_invite_user", (ctx) => {
  if (ctx.eventMemberId === config.get("groupPeerId")) {
    ctx.send(
      "Привет!\n\nЭтот бот отслеживает обсуждения в группе 41 ИСИП-В"
    + " и автоматически уведомляет о появлении новых тем\n\n"
    + "Для запуска бота нужно отправить в чат сообщение с текстом \"/start\""
    );
  }
});

bot.updates.on("message_allow", async (ctx) => {
  const user = await Peer.findOne({ where: { id: ctx.userId } });
  if (user) {
    user.update({ isNotificationEnabled: true });
    logger.info(`User:${ctx.userId} has allowed messages`);
  } else {
    logger.warn(`User:${ctx.userId} not found during message_allow event`);
  }
});

bot.updates.on("message_deny", async (ctx) => {
  const user = await Peer.findOne({ where: { id: ctx.userId } });
  if (user) {
    user.update({ isNotificationEnabled: false });
    logger.info(`User:${ctx.userId} has denied messages`);
  } else {
    logger.warn(`User:${ctx.userId} not found during message_deny event`);
  }
});

hearManager.hear("/ping", (ctx) => {
  ctx.send("pong");
});

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

    logger.info(`New peer has been created - ${peer.type}:${peer.id}`);
    ctx.send(greeting);
  }
});

cron.schedule("*/5 * * * *", async () => {
  const apiTopics = await service.api.board.getTopics({
    group_id: config.get("groupId"),
    order: 2,
    count: 50,
    extended: 1,
    lang: 0
  });
  const dbTopicsIds = (await Topic.findAll({
    order: [["createdAt", "DESC"]],
    limit: 50
  })).map((dbTopic) => dbTopic.id);
  const newTopics = [];
  const oldestApiTopic = apiTopics.items[apiTopics.items.length - 1];

  apiTopics.items = apiTopics.items.filter(
    (apiTopic) => apiTopic.created >= oldestApiTopic.created
  );

  apiTopics.items.sort((firstTopic, secondTopic) => {
    if (firstTopic.created < secondTopic.created) return 1;
    if (firstTopic.created > secondTopic.created) return -1;
    return 0;
  });

  apiTopics.items.forEach((topic) => {
    if (!dbTopicsIds.includes(topic.id)) {
      newTopics.unshift({
        id: topic.id,
        title: topic.title,
        createdAt: new Date(topic.created * 1000),
        createdBy: topic.created_by
      });
    }
  });
  await Topic.bulkCreate(newTopics);

  const peersIds = (
    await Peer.findAll({ where: { isNotificationEnabled: true } })
  ).map((peer) => peer.id);

  newTopics.forEach((newTopic) => {
    const author = apiTopics.profiles.find(
      (profile) => profile.id === newTopic.createdBy
    );

    const maxPeersPerRequest = 98;
    for (let i = 0; i < peersIds.length; i += maxPeersPerRequest) {
      bot.api.messages.send({
        random_id: generateRandomInt32(),
        peer_ids: peersIds.slice(i, i + maxPeersPerRequest),
        message: "‼‼ Новое обсуждение ‼‼ \n\n"
        + `Тема: ${newTopic.title} \n`
        + `Автор: ${author.first_name} ${author.last_name} \n`
        + `Дата и время: ${newTopic.createdAt.toLocaleString("ru-RU")} \n`
        + `https://vk.com/topic-${config.get("groupId")}_${newTopic.id}`
      });
    }
  });
});

db.sync({ alter: true });
bot.updates.start().catch(console.error);
