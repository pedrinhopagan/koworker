import { db } from "../src/api/db/connection";

await db
  .insertInto("users")
  .values({
    name: "admin",
    password: Bun.password.hashSync("password"),
  })
  .execute();
