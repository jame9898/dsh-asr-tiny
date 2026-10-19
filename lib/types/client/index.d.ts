/**
 * dsh-plugin-asr-zh-tiny — client half.
 *
 * A full "record -> recognize -> correct -> save" panel injected into the
 * conversation composer tool row, plus a settings card (plugin page) that
 * points the browser half at the local ASR service. Audio never leaves the
 * machine: recording happens in-browser, recognition runs on the local ASR
 * service, and corrected samples are saved to the local training dataset.
 */
import type { Context } from './context-types.ts';
export declare const name = "dsh-plugin-asr-zh-tiny-client";
export declare const inject: string[];
export declare const LOCALE_NS = "voice.collector";
/** The bundle this package's client half belongs to (plugin-manager settings key). */
export declare const BUNDLE_NAME = "dsh-plugin-asr-zh-tiny";
export declare function apply(ctx: Context): void;
