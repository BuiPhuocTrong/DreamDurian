import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy, 
  serverTimestamp,
  onSnapshotsInSync
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './lib/firebase';
import { 
  Sprout, 
  Syringe, 
  ClipboardList, 
  Home, 
  Camera, 
  LogOut, 
  Plus, 
  Search,
  ChevronRight,
  Info,
  Check,
  Edit2,
  Wallet,
  CircleDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface MedicationEntry {
  id?: string;
  date: string;
  medicineName: string;
  purpose: string;
  quantity: number;
  dosage: string;
  imageUrl: string;
  userId: string;
  createdAt: any;
}

interface TreeStatusEntry {
  id?: string;
  treeCode: string;
  description: string;
  imageUrl: string;
  userId: string;
  createdAt: any;
}

interface FinanceEntry {
  id?: string;
  date: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  inputMode: 'unit' | 'total';
  userId: string;
  createdAt: any;
}

interface InventoryEntry {
  id?: string;
  itemName: string;
  quantity: number;
  userId: string;
  updatedAt: any;
}

// --- Components ---

function LoginView() {
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError('Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng kiểm tra và cho phép bật popup.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Cửa sổ đăng nhập đã bị đóng.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignore, common when multiple clicks happen
      } else {
        setError('Có lỗi khi đăng nhập. Hãy thử lại hoặc mở trong tab mới.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl panel-shadow max-w-md w-full text-center border-t-8 border-secondary"
      >
        <div className="mb-6 flex justify-center">
          <div className="bg-secondary/20 p-4 rounded-full">
            <Sprout size={48} className="text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-dark mb-2 uppercase tracking-tight">Dream Durians</h1>
        <p className="text-primary font-bold mb-8">Quản lý vườn sầu riêng chuyên nghiệp.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold leading-relaxed animate-in fade-in slide-in-from-top-2">
            ⚠️ {error}
            <p className="mt-2 text-dark opacity-70">Mẹo: Nếu vẫn lỗi, hãy thử "Mở trong tab mới" (Open in new tab).</p>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 btn-vibrant py-4 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoggingIn ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin"></div>
              Đang kết nối...
            </span>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebase/builtins/external/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Đăng nhập với Google
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

function MedicationForm({ onNavigate, onSuccess, user }: { onNavigate: (tab: string) => void, onSuccess: () => void, user: User }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 16),
    medicineName: '',
    purpose: '',
    quantity: 1,
    dosage: '',
    image: ''
  });
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [invLoading, setInvLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryEntry));
        setInventory(list);
      } catch (err) {
        console.error(err);
      } finally {
        setInvLoading(false);
      }
    };
    fetchInventory();
  }, [user.uid]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const selectedInv = inventory.find(i => i.itemName === formData.medicineName);
    const usedQty = Number(formData.quantity);
    
    if (!selectedInv || Number(selectedInv.quantity) < usedQty) {
      alert('Số lượng tồn kho không đủ để thực hiện!');
      return;
    }

    setLoading(true);
    try {
      // 1. Save Medication Log
      await addDoc(collection(db, 'medications'), {
        ...formData,
        quantity: usedQty,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        imageUrl: formData.image
      });

      // 2. Update/Delete Inventory
      const invRef = doc(db, 'inventory', selectedInv.id!);
      const newQuantity = Number(selectedInv.quantity) - usedQty;

      if (newQuantity <= 0) {
        await deleteDoc(invRef);
      } else {
        await updateDoc(invRef, {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
      }

      onSuccess();
      onNavigate('home');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const currentStock = inventory.find(i => i.itemName === formData.medicineName)?.quantity || 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="bg-white rounded-3xl p-6 panel-shadow border border-secondary">
        <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-primary to-dark -mx-6 -mt-6 p-5 rounded-t-3xl text-white">
          <h2 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
            <Syringe size={20} />
            Bón phân / Thuốc
          </h2>
          <span className="bg-white/20 p-1.5 rounded-lg"><Plus size={16} /></span>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Ngày giờ thực hiện</label>
            <input 
              type="datetime-local" 
              required
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Tên loại thuốc / Phân bón</label>
            {invLoading ? (
              <div className="p-4 text-sm text-primary animate-pulse font-bold">Đang tải danh sách tồn kho...</div>
            ) : inventory.length === 0 ? (
              <div className="p-4 bg-red-50 text-red-500 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2 leading-tight">
                <Info size={16} /> Bạn chưa có thuốc trong kho. Vui lòng nhập từ "Thu Chi" trước.
              </div>
            ) : (
              <select 
                required
                className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all bg-white font-bold text-base appearance-none"
                value={formData.medicineName}
                onChange={e => setFormData(prev => ({ ...prev, medicineName: e.target.value }))}
              >
                <option value="">-- Chọn thuốc có sẵn trong kho --</option>
                {inventory.map(item => (
                  <option key={item.id} value={item.itemName} disabled={item.quantity <= 0}>
                    {item.itemName} (Còn {item.quantity})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Mục đích sử dụng</label>
            <textarea 
              placeholder="VD: Xử lý rầy, trị thối rễ..."
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all h-28 text-base bg-white"
              value={formData.purpose}
              onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
            />
          </div>

          <div className="form-group font-sans">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Số lượng chai / bao đã dùng</label>
            <div className="relative">
              <input 
                type="number" 
                min="1"
                max={currentStock}
                required
                disabled={!formData.medicineName}
                className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all disabled:bg-gray-50 text-base bg-white"
                value={formData.quantity}
                onChange={e => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
              />
              {formData.medicineName && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary italic bg-white/80 px-1 rounded">
                  Còn lại: {currentStock - formData.quantity} / Tồn: {currentStock}
                </span>
              )}
            </div>
          </div>

          <div className="form-group font-sans">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Cách pha thuốc (Tùy chọn)</label>
            <input 
              type="text" 
              placeholder="VD: Pha 400L nước"
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
              value={formData.dosage}
              onChange={e => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Hình ảnh bao bì</label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary rounded-xl cursor-pointer bg-[#F4F6F0] hover:bg-[#EAEEDF] transition-all text-primary gap-1">
                  <Camera size={24} />
                  <span className="text-xs font-bold">📷 Chụp hoặc Chọn ảnh</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {formData.image && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shadow-inner border border-[#EAEAEA] flex-shrink-0">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-vibrant py-4 mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'LƯU THÔNG TIN'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function TreeStatusForm({ onNavigate, onSuccess, user }: { onNavigate: (tab: string) => void, onSuccess: () => void, user: User }) {
  const [formData, setFormData] = useState({
    treeCode: '',
    description: '',
    image: '',
  });
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'tree_statuses'), {
        ...formData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        imageUrl: formData.image
      });
      onSuccess();
      onNavigate('home');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="bg-white rounded-3xl p-6 panel-shadow border border-secondary">
        <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-primary to-dark -mx-6 -mt-6 p-5 rounded-t-3xl text-white">
          <h2 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
            <Sprout size={20} />
            Tình trạng cây
          </h2>
          <span className="bg-white/20 p-1.5 rounded-lg"><Plus size={16} /></span>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Mã số cây (Bắt buộc)</label>
            <input 
              type="text" 
              required
              placeholder="VD: Gốc số 42, Hàng 3..."
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
              value={formData.treeCode}
              onChange={e => setFormData(prev => ({ ...prev, treeCode: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Mô tả thêm (Tùy chọn)</label>
            <textarea 
              placeholder="VD: Cây có hiện tượng cháy lá..."
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all h-36 text-base bg-white"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Hình thực tế</label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary rounded-xl cursor-pointer bg-[#F4F6F0] hover:bg-[#EAEEDF] transition-all text-primary gap-1">
                  <Camera size={24} />
                  <span className="text-xs font-bold">📷 Chụp hoặc Chọn ảnh</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {formData.image && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shadow-inner border border-[#EAEAEA] flex-shrink-0">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-vibrant py-4 mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'GHI NHẬN'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function FinanceForm({ onNavigate, onSuccess, user }: { onNavigate: (tab: string) => void, onSuccess: () => void, user: User }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 16),
    itemName: '',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    inputMode: 'unit' as 'unit' | 'total'
  });
  const [loading, setLoading] = useState(false);
  const [inventoryNames, setInventoryNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchInventoryNames = async () => {
      try {
        const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setInventoryNames(snap.docs.map(doc => doc.data().itemName));
      } catch (err) {
        console.error(err);
      }
    };
    fetchInventoryNames();
  }, [user.uid]);

  useEffect(() => {
    if (formData.inputMode === 'unit') {
      setFormData(prev => ({ ...prev, totalPrice: prev.quantity * prev.unitPrice }));
    }
  }, [formData.quantity, formData.unitPrice, formData.inputMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const itemName = formData.itemName.trim();
      
      // 1. Save Finance Log
      await addDoc(collection(db, 'finances'), {
        ...formData,
        itemName,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Sync with Inventory
      const q = query(
        collection(db, 'inventory'), 
        where('userId', '==', user.uid),
        where('itemName', '==', itemName)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Update existing
        const invDoc = snap.docs[0];
        const existingData = invDoc.data() as InventoryEntry;
        await updateDoc(doc(db, 'inventory', invDoc.id), {
          quantity: Number(existingData.quantity) + Number(formData.quantity),
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        await addDoc(collection(db, 'inventory'), {
          itemName: itemName,
          quantity: Number(formData.quantity),
          userId: user.uid,
          updatedAt: serverTimestamp()
        });
      }

      onSuccess();
      onNavigate('home');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="bg-white rounded-3xl p-6 panel-shadow border border-secondary">
        <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-primary to-dark -mx-6 -mt-6 p-5 rounded-t-3xl text-white">
          <h2 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
            <Wallet size={20} />
            Quản lý Thu Chi
          </h2>
          <span className="bg-white/20 p-1.5 rounded-lg"><CircleDollarSign size={16} /></span>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Ngày tháng năm</label>
            <input 
              type="datetime-local" 
              required
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Tên loại thuốc / Hạng mục</label>
            <input 
              type="text" 
              required
              list="inventory-items"
              placeholder="VD: Thuốc sâu, Phân bón NPK..."
              className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
              value={formData.itemName}
              onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
            />
            <datalist id="inventory-items">
              {inventoryNames.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group text-dark">
              <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Số lượng</label>
              <input 
                type="number" 
                min="1"
                required
                className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all text-base bg-white"
                value={formData.quantity}
                onChange={e => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Cách nhập giá</label>
              <select 
                className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all bg-white text-base appearance-none font-bold"
                value={formData.inputMode}
                onChange={e => setFormData(prev => ({ ...prev, inputMode: e.target.value as 'unit' | 'total' }))}
              >
                <option value="unit">Theo đơn giá</option>
                <option value="total">Theo tổng tiền</option>
              </select>
            </div>
          </div>

          {formData.inputMode === 'unit' ? (
            <div className="form-group animate-in fade-in slide-in-from-top-1">
              <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Đơn giá mỗi chai/bao</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  required
                  className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all pr-12 text-base bg-white"
                  value={formData.unitPrice || ''}
                  onChange={e => setFormData(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#AAA]">VNĐ</span>
              </div>
              <p className="mt-2 text-[10px] font-bold text-primary italic">Tổng tiền tính được: {formatCurrency(formData.totalPrice)}</p>
            </div>
          ) : (
            <div className="form-group animate-in fade-in slide-in-from-top-1">
              <label className="block text-xs font-bold text-dark mb-1.5 uppercase tracking-wider">Tổng tiền cả lô</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0"
                  required
                  className="w-full p-4 rounded-xl border-2 border-[#EAEAEA] focus:border-primary outline-none transition-all pr-12 text-base bg-white"
                  value={formData.totalPrice || ''}
                  onChange={e => setFormData(prev => ({ ...prev, totalPrice: Number(e.target.value) }))}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#AAA]">VNĐ</span>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-vibrant py-4 mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'LƯU THU CHI'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function InventoryView({ user }: { user: User }) {
  const [items, setItems] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshotsInSync(db, () => {
      getDocs(q).then(snap => {
        setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryEntry)));
        setLoading(false);
      });
    });
    
    // Initial fetch
    getDocs(q).then(snap => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryEntry)));
      setLoading(false);
    });

    return () => {}; // onSnapshotsInSync doesn't return an unregister in this version easily 
  }, [user.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-3xl p-5 panel-shadow border border-secondary">
        <div className="flex justify-between items-center mb-6 bg-secondary p-4 rounded-xl text-dark">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-primary" />
            <span className="font-bold text-sm uppercase tracking-wider">Kho vật tư hiện tại</span>
          </div>
          <span className="text-[10px] bg-dark/5 px-2 py-1 rounded font-bold">Tổng loại: {items.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-primary font-bold animate-pulse">Đang kiểm kê kho...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-[#F9F9F9] rounded-2xl border-2 border-dashed border-[#EEE]">
            <Info size={40} className="mx-auto text-[#CCC] mb-4" />
            <p className="text-sm text-[#888] font-medium leading-relaxed italic px-8">
              Kho của bạn đang trống.<br/>Vật tư sẽ tự động xuất hiện khi bạn thêm giao dịch ở mục <span className="text-primary font-bold">"Thu Chi"</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {items.map(item => (
              <div 
                key={item.id} 
                className="p-4 bg-[#FDFDFD] border border-secondary/30 rounded-2xl flex items-center justify-between group hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Syringe size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-dark text-sm uppercase mb-0.5">{item.itemName}</h4>
                    <p className="text-[10px] text-[#888] font-bold">Cập nhật: {item.updatedAt?.toDate().toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-black ${item.quantity > 5 ? 'text-primary' : item.quantity > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                    {item.quantity}
                  </div>
                  <div className="text-[9px] font-extrabold uppercase text-[#AAA] tracking-widest mt-[-2px]">Còn lại</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LogsView({ user }: { user: User }) {
  const [view, setView] = useState<'meds' | 'trees' | 'finances' | 'inventory'>('meds');
  const [medLogs, setMedLogs] = useState<MedicationEntry[]>([]);
  const [treeLogs, setTreeLogs] = useState<TreeStatusEntry[]>([]);
  const [financeLogs, setFinanceLogs] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const medQ = query(
          collection(db, 'medications'), 
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const treeQ = query(
          collection(db, 'tree_statuses'), 
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const financeQ = query(
          collection(db, 'finances'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const [medSnap, treeSnap, financeSnap] = await Promise.all([
          getDocs(medQ), 
          getDocs(treeQ),
          getDocs(financeQ)
        ]);
        
        setMedLogs(medSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicationEntry)));
        setTreeLogs(treeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TreeStatusEntry)));
        setFinanceLogs(financeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceEntry)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-3xl p-5 panel-shadow border border-secondary">
        <div className="flex justify-between items-center mb-4 bg-secondary p-3 rounded-xl text-dark">
          <span className="font-bold text-sm uppercase tracking-wider">Khám phá lịch sử</span>
          <span className="text-[10px] bg-dark/5 px-2 py-1 rounded font-bold">Tổng: {medLogs.length + treeLogs.length + financeLogs.length}</span>
        </div>
        
        <div className="flex bg-[#EEE] p-1 rounded-full gap-1 mb-6">
          <button 
            onClick={() => setView('meds')}
            className={`flex-1 py-2 rounded-full text-[9px] font-bold transition-all ${view === 'meds' ? 'bg-white text-dark shadow-sm' : 'text-[#666] hover:text-dark'}`}
          >
            Sử dụng
          </button>
          <button 
            onClick={() => setView('trees')}
            className={`flex-1 py-2 rounded-full text-[9px] font-bold transition-all ${view === 'trees' ? 'bg-white text-dark shadow-sm' : 'text-[#666] hover:text-dark'}`}
          >
            Theo dõi
          </button>
          <button 
            onClick={() => setView('finances')}
            className={`flex-1 py-2 rounded-full text-[9px] font-bold transition-all ${view === 'finances' ? 'bg-white text-dark shadow-sm' : 'text-[#666] hover:text-dark'}`}
          >
            Thu Chi
          </button>
          <button 
            onClick={() => setView('inventory')}
            className={`flex-1 py-2 rounded-full text-[9px] font-bold transition-all ${view === 'inventory' ? 'bg-white text-dark shadow-sm' : 'text-[#666] hover:text-dark'}`}
          >
            Kho
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-primary tracking-wide font-bold animate-pulse">Đang tải dữ liệu...</div>
          ) : (
            <>
              {view === 'inventory' && <InventoryView user={user} />}
              {view === 'meds' && (
                medLogs.length === 0 ? (
                  <div className="text-center py-12 text-[#666] bg-[#FDFDFD] rounded-2xl border border-[#EEE] italic text-sm">Chưa có dữ liệu thuốc.</div>
                ) : (
                  medLogs.map(log => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="bg-[#FDFDFD] rounded-2xl p-4 border border-[#EEE] flex gap-4 relative"
                    >
                      <img 
                        src={log.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23eee'/%3E%3Cpath d='M40 25l15 30H25z' fill='%238A9A5B'/%3E%3C/svg%3E"} 
                        alt={log.medicineName} 
                        className="w-20 h-20 rounded-xl object-cover bg-[#EEE] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 pr-8">
                        <h4 className="font-bold text-dark text-base truncate tracking-tight">{log.medicineName}</h4>
                        <p className="text-[11px] text-[#666] mb-1 line-clamp-1">Mục đích: {log.purpose || 'Bảo vệ cây'}</p>
                        <p className="text-[11px] text-dark font-bold">Lượng dùng: {log.quantity} chai/bao</p>
                        {log.dosage && <p className="text-[11px] text-[#666]"><b>Cách pha:</b> {log.dosage}</p>}
                        <div className="inline-block px-2 py-1 bg-[#E8F5E9] text-[#2E7D32] rounded-md text-[9px] font-extrabold mt-2 uppercase tracking-widest">
                          ĐÃ HOÀN THÀNH
                        </div>
                      </div>
                      <span className="absolute top-4 right-4 text-[10px] font-bold text-primary bg-[#F0F4E8] px-2 py-1 rounded">
                        {new Date(log.date).toLocaleDateString('vi-VN')}
                      </span>
                    </motion.div>
                  ))
                )
              )}

              {view === 'trees' && (
                treeLogs.length === 0 ? (
                  <div className="text-center py-12 text-[#666] bg-[#FDFDFD] rounded-2xl border border-[#EEE] italic text-sm">Chưa có dữ liệu cây.</div>
                ) : (
                  treeLogs.map(log => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="bg-[#FDFDFD] rounded-2xl p-4 border border-[#EEE] flex gap-4 relative"
                    >
                      <img 
                        src={log.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23eee'/%3E%3Ccircle cx='40' cy='40' r='20' fill='%23F9E076'/%3E%3C/svg%3E"} 
                        alt={log.treeCode} 
                        className="w-20 h-20 rounded-xl object-cover bg-[#EEE] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 pr-8">
                        <h4 className="font-bold text-dark text-base truncate tracking-tight">{log.treeCode}</h4>
                        <p className="text-[11px] text-dark/70 mt-1 line-clamp-2 leading-relaxed">{log.description}</p>
                        <div className="inline-block px-2 py-1 bg-secondary text-dark rounded-md text-[9px] font-extrabold mt-2 uppercase tracking-widest">
                          LƯU TRỮ VĨNH VIỄN
                        </div>
                      </div>
                      <span className="absolute top-4 right-4 text-[10px] font-bold text-primary bg-[#F0F4E8] px-2 py-1 rounded">
                        {log.createdAt?.toDate().toLocaleDateString('vi-VN') || 'Mới'}
                      </span>
                    </motion.div>
                  ))
                )
              )}

              {view === 'finances' && (
                financeLogs.length === 0 ? (
                  <div className="text-center py-12 text-[#666] bg-[#FDFDFD] rounded-2xl border border-[#EEE] italic text-sm">Chưa có dữ liệu thu chi.</div>
                ) : (
                  financeLogs.map(log => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="bg-[#FDFDFD] rounded-2xl p-4 border border-[#EEE] flex gap-4 relative"
                    >
                      <div className="w-20 h-20 rounded-xl bg-secondary/20 flex items-center justify-center text-primary flex-shrink-0 border border-secondary/30">
                        <Wallet size={32} />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h4 className="font-bold text-dark text-base truncate tracking-tight">{log.itemName}</h4>
                        <p className="text-[11px] text-[#666] mb-1">Số lượng: {log.quantity}</p>
                        <p className="text-[13px] font-black text-primary">{formatCurrency(log.totalPrice)}</p>
                        <div className="inline-block px-2 py-1 bg-[#E3F2FD] text-[#1976D2] rounded-md text-[9px] font-extrabold mt-2 uppercase tracking-widest">
                          CHI PHÍ VẬT TƯ
                        </div>
                      </div>
                      <span className="absolute top-4 right-4 text-[10px] font-bold text-primary bg-[#F0F4E8] px-2 py-1 rounded">
                        {new Date(log.date).toLocaleDateString('vi-VN')}
                      </span>
                    </motion.div>
                  ))
                )
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [todayTask, setTodayTask] = useState('Kiểm tra vườn');
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInput, setTaskInput] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      try {
        if (u) {
          setUser(u);
          // Fetch user preferences/profile for todayTask
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.todayTask) setTodayTask(data.todayTask);
          } else {
            // Initialize user doc if it doesn't exist
            await setDoc(doc(db, 'users', u.uid), {
              userId: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Người dùng',
              photoURL: u.photoURL || '',
              todayTask: 'Kiểm tra vườn'
            });
          }
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error("Auth sync error:", err);
        // If it's a permission error, we might still want to show the app but warn
        if (err.code === 'permission-denied') {
          console.warn("Permission denied for user profile. Checking rules...");
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const handleUpdateTask = async () => {
    if (!user || !taskInput) {
      setIsEditingTask(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), { todayTask: taskInput });
      setTodayTask(taskInput);
      setIsEditingTask(false);
    } catch (err) {
      console.error(err);
      alert('Không thể lưu công việc.');
    }
  };

  const [isSignoutConfirming, setIsSignoutConfirming] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const startLogout = () => {
    setIsSignoutConfirming(true);
    // Auto-cancel after 3 seconds if not confirmed
    setTimeout(() => setIsSignoutConfirming(false), 3000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setActiveTab('home');
      setIsSignoutConfirming(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) return <div className="min-h-screen bg-light-bg flex items-center justify-center">Đang tải...</div>;
  if (!user) return <LoginView />;

  const renderContent = () => {
    switch (activeTab) {
      case 'med': return <MedicationForm onNavigate={setActiveTab} onSuccess={triggerToast} user={user} />;
      case 'tree': return <TreeStatusForm onNavigate={setActiveTab} onSuccess={triggerToast} user={user} />;
      case 'finance': return <FinanceForm onNavigate={setActiveTab} onSuccess={triggerToast} user={user} />;
      case 'logs': return <LogsView user={user} />;
      case 'home':
      default:
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary to-dark rounded-3xl p-8 text-white relative overflow-hidden panel-shadow">
              <div className="relative z-10">
                <h2 className="text-2xl font-black mb-1 uppercase tracking-tight italic">Chào, Nhà vườn {user.displayName?.split(' ').pop()}!</h2>
                <p className="opacity-90 text-sm font-medium">Lưu trữ dữ liệu bền vững cho vườn sầu riêng.</p>
                <div className="mt-6 flex gap-4">
                  <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl flex-1 border border-white/20 relative">
                    <p className="text-[10px] uppercase font-black opacity-70 mb-1">Cần làm hôm nay</p>
                    {isEditingTask ? (
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text"
                          className="bg-white/10 border-b border-white outline-none text-sm font-bold w-full"
                          value={taskInput}
                          onChange={e => setTaskInput(e.target.value)}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleUpdateTask()}
                        />
                        <button onClick={handleUpdateTask} className="hover:text-secondary"><Check size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group">
                        <p className="font-bold">{todayTask}</p>
                        <button 
                          onClick={() => { setTaskInput(todayTask); setIsEditingTask(true); }} 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-[-40px] right-[-40px] opacity-20 transform rotate-12 text-[160px]">
                🌿
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveTab('med')}
                className="bg-white p-6 rounded-3xl border border-secondary panel-shadow flex flex-col items-center gap-3 text-dark transition-all active:scale-95"
              >
                <div className="bg-secondary p-4 rounded-full border-2 border-primary">
                  <Syringe size={24} />
                </div>
                <span className="font-black text-[12px] uppercase">Phun Thuốc</span>
              </button>
              <button 
                onClick={() => setActiveTab('tree')}
                className="bg-white p-6 rounded-3xl border border-secondary panel-shadow flex flex-col items-center gap-3 text-dark transition-all active:scale-95"
              >
                <div className="bg-secondary p-4 rounded-full border-2 border-primary text-primary">
                  <Sprout size={24} />
                </div>
                <span className="font-black text-[12px] uppercase">Ghi Nhận Gốc</span>
              </button>
            </div>

            <button 
              onClick={() => setActiveTab('finance')}
              className="w-full bg-white p-6 rounded-3xl border border-secondary panel-shadow flex items-center justify-between transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="bg-secondary p-4 rounded-full border-2 border-primary">
                  <Wallet size={24} className="text-dark" />
                </div>
                <div className="text-left">
                  <p className="font-black text-dark uppercase text-sm tracking-wide">Quản lý Thu Chi</p>
                  <p className="text-[11px] font-bold text-primary italic">Tính toán lợi nhuận vườn</p>
                </div>
              </div>
              <ChevronRight className="text-secondary" />
            </button>

            <button 
              onClick={() => setActiveTab('logs')}
              className="w-full bg-white p-6 rounded-3xl border border-secondary panel-shadow flex items-center justify-between transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-4 rounded-full text-primary">
                  <ClipboardList size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black text-dark uppercase text-sm tracking-wide">Kho & Nhật ký</p>
                  <p className="text-[11px] font-bold text-primary italic">Kiểm kê tồn kho & Lịch sử</p>
                </div>
              </div>
              <ChevronRight className="text-secondary" />
            </button>

            {isSignoutConfirming ? (
              <div className="flex gap-2">
                <button 
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 text-white p-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg animate-pulse"
                >
                  Xác nhận đăng xuất
                </button>
                <button 
                  onClick={() => setIsSignoutConfirming(false)}
                  className="bg-[#EEE] text-dark px-6 rounded-2xl text-xs font-black uppercase"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button 
                onClick={startLogout}
                className="w-full bg-white/50 border-2 border-dashed border-[#DDD] p-4 rounded-2xl flex items-center justify-center gap-2 text-[#888] hover:text-brown hover:border-brown transition-all"
              >
                <LogOut size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Đăng xuất tài khoản</span>
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-light-bg pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] font-sans text-dark relative selection:bg-primary/20">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[100] bg-green-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md"
          >
            <Check size={20} className="bg-white/20 rounded-full p-0.5" />
            <span>Bạn đã lưu thành công</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 bg-white z-40 border-b-2 border-secondary px-8 py-4 flex justify-between items-center panel-shadow">
        <div className="flex items-center gap-3 text-dark">
          <div className="w-10 h-10 bg-secondary border-2 border-primary rounded-full flex items-center justify-center text-xl">
            🌳
          </div>
          <h1 className="text-xl font-black tracking-widest uppercase">
            DREAM <span className="text-primary italic">DURIANS</span>
          </h1>
        </div>
        <button 
          onClick={() => {
            if (activeTab === 'home') {
              startLogout();
            } else {
              if (window.confirm("Bạn có chắc chắn muốn đăng xuất không?")) handleLogout();
            }
          }} 
          className="p-2 text-primary hover:text-brown transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-lg border-t-2 border-secondary px-8 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] flex justify-between items-center shadow-[0_-8px_30px_rgba(0,0,0,0.05)] z-40 transition-all">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'home' ? 'text-primary' : 'text-[#888]'}`}
        >
          <Home size={24} className={activeTab === 'home' ? 'fill-current' : ''} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'home' ? 'opacity-100' : 'opacity-60'}`}>Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('med')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'med' ? 'text-primary' : 'text-[#888]'}`}
        >
          <Syringe size={24} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'med' ? 'opacity-100' : 'opacity-60'}`}>Thuốc</span>
        </button>
        <button 
          onClick={() => setActiveTab('tree')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'tree' ? 'text-primary' : 'text-[#888]'}`}
        >
          <Sprout size={24} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'tree' ? 'opacity-100' : 'opacity-60'}`}>Cây</span>
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'logs' ? 'text-primary' : 'text-[#888]'}`}
        >
          <ClipboardList size={24} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'logs' ? 'opacity-100' : 'opacity-60'}`}>Nhật ký</span>
        </button>
      </nav>
    </div>
  );
}
