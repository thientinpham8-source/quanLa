import { db } from '../db.js?v=1.0.59';
import { store } from '../store.js?v=1.0.59';
import { icon, toast, setTitle } from '../ui.js';
import { esc } from '../utils.js';
import { billPrintHTML, printHTML } from '../bill.js?v=1.0.40';

let el, draft;

function render() {
  const p = draft;
  el.innerHTML = `<div class="page-head"><h1>Máy in</h1></div>
    <p class="small muted mb">Cấu hình in hóa đơn và phiếu bếp cho máy in nhiệt 80mm.</p>
    <div class="settings-grid">
      <div class="card card-pad stack">
        <h3>${icon('receipt')} Khổ giấy</h3>
        <label class="field"><span>Khổ giấy in</span><select class="input" data-k="paperSize">
          <option value="58mm" ${p.paperSize === '58mm' ? 'selected' : ''}>58mm · Máy in hóa đơn nhỏ</option>
          <option value="80mm" ${p.paperSize !== 'a4' && p.paperSize !== '58mm' ? 'selected' : ''}>80mm · Máy in hóa đơn nhiệt</option>
          <option value="a4" ${p.paperSize === 'a4' ? 'selected' : ''}>A4 · Máy in văn phòng</option>
        </select></label>
        <div class="xs muted">Thiết lập này điều chỉnh kích thước nội dung. Nếu hộp thoại in vẫn chọn khổ khác, hãy chọn đúng khổ giấy trong trình điều khiển máy in.</div>
      </div>
      <div class="card card-pad stack">
        <h3>${icon('print')} Kết nối máy in</h3>
        <div class="xs muted">Máy in nhiệt kết nối với máy tính qua USB hoặc cáp mạng sẽ được chọn trong hộp thoại in. Hãy cài driver và chọn đúng khổ giấy trong thiết lập máy in của máy tính.</div>
      </div>
      <div class="card card-pad stack">
        <h3>${icon('print')} Tự động in</h3>
        <div class="row-between"><span><b>Tự in hóa đơn</b><div class="xs muted">Sau khi Thu ngân hoàn tất thanh toán</div></span><label class="switch"><input type="checkbox" data-k="autoBill" ${p.autoBill ? 'checked' : ''}><span></span></label></div>
        <div class="row-between"><span><b>Tự in phiếu bếp</b><div class="xs muted">Khi Order gửi món; thiết bị cần kết nối máy in</div></span><label class="switch"><input type="checkbox" data-k="autoKitchen" ${p.autoKitchen ? 'checked' : ''}><span></span></label></div>
      </div>
      <div class="card card-pad stack">
        <h3>${icon('receipt')} Nội dung hóa đơn</h3>
        <div class="row-between"><span><b>In mã QR thanh toán</b><div class="xs muted">Hiện QR trên hóa đơn chuyển khoản</div></span><label class="switch"><input type="checkbox" data-k="showQR" ${p.showQR ? 'checked' : ''}><span></span></label></div>
        <div class="row-between"><span><b>Hiện dòng tạm tính trên bill in</b><div class="xs muted">Bật/tắt dòng tạm tính trên phiếu tính tiền và hóa đơn</div></span><label class="switch"><input type="checkbox" data-k="showSubtotal" ${p.showSubtotal !== false ? 'checked' : ''}><span></span></label></div>
        <label class="field"><span>Lời cảm ơn cuối hóa đơn</span><input class="input" data-k="footer" value="${esc(p.footer || '')}"></label>
        <div class="row wrap"><button class="btn" data-a="test">${icon('print')} In thử</button><button class="btn btn-primary" data-a="save">${icon('check')} Lưu cài đặt máy in</button></div>
      </div>
    </div>`;
}

export default {
  async mount(root) {
    el = root;
    draft = { autoBill: false, autoKitchen: false, showQR: true, footer: '', paperSize: '80mm', connection: 'system', ...(store.settings.print || {}) };
    setTitle('Máy in');
    render();
    const onChange = e => {
      const t = e.target;
      if (t.dataset.k) draft[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
    };
    const onClick = async e => {
      const t = e.target.closest('[data-a]');
      if (!t) return;
      if (t.dataset.a === 'save') {
        await db.update('settings', 'main', { print: { ...draft } });
        toast('Đã lưu cài đặt máy in');
      } else if (t.dataset.a === 'test') {
        const original = store.settings.print;
        store.settings.print = { ...draft };
        document.documentElement.style.setProperty('--print-page-size', draft.paperSize === 'a4' ? '210mm 297mm' : `${draft.paperSize || '80mm'} auto`);
        try {
          await printHTML(billPrintHTML({ tableName: 'Bàn thử', code: 'IN-THU', openedAt: Date.now() - 1800000, closedAt: Date.now(), closedBy: store.user.name,
            items: [{ menuId: 'test-1', name: 'Món kiểm tra máy in', price: 45000, qty: 1 }], pay: { method: 'cash', received: 50000, cash: 50000 } }));
        } finally {
          store.settings.print = original;
          document.documentElement.style.removeProperty('--print-page-size');
        }
      }
    };
    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);
    return () => { el.removeEventListener('change', onChange); el.removeEventListener('click', onClick); };
  },
};
