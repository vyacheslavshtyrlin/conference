# Architecture

## Цель

Собрать MVP видеоконференций для комнат до 10 участников. Главный приоритет - рабочий audio/video поток на desktop и mobile, screen share на desktop, понятное состояние комнаты и простая локальная разработка.

## Сервисы

### Web app

React-приложение отвечает за:

- pre-join экран: имя, camera on/off, mic on/off;
- creator flow: после создания комнаты пользователь попадает на pre-join этой комнаты, а не сразу в live conference;
- получение локальных media streams через `getUserMedia` и `getDisplayMedia`;
- mobile-first conference UI для iOS Safari и Android Chrome;
- feature detection для screen share: кнопка показывается только если доступен `navigator.mediaDevices.getDisplayMedia`;
- mediasoup client flow: device load, send transport, recv transport, produce, consume;
- отображение сетки видео;
- панель управления: mute/unmute, camera on/off, screen share;
- список участников и их состояний;
- сохранение последнего имени и настроек в `sessionStorage`.

### API service

NestJS-сервис отвечает за HTTP API:

- создание комнаты;
- получение метаданных комнаты по slug/id;
- выдача join token для signaling server;
- healthcheck.
- future recording commands and metadata, если запись будет включена после MVP.

В MVP API является secondary/minimal bridge. Его нельзя расширять в полноценный product backend без отдельного architecture decision. Главный фокус реализации - signaling/media и frontend.

Для MVP БД не обязательна: комнаты можно хранить в Redis с TTL 30 минут. Если позже нужны история, аналитика, пользователи или записи, добавляем PostgreSQL.

### Signaling/media service

Node.js-сервис с mediasoup отвечает за:

- WebSocket подключение участников;
- room state;
- WebRTC signaling;
- mediasoup workers, routers, transports, producers, consumers;
- broadcast событий участникам комнаты;
- cleanup пустых комнат.
- future recording media source через mediasoup plain transports, если запись будет включена после MVP.

API backend и signaling service разделены. Это снижает связность: REST API не зависит от WebRTC lifecycle, а signaling не превращается в общий backend.

### Recording/storage service

Запись и S3 upload не входят в MVP, но ответственность нужно разделить заранее:

- mediasoup/signaling не пишет файлы в S3 и не владеет storage credentials;
- mediasoup/signaling предоставляет media source для записи через plain transport и события о producers;
- recording worker получает media, mux/encode делает в отдельном процессе или сервисе;
- recording worker загружает готовые файлы или multipart chunks в S3 через storage adapter;
- NestJS API владеет командами записи, metadata записей, статусами, ссылками доступа и future permissions;
- frontend только показывает UI и вызывает API/WebSocket commands, но не пишет записи в S3.

Для MVP `apps/recording` можно не создавать. Нужно только не смешивать S3 upload с `MediasoupService`, чтобы запись можно было добавить отдельным worker без переписывания signaling flow.

### Redis

Redis используется для:

- TTL комнат;
- session/participant state;
- idempotency коротких reconnect операций;
- room cleanup lock.

Для MVP signaling может держать mediasoup runtime objects в памяти, потому что `Worker`, `Router`, `Transport`, `Producer`, `Consumer` нельзя сериализовать в Redis. Redis хранит только внешнее состояние.

## Room lifecycle

1. Клиент вызывает `POST /rooms`.
2. API создает `roomId`, `slug`, `expiresAt`, creator marker и пишет room metadata в Redis с TTL 30 минут.
3. API возвращает join URL и short-lived/private creator token. Creator token не должен попадать в публичную ссылку.
4. Frontend сохраняет creator token в `sessionStorage` и переводит creator на pre-join этой комнаты.
5. Creator вводит имя, выбирает устройства и явно нажимает Join.
6. Client вызывает `POST /rooms/:slug/join` с `displayName` и optional `creatorToken`.
7. API создает participant. Если creator token валиден, participant получает `isCreator: true`; иначе это обычный participant.
8. Client получает одноразовый/короткоживущий join token для signaling.
9. Client подключается к signaling WebSocket с token.
10. Signaling проверяет room в Redis, создает mediasoup router при первом live participant.
11. Участник публикует audio/video producers.
12. Остальные участники получают события о новых producers и создают consumers.
13. При уходе участника закрываются его transports/producers/consumers.
14. Если в комнате нет участников, signaling удаляет runtime room immediately или после grace period 30-60 секунд.
15. Redis room key живет максимум 30 минут, если комнату не продлили.

Создание комнаты не создает live participant и не включает WebRTC. Это production privacy rule: camera/mic начинают работать только после явного действия на pre-join.

`isCreator` в MVP является metadata, а не permission model. Creator отличается в participant list и future extension points, но не получает host/moderation rights до отдельного product decision.

## TTL policy

Для MVP:

- TTL комнаты: 30 минут с момента создания.
- Если все покинули комнату: закрыть mediasoup runtime room сразу или через 60 секунд.
- Redis metadata можно удалить при пустой комнате, если не нужен повторный вход по той же ссылке.

Рекомендуемое решение для MVP: если все покинули комнату, удалить комнату после 60 секунд. Это соответствует требованию "полчаса или если все покинули".

## Архитектурные паттерны

### Frontend

- Feature-first структура: `features/conference`, `features/prejoin`, `shared`.
- Mantine UI используется как базовая component library для `apps/web`.
- Mantine components применяются для forms, modals, drawers, notifications, layout primitives и accessible controls.
- WebRTC/media logic не должна жить внутри Mantine view components; UI вызывает hooks/services.
- WebRTC логика в hooks/services, UI компоненты не управляют signaling напрямую.
- Central room store: Zustand или Redux Toolkit. Для MVP лучше Zustand.
- Server state для REST: TanStack Query.
- UI проектируется mobile-first: крупные touch controls, responsive video grid, без hover-only действий.
- Autoplay restrictions учитываются: remote media подключается после явного действия пользователя на pre-join/join.
- На mobile поддержка обязательна для join, audio, video, mute/unmute, camera on/off и participant list.
- Screen share на mobile является optional capability, а не обязательной частью MVP.
- Для mobile нужно обрабатывать `visibilitychange`, network disconnect/reconnect и device permission errors.
- Media state отделить от participant state:
  - local device state: что пользователь хочет включить;
  - signaling participant state: что реально опубликовано в комнате;
  - mediasoup state: transports/producers/consumers.

### NestJS API

- Feature modules: `RoomsModule`, `HealthModule`.
- DTO validation через `class-validator`.
- Config через `@nestjs/config`.
- Redis доступ через отдельный provider/repository, не напрямую из controllers.
- Controllers тонкие, бизнес-логика в services.
- Для join token использовать JWT с коротким TTL или signed token через HMAC.

### Signaling/media

- RoomManager отвечает за lifecycle комнат.
- PeerManager отвечает за состояние участников.
- MediasoupService отвечает только за mediasoup worker/router/transport operations.
- SocketGateway отвечает за protocol boundary и validation входящих событий.
- Все входящие WebSocket payloads валидируются schema-first подходом, например Zod.
- Нельзя доверять client state: сервер является источником правды для participants/producers.

## Recording extension point

Запись не входит в MVP, но нужно оставить место:

- mediasoup plain transport для recorder pipeline;
- отдельный recording worker или `RecordingService`;
- event hooks: `room.started`, `participant.produced`, `room.ended`;
- storage abstraction: `RecordingStorage`, позже `S3RecordingStorage`;
- recording metadata API в NestJS, когда появится persistence;
- запись запускается не из UI напрямую, а через backend/signaling command.

Рекомендуемая future flow:

1. Client or admin action calls NestJS API to request recording start.
2. NestJS validates permissions and sends command to signaling/media.
3. Signaling creates recording plain transports for required producers.
4. Recording worker consumes RTP/plain transport output and writes encoded files.
5. Recording worker uploads files to S3 through `RecordingStorage`.
6. NestJS stores metadata and exposes recording status/download links.

S3 upload responsibility belongs to the recording worker/storage adapter. NestJS owns metadata and commands. mediasoup owns media routing only.

## Масштабирование после MVP

MVP запускается как один signaling/media instance. Для горизонтального масштабирования позже нужны:

- sticky routing по `roomId`, чтобы все участники комнаты попадали на один mediasoup instance;
- Redis pub/sub или NATS для межсерверных событий;
- API знает, на какой media node назначена комната;
- PostgreSQL для persistent rooms/users/recordings;
- отдельный TURN в публичной сети.
