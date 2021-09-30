import SerialPort from "serialport";
import Ready from "@serialport/parser-ready";
import { commands, units } from "./constants.js";

import { StringPinModes } from "./constants.js";

const msgStartByte = 48;
const arduinoPort = "COM4"; //Will retrieve from app later.

export const sport = new SerialPort(arduinoPort, { autoOpen: true });
export const parser = sport.pipe(new Ready({ delimiter: "READY" }));

sport.on("close", () => {
  console.log("[Server] Connection to Arduino lost.");
});

function writeBytes(sport, bytes) {
  const len = bytes.length;
  let bytesToWrite = new Uint8Array(len + 3);
  bytesToWrite[0] = 48;
  bytesToWrite[1] = len;
  for (let i = 2, j = len + 2; i < j; i++) {
    bytesToWrite[i] = bytes[i - 2];
  }
  sport.write(Buffer.from(bytesToWrite), "binary");
}

export const writeArduinoCmd = (pin, cmd, value = 0) => {
  let bytes = [];
  bytes.push(pin, cmd);
  let argsBytes = [];
  argsBytes[0] = value & 0xff;
  argsBytes[1] = (value >> 8) & 0xff;
  argsBytes[2] = (value >> 16) & 0xff;
  argsBytes[3] = (value >> 24) & 0xff;
  argsBytes.forEach((byte) => {
    bytes.push(byte);
  });
  writeBytes(sport, bytes);
};

export const turnOn = (pin) => {
  writeArduinoCmd(pin, commands.turnOn);
};
export const turnOff = (pin) => {
  writeArduinoCmd(pin, commands.turnOff);
};
export const pwm = (pin) => {
  writeArduinoCmd(pin, commands.PWM);
};
export const setPeriod = (pin, value) => {
  writeArduinoCmd(pin, commands.setPeriod, value);
};
export const setDutyCycle = (pin, value) => {
  writeArduinoCmd(pin, commands.setDutyCycle, value);
};
export const setUnit = (pin, unit) => {
  switch (unit) {
    case "ms": {
      return writeArduinoCmd(pin, commands.setUnit, units.ms);
    }
    case "us": {
      return writeArduinoCmd(pin, commands.setUnit, units.us);
    }
  }
};
