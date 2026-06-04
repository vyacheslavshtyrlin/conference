import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const port = Number(process.env.PORT ?? 3000);
const app = await NestFactory.create(AppModule);

app.setGlobalPrefix("api/v1");
app.enableCors({
  origin: process.env.WEB_PUBLIC_URL ?? "http://localhost:5173",
});
app.useGlobalPipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  })
);

await app.listen(port, "0.0.0.0");
