import WebSocket from "ws";
import aJSON_Parse from "async-json-parse";
import dotenv from "dotenv";
dotenv.config();

import "./arduino.js";

import { Broadcaster } from "./broadcaster.js";

import { sendMessage } from "./sendMessage.js";
import {
  setPeriod,
  turnOff,
  turnOn,
  pwm,
  setUnit,
  setDutyCycle,
} from "./arduino.js";
import SerialPort from "serialport";
import { Pin } from "./Pin.js";
import { parser } from "./arduino.js";
import { BroadcastEvent } from "./broadcaster.js";

const totalPins = 13;
export let PinStore = [];
for (let i = 0; i < totalPins; i++) {
  PinStore.push(new Pin(i));
}

const serverAddress = process.env.HOST;
const serverPort = process.env.PORT;

let clientList = new Set();
const wss = new WebSocket.Server({
  host: serverAddress,
  port: serverPort,
});

wss.binaryType = "arraybuffer";

const broadcaster = new Broadcaster();

wss.on("connection", (ws) => {
  clientList.add(ws);
  console.log("[SERVER] New client just connected.");
  broadcaster.addClient(ws);
  broadcaster.sendAllSettings(ws, PinStore);
  ws.on("message", (msg) => {
    try {
      aJSON_Parse(msg).then((msg) => {
        const { type, payload } = msg;
        onMessage(ws, type, payload);
      });
    } catch (error) {
      console.log(error);
    }
  });
  ws.on("close", () => {
    clientList.delete(ws);
    broadcaster.removeClient(ws);
    console.log("[SERVER] A client just disconnected.");
  });
});

function onMessage(ws, type, payload) {
  switch (type) {
    case "arduino/req_listports": {
      const listPorts = async () => {
        const ports = await SerialPort.list();
        sendMessage(ws, "arduino/res_listports", ports);
      };
      listPorts();
      break;
    }
    case "arduino/cmd": {
      BroadcastEvent.emit("receivedArduinoCommand", {
        ws,
        payload,
      });
      const { pinId, cmd } = payload;
      switch (cmd) {
        case "ON": {
          turnOn(pinId);
          PinStore[pinId].state.mode = "ON";
          break;
        }
        case "OFF": {
          turnOff(pinId);
          PinStore[pinId].state.mode = "OFF";
          break;
        }
        case "PWM": {
          pwm(pinId);
          PinStore[pinId].state.mode = "PWM";
          break;
        }
        case "setPeriod": {
          setPeriod(pinId, payload.value);
          PinStore[pinId].state.period = payload.value;
          break;
        }
        case "setUnit": {
          setUnit(pinId, payload.value);
          PinStore[pinId].state.unit = payload.value;
          break;
        }
        case "setDutyCycle": {
          setDutyCycle(pinId, payload.value);
          PinStore[pinId].state.dutyCycle = payload.value;
          break;
        }
      }
    }
  }
}

export const initializeArduinoPins = () => {
  for (let i = 0; i < totalPins; i++) {
    PinStore[i].sendConfigToArduino();
  }
};

parser.on("ready", () => {
  console.log("[Server] Connection to Arduino established.");
  initializeArduinoPins();
});
