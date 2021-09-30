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

import { Broadcaster, BroadcastEvent } from "./broadcaster.js";
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
      console.log(pinId, cmd);
      switch (cmd) {
        case "ON": {
          turnOn(pinId);
          break;
        }
        case "OFF": {
          turnOff(pinId);
          break;
        }
        case "PWM": {
          pwm(pinId);
          break;
        }
        case "setPeriod": {
          setPeriod(pinId, payload.value);
          break;
        }
        case "setUnit": {
          setUnit(pinId, payload.value);
          break;
        }
        case "setDutyCycle": {
          setDutyCycle(pinId, payload.value);
          break;
        }
      }
    }
  }
}
export default onMessage;
