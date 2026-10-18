import { h } from './dom';

let stack = 0;
export const modalOpen = () => stack > 0;

/** Mở hộp thoại; trả về hàm đóng. */
export function openModal(title: string, body: HTMLElement, actions: HTMLElement[] = [], opts: { wide?: boolean; onClose?: () => void } = {}) {
  const close = () => {
    if (!overlay.isConnected) return;
    overlay.remove();
    stack--;
    document.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const overlay = h(
    'div',
    { class: 'modal-overlay', onmousedown: (e: MouseEvent) => e.target === overlay && close() },
    h(
      'div',
      { class: `modal parchment${opts.wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', title: 'Đóng (Esc)', onclick: close }, '✕')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' }, ...actions) : null,
    ),
  );
  document.body.append(overlay);
  stack++;
  document.addEventListener('keydown', onKey, true);
  const focusable = overlay.querySelector<HTMLElement>('input, textarea, select, button.primary');
  focusable?.focus();
  return close;
}

export function confirmDialog(title: string, message: string, okText = 'Đồng ý', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const ok = h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => ((result = true), close()) }, okText);
    const cancel = h('button', { class: 'btn', onclick: () => close() }, 'Huỷ');
    const close = openModal(title, h('p', { class: 'modal-text' }, message), [cancel, ok], { onClose: () => resolve(result) });
    ok.focus();
  });
}

export function promptPassword(message: string): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    const input = h('input', { type: 'password', class: 'input', autocomplete: 'current-password' });
    const submit = () => {
      result = input.value;
      close();
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    const close = openModal('🔒 Mật khẩu giảng viên', h('div', {}, h('p', { class: 'modal-text' }, message), input), [
      h('button', { class: 'btn', onclick: () => close() }, 'Huỷ'),
      h('button', { class: 'btn primary', onclick: submit }, 'Xác nhận'),
    ], { onClose: () => resolve(result) });
    input.focus();
  });
}

export function toast(message: string, kind: 'info' | 'error' | 'ok' = 'info') {
  let host = document.querySelector<HTMLElement>('.toasts');
  if (!host) {
    host = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const t = h('div', { class: `toast ${kind}` }, message);
  host.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}
