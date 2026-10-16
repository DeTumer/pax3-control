# PAX 3 BLE protocol: findings

This is a living document. Add findings from the Research tab here: the attribute scanner, the change watcher and exported sessions.

Sources: [evertonstz/pax-romana](https://github.com/evertonstz/pax-romana) (captured test vectors),
[Toemeler/P3-VapeControl](https://github.com/Toemeler/P3-VapeControl), and the blraaz.me write-ups it cites.

## Transport

| What | UUID |
|---|---|
| PAX service | `8e320200-64d2-11e6-bdf4-0800200c9a66` |
| Read (packets from device) | `8e320201-…` |
| Write (packets to device) | `8e320202-…` (write **with** response; macOS and Linux reject without-response writes) |
| Notify ("data ready") | `8e320203-…` |
| Device Information | `0x180a` (serial `0x2a25`, which Chrome's Web Bluetooth blocklist hides) |

Flow:
1. Subscribe to notify.
2. Each notification means a packet is waiting, so read `0201` and decrypt it.
3. The notification value itself is logged as `NOTIFY` and is not decoded yet.

## Encryption

- Device key: `AES-128-ECB(K, ascii(serial + serial))` with `K = f7c866c38f78753086293bd57dd32540`.
  - Some write-ups list `8aecf0ab…`. That value is wrong, because the vectors below only pass with `f7c8…`.
- Packet layout: `ciphertext || IV` (the IV is the last 16 bytes and is random for each packet). Cipher is AES-128-OFB with no padding.
- Plaintext layout: `[attr id][payload…]`. Short packets are zero-padded to 16 bytes. Longer packets are allowed; the color theme is 34 bytes.
- Test vectors:
  - Serial `KRZQ2NW9` gives the key `8423398c3781fa6b008cba8c6c5366d4`.
  - Packet `63d33e…6bec` decrypts to `3568637c…8ad0`.

## Requests

`0xFE` StatusUpdate takes an 8-byte little-endian bitmask. When bit N is set, the device answers with attribute N. Only ids 0–63 can be requested this way.

## Attributes

| id | name | status | format |
|---|---|---|---|
| 0x01 | ActualTemp | decoded | u16le raw → °C, see below |
| 0x02 | HeaterSetPoint | decoded, writable | u16le raw |
| 0x03 | Battery | decoded | u8 % |
| 0x06 | Locked | partial | u8 |
| 0x07 | ChargeStatus | partial | u8 state (values?) |
| 0x0a | DeviceName | partial | string (layout?) |
| 0x11 | HeaterRanges | unknown | probably min/max |
| 0x13 | DynamicMode | partial | u8 (0 std, 1 boost, 2 efficiency, 3 stealth, 4 flavor; unconfirmed) |
| 0x14 | ColorTheme | decoded, writable | `count(4)` + 4 × `[r1 g1 b1 r2 g2 b2 anim freq]` (startup, heating, regulating, standby) |
| 0x15 | Brightness | decoded, writable | u8 0–128 |
| 0x17 | HapticMode | decoded, writable | u8 0–128 |
| 0x18 | SupportedAttributes | decoded | u64le bitmask |
| 0x1f | CurrentTargetTemp | decoded | u16le raw |
| 0x20 | HeatingState | decoded | 0 heating, 1 ready, 2 boosting, 3 cooling, 4 standby, 5 oven off, 6 temp select |

Names known from the official app whose format is still undecoded:
- 0x04 Usage, 0x05 UsageLimit, 0x09 Time
- 0x0d Replay, 0x0f GameMode, 0x12 LogSyncRequest
- 0x19 HeatingParameters, 0x1b UiMode, 0x1c ShellColor, 0x1e LowSocMode
- 0x24 SessionControl, 0x28 Haptics, 0x29 LogRequest
- 0x31/0x32 Encryption exchange/packet, 0x34 BLE DIS data, 0x36 FindMyPax

## Temperature units

PAX 3 raw units are not °C×10. The conversions are:

```
rawToCelsius(raw) = raw < 1980 ? trunc((raw+4)*10/109) + 3 : trunc(raw/12) + 20
celsiusToRaw(c)   = c < 185   ? trunc((c-3)*109/10) + 6  : (c-20)*12 + 10
```

## Open questions

- What the color animation ids beyond 0–2 do, and what unit `frequency` uses.
- Whether the notify payload carries any information.
- What each ChargeStatus value means.
- The write formats for Locked, DeviceName and FindMyPax. The app's guesses are marked experimental.
- Whether 0x31/0x32 indicate a newer key exchange on recent firmware.
