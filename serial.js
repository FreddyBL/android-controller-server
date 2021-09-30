import SerialPort from "serialport";

export const serialCOMExists = async (pathCOM) => {
  const ports = await SerialPort.list();
  return ports.some((port) => port.path === pathCOM);
};
