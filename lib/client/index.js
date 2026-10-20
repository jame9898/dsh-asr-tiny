import { CollectorButton } from "./CollectorButton.js";
import { SettingsCard } from "./SettingsCard.js";
import { en, zh } from "./locales.js";
export const name = 'dsh-asr-tiny-client';
export const inject = ['slots', 'locale'];
export const LOCALE_NS = 'voice.collector';
/** The bundle this package's client half belongs to (plugin-manager settings key). */
export const BUNDLE_NAME = 'dsh-asr-tiny';
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-asr-tiny: dictionaries');
    ctx.effect(() => {
        return ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
            name: 'conversation.input.left',
            id: 'voice-collector-panel',
            order: 20,
            locale: LOCALE_NS,
            inject: () => ({}),
        }, CollectorButton));
    }, 'dsh-asr-tiny: collector slot');
    ctx.effect(() => {
        return ctx.slots.inject('plugins.bundle.config', () => {
            // DSH 0.2 keys bundle cards by bundle name; the bundled 0.1 slot types
            // predate `key`, so the option object is cast at this single seam.
            const options = {
                name: 'plugins.bundle.config',
                key: BUNDLE_NAME,
                locale: LOCALE_NS,
                inject: () => ({}),
            };
            return ctx.slots.register(options, SettingsCard);
        });
    }, 'dsh-asr-tiny: settings card');
}
