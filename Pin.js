import { StringPinModes, UnitTypes } from "./constants.js";
import {
  turnOn,
  pwm,
  setPeriod,
  setDutyCycle,
  setUnit,
  turnOff,
} from "./arduino.js";

export class Pin {
  constructor(pinId) {
    this.state = {
      mode: StringPinModes.PWM,
      period: 1000,
      periodMin: 0,
      periodMax: 2000,
      periodStep: 1,
      unit: UnitTypes.ms,
      dutyCycle: 50,
      dutyCycleStep: 1,
      pinId,
    };
  }
  sendModeToArduino() {
    switch (this.state.mode) {
      case StringPinModes.ON: {
        turnOn(this.state.pinId);
        break;
      }
      case StringPinModes.OFF: {
        turnOff(this.state.pinId);
        break;
      }
      case StringPinModes.PWM: {
        pwm(this.state.pinId);
        break;
      }
    }
  }
  sendPWMSettingsToArduino() {
    setPeriod(this.state.pinId, this.state.period);
    setUnit(this.state.pinId, this.state.unit);
    setDutyCycle(this.state.pinId, this.state.dutyCycle);
  }
  sendConfigToArduino() {
    this.sendModeToArduino();
    this.sendPWMSettingsToArduino();
  }
}
