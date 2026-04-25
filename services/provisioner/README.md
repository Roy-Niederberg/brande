# Provisioner

Thin HTTP service that handles new client creation requests. Runs on each **client VM**.

Validates the request then delegates all filesystem and Docker work to the
conductor via Unix socket. See `services/conductor/README.md` for the conductor.

## Endpoint

`POST /scaffold` — authenticated via `X-Provision-Secret` header.

```json
{ "subdomain": "myclient", "tier": 1 }
```

| Response | Meaning                        |
|----------|--------------------------------|
| 200      | Client created and healthy     |
| 400      | Missing subdomain or tier      |
| 403      | Wrong secret                   |
| 409      | Subdomain already exists       |
| 507      | VM budget exceeded             |

Routed via the clients router Caddyfile: `/scaffold` → `provisioner:4321`.

## Tests

```sh
cd services/provisioner/test && bash test.sh
```

Spins up the provisioner + a mock conductor, runs all cases, tears down.
