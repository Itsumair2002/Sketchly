# Whiteboard Backend

Node.js/Express backend for collaborative whiteboard and chat rooms with REST + raw WebSockets.

## Setup
1. Install deps: `npm install`
2. Copy env example below to `.env`.
3. Run dev: `npm run dev` (node) or start: `npm start`.

## Env example
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=some_secret
```

## REST endpoints
- `POST /auth/signup` `{name,email,password}` -> `{token,user}`
- `POST /auth/login` `{email,password}` -> `{token,user}`
- `GET /me` -> `{user}` (requires Bearer token)
- `POST /rooms` `{name}` -> `{room}` (auth)
- `POST /rooms/join` `{joinCode}` -> `{room,role}` (auth)
- `GET /rooms` -> `{rooms}` (auth)
- `GET /rooms/:roomId` -> `{room,role}` (auth)
- `GET /rooms/:roomId/board-elements` -> `{elements}` (auth)
- `GET /rooms/:roomId/messages?limit=50` -> `{messages}` (auth)

## WebSocket
Connect to `ws://host/ws?token=JWT`.
Events handled include room join/leave, chat send/typing, board element add/update/delete, and presence updates.
