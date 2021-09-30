/*
MIT License
Copyright (c) 2021 Freddy Borja
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


#define MSG_START_BYTE      48
#define MSG_END_BYTE        0b10010011
#define INVALID_MSG         -2
#define MSG_SUCCESS          1
#define MAX_BUF_SIZE         120   


// Byte message form
// | startByte<8> | byteCount<8> | data<8 * byteCount>
class AsyncReader
{
private:
    enum class ReadingStages{
        readStartByte = 0,
        readByteCount = 1,
        readData = 2,
        finishedReading = 3
    };

    enum class ReturnCodes
    {
        Finished = 3,
        Awaiting = 4,
        WaitingFor1stByte = 5,
        WaitingForMsgLenByte = 6,
        InsufficentBufSize = 7,
        AwaitingDataBytes = 8,
    };
    byte buffer[MAX_BUF_SIZE];
    ReadingStages stage;
    byte bytesToRead;
    byte bufidx;

public:
    AsyncReader()
    {
        bufidx = 0;
        stage = ReadingStages::readStartByte;
    }
    ReturnCodes read()
    {
        byte b = 0;
        if(stage == ReadingStages::readStartByte)
        {
            if(Serial.available() < 1)
                return ReturnCodes::WaitingFor1stByte;

            b = Serial.read();
            if(b == MSG_START_BYTE)
            {
                stage = ReadingStages::readByteCount;
            }
        }
        else if(stage == ReadingStages::readByteCount)
        {
            if(Serial.available() < 1)
                return ReturnCodes::WaitingForMsgLenByte;

            bytesToRead = Serial.read();
            if(bytesToRead >= MAX_BUF_SIZE)
                return ReturnCodes::InsufficentBufSize;
            
            stage = ReadingStages::readData;
        }
        else if(stage == ReadingStages::readData)
        {
            if(Serial.available() < 1)
                return ReturnCodes::AwaitingDataBytes;
            
            if(bufidx != bytesToRead)
            {
                b = Serial.read();
                buffer[bufidx] = b;
                bufidx = bufidx + 1;
            }
            else
            {
                stage = ReadingStages::finishedReading;
            }
        }
        else if(stage == ReadingStages::finishedReading)
        {
            return ReturnCodes::Finished;
        }
    }
    bool restart()
    {
        bufidx = 0;
        stage = ReadingStages::readStartByte;
        bytesToRead = 0;
    }
    const byte* const data() const
    {
        if(stage == ReadingStages::finishedReading)
            return buffer;
        else
            return nullptr;
    }
    bool done()
    {
        return (stage == ReadingStages::finishedReading);
    }
    uint8_t size() const
    {
        return bytesToRead;
    }
};

class binBuffer{
private:
    const byte* buf;
    size_t len;
    size_t bufIdx;
    bool outOfBounds;
public:
    binBuffer(const byte* buffer, size_t size){
        buf = buffer;
        len = size;
        outOfBounds = false;
        bufIdx = 0;
    }

    uint8_t readUInt8(){

        if(bufIdx >= len){
            outOfBounds = true;
            return 0;
        }
        uint8_t val = buf[bufIdx];
        bufIdx++;
        return val;
    }
    uint32_t readUInt32()
    {
        if(bufIdx >= len){
            outOfBounds = true;
            return 0;
        }
        uint32_t val = buf[bufIdx] | (static_cast<uint32_t>(buf[bufIdx+1]) << 8) | (static_cast<uint32_t>(buf[bufIdx+2]) << 16) | (static_cast<uint32_t>(buf[bufIdx+3]) << 24);
        bufIdx+=4;
        return val;
    }
    uint16_t readUInt16()
    {
        if(bufIdx >= len){
            outOfBounds = true;
            return 0;
        }
        uint16_t val = buf[bufIdx] | (static_cast<uint16_t>(buf[bufIdx+1]) << 8);
        bufIdx+=2;
        return val;
    }
    bool error() const
    {
        return outOfBounds;
    }
};






AsyncReader aReader;

#define BAUD_RATE 9600
#define TOTAL_PINS 20
#define READY_SIGNAL "READY"
#define TIMEOUT 100
bool isReady = false;
constexpr int ERROR = -1;

enum class Units
{
    millisecs = 0,
    microsecs = 1
};
enum Commands
{
    TURN_ON,
    TURN_OFF,
    PWM,
    SET_PERIOD,
    SET_DUTY_CYCLE,
    SET_UNIT,
    RESET,
    RESET_SETTINGS,
};

struct cmdData
{
    uint8_t pin;
    uint16_t val1;
    int val2;
    uint16_t cmd;
};

struct Data
{
    int pin;
    bool blinkOn;
    int pinMode;
    int blinkTimeMs;
    int startTimeMs;
    int period;
    int onTimeNs;
    int endTimeMs;
    int dutyCycle;
    bool dwriteCalled;
    Units unit;
};
Data PinData[TOTAL_PINS];



void reset(int pin, int mode = OUTPUT)
{
    PinData[pin].blinkOn = false;
    PinData[pin].blinkTimeMs = 0;
    PinData[pin].startTimeMs = 0;
    PinData[pin].dwriteCalled = false;
    setPinMode(pin, mode);
}
void pwm(int pin)
{
    reset(pin, OUTPUT);
    int period = PinData[pin].period;
    int dutyCycle = PinData[pin].dutyCycle;
    PinData[pin].startTimeMs = time(pin);
    float duty_factor = static_cast<float>(dutyCycle) / 100.0f;
    PinData[pin].onTimeNs = static_cast<int>(period * duty_factor);
    PinData[pin].blinkOn = true;

}
void initializePins()
{
    for (int i = 0; i < TOTAL_PINS; i++)
    {
        PinData[i].unit = Units::millisecs;
        PinData[i].period = 1000;
        PinData[i].dutyCycle = 50;
        reset(i, OUTPUT);
        digitalWrite(i, LOW);
    }
}
bool is_digital(int pin)
{
    return (pin >= 0 && pin <= 13);
}
bool is_analog(int pin)
{
    return (pin >= A0 && pin <= A5);
}
bool is_pwm(int pin)
{
    return (pin == 11 | pin == 10 || pin == 9 || pin == 6 || pin == 5 || pin == 3);
}
bool is_out(int pin)
{
    return PinData[pin].pinMode == OUTPUT;
}

void setPinMode(int pin, int mode)
{
    pinMode(pin, mode);
    PinData[pin].pinMode = mode;
}


bool toggle(int pin)
{
    if (is_out(pin))
    {
        bool state = static_cast<bool>(digitalRead(pin));
        digitalWrite(pin, !state);
        return true;
    }
    return false;
}
void setAllMode(int mode)
{
    for (int i = 0; i < TOTAL_PINS; i++)
    {
        reset(i, OUTPUT);
        setPinMode(i, mode);
    }
}
bool turnOnAll()
{
    for (int i = 0; i < TOTAL_PINS; i++)
    {
        reset(i, OUTPUT);
        turn_on(i);
    }
}

unsigned long time(int pin)
{
    return (PinData[pin].unit == Units::millisecs) ? millis() : micros();
}

void refresh()
{
    for (int i = 0; i < TOTAL_PINS; i++)
    {
        if (PinData[i].blinkOn)
        {
            int delta = time(i) - PinData[i].startTimeMs;
            const int endTime = PinData[i].period;
            const int onTime = PinData[i].onTimeNs;
            if (delta < onTime)
            {
                if (!PinData[i].dwriteCalled)
                {
                    digitalWrite(i, HIGH);
                    PinData[i].dwriteCalled = true;
                }
            }
            else if (delta >= onTime && delta < endTime)
            {
                if (PinData[i].dwriteCalled)
                {
                    digitalWrite(i, LOW);
                    PinData[i].dwriteCalled = false;
                }
            }
            else
            {
                PinData[i].startTimeMs = time(i);
            }
        }
    }
}
bool turn_on(int pin)
{
    if (is_digital(pin))
    {
        reset(pin, OUTPUT);
        digitalWrite(pin, HIGH);
        return true;
    }
    return false;
}
bool turn_off(int pin)
{
    if (is_digital(pin))
    {
        reset(pin, OUTPUT);
        digitalWrite(pin, LOW);
        return true;
    }
    return false;
}

int executeCmd(int pin, int cmd, int value)
{
    switch (cmd)
    {
    case TURN_ON:
    {
        turn_on(pin);
        break;
    }
    case TURN_OFF:
    {
        turn_off(pin);
        break;
    }
    case PWM:
    {
      reset(pin);
        pwm(pin);
        break;
    }
    case SET_UNIT:
    {
        PinData[pin].unit = (value == static_cast<int>(Units::millisecs)) ? Units::millisecs : Units::microsecs;
        if (PinData[pin].blinkOn)
        {
            PinData[pin].startTimeMs = time(pin);
            PinData[pin].dwriteCalled = false;
        }
        break;
    }
    case SET_PERIOD:
    {
        PinData[pin].period = value;
        if(PinData[pin].blinkOn)
        {
           reset(pin);
            pwm(pin);
        }
        break;
    }
    case RESET:
    {
        reset(pin);
        break;
    }
    case SET_DUTY_CYCLE:
    {
        PinData[pin].dutyCycle = value;
        if(PinData[pin].blinkOn)
        {
           reset(pin);
            pwm(pin);
        }
        break;
    }
    case RESET_SETTINGS:
    {
        initializePins();
        break;
    }
    default:
    {
        return ERROR;
    }
    }
}

void setup()
{
    Serial.begin(BAUD_RATE);
    initializePins();
}

void loop()
{
    if(!isReady){
        Serial.write(READY_SIGNAL);
        isReady = true;
    }
    aReader.read();
    if(aReader.done())
    {   
        const byte* bytes = aReader.data();
        uint8_t size = aReader.size();
        binBuffer bf (&(bytes[0]), size);
        const uint8_t pin = bf.readUInt8();
        const uint8_t cmd = bf.readUInt8();
        const uint32_t arg1 = bf.readUInt32();
        executeCmd(pin, cmd, arg1);
        aReader.restart();
    }
    refresh();
    
}
