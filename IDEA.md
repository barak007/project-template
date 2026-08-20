import axios from 'axios';

// ============================================================================
// 1. CONFIGURATION & TYPES
// ============================================================================

interface TargetConfig {
url: string;
}

const CONFIG: Record<'local' | 'cloud', TargetConfig> = {
local: {
url: 'http://localhost:2375',
},
cloud: {
url: 'http://YOUR_CLOUD_VM_IP:2375', // Replace with your real cloud IP
},
};

// Podman API specification payload structure
interface MachineSpec {
image: string;
command: string[];
netns: {
ns_mode: 'bridge' | 'host' | 'none';
};
resource_limits?: {
cpus?: number;
memory?: number; // In bytes
};
}

interface CreateResponse {
Id: string;
}

// ============================================================================
// 2. FACADE ENGINE ENGINE
// ============================================================================

/**

- Provisions an isolated container session using Podman's REST API.
- The payload remains exactly identical whether targeting local or cloud engines.
  */
  async function createSession(target: 'local' | 'cloud', sessionId: string): Promise<string | null> {
  const baseConfig = CONFIG[target];
  if (!baseConfig) {
  console.error(`❌ Unknown target: ${target}`);
  return null;
  }

const baseUrl = baseConfig.url;
console.log(`\n🚀 Connecting to ${target.toUpperCase()} engine at ${baseUrl}...`);

// Define the isolated container specs
const machineSpec: MachineSpec = {
image: 'docker.io/library/ubuntu:latest',
command: ['/bin/bash', '-c', "echo 'Hello from inside your dynamic session!'; sleep 3600"],
netns: {
ns_mode: 'bridge', // Networks are fully isolated
},
resource_limits: {
cpus: 2,
memory: 2 * 1024 * 1024 * 1024, // 2GB limit in bytes
},
};

try {
// Step 1: Provision the machine on the engine
const createUrl = `${baseUrl}/v4.0.0/libpod/containers/create?name=${sessionId}`;
const createResponse = await axios.post<CreateResponse>(createUrl, machineSpec, { timeout: 10000 });
const containerId = createResponse.data.Id;
console.log(`✅ Machine provisioned successfully! Short ID: ${containerId.substring(0, 12)}`);

    // Step 2: Start the provisioned machine to execute code
    const startUrl = `${baseUrl}/v4.0.0/libpod/containers/${containerId}/start`;
    await axios.post(startUrl, {}, { timeout: 10000 });
    console.log(`⚡ Machine booted up! Session execution code is running.`);

    return containerId;

} catch (error: any) {
console.error(`❌ Failed to spin up machine on ${target.toUpperCase()}:`, error.message);
return null;
}
}

// ============================================================================
// 3. EXECUTION FLOW (Example Usage)
// ============================================================================

async function runTestPipeline() {
const uniqueSessionId = `user-session-${Date.now()}`;

// Execute Local Option
await createSession('local', `${uniqueSessionId}-local`);

// Execute Cloud Option (Uncomment below once cloud IP is configured)
// await createSession('cloud', `${uniqueSessionId}-cloud`);
}

runTestPipeline();
