import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { Ctx } from '../../core/context';
import { h, openModal, type Modal } from '../../ui/dom';
import { voiceOccluded } from '../../../shared/local-voice';
import './ui.css';

export function browserUrl(raw: string): string | null {
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** A real web view, projected onto the TV. E opens its interactive browser controls. */
export function tvBrowser(ctx: Ctx) {
  const saved = localStorage.getItem('office-tv-url');
  let url = browserUrl(saved ?? '') ?? `${location.protocol}//${location.hostname}:8081/`;
  const iframe = document.createElement('iframe');
  iframe.title = 'Office TV — podgląd aplikacji';
  iframe.referrerPolicy = 'no-referrer';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
  iframe.src = url;
  const surface = document.createElement('div'); surface.className = 'tv-world-surface'; surface.append(iframe);
  const scene = new THREE.Scene(), object = new CSS3DObject(surface);
  scene.add(object);
  const renderer = new CSS3DRenderer(); renderer.domElement.className = 'tv-world-layer';
  ctx.canvas.after(renderer.domElement);
  let modal: Modal | undefined;
  const center = new THREE.Vector3(), end = new THREE.Vector3(), normal = new THREE.Vector3(), direction = new THREE.Vector3();
  const scale = new THREE.Vector3();
  ctx.ticks.add('render', () => {
    const screen = ctx.office.tvScreen;
    screen.updateWorldMatrix(true, false);
    screen.getWorldPosition(center); screen.getWorldQuaternion(object.quaternion); screen.getWorldScale(scale);
    object.position.copy(center);
    const geometry = screen.geometry as THREE.PlaneGeometry;
    object.scale.set(geometry.parameters.width * scale.x / 1280, geometry.parameters.height * scale.y / 720, 1);
    normal.set(0, 0, 1).applyQuaternion(object.quaternion);
    direction.copy(ctx.camera.position).sub(center);
    end.copy(center).addScaledVector(normal, 0.25);
    const visible = !modal && ctx.inOffice() && !ctx.trip() && direction.dot(normal) > 0 &&
      !voiceOccluded(ctx.camera.position, end, ctx.world().colliders);
    renderer.domElement.style.display = visible ? '' : 'none';
    if (!visible) return;
    renderer.setSize(innerWidth, innerHeight); renderer.render(scene, ctx.camera);
  });
  function open() {
    if (modal) return;
    const address = h('input', { value: url, 'aria-label': 'Adres strony', spellcheck: 'false' }) as HTMLInputElement;
    const note = h('p.tv-note', {}, 'Podgląd webowy. Jeśli strona blokuje osadzanie, otwórz ją w nowej karcie.');
    const go = () => {
      const next = browserUrl(address.value);
      if (!next) { note.textContent = 'Podaj poprawny adres http:// lub https://.'; return; }
      url = next; address.value = url; localStorage.setItem('office-tv-url', url); iframe.src = url;
    };
    const form = h('form.tv-address', {}, address, h('button.btn.primary', { type: 'submit' }, 'Otwórz'));
    form.onsubmit = (e) => { e.preventDefault(); go(); };
    const viewport = h('div.tv-viewport', {}, iframe);
    const el = h('div.modal.tv-browser', { role: 'dialog', 'aria-label': 'Office TV — przeglądarka' },
      h('header', {}, h('h2', {}, 'Office TV · przeglądarka')),
      form,
      h('div.tv-tools', {},
        h('button.btn', { onclick: () => { iframe.src = url; } }, 'Odśwież'),
        h('button.btn', { onclick: () => viewport.classList.toggle('phone') }, 'Telefon / komputer'),
        h('button.btn', { onclick: () => { address.value = `${location.protocol}//${location.hostname}:8081/`; go(); } }, 'SOBR'),
        h('button.btn', { onclick: () => window.open(url, '_blank', 'noopener,noreferrer') }, 'Nowa karta')),
      viewport, note);
    modal = openModal(el, { onClose: () => { surface.append(iframe); modal = undefined; } });
  }
  window.addEventListener('pagehide', () => { renderer.domElement.remove(); iframe.src = 'about:blank'; });
  return { open };
}
