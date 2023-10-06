import winston from "winston";
import "winston-daily-rotate-file";

const logFormats = [
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.printf((info) => (
    `[${info.timestamp}][${info.level}] ${info.message}`
  ))
];

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: "bot-%DATE%.log",
  dirname: "logs",
  datePattern: "YYYY-MM-DD",
  maxFiles: "21d",
  level: "debug",
  format: winston.format.combine(...logFormats)
});

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        ...logFormats
      ),
      level: process.env.NODE_ENV === "production" ? "error" : "debug"
    }),
    fileRotateTransport
  ]
});

export default logger;
