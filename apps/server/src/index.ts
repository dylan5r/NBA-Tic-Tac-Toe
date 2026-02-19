import { createAppServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const { httpServer } = createAppServer();

httpServer.listen(port, () => {
  console.log(`NBA Tic-Tac-Toe server listening on :${port}`);
});
