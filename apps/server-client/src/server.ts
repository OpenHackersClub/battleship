// import type { HttpPlatform, HttpServer } from '@effect/platform';
// import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
// import { Layer } from 'effect';
// import { createServer } from 'node:http';

// export const listen = (
//   app: Layer.Layer<never, never, HttpPlatform.HttpPlatform | HttpServer.HttpServer>,
//   port: number
// ) =>
//   NodeRuntime.runMain(
//     Layer.launch(
//       Layer.provide(
//         app,
//         NodeHttpServer.layer(() => createServer(), { port })
//       )
//     )
//   );
