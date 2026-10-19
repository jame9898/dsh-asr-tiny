/**
 * dsh-plugin-asr-zh-tiny — host half.
 *
 * Personal-accent voice data collector for the Moonshine fine-tuning loop:
 *   record -> local ASR -> correct -> save (WAV + text)
 *
 * The host half places the plugin in the host cordis tree so the client-modules
 * scanner discovers the `dsh.client` bundle. It can also bind the local ASR
 * service to the DSH lifecycle — but only when the plugin config opts in and
 * names the interpreter/entry script, because a third-party install cannot
 * assume anyone's local paths.
 *
 * Config (profile `cordis.patch.yml`):
 *   - id: dsh-plugin-asr-zh-tiny
 *     name: dsh-plugin-asr-zh-tiny
 *     config:
 *       asrBase: 'http://127.0.0.1:8000'   # optional, this is the default
 *       autoStart: true                    # default false
 *       pythonPath: 'D:\...\pythonw.exe'   # required for autoStart
 *       serverPath: 'D:\...\server.py'     # required for autoStart
 *       logDir: 'D:\...\asr_service'       # optional rotating log directory
 */
import { spawn } from 'node:child_process';
import { closeSync, openSync, renameSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { DEFAULT_ASR_BASE } from "./config.js";
export const name = 'dsh-plugin-asr-zh-tiny';
/** Rotate the service logs before they grow unbounded. */
const LOG_ROTATE_BYTES = 5 * 1024 * 1024;
let config = {
    asrBase: DEFAULT_ASR_BASE,
    autoStart: false,
    pythonPath: '',
    serverPath: '',
    logDir: '',
};
/** pid of the service this plugin started; undefined when another owner runs it. */
let ownedPid;
/** Set by the disposer so a late health check can never spawn after unload. */
let disposed = false;
function readConfig(raw) {
    const input = raw !== null && typeof raw === 'object' ? raw : {};
    const text = (key, fallback) => {
        const value = input[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
    };
    return {
        asrBase: text('asrBase', DEFAULT_ASR_BASE),
        autoStart: input['autoStart'] === true,
        pythonPath: text('pythonPath', ''),
        serverPath: text('serverPath', ''),
        logDir: text('logDir', ''),
    };
}
function info(ctx, message) {
    const line = `[dsh-plugin-asr-zh-tiny] ${message}`;
    try {
        const method = ctx.logger?.info?.bind(ctx.logger);
        if (typeof method === 'function')
            method(line);
        else
            console.log(line);
    }
    catch {
        console.log(line);
    }
}
/** Parsed ASR endpoint; invalid overrides fall back to the loopback default. */
function asrTarget() {
    try {
        const url = new URL(config.asrBase);
        const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
        if (!Number.isInteger(port) || port <= 0)
            throw new Error('bad port');
        return { host: url.hostname, port };
    }
    catch {
        const fallback = new URL(DEFAULT_ASR_BASE);
        return { host: fallback.hostname, port: Number(fallback.port) };
    }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Whether the service port already accepts connections (covers a still-loading service). */
function portOpen(host, port, timeoutMs) {
    return new Promise((resolve) => {
        const socket = createConnection({ host, port });
        const finish = (open) => {
            socket.destroy();
            resolve(open);
        };
        socket.setTimeout(timeoutMs, () => finish(false));
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
    });
}
/** Whether the local service is already running (or still loading its model). */
async function asrRunning() {
    const { host, port } = asrTarget();
    if (await portOpen(host, port, 800))
        return true;
    try {
        const response = await fetch(`${config.asrBase}/health`, { signal: AbortSignal.timeout(2500) });
        return response.ok;
    }
    catch {
        return false;
    }
}
function rotateLog(path) {
    try {
        if (statSync(path).size > LOG_ROTATE_BYTES)
            renameSync(path, `${path}.1`);
    }
    catch {
        /* missing or locked: keep appending */
    }
}
function openLog(path) {
    try {
        return openSync(path, 'a');
    }
    catch {
        return undefined;
    }
}
/** Start the service detached (survives a host crash) and windowless: pythonw
 * has no console at all, so no terminal window is left hanging on screen. */
function spawnAsr(ctx) {
    const stdout = config.logDir === '' ? undefined : join(config.logDir, 'server.log');
    const stderr = config.logDir === '' ? undefined : join(config.logDir, 'server_err.log');
    if (stdout !== undefined)
        rotateLog(stdout);
    if (stderr !== undefined)
        rotateLog(stderr);
    const out = stdout === undefined ? undefined : openLog(stdout);
    const err = stderr === undefined ? undefined : openLog(stderr);
    try {
        const child = spawn(config.pythonPath, [config.serverPath], {
            detached: true,
            windowsHide: true,
            stdio: ['ignore', out ?? 'ignore', err ?? 'ignore'],
        });
        child.on('error', (error) => info(ctx, `ASR service spawn failed: ${String(error)}`));
        child.unref();
        if (child.pid !== undefined) {
            ownedPid = child.pid;
            info(ctx, `ASR service starting (pid ${child.pid})`);
        }
        else {
            info(ctx, 'ASR service spawn returned no pid');
        }
    }
    catch (error) {
        info(ctx, `ASR service could not start: ${String(error)}`);
    }
    finally {
        if (out !== undefined)
            closeSync(out);
        if (err !== undefined)
            closeSync(err);
    }
}
function processAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/** Run taskkill for one pid (and its tree), resolving when it settles. */
function runTaskkill(pid, force) {
    return new Promise((resolve) => {
        const args = ['/PID', String(pid), '/T'];
        if (force)
            args.push('/F');
        let settled = false;
        const done = () => {
            if (settled)
                return;
            settled = true;
            resolve();
        };
        try {
            const child = spawn('taskkill', args, { windowsHide: true, stdio: 'ignore' });
            child.once('error', done);
            child.once('exit', done);
            const timer = setTimeout(done, 5000);
            timer.unref?.();
        }
        catch {
            done();
        }
    });
}
/**
 * Stop the service only when this plugin owns it; a pre-existing service is
 * untouched. The first attempt is graceful so an in-flight /samples write can
 * finish; pythonw has no window to receive it, so a forced kill follows shortly.
 */
async function stopOwnedAsr() {
    const pid = ownedPid;
    ownedPid = undefined;
    if (pid === undefined)
        return;
    if (process.platform !== 'win32') {
        try {
            process.kill(pid);
        }
        catch {
            /* already exited */
        }
        return;
    }
    await runTaskkill(pid, false);
    for (let i = 0; i < 4 && processAlive(pid); i++)
        await delay(200);
    if (processAlive(pid))
        await runTaskkill(pid, true);
}
export function apply(ctx, raw) {
    config = readConfig(raw);
    disposed = false;
    info(ctx, 'loaded');
    if (!config.autoStart) {
        info(ctx, 'ASR auto-start disabled (set autoStart/pythonPath/serverPath in the plugin config to enable)');
        return;
    }
    if (config.pythonPath === '' || config.serverPath === '') {
        info(ctx, 'ASR auto-start skipped: pythonPath and serverPath are required');
        return;
    }
    try {
        ctx.effect(() => () => {
            disposed = true;
            return stopOwnedAsr();
        }, 'dsh-plugin-asr-zh-tiny: ASR service lifecycle');
    }
    catch {
        /* host without effect support: leave the service independent */
    }
    void (async () => {
        if (await asrRunning()) {
            info(ctx, 'ASR service already running');
            return;
        }
        if (disposed)
            return;
        spawnAsr(ctx);
    })();
}
