"use client";

import type { ClientToServerEvents, ServerToClientEvents } from "@nba/contracts";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true
    });
  }
  return socket;
};
