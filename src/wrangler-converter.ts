export interface WranglerConfig {
  name?: string;
  main?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  routes?: (string | RouteObject)[];
  route?: string | RouteObject;
  vars?: Record<string, string | any>;
  kv_namespaces?: KVNamespace[];
  r2_buckets?: R2Bucket[];
  d1_databases?: D1Database[];
  durable_objects?: { bindings: DurableObjectBinding[] };
  services?: ServiceBinding[];
  analytics_engine_datasets?: AnalyticsEngineDataset[];
  queues?: { producers?: QueueProducer[]; consumers?: QueueConsumer[] };
  browser?: { binding: string };
  ai?: { binding: string; staging?: boolean };
  vectorize?: VectorizeIndex[];
  hyperdrive?: HyperdriveConfig[];
  mtls_certificates?: MTLSCertificate[];
  send_email?: EmailBinding[];
  assets?: AssetsConfig;
  observability?: ObservabilityConfig;
  placement?: PlacementConfig;
  logpush?: boolean;
  usage_model?: string;
  tail_consumers?: TailConsumer[];
  migrations?: MigrationConfig[];
  unsafe?: UnsafeConfig;
}

interface RouteObject {
  pattern: string;
  zone_id?: string;
  zone_name?: string;
  custom_domain?: boolean;
}

interface KVNamespace {
  binding: string;
  id?: string;
  preview_id?: string;
}

interface R2Bucket {
  binding: string;
  bucket_name?: string;
  preview_bucket_name?: string;
  jurisdiction?: string;
}

interface D1Database {
  binding: string;
  database_id?: string;
  database_name?: string;
  preview_database_id?: string;
}

interface DurableObjectBinding {
  name: string;
  class_name: string;
  script_name?: string;
  environment?: string;
}

interface ServiceBinding {
  binding: string;
  service: string;
  environment?: string;
  entrypoint?: string;
}

interface AnalyticsEngineDataset {
  binding: string;
  dataset?: string;
}

interface QueueProducer {
  binding: string;
  queue: string;
  delivery_delay?: number;
}

interface QueueConsumer {
  queue: string;
  max_batch_size?: number;
  max_batch_timeout?: number;
  max_retries?: number;
  dead_letter_queue?: string;
  max_concurrency?: number | null;
}

interface VectorizeIndex {
  binding: string;
  index_name: string;
}

interface HyperdriveConfig {
  binding: string;
  id: string;
  localConnectionString?: string;
}

interface MTLSCertificate {
  binding: string;
  certificate_id: string;
}

interface EmailBinding {
  name: string;
  destination_address?: string;
  allowed_destination_addresses?: string[];
}

interface AssetsConfig {
  directory?: string;
  binding?: string;
  html_handling?: string;
  not_found_handling?: string;
  run_worker_first?: string[] | boolean;
}

interface ObservabilityConfig {
  enabled?: boolean;
  head_sampling_rate?: number;
  logs?: {
    enabled?: boolean;
    head_sampling_rate?: number;
    invocation_logs?: boolean;
  };
}

interface PlacementConfig {
  mode?: string;
  hint?: string;
}

interface TailConsumer {
  service: string;
  environment?: string;
  namespace?: string;
}

interface MigrationConfig {
  tag: string;
  new_classes?: string[];
  new_sqlite_classes?: string[];
  renamed_classes?: Array<{ from: string; to: string }>;
  deleted_classes?: string[];
}

interface UnsafeConfig {
  bindings?: Array<{ name: string; type: string; [key: string]: any }>;
  metadata?: Record<string, any>;
}

export interface WorkerMetadata {
  migrations?: {
    old_tag: string | undefined;
    new_tag: string;
    steps: MigrationConfig[];
  };
  main_module?: string;
  body_part?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  bindings?: any[];
  observability?: ObservabilityConfig;
  placement?: PlacementConfig;
  logpush?: boolean;
  usage_model?: string;
  tail_consumers?: TailConsumer[];
  keep_assets?: boolean;
  assets?: {
    jwt?: string;
    config?: {
      html_handling?: string;
      not_found_handling?: string;
      run_worker_first?: string[] | boolean;
    };
  };
}

export interface ConversionResult {
  metadata: WorkerMetadata;
  routes: Array<{
    pattern: string;
    zone_id?: string;
    script?: string;
  }>;
  /** NB: this still must be converted to get something in shape of {old_tag,new_tag,steps} */
  migrations: MigrationConfig[] | undefined;
  scriptName: string;
  mainModule?: string;
}

/**
 * @param config
 * @param env your environment variables needed
 * @param migration_tag latest migration tag applied to the worker; can be found using  https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/versions/${latestVersionId}
 * @returns
 */
export function convertWranglerToWorkerConfig(
  config: WranglerConfig,
  env: Record<string, string> = {},
  migration_tag: string | undefined
): ConversionResult {
  const bindings: any[] = [];
  const routes: Array<{ pattern: string; zone_id?: string; script?: string }> =
    [];

  // Convert environment variables (prioritize .env over config.vars)
  const allVars = { ...config.vars, ...env };

  if (allVars) {
    const varKeys = Object.keys(allVars);
    let i = 0;
    while (i < varKeys.length) {
      const key = varKeys[i];
      const value = allVars[key];

      if (typeof value === "string") {
        bindings.push({
          name: key,
          type: "plain_text",
          text: value,
        });
      } else {
        bindings.push({
          name: key,
          type: "json",
          json: JSON.stringify(value),
        });
      }
      i++;
    }
  }
  // Convert KV namespaces
  if (config.kv_namespaces) {
    let i = 0;
    while (i < config.kv_namespaces.length) {
      const kv = config.kv_namespaces[i];
      bindings.push({
        name: kv.binding,
        type: "kv_namespace",
        namespace_id: kv.id,
      });
      i++;
    }
  }

  // Convert R2 buckets
  if (config.r2_buckets) {
    let i = 0;
    while (i < config.r2_buckets.length) {
      const r2 = config.r2_buckets[i];
      bindings.push({
        name: r2.binding,
        type: "r2_bucket",
        bucket_name: r2.bucket_name,
      });
      i++;
    }
  }

  // Convert D1 databases
  if (config.d1_databases) {
    let i = 0;
    while (i < config.d1_databases.length) {
      const d1 = config.d1_databases[i];
      bindings.push({
        name: d1.binding,
        type: "d1",
        id: d1.database_id,
      });
      i++;
    }
  }

  // Convert Durable Objects
  if (config.durable_objects?.bindings) {
    let i = 0;
    while (i < config.durable_objects.bindings.length) {
      const durable = config.durable_objects.bindings[i];
      bindings.push({
        name: durable.name,
        type: "durable_object_namespace",
        class_name: durable.class_name,
        script_name: durable.script_name,
        environment: durable.environment,
      });
      i++;
    }
  }

  // Convert Services
  if (config.services) {
    let i = 0;
    while (i < config.services.length) {
      const service = config.services[i];
      bindings.push({
        name: service.binding,
        type: "service",
        service: service.service,
        environment: service.environment,
      });
      i++;
    }
  }

  // Convert Analytics Engine
  if (config.analytics_engine_datasets) {
    let i = 0;
    while (i < config.analytics_engine_datasets.length) {
      const analytics = config.analytics_engine_datasets[i];
      bindings.push({
        name: analytics.binding,
        type: "analytics_engine",
        dataset: analytics.dataset,
      });
      i++;
    }
  }

  // Convert Queue producers
  if (config.queues?.producers) {
    let i = 0;
    while (i < config.queues.producers.length) {
      const queue = config.queues.producers[i];
      bindings.push({
        name: queue.binding,
        type: "queue",
        queue_name: queue.queue,
      });
      i++;
    }
  }

  // Convert Browser
  if (config.browser) {
    bindings.push({
      name: config.browser.binding,
      type: "browser",
    });
  }

  // Convert AI
  if (config.ai) {
    bindings.push({
      name: config.ai.binding,
      type: "ai",
    });
  }

  // Convert Vectorize
  if (config.vectorize) {
    let i = 0;
    while (i < config.vectorize.length) {
      const vectorize = config.vectorize[i];
      bindings.push({
        name: vectorize.binding,
        type: "vectorize",
        index_name: vectorize.index_name,
      });
      i++;
    }
  }

  // Convert Hyperdrive
  if (config.hyperdrive) {
    let i = 0;
    while (i < config.hyperdrive.length) {
      const hyperdrive = config.hyperdrive[i];
      bindings.push({
        name: hyperdrive.binding,
        type: "hyperdrive",
        id: hyperdrive.id,
      });
      i++;
    }
  }

  // Convert mTLS certificates
  if (config.mtls_certificates) {
    let i = 0;
    while (i < config.mtls_certificates.length) {
      const mtls = config.mtls_certificates[i];
      bindings.push({
        name: mtls.binding,
        type: "mtls_certificate",
        certificate_id: mtls.certificate_id,
      });
      i++;
    }
  }

  // Convert Send Email
  if (config.send_email) {
    let i = 0;
    while (i < config.send_email.length) {
      const email = config.send_email[i];
      bindings.push({
        name: email.name,
        type: "send_email",
        destination_address: email.destination_address,
        allowed_destination_addresses: email.allowed_destination_addresses,
      });
      i++;
    }
  }

  // Convert Unsafe bindings
  if (config.unsafe?.bindings) {
    let i = 0;
    while (i < config.unsafe.bindings.length) {
      const unsafe = config.unsafe.bindings[i];
      bindings.push(unsafe);
      i++;
    }
  }

  // Convert routes
  const allRoutes: (string | RouteObject)[] = [];

  if (config.routes) {
    let i = 0;
    while (i < config.routes.length) {
      allRoutes.push(config.routes[i]);
      i++;
    }
  }

  if (config.route) {
    allRoutes.push(config.route);
  }

  let i = 0;
  while (i < allRoutes.length) {
    const route = allRoutes[i];
    if (typeof route === "string") {
      routes.push({
        pattern: route,
        script: config.name,
      });
    } else {
      routes.push({
        pattern: route.pattern,
        zone_id: route.zone_id,
        script: config.name,
      });
    }
    i++;
  }

  const migrations =
    config.migrations && config.migrations.length > 0
      ? {
          old_tag: migration_tag,
          new_tag: config.migrations[config.migrations.length - 1]?.tag,
          steps: config.migrations.filter((item) =>
            !migration_tag ? true : item.tag > migration_tag
          ),
        }
      : undefined;

  // Build metadata
  const metadata: WorkerMetadata = {
    migrations,
    compatibility_date: config.compatibility_date,
    compatibility_flags: config.compatibility_flags,
    bindings: bindings.length > 0 ? bindings : undefined,
    observability: config.observability,
    placement: config.placement,
    logpush: config.logpush,
    usage_model: config.usage_model,
    tail_consumers: config.tail_consumers,
  };

  // Determine if it's a module or service worker
  if (config.main) {
    metadata.main_module = config.main;
  }

  // Convert assets
  if (config.assets) {
    metadata.assets = {
      config: {
        html_handling: config.assets.html_handling,
        not_found_handling: config.assets.not_found_handling,
        run_worker_first: config.assets.run_worker_first,
      },
    };
  }

  return {
    metadata,
    migrations: config.migrations,

    routes,
    scriptName: config.name || "worker",
    mainModule: config.main,
  };
}
