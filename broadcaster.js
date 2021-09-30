import events from "events";
import { sendMessage } from "./sendMessage.js";
export const BroadcastEvent = new events.EventEmitter();
export class Broadcaster {
  constructor() {
    this.clientList = new Set();
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
  broadcastConfig(exclude_ws, settings) {
    this.clientList.forEach((value1, value2, set) => {
      if (value1 !== exclude_ws) {
        sendMessage(value1, "initialSettings", settings); // probably a bad idea if someone is moving a slider
      }
    });
  }
  sendAllMessage(type, payload = {}) {
    this.clientList.forEach((value1, value2, set) => {
      sendMessage(value1, type, payload);
    });
  }
}
