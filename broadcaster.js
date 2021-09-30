import events from "events";
import { sendMessage } from "./sendMessage.js";
export const BroadcastEvent = new events.EventEmitter();
export class Broadcaster {
  constructor() {
    this.clientList = new Set();
    // BroadcastEvent.on("receivedArduinoCommand", function (data) {
    //   //Broadcast updated state to all subscribes

    //   const { ws, payload } = data;
    //   for (let i = 0; i < this.clientList; i++) {
    //     if (ws === this.clientList[i]) continue;

    //     sendMessage(this.clientList[i], "broadcastUpdate", payload);
    //   }
    //   console.log(data.payload);
    // }

    // );
  }
  addClient(ws) {
    this.clientList.add(ws);
  }
  removeClient(ws) {
    this.clientList.delete(ws);
  }
  broadcastSettings(ws) {}
  sendAllSettings(ws, settings) {
    sendMessage(ws, "initialSettings", settings);
  }
}
