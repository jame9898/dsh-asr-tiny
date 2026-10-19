/**
 * Browser audio helpers: decode a MediaRecorder blob into 16 kHz mono PCM,
 * merge dictated segments without repeated whole-buffer copies, and encode the
 * PCM the training pipeline expects.
 */
/** The training pipeline (finetune-moonshine-asr) strictly requires 16 kHz mono WAV. */
export declare const TARGET_SAMPLE_RATE = 16000;
/** Silence inserted between separately dictated segments so the merged sample stays intelligible. */
export declare const SEGMENT_GAP_S = 0.2;
/** Decode a recorded blob into 16 kHz mono PCM (the training pipeline's format). */
export declare function blobToPcm(blob: Blob): Promise<Float32Array<ArrayBuffer>>;
/**
 * Merge dictated segments into one track, inserting a short silence between
 * them. Keeping the segments as chunks until save avoids re-copying the whole
 * accumulated buffer after every segment.
 */
export declare function mergePcm(chunks: Float32Array<ArrayBuffer>[]): Float32Array<ArrayBuffer>;
/** Encode 16-bit PCM as a WAV blob. */
export declare function encodeWav(samples: Float32Array<ArrayBuffer>, sampleRate: number): Blob;
