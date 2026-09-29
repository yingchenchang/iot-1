#include <Arduino.h>
#include <string.h>

#if !defined(BOARD_AMB82_MINI)
#error Select AMB82-MINI in the Arduino board menu.
#endif

// AMB82-MINI: LED_B = 23/PF9, LED_G = 24/PE6; HIGH = on.
const uint8_t LED_ON = HIGH;
const uint8_t LED_OFF = LOW;
const unsigned long BLINK_INTERVAL_MS = 300;
char lineBuffer[80];
size_t lineLength = 0;
bool discardLine = false;
unsigned long lastByteAt = 0;

void reply(const char *id, const char *result) {
  Serial.print("V1 ");
  Serial.print(id);
  Serial.print(' ');
  Serial.print(result);
  Serial.print(" AMB82-MINI ");
  // Read the GPIOs on the board; do not infer state in the browser.
  Serial.print(digitalRead(LED_B) == LED_ON ? 1 : 0);
  Serial.print(' ');
  Serial.println(digitalRead(LED_G) == LED_ON ? 1 : 0);
}

void handleLine(char *line) {
  if (strncmp(line, "V1 ", 3) != 0) return;
  char *id = line + 3;
  char *separator = strchr(id, ' ');
  if (!separator || separator == id || separator - id > 10) return;
  for (char *p = id; p < separator; ++p) {
    if (*p < '0' || *p > '9') return;
  }
  *separator = '\0';
  const char *command = separator + 1;
  if (strcmp(command, "BLUE_ON") == 0) digitalWrite(LED_B, LED_ON);
  else if (strcmp(command, "GREEN_ON") == 0) digitalWrite(LED_G, LED_ON);
  else if (strcmp(command, "BLUE_OFF") == 0) digitalWrite(LED_B, LED_OFF);
  else if (strcmp(command, "GREEN_OFF") == 0) digitalWrite(LED_G, LED_OFF);
  else if (strcmp(command, "BLINK_THREE") == 0) {
    // Three complete synchronized flashes, ending with both LEDs off.
    digitalWrite(LED_B, LED_OFF);
    digitalWrite(LED_G, LED_OFF);
    for (uint8_t count = 0; count < 3; ++count) {
      digitalWrite(LED_B, LED_ON);
      digitalWrite(LED_G, LED_ON);
      delay(BLINK_INTERVAL_MS);
      digitalWrite(LED_B, LED_OFF);
      digitalWrite(LED_G, LED_OFF);
      delay(BLINK_INTERVAL_MS);
    }
  }
  else if (strcmp(command, "ALL_OFF") == 0) {
    digitalWrite(LED_B, LED_OFF);
    digitalWrite(LED_G, LED_OFF);
  } else if (strcmp(command, "STATUS") != 0) {
    reply(id, "ERROR");
    return;
  }
  reply(id, "OK");
}

void setup() {
  pinMode(LED_B, OUTPUT);
  pinMode(LED_G, OUTPUT);
  digitalWrite(LED_B, LED_OFF);
  digitalWrite(LED_G, LED_OFF);
  Serial.begin(115200);
}

void loop() {
  // A partial/oversized frame is discarded through the next newline.
  if (lineLength && millis() - lastByteAt > 1000) {
    lineLength = 0;
    discardLine = true;
  }
  while (Serial.available()) {
    const char c = Serial.read();
    lastByteAt = millis();
    if (c == '\n') {
      if (!discardLine) {
        lineBuffer[lineLength] = '\0';
        handleLine(lineBuffer);
      }
      lineLength = 0;
      discardLine = false;
    } else if (c != '\r' && !discardLine) {
      if (c < 32 || c > 126 || lineLength >= sizeof(lineBuffer) - 1) {
        discardLine = true;
        lineLength = 0;
      } else lineBuffer[lineLength++] = c;
    }
  }
  delay(1);
}
