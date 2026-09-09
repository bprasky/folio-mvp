import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JOB_MS, OUTPUT_BYTES, RenderError, networkPolicy, validateResult, publicIPv4 } from './policy.mjs';

export function command(program, args, { input = '', timeout = 10000, maxBytes = 1024 * 1024 } = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(program, args, { shell: false, env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', HOME: '/root' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0; let error;
    const timer = setTimeout(() => { error = new RenderError('navigation_timeout'); child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { error = new RenderError('oversized_response'); child.kill('SIGKILL'); }
      else chunks.push(chunk);
    });
    child.stderr.resume(); // Never collect untrusted browser HTML/URLs/host diagnostics.
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); fail(new RenderError('isolation_setup_failure')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (error) fail(error); else ok({ code, text: Buffer.concat(chunks).toString('utf8') });
    });
    child.stdin.end(input);
  });
}
const dockerPrefix = ['--host', 'unix:///var/run/docker.sock'];
export function jobArgs(config, name) {
  return [...dockerPrefix, 'create', '--name', name, '--label', 'folio.render.job=1',
    '--network', 'folio-render', '--user', '1000:1000', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges=true', '--security-opt', `seccomp=${config.seccomp}`,
    '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777',
    '--shm-size', '64m', '--cpus', '1', '--memory', '768m', '--memory-swap', '768m', '--pids-limit', '192',
    '--ulimit', 'nofile=1024:1024', '--log-driver', 'none', '--restart', 'no',
    '--sysctl', 'net.ipv6.conf.all.disable_ipv6=1', '--sysctl', 'net.ipv6.conf.default.disable_ipv6=1',
    '--mount', `type=bind,src=${config.resolv},dst=/etc/resolv.conf,readonly`, config.image];
}
function fingerprint(text) {
  const data = JSON.parse(text);
  // Counter values change while rendering. Everything else must be unchanged.
  return createHash('sha256').update(JSON.stringify(data, (key, value) => ['packets', 'bytes', 'handle'].includes(key) ? undefined : value)).digest('hex');
}
export class Isolation {
  constructor(config, run = command) { this.config = config; this.run = run; this.healthy = false; }
  async checked(program, args, options) {
    const remaining = this.deadline ? this.deadline - Date.now() : 10000;
    if (remaining <= 0) throw new RenderError('navigation_timeout');
    const res = await this.run(program, args, { ...options, timeout: Math.min(options?.timeout || 10000, remaining) });
    if (res.code !== 0) throw new RenderError('isolation_setup_failure');
    return res.text;
  }
  docker(args, opts) { return this.checked('docker', [...dockerPrefix, ...args], opts); }
  ns(pid, args, opts) { return this.checked('nsenter', ['-t', String(pid), '-n', '--', 'nft', ...args], opts); }
  async initialize() {
    if (process.platform !== 'linux' || process.getuid?.() !== 0) throw new RenderError('isolation_setup_failure');
    const c = this.config;
    if (!/^sha256:[a-f0-9]{64}$/.test(c.image) || !publicIPv4(c.dns)) throw new RenderError('isolation_setup_failure');
    await readFile(c.seccomp); // Missing reviewed profile is fatal; never use unconfined.
    await this.docker(['image', 'inspect', c.image]);
    // Crash recovery: this service owns all jobs carrying this label on a dedicated host.
    const old = await this.docker(['ps', '-aq', '--filter', 'label=folio.render.job=1']);
    for (const id of old.trim().split(/\s+/).filter(Boolean)) {
      if (!/^[a-f0-9]{12,64}$/.test(id)) throw new RenderError('isolation_setup_failure');
      await this.docker(['rm', '-f', id]);
    }
    const networks = await this.docker(['network', 'ls', '--filter', 'name=^folio-render$', '--format', '{{.Name}}']);
    if (!networks.trim()) await this.docker(['network', 'create', '--driver', 'bridge', '--subnet', '10.203.0.0/24', '--opt', 'com.docker.network.bridge.name=br-folio-render', '--opt', 'com.docker.network.bridge.enable_icc=false', 'folio-render']);
    const [net] = JSON.parse(await this.docker(['network', 'inspect', 'folio-render']));
    if (net.Driver !== 'bridge' || net.EnableIPv6 || net.Options?.['com.docker.network.bridge.name'] !== 'br-folio-render' || net.Options?.['com.docker.network.bridge.enable_icc'] !== 'false' || net.IPAM?.Config?.length !== 1 || net.IPAM.Config[0].Subnet !== '10.203.0.0/24' || net.IPAM.Config[0].Gateway !== '10.203.0.1') throw new RenderError('isolation_setup_failure');
    const addresses = JSON.parse(await this.checked('ip', ['-j', '-4', 'address', 'show']));
    c.blocked = [...new Set([...c.blocked, ...addresses.flatMap(a => a.addr_info.map(i => i.local)), ...net.IPAM.Config.map(i => i.Gateway).filter(Boolean)])];
    if (c.blocked.includes(c.dns)) throw new RenderError('isolation_setup_failure');
    await mkdir(resolve(c.resolv, '..'), { recursive: true, mode: 0o755 });
    await writeFile(c.resolv, `nameserver ${c.dns}\noptions timeout:2 attempts:1\n`, { mode: 0o644 });
    await chmod(c.resolv, 0o644); // DNS address only; readable by UID 1000 despite service UMask.
    const table = await this.run('nft', ['list', 'table', 'inet', 'folio_render']);
    const rules = (table.code === 0 ? 'delete table inet folio_render\n' : '') + networkPolicy({ ...c, host: true });
    await this.checked('nft', ['-c', '-f', '-'], { input: rules });
    await this.checked('nft', ['-f', '-'], { input: rules }); // Atomic transaction; never flush other tables.
    this.hostFingerprint = fingerprint(await this.checked('nft', ['-j', 'list', 'table', 'inet', 'folio_render']));
    this.healthy = true;
  }
  async verifyHost() {
    if (!this.healthy || fingerprint(await this.checked('nft', ['-j', 'list', 'table', 'inet', 'folio_render'])) !== this.hostFingerprint) {
      this.healthy = false; throw new RenderError('isolation_setup_failure');
    }
  }
  async createJob() {
    await this.verifyHost();
    const name = `folio-render-${randomUUID()}`;
    try {
      await this.checked('docker', jobArgs(this.config, name));
      await this.docker(['start', name]);
      const [state] = JSON.parse(await this.docker(['inspect', name]));
      const pid = state.State?.Pid;
      if (!state.State?.Running || !Number.isSafeInteger(pid) || pid <= 1) throw new RenderError('isolation_setup_failure');
      const policy = networkPolicy(this.config);
      await this.ns(pid, ['-c', '-f', '-'], { input: policy });
      await this.ns(pid, ['-f', '-'], { input: policy });
      const snapshot = await this.ns(pid, ['-j', 'list', 'table', 'inet', 'folio_render']);
      const chains = JSON.parse(snapshot).nftables.filter(x => x.chain).map(x => x.chain);
      if (!chains.some(c => c.hook === 'output' && c.policy === 'drop') || !chains.some(c => c.hook === 'input' && c.policy === 'drop')) throw new RenderError('isolation_setup_failure');
      await this.verifyHost();
      return { name, pid, fingerprint: fingerprint(snapshot) };
    } catch {
      await this.destroy(name);
      throw new RenderError('isolation_setup_failure');
    }
  }
  async destroy(name) {
    // A failed cleanup closes admission until process restart/recovery.
    try {
      const result = await this.run('docker', [...dockerPrefix, 'rm', '-f', name], { timeout: 10000 });
      if (result.code) throw Error();
    }
    catch { this.healthy = false; throw new RenderError('isolation_setup_failure'); }
  }
  async runJob(job, url) {
    await this.verifyHost();
    const before = await this.ns(job.pid, ['-j', 'list', 'table', 'inet', 'folio_render']);
    if (fingerprint(before) !== job.fingerprint) throw new RenderError('isolation_setup_failure');
    const remaining = this.deadline ? this.deadline - Date.now() : JOB_MS;
    if (remaining <= 0) throw new RenderError('navigation_timeout');
    const output = await this.run('docker', [...dockerPrefix, 'exec', '-i', '--user', '1000:1000', job.name, 'node', '/worker/job.mjs'], { input: JSON.stringify({ url }), timeout: Math.min(JOB_MS, remaining), maxBytes: OUTPUT_BYTES });
    let result;
    try { result = JSON.parse(output.text); } catch { throw new RenderError('internal_worker_error'); }
    if (output.code || result.error) throw new RenderError(result.error || 'internal_worker_error');
    return validateResult(result);
  }
  async render(url) {
    this.deadline = Date.now() + 55000;
    try {
      const job = await this.createJob();
      try { return await this.runJob(job, url); }
      finally { await this.destroy(job.name); }
    } finally { this.deadline = null; }
  }
}
