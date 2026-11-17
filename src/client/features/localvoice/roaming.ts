import type { Ctx } from '../../core/context';
import type { Parts } from '../../core/parts';
import { store } from '../../state';
import type { Worker } from '../../world/character';
import { Vector3, type Object3D } from 'three';

type Walk = { model: Worker; seat: Vector3; yaw: number; parent: Object3D; scale: Vector3; path: [number, number][]; next: number; wait: number };
export class Roaming {
  private walks = new Map<string, Walk>();
  constructor(private ctx: Ctx, private parts: Pick<Parts, 'views'>) {}
  private sit(w: Walk) {
    if (w.model.root.parent !== this.ctx.scene) return;
    w.parent.add(w.model.root); w.model.root.position.copy(w.seat); w.model.root.scale.copy(w.scale); w.model.root.rotation.set(0, w.yaw, 0); w.model.walking = false;
  }
  reset() {
    for (const w of this.walks.values()) this.sit(w);
    this.walks.clear();
  }
  tick(dt: number, active: boolean, near?: string, conversations: ReadonlySet<string> = new Set()) {
    const { ctx, parts } = this;
    if (!active || !ctx.inOffice() || ctx.upTop() || ctx.trip() || ctx.reduceMotion.matches) { this.reset(); return; }
    for (const [id, w] of this.walks) {
      const info = store.workers.get(id), view = parts.views.workerViews.get(id);
      if (!info || view?.model !== w.model || w.model.root.parent !== ctx.scene) { this.walks.delete(id); continue; }
      if ((!['idle', 'done'].includes(info.status) && !conversations.has(id)) || info.meeting) {
        this.sit(w); this.walks.delete(id); continue;
      }
      if (conversations.has(id) || id === near || w.model.root.position.distanceTo(ctx.player.pos) < 2.4) { w.model.walking = false; continue; }
      if ((w.wait -= dt) > 0) { w.model.walking = false; continue; }
      if (w.next >= w.path.length) { w.path.reverse(); w.next = 0; w.wait = 4 + Math.random() * 8; w.model.walking = false; continue; }
      const [x, z] = w.path[w.next], pos = w.model.root.position;
      const dx = x - pos.x, dz = z - pos.z, distance = Math.hypot(dx, dz), step = Math.min(distance, dt * 1.05);
      if (distance < 0.08) { w.next++; continue; }
      pos.x += dx / distance * step; pos.z += dz / distance * step; pos.y = -0.07;
      w.model.root.rotation.y = Math.atan2(dx, dz); w.model.walking = true;
    }
    for (const [id, view] of parts.views.workerViews) {
      const info = store.workers.get(id);
      if (!info || info.meeting || !['idle', 'done'].includes(info.status) || this.walks.has(id) || view.model.walking) continue;
      const seat = ctx.plan().byId.get(view.deskId);
      if (!seat || seat.station || seat.room) continue;
      // The existing navigation route avoids desks and walls. Remain on the office's ground floor.
      const way = ctx.world().ways.in(seat);
      if (way.length < 4) continue;
      const path = way.slice(-Math.min(8, way.length)).reverse();
      const root = view.model.root;
      if (!root.parent) continue;
      const w: Walk = { model: view.model, seat: root.position.clone(), yaw: root.rotation.y, scale: root.scale.clone(), parent: root.parent, path, next: 0, wait: 5 + Math.random() * 8 };
      ctx.scene.attach(root);
      this.walks.set(id, w);
    }
  }
}
