Portable Multimodal Structural Health Monitoring & Early-Warning System

📌 Project Overview

The Portable Multimodal Structural Health Monitoring & Early-Warning System is an ESP32-based embedded system designed to monitor the condition of a structure using multiple sensors.

The system combines load, temperature, vibration, and resonance measurements to identify changes in the structural condition and provide an early warning when abnormal behavior is detected.

The main idea is:

One portable device. Multiple signals. One explainable structural health status.

⸻

🎯 Objectives

The main objectives of this project are:

* Monitor structural loading conditions.
* Measure structural temperature.
* Detect vibration from the structure.
* Perform active piezoelectric resonance testing.
* Establish a healthy structural baseline.
* Compare new measurements with the baseline.
* Detect significant changes in resonance and vibration.
* Provide a simple structural status through a TFT display.
* Provide an early warning when abnormal changes are detected.

⸻

🧠 System Concept

The system follows this basic process:

                STRUCTURE
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
     LOAD       TEMPERATURE   VIBRATION
     SENSOR       SENSOR       SENSOR
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
                  ESP32
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
       Baseline  Signal    Resonance
       Analysis  Analysis   Analysis
          │         │         │
          └─────────┼─────────┘
                    │
                    ▼
            HEALTH EVALUATION
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       HEALTHY   WARNING   CHECK SENSOR
                    │
                    ▼
               TFT DISPLAY

⸻

🔧 Hardware Components

Component	Purpose
ESP32	Main microcontroller
Load Cell	Measures applied load
HX711	Amplifier and ADC for load cell
NTC / KY-028	Temperature measurement
Piezoelectric Actuator	Excites the structure
Piezoelectric Sensor	Measures structural vibration
TFT Display	Displays measurements and status
START Button	Starts an SHM measurement
MODE Button	Resets the structural baseline
LED	Indicates warning/status
Resistors	Sensor interfacing

⸻

🔌 ESP32 Pin Configuration

The current firmware uses the following GPIO pins:

ESP32 GPIO	Function
GPIO 35	HX711 Data
GPIO 23	HX711 Clock
GPIO 34	Temperature Analog Input
GPIO 18	Piezo Transmitter
GPIO 36	Piezo Receiver
GPIO 5	START Button
GPIO 39	MODE Button
GPIO 19	Status LED

The pin definitions in the Arduino code are:

#define HX_DT         35
#define HX_SCK        23
#define TEMP_AO       34
#define PIEZO_TX      18
#define PIEZO_RX      36
#define START_BUTTON   5
#define MODE_BUTTON    39
#define STATUS_LED    19

⸻

💻 Software Requirements

Arduino IDE

The firmware is written in Arduino C/C++ and is designed to run on an ESP32.

You need:

* Arduino IDE
* ESP32 board package
* USB cable
* ESP32 development board

⸻

📚 Required Libraries

The project uses the following libraries:

#include <HX711.h>
#include <TFT_eSPI.h>
#include <math.h>

Install the required libraries from:

Arduino IDE
→ Sketch
→ Include Library
→ Manage Libraries

Install:

* HX711
* TFT_eSPI

The math.h library is normally available with the Arduino environment.

⸻

📁 Project Structure

A simple project structure is:

Portable-Multimodal-SHM/
│
├── README.md
│
└── Portable_SHM.ino

You can later expand it to:

Portable-Multimodal-SHM/
│
├── README.md
│
├── firmware/
│   └── Portable_SHM.ino
│
├── hardware/
│   └── circuit-diagram.png
│
├── documentation/
│   └── project-presentation.pdf
│
└── images/
    └── prototype.jpg

⸻

⚙️ How the System Works

1. System Startup

When the ESP32 is powered on, the system initializes:

* ESP32 GPIO pins
* HX711
* Load cell
* Temperature sensor
* Piezoelectric actuator
* Piezoelectric receiver
* TFT display
* Status LED

The load cell is also tared during startup.

scale.tare(20);

This establishes the current load as the zero reference.

⸻

🌡️ 2. Temperature Calibration

During startup, the system performs temperature calibration.

The firmware contains:

const float KNOWN_ROOM_TEMP = 24.0;

The system uses this reference to calculate a temperature offset.

The actual room temperature should be used when calibrating the hardware.

⸻

⚖️ 3. Load Measurement

The load cell is connected to the HX711 amplifier.

The ESP32 reads the load through the HX711.

The firmware uses multiple readings to obtain a more stable measurement.

Example:

float loadGrams = scale.get_units(15);

The result is displayed in grams.

⸻

🌡️ 4. Temperature Measurement

The temperature sensor is connected to the ESP32 analog input.

The system continuously measures the temperature during an SHM test.

The temperature is displayed on the TFT screen.

Example:

TEMPERATURE
24.7 C

⸻

📳 5. Active Vibration Testing

The system uses a piezoelectric actuator to actively excite the structure.

The excitation frequency is configured as:

#define TX_FREQUENCY 1000

Therefore, the structure is excited at approximately:

1000 Hz

The purpose is to generate a measurable structural vibration response.

⸻

📈 6. Vibration Measurement

After excitation, the piezoelectric receiver measures the structural response.

The current firmware uses:

const int SAMPLE_COUNT = 256;
const int SAMPLE_RATE = 4000;

This means:

* Number of samples = 256
* Sampling rate = 4000 samples/second

The vibration samples are stored in an array:

int vibrationSamples[SAMPLE_COUNT];

⸻

🔊 7. Resonance Frequency Detection

The system analyzes the vibration signal to determine the dominant frequency.

The current frequency search range is:

const int MIN_FREQ = 50;
const int MAX_FREQ = 1500;

The frequency step is:

const int FREQ_STEP = 10;

Therefore, the system searches approximately from:

50 Hz → 1500 Hz

and determines the frequency with the strongest response.

The main function used for this process is:

float findDominantFrequency()

⸻

📊 8. Vibration Signal Strength

The system calculates the peak-to-peak vibration signal.

The function:

float getSignalMillivoltsPP()

determines the difference between the maximum and minimum measured signal.

The result is represented as:

mVpp

where mVpp means millivolts peak-to-peak.

⸻

🎯 9. Healthy Baseline

One of the important features of the system is automatic baseline creation.

During the first valid measurement, the system stores:

* Resonance frequency
* Vibration signal strength

For example:

Baseline Resonance = 500 Hz
Baseline Signal    = 300 mVpp

These values represent the reference condition of the structure.

Future measurements are compared against this baseline.

⸻

🚨 10. Early-Warning Logic

The system currently uses changes in resonance frequency and vibration signal to determine whether the structure should be checked.

Sensor Check

If the vibration signal is too weak:

Signal < 40 mV

the system displays:

CHECK SENSOR

This indicates that the signal may not be strong enough for reliable analysis.

⸻

Baseline Creation

If there is no existing baseline, the first valid measurement becomes the baseline.

The system displays:

BASELINE SET

⸻

Resonance Change

The system calculates the percentage change in resonance frequency.

Frequency Change =
|Current Frequency - Baseline Frequency|
---------------------------------------- × 100
          Baseline Frequency

If the change is greater than:

10%

the system displays:

WARNING

⸻

Vibration Signal Reduction

The system also compares the current vibration signal with the baseline.

If:

Current Signal < 50% of Baseline Signal

the system displays:

WARNING

⸻

Healthy Condition

If the measurements remain within the configured thresholds, the system displays:

HEALTHY

⸻

🔄 Health Decision Flow

                 START TEST
                     │
                     ▼
              Read Load
                     │
                     ▼
            Read Temperature
                     │
                     ▼
           Excite Structure
                     │
                     ▼
          Capture Vibration
                     │
                     ▼
        Find Resonance Frequency
                     │
                     ▼
        Calculate Vibration Signal
                     │
                     ▼
            Check Signal
                     │
          ┌──────────┴──────────┐
          │                     │
     Signal < 40 mV         Signal OK
          │                     │
          ▼                     ▼
   CHECK SENSOR          Check Baseline
                                │
                    ┌───────────┴───────────┐
                    │                       │
              No Baseline             Baseline Exists
                    │                       │
                    ▼                       ▼
              Set Baseline             Compare Data
                                            │
                              ┌─────────────┴─────────────┐
                              │                           │
                       Large Change                Normal Change
                              │                           │
                              ▼                           ▼
                          WARNING                     HEALTHY

⸻

🖥️ TFT Display

The TFT display provides a local interface.

The system can display information such as:

PORTABLE SHM
LOAD          TEMPERATURE
125.4 g       24.7 C
RESONANCE     VIBRATION
520 Hz        310 mVpp
STATUS
HEALTHY

The actual values depend on the sensor measurements.

⸻

🔘 Button Functions

START Button

The START button begins a complete structural health measurement.

The process is:

START
  ↓
Load Measurement
  ↓
Temperature Measurement
  ↓
Piezo Excitation
  ↓
Vibration Sampling
  ↓
Resonance Detection
  ↓
Signal Analysis
  ↓
Baseline Comparison
  ↓
Health Status

⸻

MODE Button

The MODE button resets the current structural baseline.

This is useful when:

* Testing a new structure
* Changing the test specimen
* Establishing a new healthy reference

After resetting the baseline, the next valid measurement becomes the new reference.

⸻

💡 LED Warning

The status LED is connected to:

#define STATUS_LED 19

The LED is used as a simple visual warning indicator.

The system can indicate abnormal conditions such as:

WARNING

or:

CHECK SENSOR

⸻

🖥️ Serial Monitor

The ESP32 communicates measurement information through the Serial Monitor.

The configured baud rate is:

115200

Example output:

Load: 125.4 g
Temperature: 24.7 C
Resonance: 520 Hz
Signal: 310 mVpp
Status: HEALTHY

The Serial Monitor is useful for:

* Debugging
* Sensor testing
* Monitoring measurements
* Demonstrations
* Future data logging

⸻

📐 Current System Parameters

Parameter	Current Value
ESP32 ADC Resolution	12-bit
Vibration Samples	256
Sampling Rate	4000 Hz
Minimum Frequency	50 Hz
Maximum Frequency	1500 Hz
Frequency Step	10 Hz
Piezo Excitation	1000 Hz
Frequency Warning Threshold	>10% change
Signal Warning Threshold	<50% baseline
Sensor Check Threshold	<40 mVpp
Serial Baud Rate	115200

⸻

🔧 Calibration

Load Cell Calibration

The current firmware contains:

float calibration_factor = -210.0;

This value depends on the particular load cell and mechanical arrangement.

A known weight should be used to calibrate the load cell.

⸻

Temperature Calibration

The firmware currently uses:

const float KNOWN_ROOM_TEMP = 24.0;

Change this value according to the actual room temperature during calibration.

⸻

Structural Baseline Calibration

The structure should be in its known healthy/reference condition when the baseline is created.

The first valid measurement automatically becomes the baseline.

⸻

⚠️ Important Limitations

This project is currently a prototype/research system.

It should not be treated as a certified structural safety system.

The results can be affected by:

* Sensor mounting
* Sensor position
* Piezoelectric actuator position
* Structural boundary conditions
* Environmental temperature
* Electrical noise
* Mechanical noise
* Load-cell calibration
* Temperature calibration

The current warning thresholds are prototype thresholds and should be validated experimentally before being used for real structural safety decisions.

⸻

🚀 Future Improvements

The project can be extended with the following features.

1. Wireless Communication

Add:

* Wi-Fi
* Bluetooth/BLE
* MQTT

This would allow measurements to be transmitted to a computer or cloud server.

⸻

2. Web Dashboard

A web dashboard could display:

Load
Temperature
Resonance Frequency
Vibration
Structural Status
Historical Measurements

⸻

3. Data Logging

Measurements could be stored with:

Timestamp
Load
Temperature
Resonance
Vibration
Health Status

Possible storage options:

* SD Card
* ESP32 Flash
* Cloud Database

⸻

4. Structural Health Index

A future version could combine multiple measurements into a single:

Structural Health Index (SHI)

For example:

100% ───────── Healthy
 80% ───────── Normal
 60% ───────── Monitor
 40% ───────── Warning
 20% ───────── Critical

The exact scoring system would need experimental validation.

⸻

5. Advanced Signal Processing

Future versions could include:

* FFT
* Digital filtering
* Noise reduction
* Multiple resonance modes
* Statistical anomaly detection
* Sensor fusion
* Machine learning
* Damage classification

⸻

🏗️ Possible Applications

The prototype can be used for experimental monitoring of:

* Bridges
* Beams
* Structural frames
* Laboratory structures
* Mechanical components
* Industrial structures
* Educational structural models
* Small-scale civil structures

⸻

🔬 Key Features

01 — MULTIMODAL

Load, temperature, and vibration information are collected using multiple sensors.

02 — BASELINE

The system establishes a healthy reference condition for the structure.

03 — SIGNAL INTELLIGENCE

The ESP32 performs vibration sampling and resonance analysis locally.

04 — ACTIVE RESONANCE TESTING

A piezoelectric actuator excites the structure to measure its response.

05 — SENSOR CHECK

Very weak vibration signals are identified instead of producing an unreliable health result.

06 — EARLY WARNING

Significant changes from the baseline generate a warning.

07 — PORTABLE

The system is designed as a compact ESP32-based monitoring node.

⸻

📌 Project Workflow

Power ON
   ↓
Initialize ESP32
   ↓
Initialize Sensors
   ↓
Initialize TFT
   ↓
Temperature Calibration
   ↓
System Ready
   ↓
Press START
   ↓
Measure Load
   ↓
Measure Temperature
   ↓
Excite Structure
   ↓
Capture Vibration
   ↓
Analyze Resonance
   ↓
Calculate Signal Strength
   ↓
Compare With Baseline
   ↓
Determine Structural Status
   ↓
Display Result
   ↓
Show Warning if Required

⸻

📁 Repository Structure

portable-multimodal-shm/
│
├── README.md
│
├── firmware/
│   └── Portable_SHM.ino
│
├── hardware/
│   └── circuit-diagram.png
│
├── documentation/
│   └── project-presentation.pdf
│
└── images/
    └── prototype.jpg

⸻

👨‍💻 Project Information

Project Name: Portable Multimodal Structural Health Monitoring & Early-Warning System

Microcontroller: ESP32

Programming Language: Arduino C/C++

Development Environment: Arduino IDE

Application Area: Structural Health Monitoring

Main Technologies:

* ESP32
* HX711
* Load Cell
* NTC Temperature Sensor
* Piezoelectric Sensor
* Piezoelectric Actuator
* TFT Display
* Signal Processing
* Baseline-Based Anomaly Detection

⸻

📜 License

This project is intended for educational, research, and prototype development purposes.

If the project is publicly distributed, an appropriate open-source license can be added to the repository.