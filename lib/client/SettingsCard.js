import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DEFAULT_ASR_BASE } from "../config.js";
import { readAsrBase, writeAsrBase } from "./prefs.js";
import css from './SettingsCard.module.css';
/** Plugin settings card: where the browser half reaches the local ASR service. */
export function SettingsCard({ t }) {
    const [value, setValue] = useState(readAsrBase());
    const [saved, setSaved] = useState(false);
    const save = () => {
        writeAsrBase(value);
        setValue(readAsrBase());
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };
    return (_jsxs("div", { className: css.card, children: [_jsx("label", { className: css.label, htmlFor: "dsh-asr-tiny-asr-base", children: t('settingsAsrBase') }), _jsxs("div", { className: css.row, children: [_jsx("input", { id: "dsh-asr-tiny-asr-base", className: css.input, value: value, placeholder: DEFAULT_ASR_BASE, spellCheck: false, onChange: (event) => setValue(event.target.value) }), _jsx("button", { type: "button", className: css.save, onClick: save, children: t('settingsSave') })] }), _jsx("p", { className: css.hint, children: saved ? t('settingsSaved') : t('settingsHint') })] }));
}
