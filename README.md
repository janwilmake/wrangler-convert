Goal: wrangler-compatible workers augmentation

# Wrangler Config Converter

This is a CLI and library that allows easily converting a `wrangler.toml|json|jsonc` and `.dev.vars|.env` into a `metadata.json` file.

A utility function to convert Cloudflare Wrangler configuration files (`wrangler.toml`) into the format expected by the Cloudflare Workers API.

Sources used:

- https://unpkg.com/wrangler@latest/config-schema.json (Amazing!)
- https://oapis.org/openapi/cloudflare/worker-script-upload-worker-module

# Limitations

- Does not take into account environment. Normally workers can have `env: { staging, ... }` but this is now completely ignored
- Does not take into account that .ts files need to be built into a .js first before upload.
- See considerations for additional things that need to be done before worker script upload

## Installation

```bash
npm install wrangler-convert
```

## Usage

### Basic Usage

```typescript
import { convertWranglerToWorkerConfig } from "wrangler-convert";

const wranglerConfig = {
  name: "my-worker",
  main: "src/index.js",
  compatibility_date: "2023-10-01",
  vars: {
    API_URL: "https://api.example.com",
    DEBUG: "true",
  },
  kv_namespaces: [
    {
      binding: "MY_KV",
      id: "your-kv-namespace-id",
    },
  ],
};

const result = convertWranglerToWorkerConfig(wranglerConfig);
console.log(result);
```

### With Environment Variables

You can also pass environment variables that will override config variables:

```typescript
import { convertWranglerToWorkerConfig } from "wrangler-convert";

const wranglerConfig = {
  name: "my-worker",
  main: "src/index.js",
  vars: {
    API_URL: "https://api.example.com",
  },
};

const envVars = {
  API_URL: "https://api.production.com", // This will override the config value
  SECRET_KEY: "prod-secret-123",
};

const result = convertWranglerToWorkerConfig(wranglerConfig, envVars);
```

### Complete Example

```typescript
import { convertWranglerToWorkerConfig } from "wrangler-convert";

const wranglerConfig = {
  name: "my-full-worker",
  main: "src/index.js",
  compatibility_date: "2023-10-01",
  compatibility_flags: ["nodejs_compat"],

  // Variables
  vars: {
    API_URL: "https://api.example.com",
    DEBUG: "false",
    CONFIG_OBJECT: { nested: "value" },
  },

  // KV Namespaces
  kv_namespaces: [
    {
      binding: "MY_KV",
      id: "kv-namespace-id",
      preview_id: "preview-kv-id",
    },
  ],

  // R2 Buckets
  r2_buckets: [
    {
      binding: "MY_BUCKET",
      bucket_name: "my-r2-bucket",
    },
  ],

  // D1 Databases
  d1_databases: [
    {
      binding: "DB",
      database_id: "d1-database-id",
    },
  ],

  // Durable Objects
  durable_objects: {
    bindings: [
      {
        name: "CHAT_ROOM",
        class_name: "ChatRoom",
        script_name: "chat-worker",
      },
    ],
  },

  // Services
  services: [
    {
      binding: "AUTH_SERVICE",
      service: "auth-worker",
      environment: "production",
    },
  ],

  // Routes
  routes: [
    "example.com/*",
    {
      pattern: "api.example.com/*",
      zone_id: "your-zone-id",
    },
  ],

  // AI Binding
  ai: {
    binding: "AI",
  },

  // Analytics Engine
  analytics_engine_datasets: [
    {
      binding: "ANALYTICS",
      dataset: "my-dataset",
    },
  ],

  // Queue Producers
  queues: {
    producers: [
      {
        binding: "MY_QUEUE",
        queue: "my-queue-name",
      },
    ],
  },

  // Assets
  assets: {
    directory: "dist",
    binding: "ASSETS",
    html_handling: "auto-trailing-slash",
  },
};

const result = convertWranglerToWorkerConfig(wranglerConfig);

// Result contains:
// - metadata: Worker metadata for API deployment
// - routes: Array of route configurations
// - scriptName: The worker's name
// - mainModule: The main module file (if module worker)
```

## API Reference

### `convertWranglerToWorkerConfig(config, env?)`

Converts a Wrangler configuration object to Worker API format.

#### Parameters

- `config` (WranglerConfig): The Wrangler configuration object
- `env` (Record<string, string>, optional): Environment variables that override config vars

#### Returns

Returns a `ConversionResult` object with the following properties:

- `metadata`: Worker metadata object for API deployment
- `routes`: Array of route configurations
- `scriptName`: The worker's script name
- `mainModule`: The main module file path (for module workers)

### Supported Configuration Options

The converter supports all major Wrangler configuration options:

- **Basic Config**: `name`, `main`, `compatibility_date`, `compatibility_flags`
- **Variables**: `vars` (supports strings, numbers, objects)
- **Storage**: `kv_namespaces`, `r2_buckets`, `d1_databases`
- **Compute**: `durable_objects`, `services`, `ai`, `browser`
- **Networking**: `routes`, `route`
- **Observability**: `analytics_engine_datasets`, `observability`, `logpush`
- **Advanced**: `queues`, `vectorize`, `hyperdrive`, `mtls_certificates`
- **Assets**: `assets` configuration for static assets
- **Unsafe**: `unsafe.bindings` for custom binding types

### Example Output

```typescript
{
  metadata: {
    main_module: "src/index.js",
    compatibility_date: "2023-10-01",
    compatibility_flags: ["nodejs_compat"],
    bindings: [
      {
        name: "API_URL",
        type: "plain_text",
        text: "https://api.example.com"
      },
      {
        name: "MY_KV",
        type: "kv_namespace",
        namespace_id: "kv-namespace-id"
      }
      // ... more bindings
    ]
  },
  routes: [
    {
      pattern: "example.com/*",
      script: "my-worker"
    }
  ],
  scriptName: "my-worker",
  mainModule: "src/index.js"
}
```

# Considerations

## Files that can be part of a Worker script

The multipart upload accepts these content types:

- `application/javascript+module` / `text/javascript+module` - ES modules
- `application/javascript` / `text/javascript` - Regular JS files
- `application/wasm` - WebAssembly modules
- `text/plain` - Text files
- `application/octet-stream` - Binary files
- `application/source-map` - Source maps

## JWT, \_headers, and \_redirects placement

Since you already have the JWT from the asset upload service, here's where each goes:

```json path="metadata-structure.json"
{
  "metadata": {
    "main_module": "worker.js",
    "compatibility_date": "2023-10-01",
    "assets": {
      "jwt": "your-jwt-from-asset-service",
      "config": {
        "_headers": "# Headers file content\n/dashboard/*\nX-Frame-Options: DENY\n\n/static/*\nAccess-Control-Allow-Origin: *",
        "_redirects": "# Redirects file content\n/foo /bar 301\n/news/* /blog/:splat",
        "html_handling": "auto-trailing-slash",
        "not_found_handling": "404-page",
        "run_worker_first": ["/api/*", "/oauth/callback", "!/api/assets/*"]
      }
    },
    "bindings": [
      // ... your converted bindings
    ]
  }
}
```
