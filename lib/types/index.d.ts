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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-plugin-asr-zh-tiny";
/** Plugin config surface (unvalidated pass-through; see the header example). */
export interface CollectorConfig {
    /** Base URL of the local ASR service. */
    asrBase?: string;
    /** Start the service with DSH. Off by default for third-party installs. */
    autoStart?: boolean;
    /** Python interpreter that launches the service (a venv `pythonw.exe` avoids consoles). */
    pythonPath?: string;
    /** Service entry script. */
    serverPath?: string;
    /** Directory for rotated stdout/stderr logs; omit to discard output. */
    logDir?: string;
}
export declare function apply(ctx: Context, raw?: unknown): void;
