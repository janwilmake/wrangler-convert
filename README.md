Goal: wrangler-compatible workers augmentation

This is a CLI and library that allows easily converting a `wrangler.toml|json|jsonc` and `.dev.vars|.env` into a `metadata.json` file.

Usage

```
npx wrangler-convert
```

Sources used:

- https://unpkg.com/wrangler@latest/config-schema.json (Amazing!)
- https://oapis.org/openapi/cloudflare/worker-script-upload-worker-module
