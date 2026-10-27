// Thành tựu. stat: tên bộ đếm trong p.stats (hoặc 'quests' = số nhiệm vụ đã xong, 'regions' = số vùng đã đến), need: mức cần đạt.
// has: giữ vật phẩm trong túi; armor4: mặc đủ 4 món giáp. icon: ký tự hiển thị.
export const ACHIEVEMENTS = [
  { id: 'first-kill', name: 'Máu đầu tiên', desc: 'Hạ 1 quái vật.', icon: '⚔', stat: 'kill', need: 1 },
  { id: 'hunter', name: 'Thợ săn', desc: 'Hạ 50 quái vật.', icon: '🏹', stat: 'kill', need: 50 },
  { id: 'slayer', name: 'Đồ tể bóng đêm', desc: 'Hạ 200 quái vật.', icon: '☠', stat: 'kill', need: 200 },
  { id: 'miner', name: 'Thợ mỏ', desc: 'Đào 100 khối.', icon: '⛏', stat: 'mine', need: 100 },
  { id: 'digger', name: 'Đào sâu', desc: 'Đào 1000 khối.', icon: '⛰', stat: 'mine', need: 1000 },
  { id: 'builder', name: 'Thợ xây', desc: 'Đặt 100 khối.', icon: '🧱', stat: 'place', need: 100 },
  { id: 'crafter', name: 'Đôi tay khéo léo', desc: 'Chế tạo món đồ đầu tiên.', icon: '🔨', stat: 'craft', need: 1 },
  { id: 'master-crafter', name: 'Bậc thầy chế tạo', desc: 'Chế tạo 50 món đồ.', icon: '⚒', stat: 'craft', need: 50 },
  { id: 'farmer', name: 'Nông dân', desc: 'Thu hoạch 10 cây trồng.', icon: '🌾', stat: 'harvest', need: 10 },
  { id: 'foodie', name: 'Sành ăn', desc: 'Ăn 20 lần.', icon: '🍞', stat: 'eat', need: 20 },
  { id: 'helper', name: 'Người giúp việc', desc: 'Hoàn thành 1 nhiệm vụ.', icon: '📜', stat: 'quests', need: 1 },
  { id: 'hero', name: 'Anh hùng làng', desc: 'Hoàn thành 5 nhiệm vụ.', icon: '🏅', stat: 'quests', need: 5 },
  { id: 'explorer', name: 'Nhà thám hiểm', desc: 'Đặt chân đến 4 vùng đất khác nhau.', icon: '🧭', stat: 'regions', need: 4 },
  { id: 'boss-1', name: 'Kẻ hạ gục thủ lĩnh', desc: 'Hạ 1 trùm.', icon: '👑', stat: 'boss', need: 1 },
  { id: 'boss-3', name: 'Khắc tinh của trùm', desc: 'Hạ 3 trùm.', icon: '🔱', stat: 'boss', need: 3 },
  { id: 'dungeon', name: 'Kẻ phá hầm', desc: 'Hạ chủ một hầm ngục.', icon: '🗝', stat: 'dungeon', need: 1 },
  { id: 'gem', name: 'Thợ săn đá quý', desc: 'Sở hữu 1 viên ngọc.', icon: '💎', has: 'gem' },
  { id: 'armored', name: 'Vũ trang đầy đủ', desc: 'Mặc đủ mũ, áo, quần và giày.', icon: '🛡', armor4: true },
  { id: 'fallen', name: 'Ngã một lần', desc: 'Gục ngã lần đầu. Ai cũng có lần đầu.', icon: '💀', stat: 'die', need: 1 },
];
