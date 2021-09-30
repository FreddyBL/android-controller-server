//Need to refactor code

import WebSocket from "ws";
import aJSON_Parse from "async-json-parse";
import dotenv from "dotenv";
import Ready from "@serialport/parser-ready";
import express from "express";

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
import { parser, sport, isArduinoConnected, arduinoCOM } from "./global.js";
import { BroadcastEvent } from "./broadcaster.js";
import { serialCOMExists } from "./serial.js";

import { app } from "./express-server.js";
const totalPins = 13;
export let PinStore = [];
for (let i = 0; i < totalPins; i++) {
  PinStore.push(new Pin(i));
}

app.use(
  express.json({
    limit: "30mb",
    extended: true,
  })
);

app.locals.isArduinoConnected = false;
app.locals.arduinoCOM = null;
app.locals.sport = null;
app.locals.parser = null;

app.use(
  express.urlencoded({
    limit: "30mb",
    extended: true,
  })
);

app.listen(process.env.HTTP_PORT, () => {
  console.log(
    `[Server] Express Server us running on port ${process.env.HTTP_PORT} `
  );
});

const serverAddress = process.env.HOST;
const wsocketPort = process.env.PORT;

let clientList = new Set();
const wss = new WebSocket.Server({
  host: serverAddress,
  port: wsocketPort,
});

wss.binaryType = "arraybuffer";

const broadcaster = new Broadcaster();

wss.on("connection", (ws) => {
  clientList.add(ws);
  console.log("[SERVER] New client just connected.");
  broadcaster.addClient(ws);
  broadcaster.sendAllSettings(ws, PinStore);
  ws.on("message", (msg) => {
    if (app.locals.isArduinoConnected) {
      try {
        aJSON_Parse(msg).then((msg) => {
          const { type, payload } = msg;
          onMessage(ws, type, payload);
        });
      } catch (error) {
        console.log(error);
      }
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
      broadcaster.broadcastConfig(ws, PinStore);
    }
  }
}

export const initializeArduinoPins = () => {
  for (let i = 0; i < totalPins; i++) {
    PinStore[i].sendConfigToArduino();
  }
};

const msgStartByte = 48;

app.get("/is-arduino-connected", async (req, res) => {
  res.status(200).json({
    value: app.locals.isArduinoConnected,
  });
});

app.put("/connect-to-arduino", async (req, res) => {
  const { path } = req.body;
  if (app.locals.isArduinoConnected) {
    res.status(400).json({
      error: {
        message: `Arduino is already connected on COM: ${app.locals.arduinoCOM}`,
      },
    });
    return;
  }

  try {
    const exists = await serialCOMExists(path);
    if (!exists) {
      return res.status(404).json({
        error: {
          message: "COM port specified does not exist or is unavailable.",
        },
      });
    }

    app.locals.arduinoCOM = path;
    app.locals.sport = new SerialPort(app.locals.arduinoCOM, {
      autoOpen: true,
    });
    app.locals.parser = app.locals.sport.pipe(
      new Ready({ delimiter: "READY" })
    );
    app.locals.sport.on("close", () => {
      console.log("[Server] Connection to Arduino lost.");
      app.locals.isArduinoConnected = false;
      console.log("[Server] Broadcasting messaage to all clients...");
      broadcaster.sendAllMessage("arduino-closed");
    });

    app.locals.parser.on("ready", () => {
      console.log("[Server] Connection to Arduino established.");
      app.locals.isArduinoConnected = true;
      initializeArduinoPins(app.locals.sport);
    });

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
});

app.get("/list-ports", async (req, res) => {
  const ports = await SerialPort.list();
  res.status(200).json({
    value: ports,
  });
});
