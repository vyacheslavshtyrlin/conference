import "reflect-metadata";

import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", service: "api" };
  }
}

@Module({
  controllers: [HealthController]
})
class AppModule {}

const port = Number(process.env.PORT ?? 3000);
const app = await NestFactory.create(AppModule);

app.setGlobalPrefix("api/v1");
await app.listen(port, "0.0.0.0");
