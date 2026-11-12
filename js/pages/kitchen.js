// ===== K01 – Phiếu bếp =====
import { store } from '../store.js?v=1.0.59';
import { advanceKitchenTicket } from '../actions.js?v=1.0.59';
import { esc, fmtTime } from '../utils.js';
import { icon, setTitle, toast } from '../ui.js';

let el;
const busy = new Set();
let activeStatus = 'waiting';
let expandedTicketId = null;
const LANES = [
  { status: 'waiting', title: 'Chờ làm', next: 'preparing', action: 'Bắt đầu làm' },
  { status: 'preparing', title: 'Đang làm', next: 'ready', action: 'Đã đủ món' },
  { status: 'ready', title: 'Đã đủ món' },
];

const normalizeDishName = name => String(name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

function duplicateTicketCounts(tickets) {
  const ticketsByName = new Map();
  for (const ticket of tickets) {
    const seen = new Set();
    for (const item of ticket.items || []) {
      if (item.void || !item.name) continue;
      const name = normalizeDishName(item.name);
      if (seen.has(name)) continue;
      seen.add(name);
      const ticketIds = ticketsByName.get(name) || new Set();
      ticketIds.add(ticket.id);
      ticketsByName.set(name, ticketIds);
    }
  }
  return new Map([...ticketsByName].filter(([, ticketIds]) => ticketIds.size > 1).map(([name, ticketIds]) => [name, ticketIds.size]));
}

function ticketHTML(ticket, action, duplicates) {
  const expanded = expandedTicketId === ticket.id;
  const itemCount = ticket.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  return `<article class="card kitchen-ticket is-${ticket.status} ${expanded ? 'is-expanded' : 'is-collapsed'}">
    <button type="button" class="kitchen-ticket-head" data-ticket-toggle="${ticket.id}" aria-expanded="${expanded}">
      <h2>${esc(ticket.tableName)}</h2><span class="pill">${itemCount} món</span>
    </button>
    ${expanded ? `<div class="kitchen-ticket-details">
      <div class="kitchen-ticket-meta">${ticket.kind === 'additional' ? 'Gọi thêm' : `Lần ${ticket.round}`} · ${fmtTime(ticket.createdAt)}</div>
      <div class="kitchen-ticket-items">${ticket.items.map(item => {
        const nameKey = normalizeDishName(item.name);
        const duplicateCount = item.void ? 0 : duplicates.get(nameKey) || 0;
        return `<div class="kitchen-ticket-item ${item.void ? 'void' : ''} ${duplicateCount ? 'is-duplicate' : ''}">
          <b>${Number(item.qty) || 0}×</b>
          <span>${esc(item.name)}${item.note ? `<small>${esc(item.note)}</small>` : ''}${duplicateCount ? `<small class="kitchen-duplicate">Có ở ${duplicateCount} phiếu</small>` : ''}${item.void ? `<small class="text-danger">Đã hủy${item.voidReason ? ` · ${esc(item.voidReason)}` : ''}</small>` : ''}</span>
        </div>`;
      }).join('')}</div>
      ${action ? `<footer class="kitchen-ticket-foot">
        <button class="btn ${ticket.status === 'preparing' ? 'btn-primary' : 'btn-accent'} btn-block" data-ticket-next="${action.next}" data-ticket-id="${ticket.id}" ${busy.has(ticket.id) ? 'disabled' : ''}>
          ${icon(ticket.status === 'preparing' ? 'check' : 'chef')} ${busy.has(ticket.id) ? 'Đang cập nhật…' : action.action}
        </button>
      </footer>` : ''}
    </div>` : ''}
  </article>`;
}

function render() {
  if (!el) return;
  const tickets = store.kitchenTickets;
  const loaded = store.loaded.has('kitchenTickets');
  const duplicates = duplicateTicketCounts(tickets);
  const counts = Object.fromEntries(LANES.map(lane => [
    lane.status,
    tickets.filter(ticket => ticket.status === lane.status).length,
  ]));
  const lane = LANES.find(item => item.status === activeStatus) || LANES[0];
  const items = tickets.filter(ticket => ticket.status === lane.status);
  el.innerHTML = `<div class="kitchen-page">
    <div class="page-head"><div><h1>Phiếu bếp</h1><p class="muted small">Đơn mới sẽ tự động xuất hiện tại đây.</p></div><span class="pill">${tickets.length} phiếu</span></div>
    <div class="kitchen-tabs" role="group" aria-label="Trạng thái phiếu bếp">
      ${LANES.map(item => `<button type="button" class="kitchen-tab" data-kitchen-status="${item.status}" aria-pressed="${activeStatus === item.status}">
        <span>${item.title}</span><span class="kitchen-tab-count">${loaded ? counts[item.status] : '–'}</span>
      </button>`).join('')}
    </div>
    <section class="kitchen-tab-panel ${items.length > 1 ? 'has-multiple' : ''}">
      ${!loaded ? '<div class="kitchen-lane-empty">Đang tải phiếu…</div>' : items.length ? items.map(ticket => ticketHTML(ticket, lane.next ? lane : null, duplicates)).join('') : '<div class="kitchen-lane-empty">Không có phiếu</div>'}
    </section>
  </div>`;
}

export default {
  async mount(root) {
    el = root;
    setTitle('Phiếu bếp');
    render();
    const onClick = async event => {
      const tab = event.target.closest('[data-kitchen-status]');
      if (tab) {
        activeStatus = tab.dataset.kitchenStatus;
        expandedTicketId = null;
        render();
        return;
      }
      const ticket = event.target.closest('[data-ticket-toggle]');
      if (ticket) {
        expandedTicketId = expandedTicketId === ticket.dataset.ticketToggle ? null : ticket.dataset.ticketToggle;
        render();
        return;
      }
      const button = event.target.closest('[data-ticket-next]');
      if (!button || busy.has(button.dataset.ticketId)) return;
      const { ticketId, ticketNext } = button.dataset;
      busy.add(ticketId);
      render();
      try {
        await advanceKitchenTicket(ticketId, ticketNext, store.user.name);
        toast(ticketNext === 'ready' ? 'Đã báo đủ món' : 'Đã bắt đầu làm món');
      } catch (error) {
        toast(error.message || 'Không thể cập nhật phiếu bếp', 'err');
      } finally {
        busy.delete(ticketId);
        render();
      }
    };
    el.addEventListener('click', onClick);
    return () => { el.removeEventListener('click', onClick); el = null; busy.clear(); };
  },
  update(keys) { if (keys.has('kitchenTickets')) render(); },
};
