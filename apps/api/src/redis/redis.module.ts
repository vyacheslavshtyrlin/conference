import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import { REDIS_CLIENT } from "./redis.constants.js";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const client = createClient({
          url: config.get<string>("REDIS_URL") ?? "redis://localhost:6379",
        });

        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
