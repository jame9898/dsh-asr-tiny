/** DSH 0.1.0-rc.x client contracts consumed by the browser half. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { zh } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'voice.collector': keyof typeof zh;
    }
    interface SlotMap {
        /**
         * Plugin-manager settings card rendered on this bundle's detail page
         * (DSH 0.2 settings surface; root-scoped, keyed by bundle name).
         */
        'plugins.bundle.config': {
            kind: 'list';
            scope: 'root';
        };
    }
}
export type Context = ClientContext;
