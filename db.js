import { Sequelize } from "sequelize";

const db = new Sequelize({
  storage: "db.sqlite3",
  dialect: "sqlite",
  logging: false,
  define: {
    timestamps: false
  }
});

export default db;
