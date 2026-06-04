# Conference MVP

MVP приложения для видеоконференций на 10 участников в комнате.

## Зафиксированный стек

- Frontend: React + TypeScript + Vite + Mantine UI.
- Media/signaling: Node.js + TypeScript + mediasoup + WebSocket.
- API backend: NestJS + TypeScript, minimal bridge for room creation and join tokens.
- State: Redis для room/session state и TTL комнат.
- TURN/STUN: coturn, сначала локально через Docker.
- Runtime: Docker Compose для локальной разработки.

## MVP scope

- Создать комнату и получить уникальную ссылку.
- Создатель комнаты проходит pre-join flow как любой участник, но помечается как `isCreator`.
- Присоединиться к комнате по ссылке без авторизации.
- Перед входом указать имя, выбрать mic/camera state.
- Audio/video публикация.
- Screen share на desktop.
- Mobile support для join, audio, video, mute/unmute, camera on/off и списка участников.
- Screen share на mobile включается только если браузер поддерживает `navigator.mediaDevices.getDisplayMedia`.
- Mute/unmute.
- Camera on/off.
- Список участников и их состояния: online, mic, camera, screen share.
- Ошибки доступа к устройствам показываются пользователю.
- При реконнекте пользователь входит заново; имя и прошлые настройки можно восстановить из `sessionStorage`.

## Out of scope для MVP

- Авторизация.
- Роли host/speaker/participant.
- Чат.
- Запись конференции.
- S3 storage.
- Обязательный mobile screen share.
- Горизонтальное масштабирование.
- Модерация, kick/ban, lobby.

Архитектура оставляет точки расширения для записей, S3 и ролей.

## Документы

- [Architecture](docs/architecture.md)
- [API and WebSocket Contracts](docs/contracts.md)
- [Local Docker](docs/local-docker.md)
- [MVP Server Deployment](docs/deployment.md)
- [Monorepo](docs/monorepo.md)
- [Work Plan](docs/work-plan.md)
