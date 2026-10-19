import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Composer input action surface (injected by the standard kit). */
export interface VoiceInputActions {
    setDraft(text: string): void;
}
/** 会话输入状态（slot 标准 seat 中我们读取的子集）。 */
export interface ComposerInputState {
    readonly draft: string;
}
export type CollectorButtonProps = {
    inputActions: VoiceInputActions;
    /**
     * 会话输入选择器 Hook。由 conversation slot host 通过 uiSession.provide 的
     * 标准 seat 注入（0.1 与 0.2 均提供），这里无条件调用以满足 hooks 规则。
     */
    useInput: <T>(selector: (state: ComposerInputState) => T) => T | undefined;
} & PropsLocale<'voice.collector'>;
export declare function CollectorButton({ inputActions, useInput, t }: CollectorButtonProps): import("react").JSX.Element;
