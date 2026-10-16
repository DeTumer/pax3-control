# PAX 3 Control

A web app for controlling a PAX 3 vaporizer over Web Bluetooth. It replaces the retired connect.pax web app and doubles as a tool for mapping the protocol.

- **Control:** live temperature and heating state, battery, set point and presets, brightness, haptics, dynamic mode.
- **Colors:** edit the LED color theme (startup, heating, regulating, standby) and save themes.
- **Research:**
  - attribute scanner (ids 0–63 against the supported-attributes bitmask)
  - change watcher with byte diffs
  - attribute inspector with a field annotator
  - raw packet sender
  - GATT explorer
- **Log:** every packet in both directions, with plaintext, ciphertext and IV. Sessions can be exported and imported as JSON.

See [PROTOCOL.md](PROTOCOL.md) for what is known about the protocol.

## Browsers

| Platform | Works? |
|---|---|
| Chrome / Edge / Opera, desktop | yes |
| Chrome, Android | yes |
| Linux Chrome | enable `chrome://flags/#enable-experimental-web-platform-features` |
| iPhone / iPad | only inside the **Bluefy** browser app (all iOS browsers lack Web Bluetooth) |
| Firefox, Safari | no |

Chrome hides the device's serial number characteristic, so you have to enter the serial printed on your PAX the first time you connect. The encryption key is derived from it.

## Development

```sh
npm install
npm run dev     # http://localhost:5173 (localhost counts as a secure context)
npm test        # crypto/codec tests against captured vectors
npm run build
```

## Deploy

Push to `main` on GitHub. Then, in the repo settings, go to **Pages** and set **Source** to **GitHub Actions**. The workflow tests, builds and publishes the site to `https://<user>.github.io/<repo>/`.

## Safety

- The app never writes to non-PAX characteristics, such as firmware update.
- Writes to attributes whose format is unconfirmed ask for confirmation first.
- The temperature slider is limited to the PAX 3 range of 182–215 °C.
