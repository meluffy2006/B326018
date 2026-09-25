#include <HX711.h>
#include <TFT_eSPI.h>
#include <math.h>

// =====================================================
// FINAL ESP32 PIN CONNECTIONS
// =====================================================
#define HX_DT         35
#define HX_SCK        23
#define TEMP_AO       34
#define PIEZO_TX      18
#define PIEZO_RX      36

#define START_BUTTON   5
#define MODE_BUTTON   39
#define STATUS_LED    19

// =====================================================
// LOAD CELL
// Replace after load-cell calibration.
// =====================================================
float calibration_factor = -210.0;

// =====================================================
// KY-028 TEMPERATURE
// Keep the sensor untouched during the first 10 seconds.
// Set this to the actual room temperature at startup.
// =====================================================
const float KNOWN_ROOM_TEMP = 24.0;

const float FIXED_RESISTOR = 10000.0;
const float NTC_R0 = 10000.0;
const float NTC_BETA = 3950.0;
const float T0_KELVIN = 298.15;

float temperatureOffset = 0.0;

// =====================================================
// PIEZO VIBRATION / RESONANCE
// =====================================================
#define TX_CHANNEL 0
#define TX_FREQUENCY 1000
#define TX_RESOLUTION 8

const int SAMPLE_COUNT = 256;
const int SAMPLE_RATE = 4000;
const int MIN_FREQ = 50;
const int MAX_FREQ = 1500;
const int FREQ_STEP = 10;

int vibrationSamples[SAMPLE_COUNT];

// =====================================================
// STRUCTURAL BASELINE
// First valid test becomes the healthy baseline.
// Press the MODE button to erase and reset it.
// =====================================================
bool baselineSet = false;
float baselineFrequency = 0.0;
float baselineSignal = 0.0;

unsigned long lastStartPress = 0;
unsigned long lastModePress = 0;

HX711 scale;
TFT_eSPI tft = TFT_eSPI();

// =====================================================
// PIEZO PWM FUNCTIONS
// =====================================================
void setupPiezoPWM() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIEZO_TX, TX_FREQUENCY, TX_RESOLUTION);
  ledcWriteTone(PIEZO_TX, 0);
#else
  ledcSetup(TX_CHANNEL, TX_FREQUENCY, TX_RESOLUTION);
  ledcAttachPin(PIEZO_TX, TX_CHANNEL);
  ledcWriteTone(TX_CHANNEL, 0);
#endif
}

void setPiezoTone(int frequency) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(PIEZO_TX, frequency);
#else
  ledcWriteTone(TX_CHANNEL, frequency);
#endif
}

// =====================================================
// TEMPERATURE FUNCTIONS
// =====================================================
float readTempRawC() {
  long total = 0;

  for (int i = 0; i < 30; i++) {
    total += analogRead(TEMP_AO);
    delay(3);
  }

  float raw = total / 30.0;

  if (raw <= 0 || raw >= 4095) {
    return NAN;
  }

  // This direction makes temperature increase when touched.
  float ntcResistance = FIXED_RESISTOR * raw / (4095.0 - raw);

  float inverseT =
    (1.0 / T0_KELVIN) +
    (log(ntcResistance / NTC_R0) / NTC_BETA);

  return (1.0 / inverseT) - 273.15;
}

float readTemperatureC() {
  float temperature = readTempRawC();

  if (isnan(temperature)) {
    return NAN;
  }

  return temperature + temperatureOffset;
}

// =====================================================
// VIBRATION FUNCTIONS
// =====================================================
void exciteStructure() {
  setPiezoTone(TX_FREQUENCY);
  delay(12);
  setPiezoTone(0);
}

void captureVibration() {
  unsigned long samplePeriod = 1000000UL / SAMPLE_RATE;
  unsigned long nextSampleTime = micros();

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    while ((long)(micros() - nextSampleTime) < 0) {
    }

    vibrationSamples[i] = analogRead(PIEZO_RX);
    nextSampleTime += samplePeriod;
  }
}

float findDominantFrequency() {
  float mean = 0;

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    mean += vibrationSamples[i];
  }

  mean = mean / SAMPLE_COUNT;

  float strongestFrequency = 0;
  float strongestPower = 0;

  for (int frequency = MIN_FREQ; frequency <= MAX_FREQ; frequency += FREQ_STEP) {
    float omega = (2.0 * PI * frequency) / SAMPLE_RATE;
    float coefficient = 2.0 * cos(omega);

    float q0 = 0;
    float q1 = 0;
    float q2 = 0;

    for (int i = 0; i < SAMPLE_COUNT; i++) {
      float signal = vibrationSamples[i] - mean;

      q0 = coefficient * q1 - q2 + signal;
      q2 = q1;
      q1 = q0;
    }

    float power = q1 * q1 + q2 * q2 - coefficient * q1 * q2;

    if (power > strongestPower) {
      strongestPower = power;
      strongestFrequency = frequency;
    }
  }

  return strongestFrequency;
}

float getSignalMillivoltsPP() {
  int minimumValue = 4095;
  int maximumValue = 0;

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    if (vibrationSamples[i] < minimumValue) {
      minimumValue = vibrationSamples[i];
    }

    if (vibrationSamples[i] > maximumValue) {
      maximumValue = vibrationSamples[i];
    }
  }

  return ((maximumValue - minimumValue) * 3300.0) / 4095.0;
}

// =====================================================
// HEALTH STATUS
// =====================================================
String calculateHealthStatus(float resonanceHz, float signalMv) {
  if (signalMv < 40) {
    return "CHECK SENSOR";
  }

  if (!baselineSet) {
    baselineSet = true;
    baselineFrequency = resonanceHz;
    baselineSignal = signalMv;
    return "BASELINE SET";
  }

  float frequencyChange =
    fabs(resonanceHz - baselineFrequency) / baselineFrequency * 100.0;

  if (frequencyChange > 10.0 || signalMv < baselineSignal * 0.50) {
    return "WARNING";
  }

  return "HEALTHY";
}

// =====================================================
// TFT USER INTERFACE
// =====================================================
void showIdleScreen() {
  tft.fillScreen(TFT_BLACK);

  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.println("PORTABLE SHM");

  tft.drawFastHLine(5, 35, 310, TFT_DARKGREY);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(35, 80);
  tft.println("SYSTEM READY");

  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(20, 125);
  tft.println("PRESS START");

  tft.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(20, 180);
  tft.println("MODE: Reset baseline");
  tft.setCursor(20, 200);
  tft.println("START: Run SHM test");
}

void showResults(float loadGrams, float temperatureC,
                 float resonanceHz, float signalMv,
                 String healthStatus) {
  tft.fillScreen(TFT_BLACK);

  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 5);
  tft.println("PORTABLE SHM");

  tft.drawFastHLine(5, 28, 310, TFT_DARKGREY);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 40);
  tft.println("LOAD");

  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 53);
  tft.printf("%.1f g", loadGrams);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(170, 40);
  tft.println("TEMPERATURE");

  tft.setTextColor(TFT_GREEN, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(170, 53);

  if (isnan(temperatureC)) {
    tft.println("ERROR");
  } else {
    tft.printf("%.1f C", temperatureC);
  }

  tft.drawFastHLine(5, 85, 310, TFT_DARKGREY);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 100);
  tft.println("RESONANCE");

  tft.setTextColor(TFT_MAGENTA, TFT_BLACK);
  tft.setTextSize(3);
  tft.setCursor(10, 115);
  tft.printf("%.0f Hz", resonanceHz);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(170, 100);
  tft.println("VIBRATION");

  tft.setTextColor(TFT_ORANGE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(170, 117);
  tft.printf("%.0f mVpp", signalMv);

  tft.drawFastHLine(5, 157, 310, TFT_DARKGREY);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 172);
  tft.println("STRUCTURAL STATUS");

  if (healthStatus == "HEALTHY" || healthStatus == "BASELINE SET") {
    tft.setTextColor(TFT_GREEN, TFT_BLACK);
  } else {
    tft.setTextColor(TFT_RED, TFT_BLACK);
  }

  tft.setTextSize(2);
  tft.setCursor(10, 190);
  tft.println(healthStatus);

  tft.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 225);
  tft.println("START=new test | MODE=reset");
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(TEMP_AO, ADC_11db);
  analogSetPinAttenuation(PIEZO_RX, ADC_11db);

  pinMode(START_BUTTON, INPUT_PULLUP);
  pinMode(MODE_BUTTON, INPUT);   // External 10 kΩ pull-up required
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  scale.begin(HX_DT, HX_SCK);
  scale.set_scale(calibration_factor);

  // Keep the load cell empty during startup.
  scale.tare(20);

  setupPiezoPWM();

  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(20, 80);
  tft.println("TEMP CALIBRATION");
  tft.setCursor(20, 110);
  tft.println("DO NOT TOUCH");
  delay(10000);

  float initialTemperature = readTempRawC();

  if (!isnan(initialTemperature)) {
    temperatureOffset = KNOWN_ROOM_TEMP - initialTemperature;
  }

  showIdleScreen();
}

// =====================================================
// MAIN PROGRAM
// =====================================================
void loop() {
  // MODE button: delete saved baseline.
  if (digitalRead(MODE_BUTTON) == LOW &&
      millis() - lastModePress > 500) {

    baselineSet = false;
    baselineFrequency = 0;
    baselineSignal = 0;

    digitalWrite(STATUS_LED, LOW);
    showIdleScreen();

    lastModePress = millis();
  }

  // START button: perform a complete measurement.
  if (digitalRead(START_BUTTON) == LOW &&
      millis() - lastStartPress > 500) {

    lastStartPress = millis();
    digitalWrite(STATUS_LED, HIGH);

    float loadGrams = scale.get_units(15);

    if (fabs(loadGrams) < 1.0) {
      loadGrams = 0.0;
    }

    float temperatureC = readTemperatureC();

    exciteStructure();
    captureVibration();

    float resonanceHz = findDominantFrequency();
    float signalMv = getSignalMillivoltsPP();

    String healthStatus =
      calculateHealthStatus(resonanceHz, signalMv);

    showResults(loadGrams, temperatureC,
                resonanceHz, signalMv, healthStatus);

    // LED stays ON only for warning/check-sensor results.
    if (healthStatus == "WARNING" ||
        healthStatus == "CHECK SENSOR") {
      digitalWrite(STATUS_LED, HIGH);
    } else {
      digitalWrite(STATUS_LED, LOW);
    }

    Serial.print("Load: ");
    Serial.print(loadGrams, 1);
    Serial.print(" g | Temperature: ");
    Serial.print(temperatureC, 1);
    Serial.print(" C | Resonance: ");
    Serial.print(resonanceHz, 0);
    Serial.print(" Hz | Signal: ");
    Serial.print(signalMv, 0);
    Serial.print(" mVpp | Status: ");
    Serial.println(healthStatus);
  }

  delay(30);
}