<p align="center">
  <img src="./assets/logo.svg" width="240" alt="Cascade" />
</p>

<p align="center">
  <strong>Self-hosted VPN router, managed from one browser tab.</strong><br/>
  WireGuard &amp; AmneziaWG — tunnels, peers, policy routing, firewall, NAT and TLS
  in a single Go binary.
</p>

<p align="center">
  <a href="README.ru.md">Русский</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="#credits">Credits</a> ·
  <a href="README.upstream.md">Original documentation</a>
</p>

---

## What this project is

This is a build of **Cascade** maintained by us. Cascade itself is a self-hosted
control panel for WireGuard and AmneziaWG: it creates the tunnels, hands out
client configurations, routes traffic by domain or country, and manages the
firewall and TLS in one place.

We ship it with a complete **Russian interface**, a set of **client-routing
corrections**, and some **alias tooling** that makes country-sized routing rules
practical. The engine is unchanged — this is the same Cascade, with the rough
edges we hit in production filed down.

## What we changed

### Russian interface

The whole admin panel is translated — every screen, every string, 1 427 message
keys across 46 files. It is proper i18n rather than text substitution: keys live
in `internal/frontend/i18n/messages.{en,ru}.json`, are merged into a generated
catalogue, and anything missing falls back to English. Backend error messages go
through the same catalogue, so validation errors appear in Russian too.

### Client routing corrections

Three defects made generated client configurations quietly wrong. Each one was
found by measurement, not guesswork.

**Critical services no longer pushed outside the tunnel.** A country-sized alias
produces far too many routes to hand to a phone, so prefixes are rounded outward
to `/16`. Rounding cannot tell "Russian" from "next door to Russian": for RU it
captured all nine of Telegram's published IPv4 ranges and Meta's — none of which
are Russian — so those services went direct and stalled on networks that throttle
them. Prefixes that would round onto a protected range are now left exact. Cost
on the real RU list: 2 053 → 2 101 routes, and all twelve protected ranges stay
inside the tunnel.

Rounding is deliberate. Summarising the complement instead would put the error
in the harmless direction, but measurement rules it out: Russian space is too
fragmented, and shrinking the list that way pulls 61 % of Russian addresses back
into the tunnel at a 1 % threshold and 100 % at 2 %.

**IPv6 is captured rather than leaked.** The exit carries IPv4 only. Sending
`::/0` anyway makes the client route IPv6 into a tunnel that cannot carry it, so
apps fall back to IPv4 and everything foreign goes through the VPN. Dropping
`::/0` instead leaks IPv6 straight to the local ISP, where Google's services are
throttled — YouTube stalls, Gemini reports no connectivity, and the system
connectivity probe fails while IPv4 works fine. Capturing is the lesser evil.

**The client MTU defaults to 1280** instead of trusting a 1500-byte path.
Measured with DF-set pings against live clients: a laptop carried 1500-byte outer
packets, confirming the 80-byte overhead, while a phone carried only 1360. With
an unset MTU the client picks 1420 and emits exactly 1500 — WireGuard sets DF, so
every oversized packet was dropped: small requests worked, large transfers and
calls did not. 1280 is the IPv6 minimum and the largest value that fits every
path we measured.

### Alias tooling

- **Precision selector** in the alias create and edit forms (exact, `/18`, `/16`,
  `/14`), so a country-sized exclusion can be made usable in one place.
- **Route preview** — `GET /api/aliases/:id/client-routes` reports how many routes
  and bytes a client would actually receive, shown live as the precision changes.
- **One-click refresh** in the aliases table, re-fetching a generated list from
  RIPEstat without opening the edit form.

### Container metadata

Images now declare their own OCI labels. As a thin layer on top of another
Cascade image they used to inherit that image's `source` and `version`, so a
published package could never attach to this repository.

## Quick start

```bash
git clone https://github.com/smm959/cascade
cd cascade
docker build -t cascade .
```

Then run it with a data volume — the panel, its SQLite database and generated
tunnel configurations live there:

```bash
docker run -d --name cascade \
  --cap-add NET_ADMIN --cap-add SYS_MODULE \
  --sysctl net.ipv4.ip_forward=1 \
  -p 8080:8080 \
  -v /opt/cascade/data:/etc/wireguard/data \
  cascade
```

Open `http://<host>:8080`, complete the first-run wizard, and Cascade creates the
first tunnel interface for you.

Detailed deployment, reverse proxy with TLS, and the API reference are in
[`docs/`](docs/) — those documents come from the upstream project and remain
accurate.

## Things worth knowing

- **AmneziaWG obfuscation parameters are symmetric.** `ContentPaddingAddition`,
  `RandomTrailers`, `Jc`, `S1-S4` and `H1-H4` must match between server and
  client. Changing them on the server alone disconnects every client that has not
  re-imported its configuration — we learned this the hard way. Treat a change
  here as a coordinated operation across all devices, not a live tweak.
- **IPv6 does not work through the tunnel.** The client routes it in and it
  expires there. This is a deliberate trade-off, explained above.
- **Re-importing a client configuration only changes the MTU.** If a device works
  well, leave it alone: 1420 is faster on a 1500-byte path, and 1280 only helps
  where the path is smaller.

## Credits

This project stands on other people's work, and none of it is ours to claim:

- **[JohnnyVBut](https://github.com/JohnnyVBut/cascade)** — the original Cascade
  project.
- **[Alex Nikonov](https://github.com/alexnikon)** — the upstream Cascade this
  build is based on, and the MIT copyright holder.
- **[AmneziaWG](https://github.com/amnezia-vpn)** — the protocol and clients this
  runs on.

Our additions are the Russian interface, the routing corrections and the alias
tooling described above.

## License

MIT, as inherited. The original copyright notice is preserved in
[`LICENSE`](LICENSE); see also [`NOTICE`](NOTICE) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
